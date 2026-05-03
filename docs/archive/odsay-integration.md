# ODSay 경로탐색 통합

## 개요

Data.go.kr `getShtrmPath` API가 불안정(2026-04-16 기준 조회 불가)하여 ODSay API로 경로탐색을 교체.
KRIC API(엘리베이터 동선)는 그대로 유지. ODSay는 **경로 구간(PathFinder)** 에만 사용.

---

## 아키텍처

```
ODSay subwayPath
      ↓
PathFinder (rawItems 변환)
      ↓
RouteAssembler
      ↓
KRIC API (stin_cd로 엘리베이터 이동동선)
← stations 테이블 name+line 매칭
```

ODSay와 KRIC 데이터는 PathFinder 출력의 `stnNm`/`lineNm`을 통해 간접 연결됨.
`odsay_station_id`는 PathFinder에서 ODSay 호출 시에만 사용, RouteAssembler는 무관.

---

## ODSay API

- **엔드포인트**: `https://api.odsay.com/v1/api/`
- **인증**: `apiKey` 쿼리 파라미터 + **`Referer: http://localhost` 헤더 필수**
  - ODSay는 등록된 URI에서만 호출 허용. 헤더 없으면 `ApiKeyAuthFailed` 오류.
- **사용 API**:
  - `searchStation` — 역명 → ODSay stationID (매핑 스크립트 / DB 미스 fallback용)
  - `subwayPath` — 경로탐색 (Sopt=2 최소환승 우선, 미지원 호선 포함 시 Sopt=1 최소시간으로 fallback)
- **환경변수**: `EXPO_PUBLIC_ODSAY_API_KEY`
- **무료 한도**: 1,000건/일

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/api/seoulApi.js` | `fetchODSaySearchStation`, `fetchODSaySubwayPath` 함수 |
| `src/services/PathFinder.js` | ODSay 기반 경로탐색, odsay_route_cache 캐시 |
| `src/services/RouteService.js` | stations 쿼리에 `odsay_station_id` 포함 |
| `scripts/map-odsay-stations.js` | 전 역 odsay_station_id DB 매핑 스크립트 |

---

## DB 변경사항

### `stations` 테이블 — 컬럼 추가
```sql
ALTER TABLE stations ADD COLUMN IF NOT EXISTS odsay_station_id INTEGER;
```
역명+호선으로 ODSay stationID를 미리 매핑해두어 런타임 searchStation 호출 최소화.

### `odsay_route_cache` 테이블 — 신규 생성 (완료)
```sql
CREATE TABLE odsay_route_cache (
  id SERIAL PRIMARY KEY,
  route_key TEXT NOT NULL UNIQUE,
  candidates JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
캐시 키: `출발역명_호선|도착역명_호선` 형식.

---

## 역코드 매핑 스크립트

```bash
# dry-run (DB 저장 없이 결과 확인)
node scripts/map-odsay-stations.js --dry-run

# 특정 호선만
node scripts/map-odsay-stations.js --line 2호선

# 전체 저장
node scripts/map-odsay-stations.js
```

- DB에 `odsay_station_id`가 없는 역만 처리
- 호선 불일치 시 첫 번째 결과로 fallback (로그에 표시됨)
- API 호출 간격 150ms (일 1,000건 한도 준수)

---

## PathFinder 캐시 (`USE_ODSAY_CACHE`)

`src/services/PathFinder.js` 상단의 플래그:

```js
const USE_ODSAY_CACHE = false; // 테스트 완료 후 true로 변경
```

- `false`: ODSay API 직접 호출, DB 저장 안 함 (기본값 — 초기 테스트용)
- `true`: `odsay_route_cache` DB 우선 조회, 미스 시 ODSay 호출 후 저장

캐시 대상: PathFinder의 `rawItems` (경로 구간 구조). KRIC 번역 데이터는 별도 캐시(RouteService).

---

## 미완료 / 후속 작업

- [x] `map-odsay-stations.js` 실행하여 `odsay_station_id` 전 역 채우기 (337개 완료, 2026-04-17)
- [ ] 앱에서 경로탐색 E2E 테스트
- [ ] 테스트 완료 후 `USE_ODSAY_CACHE = true` 활성화
