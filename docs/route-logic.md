# 교통약자 경로 탐색 로직 (Route Logic)

> 최종 업데이트: 2026-04-21
> 대상 파일: `PathFinder.js` · `RouteAssembler.js` · `RouteService.js` · `RoutePreviewScreen.js`
> DB 설정 스크립트: `scripts/populate_direction_data.mjs`

---

## 1. 전체 흐름

경로 조회는 5단계 Phase로 진행된다.

### Phase 1 — 경로 후보 수집

```
RoutePreviewScreen.handleFindRoute()
  └─ RouteService 인스턴스 생성
       ├─ _loadStations()  →  Supabase stations 전체 로드 (인스턴스 메모리 캐시)
       └─ PathFinder.findCandidatePaths()
             └─ Data.go.kr API 순차 시도: transfer → duration → distance
                   미지원 노선 없는 첫 결과 채택
                   세 유형 모두 실패 → UNSUPPORTED_LINE_TRANSFER 에러
```

`_processPath()`: API 응답을 출발+환승+도착 경계역만 압축,
`prevStn` / `afterTransferStn` / `intermediateStations` 첨부.

### Phase 2 — 출구 목록 식별

```
RouteService.getRouteAndAvailableExits()
  └─ RouteAssembler.identifyExitsForCandidate()
       ├─ 출발역: _findCodes() → KRIC fetchStationMovement()
       │     mvContDtl 정규식 /(\d+)번\s*(?:출구|출입구)/ 로 출구 번호 추출
       └─ 도착역: 동일 처리
             → availableOriginExits[], availableDestExits[] 반환
```

UI는 자동으로 첫 번째(최소 번호) 출구 선택.

### Phase 3 — 엘리베이터 실시간 상태 (선택적)

출구가 여러 개인 경우에만 실행.

```
fetchSeoulElevatorStatus()  (Supabase 프록시 경유)
  → oprtngSitu === 'M' (운행 중)인 최소 번호 출구로 자동 전환
  → 전환 발생 시 Phase 4 재실행 (isPartialLoading 상태)
```

### Phase 4 — 상세 경로 확정

```
RouteService.finalizeRoute()
  └─ RouteAssembler.findValidatedPath()
       └─ _verifyCandidate(): rawItems의 각 역 순회
            ├─ fetchSeoulElevatorStatus()  →  item.elevatorStatuses 첨부
            ├─ fetchStationMovement() or fetchTransferMovement()  (KRIC)
            │     mvPathMgNo로 그룹화 → 출구번호·방향 기준 최적 그룹 선택
            │     movement_steps (한국어 원문) 구성
            ├─ _fetchTranslatedSteps()
            │     Supabase Edge Function 'translate-movement'
            │       ├─ movement_translations DB 캐시 조회 (SHA-256 hash_key)
            │       │     hit  → 즉시 반환
            │       │     miss → Gemini 2.5 Flash 번역 → DB 저장
            │       └─ 실패 → _linesToSteps() fallback (translation_dict + 정규식)
            └─ _enrichSteps()
                  elevators 테이블 조회
                    is_internal=FALSE → exit_no 첨부
                    is_internal=TRUE  → car_position 첨부
```

검증 게이트: `originSteps.length > 0` AND `destinationSteps.length > 0`
실패 시 `isBarrierFree=false` fallback으로 반환.

### Phase 5 — 결과 표시

```
RoutePreviewScreen._handleFinalRouteReady()
  ├─ stations.name_en 조회 → stationNameMap 구성
  └─ ResultView 렌더링

출구 변경 시: Phase 4만 재실행 (Phase 1-2 스킵)
```

---

## 2. PathFinder — 경로 후보 수집

**파일**: `src/services/PathFinder.js`

### 2-1. API 호출

공공데이터포털 (`apis.data.go.kr/B553766/path`) 의 `fetchShtrmPath`를 아래 순서로 시도합니다.  
미지원 노선이 경유에 포함되지 않는 결과가 나오면 그 시점에서 채택하고 이후 유형은 건너뜁니다.

| 순서 | searchType | 설명 |
|------|------------|------|
| 1 | `transfer` | 최소환승 (우선) |
| 2 | `duration` | 최소시간 |
| 3 | `distance` | 최단거리 |

세 유형 모두 미지원 노선 경유 경로만 반환하면 `UNSUPPORTED_LINE_TRANSFER` 에러를 throw → UI에서 "Route unavailable" 표시.

**지원 노선 (`SUPPORTED_LINES`)**: `1호선` ~ `9호선`, `공항철도`  
신분당선·경강선·GTX 등 KRIC 엘리베이터 데이터가 없는 노선은 미지원.

미지원 노선 감지 기준:
```js
rawItems.filter(item =>
    item.transferYn === 'Y'
    && item.transferToLineNm
    && !SUPPORTED_LINES.has(item.transferToLineNm)
)
```

**호선 선택 없음**  
사용자는 역명만 선택하며 호선을 지정하지 않습니다. Data.go.kr API가 역명 기반으로 최적 경로를 자체 결정합니다.  
출발·도착역의 실제 호선은 API 응답의 `lineNm`에서 확인하며, UI(TimelineCard, 결과 헤더 카드 색상)는 이 값 기준으로 렌더링합니다.

### 2-2. Candidate 구조

API가 반환하는 역-by-역 세그먼트를 **경계 역만** 압축합니다.

```
세그먼트 배열 → 출발역(idx=0) + 환승역(trsitYn='Y') + 도착역(마지막)
```

각 `rawItem`에 첨부되는 핵심 필드:

| 필드 | 설명 |
|------|------|
| `stnNm` | 역명 |
| `lineNm` | 노선명 (예: "2호선") |
| `transferYn` | 환승 여부 `'Y'/'N'` |
| `transferToLineNm` | 환승 후 탑승 노선명 (API `trfstnNms` 기반, 정확도 높음) |
| `transferFromLineNm` | 환승 전 탑승 노선명 (`trfstnNms.dptreLineNm`) |
| `afterTransferStn` | 환승 후 바로 다음 역 `{stnNm, lineNm}` (방향 판별용) |
| `afterTransferStnCd` | 환승 후 다음 역 `stnCd` (`paths[i+1].arvlStn.stnCd`) |
| `prevStn` | 환승역 직전 역 `{stnNm, lineNm}` |
| `prevStnCd` | 환승 직전 역 `stnCd` (`paths[i-1].dptreStn.stnCd`) |
| `datagokrStnCd` | Data.go.kr `stnCd` → KRIC `stinCd`와 동일 코드 체계 |
| `stopCountToNext` | 다음 경계역까지 구간 수 |
| `intermediateStations` | 중간 경유 역 목록 (방향 판별 보조) |
| `brlnNm` | 지선명 (신정지선 등) |

### 2-3. 역 검색 필터 (SearchingView)

검색 목록은 `LINE_COLORS` (= `src/constants/data.ts`) 키에 정의된 노선만 표시한다.  
`LINE_COLORS`가 지원 노선의 단일 진실 소스(source of truth) 역할을 한다.

```ts
.filter((s) => LINE_COLORS[String(s.line)] !== undefined)
```

GPS 주변 역 검색에도 동일하게 적용된다. 신분당선 등 미지원 노선 역은 검색 목록에 노출되지 않는다.

**역 단위 그룹핑**  
동일 역명의 여러 호선(예: 시청 1·2호선)을 하나의 항목으로 표시하며, 호선 배지를 오른쪽에 나열합니다 (예: `① ②`).  
사용자는 역명만 선택하고 호선은 API 응답이 결정합니다.

```ts
// SearchingView — stations를 name_ko 기준으로 그룹핑
const groupMap = new Map();
rows.forEach(s => {
    if (!groupMap.has(s.name_ko)) groupMap.set(s.name_ko, { ...s, lines: [s.line] });
    else groupMap.get(s.name_ko).lines.push(s.line);
});
```

### 2-4. 후보 정렬

순차 시도 방식이므로 별도 정렬·중복 제거 불필요. 세 유형 모두 결과가 없으면 `UNSUPPORTED_LINE_TRANSFER` 에러.

---

## 3. RouteAssembler — 검증 및 풍부화

**파일**: `src/services/RouteAssembler.js`

### 3-1. 역할

PathFinder 후보를 순위대로 하나씩 검증합니다.
**출발 / 환승 / 도착** 각 역에 KRIC API를 호출하여 배리어프리 이동 동선 데이터를 확인하고,
출발·도착 `atoms`(이동 단계 배열) + 이미지 경로를 후보에 첨부합니다.

### 3-2. _findCodes() — 역 코드 조회

DB `stations` 테이블에서 KRIC API 파라미터를 조회합니다.

**정규화 규칙:**
- 역명: 괄호 제거 + `역` 접미사 제거 (예: `"서울역(1호선)"` → `"서울"`)
- 노선명: `호선` / `선` 접미사 제거, `"02"` → `"2"`, `"공항"` → `"공항철도"`

**조회 우선순위:**
0. `datagokrStnCd` 정확 매칭 (Data.go.kr `stnCd` = KRIC `stinCd` 동일 코드 체계)
1. 역명 + 노선명 정규화 매칭

반환값: `{ oprCd, lnCd, stinCd, stationCd }`

### 3-3. _verifyCandidate() 처리 흐름

```
rawItems 순회
  ├─ isDeparture (i === 0)
  ├─ isArrival   (i === 마지막)
  └─ isTransfer  (transferYn='Y' OR 같은 역명이지만 lineNm 다음에 변경)
         │
         ├─ [STEP A] fetchSeoulElevatorStatus() — 실시간 엘리베이터 상태
         │
         ├─ isTransfer  → fetchTransferMovement() (KRIC)
         ├─ otherwise   → fetchStationMovement()  (KRIC)
         │
         ├─ mvPathMgNo 기준으로 pathGroups 구성
         │
         └─ 컨텍스트별 bestPathId 선택 (아래 3-4 참조)
               └─ atoms 생성 → candidate에 첨부
```

### 3-5. 이동 단계 번호 산정 규칙 (Step Numbering)

사용자 시각 매칭을 위해 출발역과 도착역의 번호 산정 방식이 다릅니다.

- **출발역 (Departure)**: **순방향 (1, 2, 3...)**
    - 출구에서 승강장으로 진입하는 순서대로 번호를 부여합니다.
- **도착역 (Arrival / Destination)**: **내용 및 번호 역순 (N...1)**
    - **이유**: 역사 내 가이드 데이터(KRIC)는 보통 '진입(출구→승강장)' 기준으로 생성되어 있습니다. 도착한 사용자는 승강장에서 출구로 나가며 이 과정을 거꾸로 밟게 되므로, **안내 데이터 배열 자체를 역순으로 뒤집어** 실제 동선(승강장→출구)에 맞추고, 각 단계의 번호는 가이드 이미지 속 번호와 일치시키기 위해 역순으로 부여합니다.

### 3-4. KRIC API 파라미터

#### 출발/도착역 — `fetchStationMovement`

```
railOprIsttCd  = station.kric_opr_cd
lnCd           = station.ln_cd
stinCd         = station.stin_cd
```

#### 환승역 — `fetchTransferMovement`

```
railOprIsttCd  = 환승 전 노선 opr_cd
lnCd           = 환승 전 노선 ln_cd
stinCd         = 환승역 stin_cd
chthTgtLn      = 환승 후 탑승 노선 ln_cd
chtnNextStinCd = afterTransferStnCd → _datagokrToStinCd() 변환
                 (null이면 파라미터 미전달 — 잘못된 fallback 사용 금지)
```

> **📌 주요 로직 변경 (prevStinCd 생략):**  
> `vulnerableUserInfo/transferMovement` API는 `prevStinCd` 파라미터를 **환승 도착 노선의 이전 역**으로 기대하는 문제가 있습니다. 우리가 타고 온 출발 노선의 코드를 넣으면 데이터가 누락됩니다.  
> 따라서 **`prevStinCd` 파라미터를 API 호출 시 아예 생략**합니다. 생략 시 API는 환승 도착지(`edMovePath`)가 고정된 상태로 **환승 전 탑승 노선의 모든 방면 경우의 수(`stMovePath`)** 를 반환하며, RouteAssembler는 이 리스트 중에서 우리가 알고 있는 `prevStnNm`(이전 방면 역명)이 포함된 `stMovePath`를 필터링하여 정확한 환승 동선을 골라냅니다.

**핵심 원칙 — Index Neighbor Mapping:**

Data.go.kr `getShtrmPath` 응답 `paths` 배열의 **선형 인덱스**를 그대로 신뢰한다.
환승 노드(`trsitYn === 'Y'`) 기준:

| 파라미터 | 추출 소스 |
|----------|-----------|
| `prevStnCd` | `paths[i-1].dptreStn.stnCd` |
| `afterTransferStnCd` | `paths[i+1].arvlStn.stnCd` |

- **Data.go.kr `stnCd` = KRIC `stinCd`**: 동일 코드 체계. `_findCodes()`에서 `datagokrStnCd`로 우선 매칭하여 1:1 고정 매핑.
- 단, 출발역 자체가 환승역이거나 **지선 환승**일 경우 KRIC API가 지선 코드를 인식하지 못해 데이터가 누락되는 이슈(빈 배열 반환)가 있어, 이 경우에 한해 예외적으로 `null` 파라미터로 우회(`bypass`) 처리합니다.

- DB 기반 `stin_cons_ordr` 비교 및 `DirectionResolver.getPrevStinCd()` 호출 **폐기**
- Fallback(이름 기반 DB 조회, steps 배열 탐색) **금지** — 데이터가 없으면 없는 대로 전달
- Data.go.kr `stnCd` == KRIC `stinCd` 전제 (두 API 공통 코드 체계 확인됨)

---

## 4. pathGroup 선택 로직

KRIC API는 한 역에서 방향(승강장 측)별로 복수의 경로 그룹을 반환합니다.

> **예시 (양천구청역):**
> Group A: `edMovePath = "도림천 방면"`
> Group B: `edMovePath = "신정네거리 방면"`

`mvPathMgNo` 기준으로 그룹화 후, 컨텍스트별 우선순위로 `bestPathId`를 선택합니다.

### 4-1. 출발역 (isDeparture) — 2단계

Data.go.kr API가 전체 역 순서를 반환하므로, **출발역 직후 역**은 `rawItems[0].intermediateStations[0]`에서 직접 읽는다. `DirectionResolver`나 `stin_cons_ordr` 연산 불필요.

```
1순위: 출구번호 포함 AND 다음역명(intermediateStations[0]) 포함
2순위: 출구번호 포함 (방향 무관)
```

- **출구번호**: `mvContDtl`에 `"N번"` 포함 여부
- **다음역명**: `rawItems[0].intermediateStations[0]` → `edMovePath` / `stMovePath` / `mvContDtl` 중 하나에 포함 여부로 방향 일치 확인

### 4-2. 도착역 (isArrival) — 2단계

```
1순위: mvContDtl에 목적지 출구번호("N번") 포함
2순위: 첫 번째 그룹
```

### 4-3. 환승역 (isTransfer) — Strict Filtering

우선순위 방식(rank-based fallback)을 지양하고 **반드시 아래 순서의 Strict Filtering**을 적용한다.

```
[필수 필터] stMovePath가 prevStn(환승 전 직전역) 이름 또는 지선명(brlnNm)을 포함하는
           그룹만 추출.

[검증] 위에서 추출된 그룹 중 edMovePath가 afterTransferStn(환승 후 다음역)을
       포함하는 그룹을 최종 선택.

[결과 없음] 필수 필터 결과가 없으면 다른 그룹을 억지로 선택하지 않고
            No Data 에러를 반환한다.
```

---

## 5. DirectionResolver — ⚠️ 폐기 예정

**파일**: `src/services/DirectionResolver.ts`

> **폐기 이유:** Data.go.kr `transfer` 단일 호출이 역 순서를 이미 제공한다.
> 출발역 다음 역(`intermediateStations[0]`), 환승 전 역(`prevStnCd`), 환승 후 역(`afterTransferStnCd`)
> 모두 API 응답에서 직접 읽으면 되므로 `stin_cons_ordr` 기반 연산이 필요 없다.

현재 코드에서 참조를 제거하고 파일을 삭제한다.

---

## 6. DB 스키마 — 방향 관련 컬럼

### 6-1. `stations` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `stin_cons_ordr` | SMALLINT | ⚠️ 미사용 — DirectionResolver 폐기와 함께 불필요. 삭제 예정. |

### 6-2. `elevators` 테이블 (내부 엘리베이터)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `toward_station_ko` | TEXT | 방면 역명 (파싱 결과) |
| `car_number` | SMALLINT | 열차 칸 번호 |
| `door_number` | SMALLINT | 문 번호 |
| `platform_side` | TEXT | ⚠️ 미사용 — DirectionResolver 폐기로 불필요. 삭제 예정. |
| `quick_exit_alt` | JSONB | 섬식 승강장 반대 방향 목록 `[{toward_station_ko, car_number, door_number}]` |

#### `location_detail_ko` 파싱 규칙

```
입력: "시청 방면5-3"
  → toward_station_ko = "시청"
  → car_number = 5
  → door_number = 3

입력: "삼각지 방면4-3, 이태원 방면5-1"  (섬식 승강장)
  → primary: toward="삼각지", car=4, door=3
  → quick_exit_alt: [{ toward_station_ko:"이태원", car_number:5, door_number:1 }]
```

---

## 7. populate_direction_data.mjs — DB 초기화 스크립트

**파일**: `scripts/populate_direction_data.mjs`

마이그레이션(`003_direction_and_quickexit.sql`) 실행 후 한 번 실행합니다.

### Step 1: stin_cons_ordr 계산

⚠️ 미사용 — DirectionResolver 폐기와 함께 불필요. 삭제 예정.

### Step 2: elevators 파싱

```
is_internal=TRUE AND location_detail_ko IS NOT NULL 엘리베이터 로드
  → location_detail_ko 파싱 ("역명 방면칸-문" 패턴)
  → toward_station_ko / car_number / door_number / quick_exit_alt upsert
```

실행 방법:
```bash
node scripts/populate_direction_data.mjs
```

---

## 8. RouteService — 오케스트레이션

**파일**: `src/services/RouteService.js`

```
getBarrierFreeRoute(departure, destination, onProgress)
  ├─ stations 로드 (캐시)
  │    SELECT: name_ko, line, ln_cd, kric_opr_cd, station_cd, stin_cd,
  │            datagokr_stn_cd, analysis_data, odsay_station_id
  │            (stin_cons_ordr 불필요 — DirectionResolver 폐기)
  │
  ├─ RouteAssembler 초기화 (stations 전달)
  │
  ├─ [prod] DB 캐시 조회 (30일 TTL)
  ├─ PathFinder.findCandidatePaths()   ← transfer 순차 시도
  └─ RouteAssembler.findValidatedPath()
        └─ 결과 [prod] cached_routes 테이블에 저장
```

---

## 9. 캐싱 레이어

| 레이어 | 범위 | 키 |
|--------|------|----|
| `_stationsCache` | RouteService 인스턴스 메모리 | — |
| `this.kricCache` | RouteAssembler 인스턴스 메모리 Map | `STN:oprCd:lnCd:stinCd` / `TRANS:oprCd:lnCd:stinCd:targetLn:nextStinCd` |
| `movement_translations` DB | Supabase 영구 | SHA-256 hash_key |
| `cached_routes` DB | Supabase 30일 TTL | `출발ID_도착ID_originExit_destExit` |

> KRIC 캐시는 인스턴스 단위로만 유지된다. 새 검색마다 RouteService 인스턴스를 새로 생성하므로 캐시가 초기화된다.

---

## 10. 에러 처리 및 Fallback

| 에러 상황 | 발생 위치 | 처리 |
|-----------|-----------|------|
| 모든 경로가 미지원 노선 경유 | PathFinder | `UNSUPPORTED_LINE_TRANSFER` throw → UI 에러 메시지 |
| 역 코드 매칭 실패 | `_findCodes()` | `null` 반환, 해당 역 안내 건너뜀 |
| KRIC 이동 동선 없음 | `_verifyCandidate()` | `isBarrierFree=false` fallback으로 반환 |
| 출구/방향 그룹 매칭 실패 | `_verifyCandidate()` | 첫 번째 그룹 사용, `originExitFallback=true` 플래그 |
| 번역 Edge Function 실패 | `_fetchTranslatedSteps()` | `_linesToSteps()` 로컬 번역 (translation_dict DB + 정규식) |
| 엘리베이터 상태 조회 실패 | RoutePreviewScreen | 무시, 자동 출구 전환 없이 진행 |

---

## 11. 핵심 결정 이력

| 일자 | 결정 | 이유 |
|------|------|------|
| 초기 | PathFinder에서 경로 후보를 3개(transfer/duration/distance) 수집 | 단일 API는 배리어프리 조건 충족 불확실 |
| 초기 | KRIC `stinCd`로만 역 코드 사용 (`station_cd` 혼용 금지) | KRIC API 파라미터 규격 |
| 이전 세션 | PathFinder에서 `afterTransferStn` / `prevStn` 보존 | 환승 방향 판별 정확도 향상 |
| 이전 세션 | `transferToLineNm`을 `trfstnNms` API 응답에서 추출 | 환승 노선 혼동 방지 |
| 이전 세션 | 지선(신정지선 등) 환승을 `brlnNm`으로 별도 처리 | 지선 환승 시 그룹 매칭 실패 방지 |
| 이전 세션 | 출발 경로 선택에 `nextStation` 이름 매칭 추가 | 동일 출구로 양방향 승강장 진입 가능 케이스 대응 |
| 이번 세션 | `DirectionResolver` 도입, `stin_cons_ordr` DB 컬럼 추가 | stin_cd 비교만으로는 2호선 순환·1호선 분기 처리 불가 |
| 이번 세션 | `prevStinCd`를 `fetchTransferMovement`에 전달 | KRIC API가 FROM 방향 정보로 정확한 이동 동선 반환 |
| 이번 세션 | 출발 경로 선택 4단계화 (platform_side 우선 매칭 추가) | 섬식 승강장에서 잘못된 방향 경로 선택 방지 |
| 이번 세션 | `nextItem` 미정의 버그 수정 (transfer 블록) | `nextItem`이 transfer API 호출 전에 정의되지 않아 crash |
| 2026-03-23 | `transferFromLineNm`을 PathFinder에서 저장 (`trfstnNms.dptreLineNm`) | 지선 환승 그룹 매칭에 필요 |
| 2026-03-23 | 지선 환승 버그 수정 | KRIC API가 지선 stinCd(247 등)를 인식 못해 `"데이터 없음"` 응답을 반환하여 환승 상세 경로가 아예 누락되는 구조적 버그 발견. 지선일 경우에만 `prevStinCd`를 `null`로 우회하되, **명칭 기반 필터링(stMovePath 매칭)**을 통해 실제 엘리베이터 이동 그룹을 반드시 찾아내도록 로직을 강화함. |
| 2026-03-24 | **DirectionResolver 폐기 결정** | Data.go.kr `transfer` 단일 호출이 전체 역 순서를 반환하므로 `stin_cons_ordr` 기반 방향 연산이 불필요함. 출발역 다음 역 = `intermediateStations[0]`, 환승 인접역 = `prevStnCd`/`afterTransferStnCd` 모두 API 응답에서 직접 읽음. `stin_cons_ordr`, `platform_side` DB 컬럼 및 `populate_direction_data.mjs` Step 1 삭제 예정. |
| 2026-03-23 | **Exact datagokr_stn_cd Match & Index Neighbor Mapping 보완** | `prevStinCd` / `chtnNextStinCd` 등 KRIC API 호출 시, 텍스트(이름/노선) 매칭을 피하기 위해 PathFinder에서 받은 `datagokrStnCd`를 DB `stations.datagokr_stn_cd`에 1:1로 직접 매핑. 단, 지선 코드는 KRIC 오류로 인해 여전히 bypass 유지. |
| 2026-03-25 | **환승 API `prevStinCd` 파라미터 생략 구조 확립** | `vulnerableUserInfo/transferMovement` API가 `prevStinCd`를 도착 노선의 역으로 오인하여 결과가 누락되는 문제 해결. `prevStinCd` 요청을 생략하여 모든 `stMovePath`를 받아오고, RouteAssembler에서 `prevStnNm`으로 내부 필터링. |
| 2026-03-26 | **도착 호선 불일치 감지 및 UI 알림 처리** | 사용자가 선택한 도착역 호선과 API 반환 호선이 다를 수 있음. UI에서 배너 알림 및 도착 카드 호선 배지 교정. |
| 2026-03-29 | **도착역 이동 번호 역순 고정** | 도착역의 이동 단계 번호를 이미지 가이드 번호와 일치시키기 위해 역순(N...1)으로 고정함. |
| 2026-04-02 | **도착역 단계 및 이미지 실제 역순 처리** | 번호뿐만 아니라 실제 이동 단계(atoms)와 가이드 이미지 배열 자체를 역순으로 뒤집음. |
| 2026-04-11 | **미지원 노선 경유 시 searchType 순차 재시도 도입** | transfer → duration → distance 순서로 재시도. 세 유형 모두 실패 시 `UNSUPPORTED_LINE_TRANSFER` 에러. |
| 2026-04-11 | **SearchingView 미지원 노선 필터** | 역 검색 목록에서 `LINE_COLORS`에 없는 노선(신분당선 등)을 제외. `LINE_COLORS`가 지원 노선의 단일 진실 소스. |
| 2026-04-11 | **에러 메시지 i18n 적용** | ResultView 에러 상태 메시지를 `STRINGS.route` + `useLanguage()` hook으로 다국어화. |
| 2026-04-18 | **Planning 모드 출구 프롬프트 제거 및 표시 범위 축소** | *(→ 2026-04-19에 폐기됨)* |
| 2026-04-19 | **Planning / On-site 모드 구분 완전 삭제 → 단일 통합 흐름** | 모드 토글 UI 및 출구 선택 모달 제거. 항상 첫 번째 출구 자동 적용. Exit Options 패널로 다른 출구 선택. |
| 2026-04-19 | **ODSay → Data.go.kr 원복** | ODSay와 Data.go.kr 모두 역명/ID 기반으로 호선을 지정할 수 없어 동일한 한계를 가짐. Data.go.kr은 `stnCd` = KRIC `stinCd` 직접 매핑, `prevStn`/`afterTransferStn` Index Neighbor 추출 등 이점이 있어 원복. ODSay 코드는 `PathFinder.odsay.bak.js` / `seoulApi.odsay.bak.js`에 보존. |
| 2026-04-19 | **역 검색 호선 선택 제거 → 역명 단위 그룹핑** | ODSay/Data.go.kr 모두 API 레벨에서 출발 호선을 지정할 수 없으므로 호선 선택을 제거. SearchingView에서 동일 역명의 다중 호선을 하나의 항목으로 표시 (배지 오른쪽 나열). 실제 호선은 API 응답 기준으로 UI 렌더링. `lineMismatchNotice` 제거. |

---

## 12. 미구현 / 향후 과제

- **빠른하차(Quick Exit) UI**: `toward_station_ko` / `car_number` / `door_number`는 DB에 저장되어 있으나 TimelineCard에서 아직 미표시
- **섬식 승강장 양방향 제안**: `quick_exit_alt` 배열 활용하여 사용자에게 "반대편 승강장 옵션" 표시
- **2호선 분기 구간 (성수지선 / 신정지선)**: 신정지선→1호선 환승 로직 적용 완료 (2026-03-23). 성수지선은 미검증.
- **엘리베이터 고장 반영**: `fetchSeoulElevatorStatus` 결과가 `item.elevatorStatuses`에 첨부되나, 실제 경로 제외 로직 미구현
