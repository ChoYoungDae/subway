# 경로 스텝 번역 시스템

> 최종 업데이트: 2026-03-22
> 대상 파일: `RouteAssembler.js` · `supabase/functions/translate-movement/index.ts`
> DB 테이블: `movement_translations` · `ai_error_log`

---

## 1. 전체 흐름

```
KRIC API (mvContDtl) — 한국어 원문
  ↓
RouteAssembler._fetchTranslatedSteps(translationReq, lines)
  │
  ├─ [정상] supabase.functions.invoke('translate-movement')
  │     ├─ movement_translations DB 캐시 조회 (SHA-256 hash_key)
  │     │     hit  → 캐시된 steps[] 즉시 반환
  │     │     miss → Gemini 2.5 Flash 번역 → DB 저장 → steps[] 반환
  │     └─ 실패(quota/api_error) → steps: [] 반환
  │
  └─ [fallback] RouteAssembler._linesToSteps(lines)
        → translateLocation(ko) — translation_dict DB + 정규식 패턴
        → short == detail (Edge Function 불가 상황이므로 허용)
```

---

## 2. Edge Function — `translate-movement`

**파일**: `supabase/functions/translate-movement/index.ts`

### 요청 파라미터

| 필드 | 타입 | 설명 |
|------|------|------|
| `stin_cd` | string | KRIC 역 코드 |
| `line` | string | 노선 코드 (ln_cd) |
| `exit_no` | string \| null | 출구번호 (출발/도착역) |
| `is_destination` | boolean | 도착역 여부 (역순 번호 생성) |
| `is_transfer` | boolean | 환승역 여부 |
| `from_line` | string \| null | 환승 전 노선 |
| `to_line` | string \| null | 환승 후 노선 |
| `next_stin_cd` | string \| null | 환승 후 다음 역 코드 (방향 컨텍스트) |
| `analysis_data` | object \| null | 역 구조 JSON (stations.analysis_data) |
| `movement_steps` | `{order, text}[]` | KRIC 한국어 원문 줄 목록 |

### 캐시 키 (hash_key)

```
출발/도착: SHA256("stin_cd:line:exit_no:is_destination")
환승:      SHA256("stin_cd:from_line:to_line:next_stin_cd")
```

### 반환값

```json
{
  "steps": [
    {
      "order": 1,
      "short":  { "en": "Take Elevator (B2)", "ko": "엘리베이터 탑승 (B2)" },
      "detail": { "en": "Take the elevator near Exit 3 down to B2F concourse.", "ko": "3번 출구 옆 엘리베이터를 타고 지하2층 대합실로 이동합니다." },
      "floor_from": "B2F",
      "floor_to": "B1F",
      "type": "elevator"
    }
  ],
  "cached": true
}
```

### Gemini 프롬프트 규칙 (요약)

- `proper_nouns` 테이블의 용어집을 고정 번역으로 사용
- **`short` (English)**: 반드시 **동사(Verb)**를 포함하여 생성 (e.g. "Move to", "Pass"). "To Platform" 등 전치사구 형태 금지.
    - 방면(`toward`) 정보를 포함하되, 역 이름은 최대한 간결하게 표현.
- **`short` (Korean)**: 자연스러운 한국어 문장 사용. 영단어(Elevator, Platform 등) 혼용 절대 금지.
- **층 표시**: 이동 방향을 나타내는 단방향 화살표(`→`) 사용. (e.g. `(B2 → B1)`).
    - ※ 역 시설 정보 화면의 운행 범위(`↔`)와 구분됨.
    - **한글 중복 제거**: 상단 영문 층 정보와 중복되는 한글 문구 시작 부분의 층수 숫자(예: `3 대합실...` → `대합실...`)는 반드시 제거한다.
- `detail`: 층수·방면·시설명 등 구체적 설명 (단, 문구 시작의 중복 층수는 제외)
- 좌/우 방향 표현 금지 → 시설명·층수·방면역명으로 대체
- `(휠체어칸)` 완전 제거
- `is_destination=true`이면 step 번호 역순 (도착 기준)
- 내부 엘리베이터 ID (`EV_*`) 출력 금지

---

## 3. RouteAssembler — 호출 지점

**파일**: `src/services/RouteAssembler.js` → `_verifyCandidate()`

| 컨텍스트 | 주요 파라미터 |
|----------|--------------|
| 출발역 | `stin_cd`, `line`, `exit_no=originExitNo`, `is_destination=false` |
| 도착역 | `stin_cd`, `line`, `exit_no=destinationExitNo`, `is_destination=true` |
| 환승역 | `is_transfer=true`, `from_line`, `to_line`, `next_stin_cd` |

`analysis_data`는 모든 컨텍스트에서 `stations` DB에서 로드된 값을 전달합니다.

---

## 4. Fallback — `_linesToSteps()`

Edge Function 실패 시 로컬 번역으로 대체합니다.

```
translateLocation(ko, 'RouteAssembler')
  1순위: translation_dict DB (in-memory 캐시)
  2순위: 정규식 패턴 (출구번호 → Exit N, 지하N층 → BNF, 방면 → toward)
  3순위: 한국어 그대로 + missing_translations 테이블에 리포트
```

- `short` == `detail` (구분 없음 — fallback 상황이므로 허용)
- `loadTranslationCache()`는 `RouteService.getBarrierFreeRoute()` 진입 시 미리 호출됨

---

## 5. DB 스키마

### `movement_translations`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `hash_key` | text UNIQUE | 캐시 조회 키 |
| `stin_cd` | text | KRIC 역 코드 |
| `line` | text | 노선 코드 |
| `exit_no` | text | 출구번호 |
| `is_destination` | boolean | 도착역 여부 |
| `is_transfer` | boolean | 환승역 여부 |
| `from_line` | text | 환승 전 노선 |
| `to_line` | text | 환승 후 노선 |
| `next_stin_cd` | text | 환승 후 다음 역 코드 |
| `steps` | jsonb | 번역된 step 배열 |
| `model_version` | text | `gemini-2.5-flash` |

### `ai_error_log`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `error_type` | text | `quota_exceeded` \| `api_error` \| `parse_error` |
| `error_msg` | text | 오류 메시지 |
| `context` | jsonb | `{stin_cd, line, exit_no, is_transfer}` |
