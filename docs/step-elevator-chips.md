# 엘리베이터 스텝 칩 표시 (Exit Chip & Car Position)

> 최종 업데이트: 2026-03-24
> 대상 파일: `RouteAssembler.js` · `src/components/Route/TimelineCard.tsx`
> DB 테이블: `elevators`

---

## 1. 기능 개요

경로 타임라인의 각 엘리베이터 스텝 오른쪽에 컨텍스트 칩을 표시한다.

| 스텝 종류 | 판단 기준 | 표시 칩 | 색상 |
|-----------|-----------|---------|------|
| 외부 진입 엘리베이터 | `is_internal=FALSE` + 현재 또는 직전 step 텍스트에 "N번 출구/출입구" | `EXIT N` (ExitBadge) | 서울 지하철 노란색 |
| 승강장 내부 엘리베이터 | `is_internal=TRUE` + 텍스트에 "X 방면" (또는 승강장/승하차/isArrival 컨텍스트) | 칸 위치 (e.g. `4-3`) | Stone Wall Gray `#3D3D4A` / 흰 텍스트 |

엘리베이터 실시간 상태 도트(🟢/🔴)는 칩 오른쪽에 유지된다.

---

## 2. 데이터 흐름

```
Gemini 번역 스텝 (type='elevator')
  ↓
RouteAssembler._enrichSteps(steps, stationNameKo, context)
  │
  ├─ elevators 테이블 단일 쿼리 (역 전체 엘리베이터)
  │     internalElevators = is_internal=TRUE
  │     externalElevators = is_internal=FALSE
  │
  ├─ [is_internal=FALSE] 현재 step 텍스트 "N번 출구/출입구"
  │     없으면 직전 step 텍스트도 확인 (look-back)
  │     → step.exit_no = "N"
  │
  └─ [is_internal=TRUE] 텍스트에 "X 방면" → toward_station_ko 직접 매칭
        → step.car_position = "car_number-door_number"
  ↓
TimelineCard: exit_no → ExitBadge / car_position → 칸 배지
```

---

## 3. RouteAssembler._enrichSteps

`_fetchTranslatedSteps` 직후 호출된다.

```js
const translatedSteps = await this._fetchTranslatedSteps(translationReq, lines);
const enrichedSteps = await this._enrichSteps(translatedSteps, item.stnNm, translationCtx);
```

### DB 쿼리

역 엘리베이터를 한 번에 조회해 `is_internal`로 분리한다.

```js
const { data } = await supabase
    .from('elevators')
    .select('exit_no, is_internal, toward_station_ko, car_number, door_number')
    .eq('station_name_ko', cleanName);   // normalizeStationName() 적용

internalElevators = all.filter(e => e.is_internal);   // 승강장 내부
externalElevators = all.filter(e => !e.is_internal);  // 출구 연결
```

### 외부 엘리베이터 (is_internal=FALSE) → exit_no

```js
// 현재 step 텍스트에 "N번 출구/출입구" 패턴 검색
// 없으면 직전 step(i-1) 텍스트까지 확인 (look-back)
// — KRIC 데이터에서 출구 번호가 이동 step에 먼저 나오고 엘리베이터 step에는 생략되는 경우 대응
const prevKoText = i > 0 ? (steps[i - 1].short?.ko || steps[i - 1].detail?.ko || '') : '';
const exitMatch = koText.match(/(\d+)번\s*(?:출구|출입구)/)
               || prevKoText.match(/(\d+)번\s*(?:출구|출입구)/);

if (exitMatch && externalElevators.length > 0) {
    return { ...step, exit_no: exitMatch[1] };
}
```

### 승강장 엘리베이터 (is_internal=TRUE) → car_position

```js
// 진입 조건: "방면" 키워드, 또는 "승강장"/"승하차" 텍스트, 또는 isArrival 컨텍스트
const dirMatch = koText.match(/(\S+)\s*방면/);
if (dirMatch || koText.includes('승강장') || koText.includes('승하차') || context.isArrival) {
    const direction = dirMatch ? dirMatch[1] : '';

    // toward_station_ko 직접 매칭 (includes 양방향)
    const matched = internalElevators.find(e =>
        direction && e.toward_station_ko && (
            e.toward_station_ko === direction ||
            direction.includes(e.toward_station_ko) ||
            e.toward_station_ko.includes(direction)
        )
    );

    if (matched?.car_number != null) {
        const carPos = matched.door_number != null
            ? `${matched.car_number}-${matched.door_number}`
            : `${matched.car_number}`;
        return { ...step, car_position: carPos };
    }
}
```

#### elevators 테이블 관련 컬럼

| 컬럼 | 설명 |
|------|------|
| `is_internal` | `TRUE` = 승강장 내부, `FALSE` = 출구 연결 |
| `toward_station_ko` | 내부 엘리베이터 방향 역명 (e.g. `"도림천"`) — `is_internal=TRUE` 전용 |
| `car_number` | 열차 칸 번호 (e.g. `4`) |
| `door_number` | 문 번호 (e.g. `3`) → 칸 위치 = `"4-3"` |

---

## 4. TimelineCard 렌더링

### StepTranslation 인터페이스 변경사항

```ts
interface StepTranslation {
    order?: number;
    short?:  { en: string; ko: string };
    detail?: { en: string; ko: string };
    en?: string;                          // isRide 스텝용 직접 필드
    ko?: string;                          // isRide 스텝용 직접 필드
    floor_from?: string | null;
    floor_to?:   string | null;
    type: 'elevator' | 'move' | 'gate' | 'board' | 'alight';
    exit_no?: string | null;              // 외부 진입 엘리베이터 출구 번호
    car_position?: string | null;         // 승강장 엘리베이터 칸 위치
    car_position_uncertain?: boolean;
}
```

### 배지 표시 로직

```tsx
{step.exit_no ? (
    <ExitBadge num={step.exit_no} size="xs" />           // 서울 지하철 노란색
) : step.car_position ? (
    <View style={{ backgroundColor: step.car_position_uncertain ? '#EEEEF3' : '#3D3D4A', ... }}>
        <Text style={{ color: step.car_position_uncertain ? '#AAABB8' : '#FFFFFF' }}>
            {step.car_position}
        </Text>
    </View>                                               // Stone Wall Gray
) : null}

{/* 엘리베이터 실시간 상태 도트 — 항상 칩 오른쪽 */}
{color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
```

---

## 5. 양천구청역 예시

```
Step 1  (1F → B1)  Take the elevator next to Exit 1    [EXIT 1]  🟢
Step 2  (B1)       Move to the Station Hall
Step 3  (B1)       Pass through the ticket gate
Step 4  (B1 → B2)  Take the Dorimcheon-bound elevator   [4-3]    🟢
Step 5  (B2)       Move to the Dorimcheon-bound platform
Step 6  (B2)       Board the train
```

Exit 1 look-back 예시 (KRIC 텍스트 패턴):
```
Step N-1  (이동)   1번 출구 방면으로 이동     ← "1번 출구" 여기에 있음
Step N    (엘리베이터) 엘리베이터 이용       ← 텍스트에 출구번호 없음 → look-back으로 EXIT 1 표시
```

---

## 6. 엣지 케이스

| 상황 | 동작 |
|------|------|
| 내부 엘리베이터 DB 레코드 없음 | `car_position` 미설정, 배지 없음 |
| "방면" 텍스트 있지만 DB 방향 불일치 | `includes()` 매칭 실패 → 배지 없음 |
| 섬식 승강장 (복수 방향) | 각 방향별 레코드 분리 저장, `toward_station_ko` 단일 매칭 |
| 외부 엘리베이터 현재 step에 출구번호 없음 | 직전 step(i-1) 텍스트에서 재시도 → 없으면 배지 없음 |
| `car_position_uncertain=true` | 회색 배경(`#EEEEF3`) + 회색 텍스트 + `?` 접미사 |
