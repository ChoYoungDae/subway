import { cleanStationName } from '../utils/textUtils.js';
import { fetchShtrmPath } from '../api/seoulApi.js';

// KRIC 엘리베이터 데이터가 있는 지원 노선.
// 이 목록에 없는 노선으로 환승하는 경로는 건너뜁니다.
const SUPPORTED_LINES = new Set([
    '1호선', '2호선', '3호선', '4호선', '5호선',
    '6호선', '7호선', '8호선', '9호선', '공항철도'
]);

function isSupportedLine(lineNm) {
    return [...SUPPORTED_LINES].some(s => lineNm.startsWith(s));
}

function hasUnsupportedTransfer(rawItems) {
    const bad = rawItems.find(item =>
        item.transferYn === 'Y' &&
        item.transferToLineNm &&
        !isSupportedLine(item.transferToLineNm)
    );
    if (bad) console.log(`[PathFinder] ❌ 미지원 환승: ${bad.stnNm} → ${bad.transferToLineNm}`);
    return !!bad;
}

export class PathFinder {
    constructor(stations = []) {
        this.stations = stations;
    }

    async findCandidatePaths(departure, destination, originExitNo = '1', destinationExitNo = '1') {
        if (!departure || !destination) return [];

        const dptNm = cleanStationName(departure.name_ko);
        const arvNm = cleanStationName(destination.name_ko);

        console.log(`[PathFinder] 경로 탐색: ${dptNm} → ${arvNm}`);

        const candidates = [];
        const uniqueFingerprints = new Set();

        const searchTypes = [
            { type: 'transfer', priority: 1 },
            { type: 'duration', priority: 2 },
            { type: 'distance', priority: 3 },
        ];

        for (const { type, priority } of searchTypes) {
            console.log(`[PathFinder] 🔍 ${type} 시도...`);
            const result = await fetchShtrmPath({ dptreStnNm: dptNm, arvlStnNm: arvNm, searchType: type });
            const pathList = result.paths || [];

            if (!pathList.length) continue;

            const processed = this._processPath(result, type, priority, originExitNo, destinationExitNo);
            if (!processed) continue;

            if (hasUnsupportedTransfer(processed.rawItems)) {
                console.log(`[PathFinder] ⚠️ ${type}: 미지원 노선 경유 — 다음 유형 시도`);
                continue;
            }

            if (!uniqueFingerprints.has(processed.fingerprint)) {
                candidates.push(processed);
                uniqueFingerprints.add(processed.fingerprint);
            }

            // 지원 경로 확보 시 이후 유형 건너뜀
            break;
        }

        if (candidates.length === 0) {
            const err = new Error('지원하지 않는 노선을 경유하는 경로만 존재합니다.');
            err.code = 'UNSUPPORTED_LINE_TRANSFER';
            throw err;
        }

        console.log(`[PathFinder] 총 ${candidates.length}개 후보`);
        return candidates;
    }

    _processPath(dataGoResult, type, priority, originExitNo, destinationExitNo) {
        const items = dataGoResult.paths || [];
        if (!items.length) return null;

        const steps = [];
        const processedItems = [];

        items.forEach((seg, idx) => {
            const isOrigin = idx === 0;
            const isTransfer = seg.trsitYn === 'Y';
            const isDestination = idx === items.length - 1;

            if (isOrigin || isTransfer) {
                const name = cleanStationName(seg.dptreStn.stnNm);
                const line = seg.dptreStn.lineNm;
                steps.push(`${name}_${line}`);

                // 다음 경계역까지 정거장 수 + 중간역 목록
                const nextKeyIdx = items.findIndex((x, j) =>
                    j > idx && (x.trsitYn === 'Y' || j === items.length - 1)
                );
                let stopCountToNext = null;
                const intermediateStations = [];
                if (nextKeyIdx !== -1) {
                    let sum = 0;
                    const isTransferAtNext = items[nextKeyIdx]?.trsitYn === 'Y';
                    const limitIdx = isTransferAtNext ? nextKeyIdx - 1 : nextKeyIdx;
                    for (let k = idx; k <= limitIdx; k++) {
                        sum += parseInt(items[k].stinCnt) || 1;
                        if (k < nextKeyIdx) intermediateStations.push(items[k].arvlStn.stnNm);
                    }
                    stopCountToNext = sum;
                }

                const processedItem = {
                    stnNm: seg.dptreStn.stnNm,
                    lineNm: line,
                    brlnNm: seg.dptreStn.brlnNm || null,
                    transferYn: isTransfer ? 'Y' : 'N',
                    stopCountToNext,
                    intermediateStations,
                    datagokrStnCd: seg.dptreStn.stnCd || null,
                };

                if (isTransfer) {
                    // transferToLineNm: trfstnNms에서 정확한 환승 도착 노선 추출
                    const trInfo = dataGoResult.trfstnNms?.find(
                        t => cleanStationName(t.stnNm) === name
                    );
                    if (trInfo) {
                        processedItem.transferToLineNm = trInfo.arvlLineNm;
                        processedItem.transferFromLineNm = trInfo.dptreLineNm || line;
                    }

                    // Index Neighbor Mapping: 환승 전/후 인접역
                    const nextSeg = items[idx + 1];
                    const prevSeg = idx > 0 ? items[idx - 1] : null;

                    processedItem.afterTransferStn = nextSeg
                        ? { stnNm: nextSeg.arvlStn.stnNm, lineNm: nextSeg.arvlStn.lineNm }
                        : null;
                    processedItem.afterTransferStnCd = nextSeg?.arvlStn?.stnCd || null;

                    processedItem.prevStn = prevSeg
                        ? { stnNm: prevSeg.dptreStn.stnNm, lineNm: prevSeg.dptreStn.lineNm }
                        : null;
                    processedItem.prevStnCd = prevSeg?.dptreStn?.stnCd || null;
                }

                processedItems.push(processedItem);
            }

            if (isDestination) {
                const name = cleanStationName(seg.arvlStn.stnNm);
                const line = seg.arvlStn.lineNm;
                steps.push(`${name}_${line}`);
                
                const prevSeg = idx > 0 ? items[idx - 1] : null;
                processedItems.push({
                    stnNm: seg.arvlStn.stnNm,
                    lineNm: line,
                    transferYn: 'N',
                    datagokrStnCd: seg.arvlStn.stnCd || null,
                    prevStn: prevSeg ? { stnNm: prevSeg.dptreStn.stnNm, lineNm: prevSeg.dptreStn.lineNm } : null,
                    prevStnCd: prevSeg?.dptreStn?.stnCd || null,
                });
            }
        });

        const totalTime = Math.floor(
            items.reduce((sum, item) => sum + (parseInt(item.reqHr) || 0), 0) / 60
        );
        const fingerprint = steps.join('|');

        console.log(`[PathFinder] ✅ ${type}: ${steps.length}개 스텝, 환승 ${processedItems.filter(i => i.transferYn === 'Y').length}회`);

        return {
            id: `datagokr-${type}`,
            steps,
            totalTime,
            transferCount: items.filter(i => i.trsitYn === 'Y').length,
            fingerprint,
            priority,
            originExitNo,
            destinationExitNo,
            rawItems: processedItems,
            trfstnNms: dataGoResult.trfstnNms || [],
        };
    }
}
