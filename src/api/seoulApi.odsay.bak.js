// 환경 변수 로드
// Node.js 테스트 시에는 직접 환경 변수를 설정해야 합니다
let API_KEY = '';

// Node.js 환경
if (typeof process !== 'undefined' && process.env) {
  API_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY ||
    process.env.KRIC_SERVICE_KEY ||
    '';
}

// Expo 환경 (런타임)
if (typeof window !== 'undefined' && window.__env__) {
  API_KEY = window.__env__.EXPO_PUBLIC_KRIC_SERVICE_KEY || API_KEY;
}
if (typeof Constants !== 'undefined' && Constants.expoConfig?.extra) {
  API_KEY = Constants.expoConfig.extra.EXPO_PUBLIC_KRIC_SERVICE_KEY || API_KEY;
}

console.log('[KRIC] Loaded API Key length:', API_KEY ? API_KEY.length : 0);
if (!API_KEY) {
  console.warn('⚠️ KRIC API 키가 로드되지 않았습니다.');
}
const BASE_URL = 'https://openapi.kric.go.kr/openapi';

// 서울 열린데이터광장 / 지하철 실시간 (swopenapi)
// 서울 열린데이터광장 인증키 (일반 키가 더 넓은 권한을 가짐)
const SEOUL_KEY = process.env.EXPO_PUBLIC_SEOUL_GENERAL_KEY || process.env.EXPO_PUBLIC_SEOUL_SUBWAY_KEY;
const SEOUL_BASE = 'http://openapi.seoul.go.kr:8088';
// ODSay API (주 경로탐색)
const ODSAY_KEY = process.env.EXPO_PUBLIC_ODSAY_API_KEY;
const ODSAY_BASE = 'https://api.odsay.com/v1/api';

// oprtngSitu 코드 → 사용가능 여부
export const isElevatorAvailable = (oprtngSitu) => oprtngSitu === 'M';

// oprtngSitu 한글 설명
export const elevatorStatusLabel = (oprtngSitu) => ({
  M: { ko: '정상 운행', en: 'In Service' },
  I: { ko: '점검 중', en: 'Inspection' },
  S: { ko: '보수 중', en: 'Under Repair' },
  T: { ko: '운행 중지', en: 'Suspended' },
  B: { ko: '공사 중', en: 'Construction' },
}[oprtngSitu] || { ko: '알 수 없음', en: 'Unknown' });

// ── 서울교통공사: 역별 엘리베이터 실시간 가동현황 ──────
// getWksnElvtr: 실시간 상태(oprtngSitu) 포함
export async function fetchSeoulElevatorStatus(stnNm) {
  if (!stnNm) return [];
  // stnNm에서 '역' 접미사 제거 (API 매칭용)
  const cleanNm = stnNm.replace(/역$/, '');

  // 1/1000으로 범위를 넓혀서 조회 (파라미터 필터링이 불안정할 경우 대비)
  const url = `${SEOUL_BASE}/${SEOUL_KEY}/json/getWksnElvtr/1/1000/`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    // getWksnElvtr 경로 확인 (테스트 결과에 기반)
    const all = data?.getWksnElvtr?.row || data?.response?.body?.items?.item || [];

    // JS에서 역명으로 필터링
    return all.filter(it => it.stnNm.includes(cleanNm) || cleanNm.includes(it.stnNm));
  } catch (err) {
    console.error('[Seoul] fetchStatus Error:', err);
    return [];
  }
}


// 서울 지하철 운영기관 코드 (서울교통공사)
export const RAIL_OPR_ISTT_CD = 'S1';

// 호선 → 선코드 매핑
export const LINE_TO_LN_CD = {
  '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
};

export async function kricGet(serviceId, operationId, params = {}) {
  // KRIC API key ($2a$...) requires special handling - $ characters should not be encoded
  const safeParams = new URLSearchParams({
    format: 'json',
    ...params,
  }).toString();

  // KRIC API는 serviceKey 파라미터에 $ 문자가 인코딩되지 않아야 함
  // URL을 직접 구성하여 $ 문자를 보존
  const url = `${BASE_URL}/${serviceId}/${operationId}?serviceKey=${API_KEY}&${safeParams}`;
  console.log('[KRIC] GET', url.replace(API_KEY, '***REDACTED***')); // Hide key in logs

  try {
    const res = await fetch(url);
    const text = await res.text();

    if (text.trim().startsWith('<')) {
      throw new Error('XML/HTML 응답: ' + text.slice(0, 300));
    }

    const json = JSON.parse(text);

    // KRIC API 오류 처리 강화
    if (json.header?.resultMsg !== 'OK' && json.header?.resultMsg !== '정상 처리되었습니다.') {
      const msg = json.header?.resultMsg || 'Unknown';
      const resultCode = json.header?.resultCode || 'UNKNOWN';

      console.log(`[KRIC] ${serviceId}/${operationId} Result:`, msg, `(Code: ${resultCode})`);

      // 권한 관련 오류 처리
      if (msg.includes('권한') || msg.includes('인증') || msg.includes('등록되지 않은') || resultCode === '30') {
        console.warn(`⚠️ [KRIC] 권한 오류: '${serviceId}/${operationId}' 서비스에 접근 권한이 없습니다.`);
        console.warn(`⚠️ KRIC 포털에서 해당 서비스를 추가로 '신청'해야 합니다.`);
        throw new Error(`KRIC_API_PERMISSION_DENIED: ${serviceId}/${operationId} - ${msg}`);
      }

      // 데이터 없음 오류 처리
      if (msg.includes('데이터가 없습니다') || msg.includes('데이터 없음') || resultCode === '99') {
        console.log(`[KRIC] 데이터 없음: ${serviceId}/${operationId}`);
        return { header: json.header, body: [] };
      }

      // 기타 오류
      throw new Error(`KRIC_API_ERROR: ${serviceId}/${operationId} - ${msg} (Code: ${resultCode})`);
    }

    return json;

  } catch (error) {
    console.error(`[KRIC] API 호출 실패: ${serviceId}/${operationId}`, error.message);

    // 네트워크 오류인 경우 재시도 메커니즘
    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.warn('⚠️ 네트워크 오류 발생, 오프라인 모드로 전환됩니다.');
      throw new Error('NETWORK_ERROR');
    }

    throw error;
  }
}

// KRIC 응답에서 아이템 리스트를 안전하게 추출하는 유틸리티
export function getKricItems(res) {
  if (!res) return [];
  // 1. body가 배열인 경우
  if (Array.isArray(res.body)) return res.body;
  // 2. body.item 또는 body.items가 있는 경우
  if (res.body?.item) return Array.isArray(res.body.item) ? res.body.item : [res.body.item];
  if (res.body?.items) return Array.isArray(res.body.items) ? res.body.items : [res.body.items];
  // 3. items가 바로 있는 경우
  if (Array.isArray(res.items)) return res.items;
  if (res.items?.item) return Array.isArray(res.items.item) ? res.items.item : [res.items.item];
  // 4. 데이터가 하나뿐이라 객체로 온 경우 (또는 인덱스가 키인 객체인 경우)
  if (res.body && typeof res.body === 'object' && !Array.isArray(res.body)) {
    // 인덱스 키만 있는 경우(0, 1, 2...) 배열로 변환
    const keys = Object.keys(res.body);
    if (keys.length > 0 && keys.every(k => !isNaN(k))) {
      return Object.values(res.body);
    }
    return [res.body];
  }

  console.log('[KRIC] No items found in response');
  return [];
}


// ── 역별 엘리베이터 현황 ─────────────────────────────────────
// serviceId: convenientInfo / operationId: stationElevator
// 파라미터: railOprIsttCd, lnCd, stinCd (역코드)
export async function fetchStationElevators({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationElevator', params);
}

// ── 역별 엘리베이터 이동동선 ─────────────────────────────────
// serviceId: vulnerableUserInfo / operationId: stationElevatorMovement
export async function fetchElevatorMovement({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('vulnerableUserInfo', 'stationElevatorMovement', params);
}

// ── 교통약자 역사 내 엘리베이터 이동동선 ─────────────────────
// serviceId: trafficWeekInfo / operationId: stinElevatorMovement
// 파라미터: railOprIsttCd, lnCd, stinCd
export async function fetchStinElevatorMovement({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('trafficWeekInfo', 'stinElevatorMovement', params);
}

// ── 출입구 승강장 이동경로 ────────────────────────────────────
// serviceId: handicapped / operationId: stationMovement
export async function fetchStationMovement({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('handicapped', 'stationMovement', params);
}

// ── 환승 이동경로 ───────────────────────────────────
// serviceId: vulnerableUserInfo / operationId: transferMovement
export async function fetchTransferMovement({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd, prevStinCd, chthTgtLn, chtnNextStinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  if (prevStinCd) params.prevStinCd = prevStinCd;
  if (chthTgtLn) params.chthTgtLn = chthTgtLn;
  if (chtnNextStinCd) params.chtnNextStinCd = chtnNextStinCd;
  return kricGet('vulnerableUserInfo', 'transferMovement', params);
}

// ── 역사별 화장실 위치 ──────────────────────────────────
// serviceId: convenientInfo / operationId: stationToilet
export async function fetchStationToilet({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationToilet', params);
}

// ── 역사별 장애인 화장실 위치 ───────────────────────────────
// serviceId: vulnerableUserInfo / operationId: stationDisabledToilet
export async function fetchStationDisabledToilet({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('vulnerableUserInfo', 'stationDisabledToilet', params);
}

// ── 역사별 물품보관소 위치 ──────────────────────────────────
// serviceId: convenientInfo / operationId: stationLocker
export async function fetchStationLocker({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationLocker', params);
}

// ── 역사별 편의시설 (수유실, 리프트 등) ──────────────
// serviceId: handicapped / operationId: stationCnvFacl
export async function fetchStationCnvFacl({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('handicapped', 'stationCnvFacl', params);
}

// ── 역사별 수유실 위치 ──────────────────────────────────
// serviceId: convenientInfo / operationId: stationDairyRoom
export async function fetchStationDairyRoom({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationDairyRoom', params);
}

// ── 역사별 유실물 센터 ──────────────────────────────────
// serviceId: convenientInfo / operationId: stationLostPropertyOffice
export async function fetchStationLostPropertyOffice({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationLostPropertyOffice', params);
}

// ── 역사별 휠체어 리프트 위치 ─────────────────────────────
// serviceId: vulnerableUserInfo / operationId: stationWheelchairLiftLocation
export async function fetchStationWheelchairLift({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('vulnerableUserInfo', 'stationWheelchairLiftLocation', params);
}

// ── 역사별 ATM 위치 ────────────────────────────────────────────
// serviceId: convenientInfo / operationId: stationAtm
export async function fetchStationAtm({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationATM', params);
}

// ── 역사별 에스컬레이터 현황 ─────────────────────────────
// serviceId: convenientInfo / operationId: stationEscalator
export async function fetchStationEscalators({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationEscalator', params);
}

// ── 역사별 출구정보 (랜드마크) ─────────────────────────────
// serviceId: convenientInfo / operationId: stationGateInfo
export async function fetchStationGateInfo({ railOprIsttCd = RAIL_OPR_ISTT_CD, lnCd, stinCd } = {}) {
  const params = { railOprIsttCd };
  if (lnCd) params.lnCd = lnCd;
  if (stinCd) params.stinCd = stinCd;
  return kricGet('convenientInfo', 'stationGateInfo', params);
}

// ── 도시철도 전체노선정보 ─────────────────────────────
// serviceId: trainUseInfo / operationId: subwayRouteInfo
// 파라미터: mreaWideCd (01: 수도권), lnCd (호선)
export async function fetchSubwayRouteInfo({ mreaWideCd = '01', lnCd } = {}) {
  const params = { mreaWideCd };
  if (lnCd) params.lnCd = lnCd;
  return kricGet('trainUseInfo', 'subwayRouteInfo', params);
}

// ── ODSay API ────────────────────────────────────────────────────────────────

/**
 * ODSay 역 검색: 역명 → ODSay stationID 목록
 * 런타임에서 DB 미스 시 fallback으로 사용.
 * 일반적으로는 DB의 odsay_station_id를 우선 사용할 것.
 * @returns {Array} [{ stationID, stationName, laneName, laneID, x, y }]
 */
// ODSay는 등록된 URI에서 오는 요청만 허용 (Referer 헤더 필수)
const ODSAY_HEADERS = { Referer: 'http://localhost' };

export async function fetchODSaySearchStation(stationName) {
  if (!ODSAY_KEY) {
    console.warn('[ODSay] EXPO_PUBLIC_ODSAY_API_KEY 미설정');
    return [];
  }
  const url = `${ODSAY_BASE}/searchStation?apiKey=${encodeURIComponent(ODSAY_KEY)}&CID=1000&stationClass=2&stationName=${encodeURIComponent(stationName)}`;
  console.log('[ODSay] searchStation:', stationName);
  try {
    const res = await fetch(url, { headers: ODSAY_HEADERS });
    const json = await res.json();
    if (json.error) {
      console.error('[ODSay] searchStation error:', json.error.message || JSON.stringify(json.error));
      return [];
    }
    return json.result?.station || [];
  } catch (err) {
    console.error('[ODSay] searchStation fetch error:', err);
    return [];
  }
}

/**
 * ODSay 지하철 경로탐색
 * @param {number} SID - 출발역 ODSay stationID
 * @param {number} EID - 도착역 ODSay stationID
 * @param {number} Sopt - 1: 최소시간, 2: 최소환승, 3: 최단거리
 * @returns {Object|null} { path: [...] } 또는 null
 */
export async function fetchODSaySubwayPath(SID, EID, Sopt = 1) {
  if (!ODSAY_KEY) {
    console.warn('[ODSay] EXPO_PUBLIC_ODSAY_API_KEY 미설정');
    return null;
  }
  const url = `${ODSAY_BASE}/subwayPath?apiKey=${encodeURIComponent(ODSAY_KEY)}&CID=1000&SID=${SID}&EID=${EID}&Sopt=${Sopt}`;
  console.log(`[ODSay] subwayPath SID=${SID} EID=${EID} Sopt=${Sopt}`);
  try {
    const res = await fetch(url, { headers: ODSAY_HEADERS });
    const json = await res.json();
    console.log('[ODSay] subwayPath raw:', JSON.stringify(json).slice(0, 400));
    if (json.error) {
      console.error('[ODSay] subwayPath error:', json.error.message || JSON.stringify(json.error));
      return null;
    }
    return json.result || null;
  } catch (err) {
    console.error('[ODSay] subwayPath fetch error:', err);
    return null;
  }
}
