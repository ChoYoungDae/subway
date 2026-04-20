import { cleanStationName } from '../utils/textUtils.js';
import { fetchODSaySubwayPath, fetchODSaySearchStation } from '../api/seoulApi.js';
import { supabase } from '../../lib/supabase.js';

// 우리 엘리베이터 DB가 커버하는 호선 목록.
// 이 목록에 없는 호선으로 환승하는 경로는 건너뜁니다.
const SUPPORTED_LINES = new Set([
    '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', '공항철도'
]);

// ODSay 경로 결과를 DB에 캐시할지 여부.
// 초기 테스트 시에는 false로 두고, 동작 확인 후 true로 변경하세요.
// Supabase에 odsay_route_cache 테이블이 필요합니다:
//   CREATE TABLE odsay_route_cache (
//     id SERIAL PRIMARY KEY,
//     route_key TEXT NOT NULL UNIQUE,
//     candidates JSONB NOT NULL,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
const USE_ODSAY_CACHE = false;

// ODSay laneName → 우리 DB line 표기로 정규화
function normalizeODSayLine(laneName) {
    if (!laneName) return '';
    if (laneName.includes('공항') || laneName.includes('AREX') || laneName.includes('인천국제')) return '공항철도';
    return laneName;
}

// 호선 일치 확인 (DB line ↔ ODSay laneName)
function linesMatch(dbLine, odsayLaneName) {
    const norm = (l) => {
        if (!l) return '';
        l = String(l).trim();
        if (l.includes('공항') || l.includes('AREX') || l.includes('인천국제')) return '공항';
        return l.replace(/호선$/, '').replace(/선$/, '').trim();
    };
    return norm(dbLine) === norm(odsayLaneName);
}

/**
 * PathFinder: ODSay API 기반 경로탐색.
 * - odsay_route_cache 테이블로 API 호출 최소화 (USE_ODSAY_CACHE=true 시 활성)
 * - 경로 결과(rawItems)만 캐시 — KRIC 번역 데이터는 별도 캐시(RouteService)
 */
export class PathFinder {
    constructor(stations = []) {
        this.stations = stations; // RouteService에서 로드한 stations (odsay_station_id 포함)
    }

    // ── 캐시 키: 출발·도착 역명+호선 조합 ─────────────────────────
    _makeCacheKey(departure, destination) {
        const dep = `${cleanStationName(departure.name_ko)}_${departure.line || ''}`;
        const dst = `${cleanStationName(destination.name_ko)}_${destination.line || ''}`;
        return `${dep}|${dst}`;
    }

    // ── DB에서 캐시 조회 ───────────────────────────────────────────
    async _loadCache(routeKey) {
        try {
            const { data, error } = await supabase
                .from('odsay_route_cache')
                .select('candidates')
                .eq('route_key', routeKey)
                .maybeSingle();
            if (error || !data) return null;
            console.log(`[PathFinder] 📦 캐시 히트: ${routeKey}`);
            return data.candidates; // candidates 배열
        } catch (err) {
            console.warn('[PathFinder] 캐시 조회 실패:', err.message);
            return null;
        }
    }

    // ── DB에 캐시 저장 ─────────────────────────────────────────────
    async _saveCache(routeKey, candidates) {
        try {
            const { error } = await supabase
                .from('odsay_route_cache')
                .upsert({ route_key: routeKey, candidates }, { onConflict: 'route_key' });
            if (error) {
                if (error.code === '42P01') {
                    console.error('[PathFinder] ⚠️ odsay_route_cache 테이블이 없습니다. Supabase에서 생성하세요.');
                } else {
                    console.warn('[PathFinder] 캐시 저장 실패:', error.message);
                }
            } else {
                console.log(`[PathFinder] ✅ 캐시 저장: ${routeKey}`);
            }
        } catch (err) {
            console.warn('[PathFinder] 캐시 저장 오류:', err.message);
        }
    }

    /**
     * stations DB에서 ODSay stationID 조회.
     * DB 미스인 경우 ODSay searchStation API로 런타임 검색.
     */
    async _resolveODSayId(station) {
        // 1순위: 전달된 객체에 odsay_station_id가 있는 경우 (SearchingView에서 stations join 시)
        if (station.odsay_station_id) {
            return station.odsay_station_id;
        }

        // 2순위: 로드된 stations 캐시에서 name+line 매칭
        const cleanedName = cleanStationName(station.name_ko);
        const dbStation = this.stations.find(s => {
            const nameMatch = cleanStationName(s.name_ko) === cleanedName;
            const lineMatch = !station.line || linesMatch(station.line, s.line);
            return nameMatch && lineMatch && s.odsay_station_id != null;
        });
        if (dbStation?.odsay_station_id) {
            console.log(`[PathFinder] odsay_station_id 매칭: ${station.name_ko} → ${dbStation.odsay_station_id}`);
            return dbStation.odsay_station_id;
        }

        // 3순위: ODSay searchStation 런타임 검색 (DB에 odsay_station_id 미입력 역)
        console.warn(`[PathFinder] odsay_station_id DB 미스: "${station.name_ko}". searchStation API 사용.`);
        const results = await fetchODSaySearchStation(cleanedName);
        if (!results.length) return null;

        const matched = station.line
            ? results.find(r => linesMatch(station.line, r.laneName))
            : null;
        const selected = matched || results[0];
        console.log(`[PathFinder] searchStation: ${station.name_ko} → ${selected.stationID} (${selected.laneName})`);
        return selected.stationID;
    }

    /**
     * ODSay subwayPath 응답 → rawItems 변환 (RouteAssembler 호환 포맷)
     *
     * 실제 ODSay 응답 구조:
     *   result.driveInfoSet.driveInfo[]  — 구간별 호선/출발역/정차수
     *   result.exChangeInfoSet.exChangeInfo[]  — 환승역별 fastTrain/fastDoor
     *   result.globalTravelTime / globalEndName  — 총 소요시간 / 도착역명
     */
    _processODSayPath(odsayResult, type, priority, originExitNo, destinationExitNo, departure, destination) {
        const driveInfo = odsayResult?.driveInfoSet?.driveInfo;
        if (!driveInfo?.length) return null;

        const exChangeInfos = odsayResult.exChangeInfoSet?.exChangeInfo || [];
        const steps = [];
        const processedItems = [];

        driveInfo.forEach((seg, segIdx) => {
            const isFirstSeg = segIdx === 0;
            const isLastSeg = segIdx === driveInfo.length - 1;
            const prevSeg = driveInfo[segIdx - 1];

            const lineName = normalizeODSayLine(seg.laneName || '');
            const isTransfer = !isFirstSeg;
            const stnNm = seg.startName;

            // 환승역은 prevSeg 호선으로 표기 (RouteAssembler 포맷 호환)
            let lineNm = isTransfer
                ? normalizeODSayLine(prevSeg?.laneName || '')
                : lineName;

            // 출발역: 사용자 선택 호선 우선 (강남역 2호선 vs 신분당선 구분 등)
            if (isFirstSeg && departure.line && cleanStationName(departure.name_ko) === cleanStationName(stnNm)) {
                lineNm = departure.line;
            }

            steps.push(`${cleanStationName(stnNm)}_${lineNm}`);

            const item = {
                stnNm,
                lineNm,
                transferYn: isTransfer ? 'Y' : 'N',
                odsayStnId: null,
                stopCountToNext: seg.stationCount || 0,
                travelTime: seg.travelTime ?? null,
                intermediateStations: (seg.stationList || [])
                    .slice(1)
                    .map(s => s.stationName)
                    .filter(Boolean),
                prevStnCd: null,
                afterTransferStnCd: null,
                prevStn: null,
                afterTransferStn: null,
            };

            if (isTransfer) {
                // exChangeInfoSet에서 이 환승역의 fastTrain/fastDoor 조회
                const exInfo = exChangeInfos.find(
                    e => cleanStationName(e.exName) === cleanStationName(stnNm)
                );

                item.transferToLineNm = lineName;
                item.transferFromLineNm = normalizeODSayLine(prevSeg?.laneName || '');
                // prevStn/afterTransferStn: driveInfoSet에는 중간역 없어 null 유지
                // → RouteAssembler prevStnNm 빈 문자열 처리 시 방향 필터 skip (안전)
                item.prevStn = null;
                item.afterTransferStn = null;
                item.fastTrain = exInfo?.fastTrain ?? null;
                item.fastDoor = exInfo?.fastDoor ?? null;

                console.log(`[PathFinder] 🔄 환승: ${stnNm} (${item.transferFromLineNm} → ${item.transferToLineNm}), fastTrain=${item.fastTrain ?? 'N/A'}`);
            }

            processedItems.push(item);

            // 마지막 구간 끝 = 도착역
            if (isLastSeg) {
                const destStnNm = odsayResult.globalEndName || destination.name_ko;
                let destLineNm = lineName;
                if (destination.line && cleanStationName(destination.name_ko) === cleanStationName(destStnNm)) {
                    destLineNm = destination.line;
                }
                steps.push(`${cleanStationName(destStnNm)}_${destLineNm}`);
                processedItems.push({
                    stnNm: destStnNm,
                    lineNm: destLineNm,
                    odsayStnId: null,
                    transferYn: 'N',
                    stopCountToNext: null,
                    intermediateStations: [],
                });
            }
        });

        const totalTime = odsayResult.globalTravelTime || 0;
        const transferCount = driveInfo.length - 1;
        const fingerprint = steps.join('|');

        console.log(`[PathFinder] ✅ ODSay path 파싱 완료. Steps: ${steps.length}, 환승: ${transferCount}, 소요: ${totalTime}분`);

        return {
            id: `odsay-${type}`,
            steps,
            totalTime,
            transferCount,
            fingerprint,
            priority,
            originExitNo,
            destinationExitNo,
            rawItems: processedItems,
        };
    }

    /**
     * 경로 후보 탐색 (출발/도착역 → rawItems 배열)
     * ODSay Sopt=1 (최소시간) → Sopt=2 (최소환승) 순으로 시도.
     * USE_ODSAY_CACHE=true 이면 DB 캐시를 우선 사용.
     */
    async findCandidatePaths(departure, destination, originExitNo = '1', destinationExitNo = '1') {
        if (!departure || !destination) return [];

        const dptNm = cleanStationName(departure.name_ko);
        const arvNm = cleanStationName(destination.name_ko);
        console.log(`[PathFinder] 경로 탐색: ${dptNm} → ${arvNm}`);

        // ── 1. DB 캐시 확인 ──────────────────────────────────────
        const routeKey = this._makeCacheKey(departure, destination);
        if (USE_ODSAY_CACHE) {
            const cached = await this._loadCache(routeKey);
            if (cached?.length) {
                console.log(`[PathFinder] 캐시에서 로드: ${cached.length}개 후보`);
                return cached;
            }
        }

        // ── 2. ODSay API 호출 ─────────────────────────────────────
        const [SID, EID] = await Promise.all([
            this._resolveODSayId(departure),
            this._resolveODSayId(destination),
        ]);

        if (!SID || !EID) {
            throw new Error(`ODSay 역코드를 찾을 수 없습니다: ${!SID ? dptNm : arvNm}`);
        }

        console.log(`[PathFinder] ODSay SID=${SID}, EID=${EID}`);

        const candidates = [];
        // 최소환승(Sopt=2) 우선. 미지원 호선 포함 시 최소시간(Sopt=1)으로 fallback.
        const ODSAY_ORDER = [
            { sopt: 2, type: 'transfer', label: '최소환승' },
            { sopt: 1, type: 'duration', label: '최소시간' },
        ];

        for (const { sopt, type, label } of ODSAY_ORDER) {
            console.log(`[PathFinder] 🔍 ODSay ${label} (Sopt=${sopt}) 시도...`);
            try {
                const result = await fetchODSaySubwayPath(SID, EID, sopt);
                const path = this._processODSayPath(result, type, 1, originExitNo, destinationExitNo, departure, destination);

                if (!path) {
                    console.log(`[PathFinder] ODSay ${label}: 경로 없음`);
                    continue;
                }

                const unsupportedStns = path.rawItems
                    .filter(item => item.transferYn === 'Y' && item.transferToLineNm && !SUPPORTED_LINES.has(item.transferToLineNm))
                    .map(item => `${item.stnNm}(${item.transferToLineNm})`);

                if (unsupportedStns.length === 0) {
                    console.log(`[PathFinder] ✅ ODSay ${label} 경로 채택`);
                    candidates.push(path);
                    break;
                }

                console.log(`[PathFinder] ⚠️ ODSay ${label}: 미지원 호선 포함 (${unsupportedStns.join(', ')})`);
            } catch (err) {
                console.error(`[PathFinder] ODSay ${label} 오류:`, err.message);
            }
        }

        if (candidates.length === 0) {
            throw new Error('UNSUPPORTED_LINE_TRANSFER');
        }

        // ── 3. DB에 캐시 저장 ─────────────────────────────────────
        if (USE_ODSAY_CACHE) {
            await this._saveCache(routeKey, candidates);
        }

        console.log(`[PathFinder] 후보 경로: ${candidates.length}개`);
        return candidates;
    }
}
