# elevators 테이블 — 데이터 출처 및 업데이트 가이드

## 개요

`elevators` 테이블은 서울·수도권 지하철 역사 내 엘리베이터 마스터 데이터를 저장한다.
경로 조회 시 **출구 연결 엘리베이터**(`is_internal=FALSE`)와 **승강장 내부 엘리베이터**(`is_internal=TRUE`) 정보를 제공한다.

---

## 데이터 출처

### 기본 소스: KRIC `stationElevator` API

- **엔드포인트**: `https://openapi.kric.go.kr/openapi/convenientInfo/stationElevator`
- **KRIC 포털**: https://data.kric.go.kr/rips/M_01_02/detail.do?id=189&service=convenientInfo&operation=stationElevator
- **인증**: `EXPO_PUBLIC_KRIC_SERVICE_KEY` (`.env`)
- **파라미터**: `railOprIsttCd`, `lnCd`, `stinCd`

### 운영기관코드 (`railOprIsttCd`) — 노선별 매핑

| railOprIsttCd | 운영기관 | 해당 노선 | API 제공 여부 |
|---|---|---|---|
| `S1` | 서울교통공사 | 1~8호선(코레일 구간 제외) | ✅ |
| `KR` | 코레일(한국철도공사) | 1호선 경인선 구간 (용산~구로~가산디지털단지 등) | ✅ |
| `AR` | 공항철도(주) | 공항철도 전 구간 | ✅ |
| `S9` | 서울시메트로9호선운영(주) | 9호선 전 구간 | ❌ KRIC 미제공 |

> **DB의 `stations.kric_opr_cd` 컬럼이 위 코드와 동일**하므로, 업데이트 시 이 컬럼을 기준으로 사용한다.

---

## API 응답 필드 → DB 컬럼 매핑

| API 필드 | DB 컬럼 | 비고 |
|---|---|---|
| `stinCd` | `stin_cd` | 역코드 |
| `lnCd` | `line` (간접) | stations 테이블 참조 |
| `exitNo` | `exit_no` | `"내부"` 이면 `is_internal=TRUE` |
| `dtlLoc` | `location_detail_ko` | 상세위치 텍스트 |
| `grndDvNmFr` | — | **DB 미저장** — 운행시작 지상/지하 구분 |
| `grndDvNmTo` | — | **DB 미저장** — 운행종료 지상/지하 구분 |
| `runStinFlorFr` | — | **DB 미저장** — 운행 시작 층수 |
| `runStinFlorTo` | — | **DB 미저장** — 운행 종료 층수 |
| `rglnPsno` | — | **DB 미저장** — 정원 인원 |
| `rglnWgt` | — | **DB 미저장** — 정원 중량 |
| `railOprIsttCd` | — | **DB 미저장** — stations.kric_opr_cd로 대체 |

### API에 없는 DB 컬럼 (파생 또는 별도 처리)

| DB 컬럼 | 출처 |
|---|---|
| `station_name_ko` | `stations.name_ko` 조인 |
| `is_internal` | `exit_no === '내부'` 여부 |
| `toward_station_ko` | `location_detail_ko` 파싱 (`populate_direction_data.mjs`) |
| `car_number` | `location_detail_ko` 파싱 (`populate_direction_data.mjs`) |
| `door_number` | `location_detail_ko` 파싱 (`populate_direction_data.mjs`) |
| `quick_exit_alt` | `location_detail_ko` 파싱 — 섬식 승강장 복수 방면 |
| `boarding_positions` | 별도 수동 입력 |

---

## 노선별 데이터 현황 (2026-04-17 기준)

| 노선 | API 제공 | DB 적재 | 비고 |
|---|---|---|---|
| 1호선 (S1 구간) | ✅ | ✅ | |
| 1호선 (KR 구간) | ✅ | ⚠️ 일부 누락 | 초기 적재 시 KR 코드 누락 |
| 2~8호선 (S1) | ✅ | ✅ 대부분 | 일부 역 누락 확인됨 |
| 9호선 1단계 (901~925) | ❌ | ✅ | CSV 직접 적재 (API 미제공) |
| 9호선 2단계 (926~938) | ❌ | ❌ | KRIC 미제공, 출처 없음 |
| 공항철도 (AR) | ✅ | ⚠️ 누락 | 초기 적재 시 AR 코드 누락 |

---

## 업데이트 방법

### 1단계: API → DB 동기화

```bash
node scripts/sync-elevators-from-api.js [--dry-run]
```

- `--dry-run`: DB 저장 없이 신규/변경 건수만 출력
- 중복 판별 기준: `stin_cd + exit_no + location_detail_ko` 조합
- 9호선은 API 미제공으로 스킵

### 2단계: 내부 엘리베이터 방향 데이터 파싱

```bash
node scripts/populate_direction_data.mjs
```

- `location_detail_ko`에서 `toward_station_ko`, `car_number`, `door_number` 추출
- `is_internal=TRUE`인 신규 레코드에 대해 실행

---

## 주기적 업데이트 체크리스트

- [ ] KRIC API에서 신규 역 추가 여부 확인 (`sync-elevators-from-api.js --dry-run`)
- [ ] 9호선 2단계 데이터 외부 출처 확인 (서울시메트로9호선 공식 자료 등)
- [ ] `grndDvNmFr/To`, `runStinFlorFr/To` 필드 활용 여부 재검토 (지상/지하·층수 정보)
