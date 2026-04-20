import { parseSubwayRoute } from './routeParser';

/**
 * Parses origin route steps (dvCd=1) into the 3-Segment Journey format.
 */
export const splitOriginSegment = (steps) => {
    if (!steps || steps.length === 0) return null;

    const parsedSteps = steps.map(s => {
        const p = parseSubwayRoute(s.ko)[0];
        return { ...p, originalText: s.ko };
    });

    // Find Gate index
    let gateIdx = parsedSteps.findIndex(s =>
        s.originalText.includes('개찰구') ||
        s.originalText.includes('표 내는 곳') ||
        s.originalText.includes('태그') ||
        s.label === 'Ticket Gate'
    );

    if (gateIdx === -1) {
        // If no gate found, fallback to treating it as 1-1 only or similar,
        // but given requirement, we focus on paths with gates.
        return null;
    }

    const entranceSteps = parsedSteps.slice(0, gateIdx);
    const gateStep = parsedSteps[gateIdx];
    const platformSteps = parsedSteps.slice(gateIdx + 1);

    // Final platform info
    const finalStep = platformSteps.length > 0
        ? platformSteps[platformSteps.length - 1]
        : (gateStep.originalText.includes('승강장') ? gateStep : null);

    // Merge Logic (Constraint 2)
    const isDirect = gateStep.floor && finalStep && finalStep.floor && gateStep.floor === finalStep.floor;

    // Segment 1-1 (Entrance to Gate Entrance)
    // Label Logic: "Go to [ExitNo] [IconLabel] / [ExitNo] [IconLabel] 이용"
    const firstStep = entranceSteps.length > 0 ? entranceSteps[0] : null;
    let s1_1_en = 'Go to Entrance';
    let s1_1_ko = '입구로 이동';

    if (firstStep) {
        const exitMatch = firstStep.originalText.match(/(\d+)번[ ]*(?:출구|출입구)/);
        const exitNo = exitMatch ? exitMatch[1] : null;
        const typeEn = firstStep.type && firstStep.type !== 'general' ? firstStep.type : 'Elevator';
        const typeKo = firstStep.originalText.includes('엘리베이터') ? '엘리베이터' : '출구';

        if (exitNo) {
            s1_1_en = `Go to Exit ${exitNo} ${typeEn}`;
            s1_1_ko = `${exitNo}번 출구 ${typeKo} 이용`;
        } else {
            s1_1_en = `Go to ${firstStep.label || 'Entrance'}`;
            s1_1_ko = `${firstStep.label_ko || '입구'} 이용`;
        }
    }

    // Segment 1-2 (Gate)
    const floorStr = gateStep.floor || '';
    const s1_2_en = floorStr ? `Tag card at ${floorStr} Gate` : 'Tag card at Gate';
    const s1_2_ko = floorStr ? `${floorStr.replace('F', '층')} 개찰구 카드 태그` : '개찰구 카드 태그';

    // Segment 1-3 (Platform)
    const destFloor = finalStep ? (finalStep.floor || '') : '';
    const s1_3_en = destFloor ? `Take Elevator to ${destFloor} Platform` : 'Take Elevator to Platform';
    const s1_3_ko = destFloor ? `${destFloor.replace('F', '층')} 승강장행 엘리베이터 탑승` : '승강장행 엘리베이터 탑승';

    const segments = {
        step1_1: { id: '1-1', title: 'Entrance', en: s1_1_en, ko: s1_1_ko, steps: entranceSteps },
        step1_2: { id: '1-2', title: 'Gate', en: s1_2_en, ko: s1_2_ko, steps: [gateStep] },
        step1_3: { id: '1-3', title: 'Platform', en: s1_3_en, ko: s1_3_ko, steps: platformSteps },
        isDirect: isDirect
    };

    if (isDirect) {
        segments.merged = {
            id: '1-2 & 1-3',
            en: 'Pass the gate to reach the platform',
            ko: '개찰구를 지나면 바로 승강장입니다'
        };
    }

    return segments;
};

/**
 * Parses transit info into Step 2: Transit Segment.
 */
export const splitTransitSegment = (transitData) => {
    if (!transitData) return null;

    const {
        fromLine,
        direction,
        bestDoor,
        stations = [],
        exitSide,
        isTransfer,
        transferInfo
    } = transitData;

    // Logic for Step 2-1 (Departure on current train)
    const lineEn = fromLine ? fromLine.replace('호선', '') : '';
    const dirEn = direction || 'Unknown';

    // UI Label synthesis
    const s2_1_en = lineEn ? `Line ${lineEn} (${dirEn} Direction)` : `Transit (${dirEn})`;
    const s2_1_ko = `${fromLine || ''} (${direction || ''} 방면)`;

    const bestDoorEn = bestDoor ? `Best Door: ${bestDoor} (Elevator nearby)` : 'Best Door: Nearby elevator';
    const bestDoorKo = bestDoor ? `최적 칸: ${bestDoor} (엘리베이터 인근)` : '최적 칸: 엘리베이터 인근';

    // Build the segments container
    const segments = {
        step2_1: {
            id: '2-1',
            title: 'Boarding',
            en: s2_1_en,
            ko: s2_1_ko,
            bestDoorEn,
            bestDoorKo,
            bestDoor,
            exitSideEn: exitSide ? `Open on the ${exitSide}` : null,
            exitSideKo: exitSide ? `문 열림: ${exitSide === 'left' ? '왼쪽' : '오른쪽'}` : null,
            stations: stations
        }
    };

    if (isTransfer && transferInfo) {
        segments.step2_2 = {
            id: '2-2',
            title: 'Transfer',
            en: `Transfer at ${transferInfo.stationEn}`,
            ko: `${transferInfo.stationKo}역에서 환승`,
            steps: transferInfo.steps || []
        };

        segments.step2_3 = {
            id: '2-3',
            title: 'Re-boarding',
            en: `Take Line ${transferInfo.toLineEn} toward ${transferInfo.toDirEn}`,
            ko: `${transferInfo.toLineKo} (${transferInfo.toDirKo} 방면) 탑승`,
            bestDoorEn: transferInfo.nextBestDoor ? `Best Door: ${transferInfo.nextBestDoor}` : null,
            bestDoorKo: transferInfo.nextBestDoor ? `최적 칸: ${transferInfo.nextBestDoor}` : null,
        };
    }

    return segments;
};

/**
 * Parses destination route steps (dvCd=2) into Step 3: Destination Segment.
 */
export const splitDestinationSegment = (steps) => {
    if (!steps || steps.length === 0) return null;

    const parsedSteps = steps.map(s => {
        const p = parseSubwayRoute(s.ko)[0];
        return { ...p, originalText: s.ko };
    });

    // Find Gate index (Tag Out)
    let gateIdx = parsedSteps.findIndex(s =>
        s.originalText.includes('개찰구') ||
        s.originalText.includes('표 내는 곳') ||
        s.originalText.includes('태그') ||
        s.label === 'Ticket Gate'
    );

    if (gateIdx === -1) return null;

    const platformToGateSteps = parsedSteps.slice(0, gateIdx);
    const gateStep = parsedSteps[gateIdx];
    const gateToExitSteps = parsedSteps.slice(gateIdx + 1);

    // Final Exit info
    const finalStep = gateToExitSteps.length > 0
        ? gateToExitSteps[gateToExitSteps.length - 1]
        : null;

    // Segment 3-1 (Platform to Gate)
    const s3_1_en = 'Go to Gate from Platform';
    const s3_1_ko = '승강장에서 개찰구로 이동';

    // Segment 3-2 (Gate Transaction)
    const floorStr = gateStep.floor || '';
    const s3_2_en = floorStr ? `Tag out at ${floorStr} Gate` : 'Tag out at Gate';
    const s3_2_ko = floorStr ? `${floorStr.replace('F', '층')} 개찰구 하차 태그` : '개찰구 하차 태그';

    // Segment 3-3 (Gate to Exit)
    let s3_3_en = 'Go to Surface via Elevator';
    let s3_3_ko = '엘리베이터 이용 지상 이동';

    if (finalStep) {
        const exitMatch = finalStep.originalText.match(/(\d+)번[ ]*(?:출구|출입구)/);
        const exitNo = exitMatch ? exitMatch[1] : null;
        if (exitNo) {
            s3_3_en = `Exit via Elevator ${exitNo}`;
            s3_3_ko = `${exitNo}번 엘리베이터로 나가기`;
        }
    }

    const segments = {
        step3_1: { id: '3-1', title: 'To Gate', en: s3_1_en, ko: s3_1_ko, steps: platformToGateSteps },
        step3_2: { id: '3-2', title: 'Tag Out', en: s3_2_en, ko: s3_2_ko, steps: [gateStep] },
        step3_3: { id: '3-3', title: 'To Exit', en: s3_3_en, ko: s3_3_ko, steps: gateToExitSteps },
        final: {
            id: 'Goal',
            en: 'Arrived at Destination',
            ko: '목적지 도착'
        }
    };

    return segments;
};
