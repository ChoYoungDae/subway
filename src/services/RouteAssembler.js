import { fetchStationMovement, fetchTransferMovement, getKricItems, fetchSeoulElevatorStatus } from '../api/seoulApi.js';
import { cleanStationName, normalizeStationName } from '../utils/textUtils.js';
import { translateLocation } from '../utils/translation.js';
import { supabase } from '../../lib/supabase.js';

/**
 * RouteAssembler: Performs sequential barrier-free validation on path candidates.
 */
export class RouteAssembler {
    constructor(stations = []) {
        this.stations = stations;
        this.kricCache = new Map(); // Cache for KRIC API responses within this instance
    }

    /**
     * Data.go.kr stnCd → KRIC stinCd 변환.
     * stations 테이블의 datagokr_stn_cd 컬럼으로 매핑.
     * 매칭 실패 시 null 반환 (잘못된 fallback 금지).
     */
    _datagokrToStinCd(stnCd) {
        if (!stnCd) return null;
        const station = this.stations.find(s => s.datagokr_stn_cd === String(stnCd));
        if (!station) {
            console.warn(`[RouteAssembler] ⚠️ datagokr_stn_cd 매핑 실패: ${stnCd}`);
            return null;
        }
        return String(station.stin_cd);
    }

    /**
     * stations DB에서 stin_cd(KRIC stinCd), ln_cd, opr_cd 조회.
     * name_ko(괄호 포함/제외)와 line(호선명) 기준으로 매칭.
     */
    _findCodes(stnNm, lineNm, datagokrStnCd = null) {
        if (!stnNm || !this.stations?.length) return null;

        // 0. Exact datagokr_stn_cd Match
        if (datagokrStnCd) {
            const exactStation = this.stations.find(s => s.datagokr_stn_cd === String(datagokrStnCd));
            if (exactStation && exactStation.stin_cd) {
                console.log(`[RouteAssembler] 🎯 Exact datagokr match for ${stnNm}: ${datagokrStnCd} -> ${exactStation.stin_cd}`);
                return {
                    oprCd: exactStation.kric_opr_cd,
                    lnCd: String(exactStation.ln_cd),
                    stinCd: String(exactStation.stin_cd),
                    analysisData: exactStation.analysis_data ?? null,
                };
            }
        }

        // 1. Station Name Normalization: Remove parentheses and terminal "역"
        const normalizeStn = (name) => (name || '').replace(/\s?\(.*?\)/g, '').replace(/역$/, '').trim();
        const normInputStn = normalizeStn(stnNm);

        // 2. Line Name Normalization
        const normalizeLine = (l) => {
            if (!l) return '';
            let res = String(l).replace(/호선$/, '').replace(/선$/, '').trim();
            if (res.startsWith('0')) res = res.replace(/^0/, ''); // "02" -> "2"
            
            // Map common aliases
            if (res === '공항') return '공항철도';
            if (res === '경의' || res === '중앙') return '경의중앙';
            return res;
        };
        const normInputLine = normalizeLine(lineNm);

        const station = this.stations.find(s => {
            if (!s.stin_cd) return false;

            // Name Match: Normalize both DB name and input name
            const dbNormStn = normalizeStn(s.name_ko);
            if (dbNormStn !== normInputStn) return false;

            // Line Match: Prioritize exact ln_cd match if input looks like a code
            const dbLnCd = String(s.ln_cd || '');
            if (dbLnCd === normInputLine) return true;

            // Fallback: Name-based matching
            const dbNormLine = normalizeLine(s.line);
            const lineMatched = dbNormLine === normInputLine
                || dbNormLine.includes(normInputLine)
                || normInputLine.includes(dbNormLine);
            
            if (dbNormStn === normInputStn && !lineMatched) {
                console.log(`[RouteAssembler] 🔍 Potential match for ${stnNm} but line mismatch: DB="${dbNormLine}" vs Input="${normInputLine}"`);
            }
            
            return lineMatched;
        });

        if (!station) {
            console.warn(`[RouteAssembler] ⚠️ DB 역 미발견: ${stnNm} (${lineNm}) -> Norm: "${normInputStn}" (Line Norm: "${normInputLine}")`);
            return null;
        }

        return {
            oprCd: station.kric_opr_cd,
            lnCd: String(station.ln_cd),
            stinCd: String(station.stin_cd),
            analysisData: station.analysis_data ?? null,
        };
    }

    /**
     * Finds the first fully validated barrier-free path from candidates.
     * @param {Array} candidates - Ranked list of path candidates.
     * @returns {Object|null} The first valid path or null.
     */
    async findValidatedPath(candidates) {
        if (!candidates || candidates.length === 0) return null;

        console.log(`[RouteAssembler] Starting sequential validation on ${candidates.length} candidates...`);

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            console.log(`[RouteAssembler] Checking Rank ${i + 1}: ${candidate.id}`);

            const isValid = await this._verifyCandidate(candidate);
            if (isValid) {
                console.log(`[RouteAssembler] ✅ Rank ${i + 1} passed validation!`);
                return { ...candidate, isBarrierFree: true };
            }

            console.log(`[RouteAssembler] ❌ Rank ${i + 1} failed (Missing movement data).`);
        }

        console.warn('[RouteAssembler] No path satisfied all barrier-free conditions. Falling back to best candidate.');
        return { ...candidates[0], isBarrierFree: false };
    }

    /**
     * Identifies available valid exits for the origin and destination 
     * based on the travel direction before assembling translations.
     */
    async identifyExitsForCandidate(candidate) {
        const rawItems = candidate.rawItems || [];
        if (rawItems.length < 2) return;

        const originItem = rawItems[0];
        const destItem = rawItems[rawItems.length - 1];

        const originCodes = this._findCodes(originItem.stnNm, originItem.lineNm, originItem.datagokrStnCd);
        const destCodes = this._findCodes(destItem.stnNm, destItem.lineNm, destItem.datagokrStnCd);

        candidate.availableOriginExits = [];
        candidate.availableDestExits = [];

        // 1. Origin
        if (originCodes) {
            try {
                const cacheKey = `STN:${originCodes.oprCd}:${originCodes.lnCd}:${originCodes.stinCd}`;
                let movements;
                if (this.kricCache.has(cacheKey)) {
                    console.log(`[RouteAssembler] 📦 [KRIC CACHE HIT] Origin: ${originItem.stnNm}`);
                    movements = this.kricCache.get(cacheKey);
                } else {
                    console.log(`[RouteAssembler] 🌐 [KRIC FETCH] Origin: ${originItem.stnNm}`);
                    const movementRes = await fetchStationMovement({
                        railOprIsttCd: originCodes.oprCd,
                        lnCd: originCodes.lnCd,
                        stinCd: originCodes.stinCd
                    });
                    movements = getKricItems(movementRes);
                    this.kricCache.set(cacheKey, movements);
                }

                const pathGroups = movements.reduce((acc, m) => {
                    const id = m.mvPathMgNo || 'default';
                    if (!acc[id]) acc[id] = [];
                    acc[id].push(m);
                    return acc;
                }, {});

                const firstAdjacentStn = rawItems[0]?.intermediateStations?.[0]
                    ? cleanStationName(rawItems[0].intermediateStations[0])
                    : (rawItems[1]?.stnNm ? cleanStationName(rawItems[1].stnNm) : null);

                let validExits = new Set();
                for (const id in pathGroups) {
                    const group = pathGroups[id];
                    const first = group[0];
                    const hasDirection = firstAdjacentStn ? (
                        (first.edMovePath || '').includes(firstAdjacentStn) ||
                        (first.stMovePath || '').includes(firstAdjacentStn) ||
                        group.some(m => m.mvContDtl?.includes(firstAdjacentStn))
                    ) : true;

                    if (hasDirection) {
                        group.forEach(m => {
                            const exitMatch = m.mvContDtl?.match(/(\d+)번\s*(?:출구|출입구)/);
                            if (exitMatch) validExits.add(exitMatch[1]);
                        });
                    }
                }
                if (validExits.size === 0) {
                    for (const id in pathGroups) {
                        pathGroups[id].forEach(m => {
                            const exitMatch = m.mvContDtl?.match(/(\d+)번\s*(?:출구|출입구)/);
                            if (exitMatch) validExits.add(exitMatch[1]);
                        });
                    }
                }
                candidate.availableOriginExits = Array.from(validExits).sort((a, b) => parseInt(a) - parseInt(b));
                console.log(`[RouteAssembler] 🎯 Found Origin Exits for ${originItem.stnNm}:`, candidate.availableOriginExits);
            } catch(e) { console.error('[RouteAssembler] origin exit lookup error', e); }
        }

        // 2. Dest
        if (destCodes) {
            try {
                const cacheKey = `STN:${destCodes.oprCd}:${destCodes.lnCd}:${destCodes.stinCd}`;
                let movements;
                if (this.kricCache.has(cacheKey)) {
                    console.log(`[RouteAssembler] 📦 [KRIC CACHE HIT] Destination: ${destItem.stnNm}`);
                    movements = this.kricCache.get(cacheKey);
                } else {
                    console.log(`[RouteAssembler] 🌐 [KRIC FETCH] Destination: ${destItem.stnNm}`);
                    const movementRes = await fetchStationMovement({
                        railOprIsttCd: destCodes.oprCd,
                        lnCd: destCodes.lnCd,
                        stinCd: destCodes.stinCd
                    });
                    movements = getKricItems(movementRes);
                    this.kricCache.set(cacheKey, movements);
                }

                const pathGroups = movements.reduce((acc, m) => {
                    const id = m.mvPathMgNo || 'default';
                    if (!acc[id]) acc[id] = [];
                    acc[id].push(m);
                    return acc;
                }, {});

                const prevItem = rawItems[rawItems.length - 2];
                let lastAdjacentStn = null;
                if (prevItem) {
                    if (prevItem.intermediateStations?.length > 0) {
                        lastAdjacentStn = cleanStationName(prevItem.intermediateStations[prevItem.intermediateStations.length - 1]);
                    } else {
                        lastAdjacentStn = cleanStationName(prevItem.stnNm);
                    }
                }

                let validExits = new Set();
                for (const id in pathGroups) {
                    const group = pathGroups[id];
                    const first = group[0];
                    const hasDirection = lastAdjacentStn ? (
                        (first.edMovePath || '').includes(lastAdjacentStn) ||
                        (first.stMovePath || '').includes(lastAdjacentStn) ||
                        group.some(m => m.mvContDtl?.includes(lastAdjacentStn))
                    ) : true;

                    if (hasDirection) {
                        group.forEach(m => {
                            const exitMatch = m.mvContDtl?.match(/(\d+)번\s*(?:출구|출입구)/);
                            if (exitMatch) validExits.add(exitMatch[1]);
                        });
                    }
                }
                if (validExits.size === 0) {
                    for (const id in pathGroups) {
                        pathGroups[id].forEach(m => {
                            const exitMatch = m.mvContDtl?.match(/(\d+)번\s*(?:출구|출입구)/);
                            if (exitMatch) validExits.add(exitMatch[1]);
                        });
                    }
                }
                candidate.availableDestExits = Array.from(validExits).sort((a, b) => parseInt(a) - parseInt(b));
                console.log(`[RouteAssembler] 🎯 Found Dest Exits for ${destItem.stnNm}:`, candidate.availableDestExits);
            } catch(e) { console.error('[RouteAssembler] dest exit lookup error', e); }
        }
    }

    /**
     * Calls the translate-movement Edge Function (Gemini), falls back to local translation.
     */
    async _fetchTranslatedSteps(requestBody, lines) {
        try {
            const { data, error } = await supabase.functions.invoke('translate-movement', { body: requestBody });
            if (error) throw error;
            if (Array.isArray(data?.steps) && data.steps.length > 0) {
                console.log(`[RouteAssembler] 🤖 [GEMINI] ${data.cached ? 'Cache hit' : 'Translated'} — ${data.steps.length} steps`);
                return { steps: data.steps, hashKey: data.hash_key || null };
            }
        } catch (e) {
            console.warn('[RouteAssembler] ⚠️ Edge function failed, using local fallback:', e.message);
        }
        return { steps: this._linesToSteps(lines), hashKey: null };
    }

    /**
     * Fallback: converts raw Korean KRIC lines to StepTranslation using local translation.
     * Used only when the Edge Function is unavailable.
     */
    _linesToSteps(lines, isArrival = false) {
        return lines.map((ko, idx) => {
            const en = translateLocation(ko, 'RouteAssembler');

            let type = 'move';
            if (/엘리베이터|E\/L/.test(ko)) type = 'elevator';
            else if (/개찰구|개집표기|태그/.test(ko)) type = 'gate';
            else if (/탑승|승차/.test(ko)) type = 'board';
            else if (/하차/.test(ko)) type = 'alight';

            const floorMatch = en.match(/B\d+F|\d+F/);

            return {
                order: isArrival ? lines.length - idx : idx + 1,
                short:  { en, ko },
                detail: { en, ko },
                floor_from: floorMatch ? floorMatch[0] : null,
                floor_to: null,
                type,
            };
        });
    }

    /**
     * Enriches translated steps with exit_no (external elevator) or
     * car_position (platform elevator) using is_internal as the source of truth.
     * is_internal=TRUE → look for "방면" → car_position
     * If is_internal=TRUE and text match fails, uses context.arrivalDir for fallback.
     */
    async _enrichSteps(steps, stationNameKo, context = {}) {
        if (!steps?.length) return steps;

        const cleanName = normalizeStationName(stationNameKo || '');
        let internalElevators = [];
        let externalElevators = [];
        try {
            const { data } = await supabase
                .from('elevators')
                .select('exit_no, is_internal, boarding_positions')
                .eq('station_name_ko', cleanName);
            const all = data || [];
            internalElevators = all.filter(e => e.is_internal);
            externalElevators = all.filter(e => !e.is_internal);
        } catch (e) {
            console.warn('[RouteAssembler] _enrichSteps: elevator query failed:', e.message);
        }

        return steps.map((step, i) => {
            if (step.type !== 'elevator') return step;

            const koText = step.short?.ko || step.detail?.ko || '';
            // look-back: KRIC 텍스트에서 출구번호가 이동 step에 먼저 나오는 경우 대응
            const prevKoText = i > 0 ? (steps[i - 1].short?.ko || steps[i - 1].detail?.ko || '') : '';

            // is_internal=TRUE → "방면" 키워드 → toward_station_ko 직접 매칭 → car_position
            // is_internal=FALSE → "출구/출입구" 번호 (현재 또는 직전 step) → exit_no
            console.log(`[_enrichSteps] type=${step.type} koText="${koText}"`);
            const dirMatch = koText.match(/(\S+)\s*방면/);
            const exitMatch = koText.match(/(\d+)번\s*(?:출구|출입구)/)
                           || prevKoText.match(/(\d+)번\s*(?:출구|출입구)/);

            // 1. External Elevator match (Highest Priority for exits)
            if (exitMatch && externalElevators.length > 0) {
                return { ...step, exit_no: exitMatch[1] };
            }

            // 2. Internal Elevator match (Platform -> Hall)
            if (dirMatch || (step.type === 'elevator' && (koText.includes('승강장') || koText.includes('승하차') || context.isArrival))) {
                const direction = dirMatch ? dirMatch[1] : '';
                
                let bestMatch = null;

                for (const elev of internalElevators) {
                    const positions = Array.isArray(elev.boarding_positions) ? elev.boarding_positions : [];
                    
                    // Match within boarding_positions
                    const matchedPos = positions.find(p => {
                        const toward = p.toward || '';
                        // 1. Exact "방면" match
                        if (direction && (
                            toward === direction ||
                            direction.includes(toward) ||
                            toward.includes(direction)
                        )) return true;

                        // 2. Departure next station match
                        if (context.departureDir && (
                            toward === context.departureDir ||
                            context.departureDir.includes(toward) ||
                            toward.includes(context.departureDir)
                        )) return true;

                        return false;
                    });

                    if (matchedPos) {
                        bestMatch = matchedPos;
                        break;
                    }
                }

                if (bestMatch) {
                    const carPos = bestMatch.door != null
                        ? `${bestMatch.car}-${bestMatch.door}`
                        : `${bestMatch.car}`;
                    return { ...step, car_position: carPos };
                }
            }

            return step;
        });
    }

    /**
     * Verifies if all critical stations in a path have elevator movement data.
     * Also enriches the candidate with atomized movement data.
     */
    async _verifyCandidate(candidate) {
        const steps = candidate.steps || [];
        const rawItems = candidate.rawItems || [];

        candidate.originSteps = [];
        candidate.destinationSteps = [];
        candidate.originImgPaths = [];
        candidate.destinationImgPaths = [];

        console.log(`[RouteAssembler] Validating & Enriching candidate: ${candidate.id}`);

        await Promise.all(rawItems.map(async (item, i) => {
            const isDeparture = i === 0;
            const isArrival = i === rawItems.length - 1;
            // Enhanced Transfer Detection: Explicit flag OR change in line number
            // (True if API says 'Y' OR if the station name is the same as the next but the line has changed)
            const isTransfer = (item.transferYn === 'Y' || (i < rawItems.length - 1 && rawItems[i + 1].stnNm === item.stnNm && rawItems[i + 1].lineNm !== item.lineNm));

            if (isDeparture || isArrival || isTransfer) {
                const codes = this._findCodes(item.stnNm, item.lineNm, item.datagokrStnCd);
                if (!codes) {
                    console.warn(`[RouteAssembler] ⚠️ [CODE FAIL] No codes found for ${item.stnNm} (${item.lineNm})`);
                    return;
                }

                try {
                    let movements = [];
                    let elevatorStatuses = [];
                    let transferTargetCodes = null;
                    let transferNextStinCd = null;

                    // ── [STEP A: API Call by Context] ──
                    try {
                        elevatorStatuses = await fetchSeoulElevatorStatus(item.stnNm);
                        item.elevatorStatuses = elevatorStatuses;
                        console.log(`[RouteAssembler] 🔄 [STATUS] Fetched ${elevatorStatuses.length} statuses for ${item.stnNm}`);
                    } catch (e) {
                        console.warn(`[RouteAssembler] ⚠️ Failed to fetch statuses for ${item.stnNm}:`, e.message);
                    }

                    if (isTransfer) {
                        const isBranchTransfer = !!(item.brlnNm || item.lineNm?.includes('지선'));
                        const nextItem = rawItems[i + 1]; // 환승 후 다음 구간 아이템
                        // Use explicit transferToLineNm if provided by PathFinder
                        const targetLineToUse = item.transferToLineNm || nextItem?.lineNm;
                        const targetCodes = this._findCodes(item.stnNm, targetLineToUse);
                        transferTargetCodes = targetCodes;

                        if (codes.lnCd && targetCodes?.lnCd && (codes.lnCd !== targetCodes.lnCd || isBranchTransfer)) {
                            // ── prevStinCd: INDEX NEIGHBOR MAPPING ──────────
                            let prevStinCd = null;
                            if (!isBranchTransfer && item.prevStnCd) {
                                prevStinCd = this._datagokrToStinCd(item.prevStnCd);
                            }

                            transferNextStinCd = (!isBranchTransfer && item.afterTransferStnCd)
                                ? this._datagokrToStinCd(item.afterTransferStnCd)
                                : null;

                            const cacheKey = `TRANS:${codes.oprCd}:${codes.lnCd}:${codes.stinCd}:${targetCodes.lnCd}:${transferNextStinCd}`;
                            if (this.kricCache.has(cacheKey)) {
                                console.log(`[RouteAssembler] 📦 [KRIC CACHE HIT] Transfer: ${item.stnNm}`);
                                movements = this.kricCache.get(cacheKey);
                            } else {
                                console.log(`[RouteAssembler] 🌐 [KRIC FETCH] Transfer: ${item.stnNm}`);
                                const transferRes = await fetchTransferMovement({
                                    railOprIsttCd: codes.oprCd,
                                    lnCd: codes.lnCd,
                                    stinCd: codes.stinCd,
                                    chthTgtLn: targetCodes.lnCd,
                                    chtnNextStinCd: transferNextStinCd
                                }).catch(() => []);
                                movements = getKricItems(transferRes);
                                this.kricCache.set(cacheKey, movements);
                            }
                        } else {
                            console.warn(`[RouteAssembler] ⚠️ [SKIP TRANSFER] Codes identical or missing: ${codes.lnCd} vs ${targetCodes?.lnCd}`);
                        }
                    } else {
                        const cacheKey = `STN:${codes.oprCd}:${codes.lnCd}:${codes.stinCd}`;
                        if (this.kricCache.has(cacheKey)) {
                            console.log(`[RouteAssembler] 📦 [KRIC CACHE HIT] ${isDeparture ? 'Departure' : 'Arrival'}: ${item.stnNm}`);
                            movements = this.kricCache.get(cacheKey);
                        } else {
                            console.log(`[RouteAssembler] 🌐 [KRIC FETCH] ${isDeparture ? 'Departure' : 'Arrival'}: ${item.stnNm}`);
                            const movementRes = await fetchStationMovement({
                                railOprIsttCd: codes.oprCd,
                                lnCd: codes.lnCd,
                                stinCd: codes.stinCd
                            });
                            movements = getKricItems(movementRes);
                            this.kricCache.set(cacheKey, movements);
                        }
                    }

                    if (movements.length === 0) {
                        console.log(`[RouteAssembler] ⚠️ [DATA EMPTY] No specific data for ${item.stnNm} (${isTransfer ? 'Transfer' : 'Entrance'})`);
                        return;
                    }

                    // 1. Group records by mvPathMgNo
                    const pathGroups = movements.reduce((acc, m) => {
                        const id = m.mvPathMgNo || 'default';
                        if (!acc[id]) acc[id] = [];
                        acc[id].push(m);
                        return acc;
                    }, {});

                    let bestPathId = null;

                    if (isDeparture) {
                        const departureExit = candidate.originExitNo || '1';
                        // API가 반환한 전체 역 순서에서 출발역 직후 역을 직접 읽음 (계산 불필요)
                        const firstAdjacentStn = rawItems[0]?.intermediateStations?.[0]
                            ? cleanStationName(rawItems[0].intermediateStations[0])
                            : null;
                        console.log(`[RouteAssembler] 🛠️ [DEPARTURE FILTER] Exit ${departureExit}, firstAdjacent=${firstAdjacentStn}`);
                        candidate.firstAdjacentStn = firstAdjacentStn; // Store for enrichment

                        // 1. 출구번호 + 다음역명(API 직접 제공) 일치
                        if (firstAdjacentStn) {
                            bestPathId = Object.keys(pathGroups).find(id => {
                                const group = pathGroups[id];
                                const first = group[0];
                                const hasExit = group.some(m => m.mvContDtl?.includes(`${departureExit}번`));
                                const hasDirection = (
                                    (first.edMovePath || '').includes(firstAdjacentStn) ||
                                    (first.stMovePath || '').includes(firstAdjacentStn) ||
                                    group.some(m => m.mvContDtl?.includes(firstAdjacentStn))
                                );
                                return hasExit && hasDirection;
                            });
                        }

                        // 2. 출구번호만 일치
                        if (!bestPathId) {
                            bestPathId = Object.keys(pathGroups).find(id => {
                                const group = pathGroups[id];
                                return group.some(m => m.mvContDtl?.includes(`${departureExit}번`));
                            });
                        }

                        if (!bestPathId && Object.keys(pathGroups).length > 0) {
                            console.log(`[RouteAssembler] ⚠️ [DEPARTURE FALLBACK] No path for Exit ${departureExit}. Picking first available group.`);
                            bestPathId = Object.keys(pathGroups)[0];
                            candidate.originExitFallback = true;
                        }
                    } else if (isArrival) {
                        const targetExit = candidate.destinationExitNo || '1';
                        console.log(`[RouteAssembler] 🛠️ [ARRIVAL FILTER] Matching Path for Exit ${targetExit}`);

                        // 1. Try to find path mentioning the specific exit
                        bestPathId = Object.keys(pathGroups).find(id => {
                            const group = pathGroups[id];
                            return group.some(m => m.mvContDtl?.includes(`${targetExit}번`));
                        });

                        // 2. Fallback: Any available path (if exact exit not found)
                        if (!bestPathId && Object.keys(pathGroups).length > 0) {
                            console.log(`[RouteAssembler] ⚠️ [ARRIVAL FALLBACK] No path for Exit ${targetExit}. Picking first available group.`);
                            bestPathId = Object.keys(pathGroups)[0];
                            candidate.destinationExitFallback = true;
                        }
                    } else if (isTransfer) {
                        const prevStnNm = item.prevStn?.stnNm || '';
                        const brlnNm = item.brlnNm || '';
                        const afterStnNm = item.afterTransferStn?.stnNm || '';
                        const transferFromLineNm = item.transferFromLineNm || '';

                        console.log(`[RouteAssembler] 🛠️ [TRANSFER FILTER] Station: ${item.stnNm}, prevStn: ${prevStnNm}, brlnNm: ${brlnNm}, afterStn: ${afterStnNm}, fromLine: ${transferFromLineNm}`);

                        // -1. 지선 환승: brlnNm / lineNm / transferFromLineNm 중 하나라도 "지선" 포함
                        //   → stMovePath에 "지선" 포함 그룹 우선
                        // (Data.go.kr dptreLineNm이 "2호선"으로만 와도 brlnNm으로 판별)
                        const isBranchFrom = !!(
                            item.brlnNm?.includes('지선') ||
                            item.lineNm?.includes('지선') ||
                            transferFromLineNm.includes('지선')
                        );
                        if (isBranchFrom) {
                            bestPathId = Object.keys(pathGroups).find(id =>
                                (pathGroups[id][0].stMovePath || '').includes('지선')
                            );
                            console.log(`[RouteAssembler] 🚇 [BRANCH FILTER] isBranchFrom=true brlnNm="${item.brlnNm}" lineNm="${item.lineNm}" → bestPathId=${bestPathId}`);
                        }

                        if (!bestPathId) {
                            // stMovePath = 탑승한 FROM 플랫폼 방향 (e.g. "2호선 대림 방면")
                            // edMovePath = 환승 후 TO 플랫폼 방향 (e.g. "1호선 XX 방면")

                            // Step 1. Filter: stMovePath에 prevStnNm이 포함된 그룹만 남김 (필수 조건)
                            const allGroupIds = Object.keys(pathGroups);
                            let candidateIds = prevStnNm
                                ? allGroupIds.filter(id => (pathGroups[id][0].stMovePath || '').includes(prevStnNm))
                                : allGroupIds;

                            allGroupIds.forEach(id => {
                                const stPath = pathGroups[id][0].stMovePath || '';
                                const edPath = pathGroups[id][0].edMovePath || '';
                                console.log(`[RouteAssembler] 🔍 Path ${id}: stMovePath="${stPath}" edMovePath="${edPath}" → kept=${candidateIds.includes(id)}`);
                            });

                            if (candidateIds.length === 0) {
                                // stMovePath 일치 그룹 없음 → 오안내 금지, bestPathId를 null로 유지
                                console.warn(`[RouteAssembler] ⛔ [TRANSFER FILTER FAIL] No group with stMovePath containing "${prevStnNm}" for ${item.stnNm}. Refusing to guess.`);
                            } else {
                                // Step 2. Match: 남은 그룹 중 edMovePath에 afterStnNm 포함 그룹 선택
                                bestPathId = afterStnNm
                                    ? candidateIds.find(id => (pathGroups[id][0].edMovePath || '').includes(afterStnNm))
                                    : null;

                                // afterStnNm 매칭 실패 시 필터된 후보 중 첫 번째 선택
                                if (!bestPathId) {
                                    bestPathId = candidateIds[0];
                                    console.log(`[RouteAssembler] ⚠️ [TRANSFER] edMovePath match failed for afterStn="${afterStnNm}", using first filtered group: ${bestPathId}`);
                                }
                            }
                        }

                        // 최후 fallback: 첫 번째 그룹
                        if (!bestPathId && Object.keys(pathGroups).length > 0) {
                            console.log(`[RouteAssembler] ⚠️ [TRANSFER FALLBACK] Picking first group for ${item.stnNm}.`);
                            bestPathId = Object.keys(pathGroups)[0];
                        }
                    }

                    // 2. Process selection
                    if (bestPathId) {
                        console.log(`[RouteAssembler] ✅ [MATCH SUCCESS] ${item.stnNm} Context: ${isTransfer ? 'TRANS' : 'STN'} -> ID: ${bestPathId}`);
                        let targetMovements = pathGroups[bestPathId].sort((a, b) => (a.exitMvTpOrdr || 0) - (b.exitMvTpOrdr || 0));

                        // ── [REVERSE FOR ARRIVAL] ─────────────────────
                        // 도착역인 경우, 고정 이미지 가이드 번호와 일치시키되 실제 이동 방향(승강장->출구)으로
                        // 안내하기 위해 데이터 배열 자체를 역순으로 뒤집습니다.
                        if (isArrival) {
                            targetMovements.reverse();
                        }

                        // 3. Split lines → build translation request → call Edge Function
                        const lines = targetMovements.flatMap(m => {
                            const bulk = m.mvContDtl || '';
                            return bulk.split(/\r?\n/).flatMap(line =>
                                line.split(/(?:^|\s)\d+\)/).map(s => s.trim()).filter(Boolean)
                            );
                        });
                        const imgPaths = [...new Set(targetMovements.map(m => m.imgPath).filter(Boolean))];
                        const movement_steps = lines.map((text, idx) => ({ 
                            order: isArrival ? lines.length - idx : idx + 1, 
                            text 
                        }));

                        console.log(`[RouteAssembler] 🛠️ [STEP B] ${lines.length} lines, ${imgPaths.length} images for ${item.stnNm}`);

                        let translationReq;
                        if (isTransfer) {
                            translationReq = {
                                stin_cd: codes.stinCd,
                                line: codes.lnCd,
                                is_transfer: true,
                                from_line: codes.lnCd,
                                to_line: transferTargetCodes?.lnCd ?? null,
                                next_stin_cd: transferNextStinCd,
                                analysis_data: codes.analysisData,
                                movement_steps,
                            };
                        } else if (isDeparture) {
                            translationReq = {
                                stin_cd: codes.stinCd,
                                line: codes.lnCd,
                                exit_no: candidate.originExitNo ?? null,
                                is_destination: false,
                                analysis_data: codes.analysisData,
                                movement_steps,
                            };
                        } else {
                            translationReq = {
                                stin_cd: codes.stinCd,
                                line: codes.lnCd,
                                exit_no: candidate.destinationExitNo ?? null,
                                is_destination: true,
                                analysis_data: codes.analysisData,
                                movement_steps,
                            };
                        }

                        const translationCtx = {
                            isArrival,
                            isDeparture,
                            isTransfer,
                            departureDir: isDeparture ? candidate.firstAdjacentStn : null,
                            arrivalDir: isArrival ? (rawItems[i]?.prevStn?.stnNm ? cleanStationName(rawItems[i].prevStn.stnNm) : null) : null,
                        };

                        try {
                            const { steps, hashKey } = await this._fetchTranslatedSteps(translationReq, lines);
                            const enrichedSteps = await this._enrichSteps(steps, item.stnNm, translationCtx);

                            if (isDeparture) {
                                candidate.originSteps = enrichedSteps;
                                candidate.originHashKey = hashKey;
                                candidate.originImgPaths = imgPaths;
                            } else if (isArrival) {
                                candidate.destinationSteps = enrichedSteps;
                                candidate.destinationHashKey = hashKey;
                                candidate.destinationImgPaths = imgPaths;
                            } else if (isTransfer) {
                                item.transitSteps = enrichedSteps;
                                item.transitHashKey = hashKey;
                                item.transitImgPaths = imgPaths;
                                console.log(`[RouteAssembler] 📌 Attached ${enrichedSteps.length} steps, ${imgPaths.length} images to item ${i} (${item.stnNm})`);
                            }
                        } catch (err) {
                            console.warn(`[Route] translation error at ${item.stnNm}:`, err);
                            const fallback = this._linesToSteps(lines, isArrival);
                            if (isArrival) candidate.destinationSteps = fallback;
                            else if (isDeparture) candidate.originSteps = fallback;
                            else item.transitSteps = fallback;
                        }
                    } else {
                        console.warn(`[RouteAssembler] ⚠️ [MATCH FAIL] No path for ${item.stnNm}. Groups:`, Object.keys(pathGroups));
                    }
                } catch (err) {
                    console.error(`[RouteAssembler] Error at ${item.stnNm}:`, err);
                }
            }
        }));

        // Critical Validity Check: Candidate must have at least origin/destination steps to be considered barrier-free
        const hasEssentialAtoms = candidate.originSteps.length > 0 && candidate.destinationSteps.length > 0;
        console.log(`[RouteAssembler] Validation concluded. Essential atoms found: ${hasEssentialAtoms}`);

        return hasEssentialAtoms;
    }
}
