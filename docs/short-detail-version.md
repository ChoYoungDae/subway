# Snapshot: short, detail version

> **기준 시점:** 2026-05-03
> **상태:** 구현 완료 및 UI 최적화 진행 중

현재 지하철 이동 경로 안내 시스템에서 **'short' (요약)** 버전과 **'detail' (상세)** 버전이 처리되는 방식에 대한 스냅샷입니다.

---

## 1. 데이터 구조 (StepTranslation)

각 이동 단계(step)는 요약과 상세 텍스트를 모두 포함할 수 있는 구조를 가집니다.

```ts
interface StepTranslation {
    order?: number;
    short?:  { en: string; ko: string };  // 요약 모드용 (Summary)
    detail?: { en: string; ko: string }; // 상세 모드용 (Detail)
    // ... 기타 필드 (floor, type, etc.)
}
```

## 2. UI 렌더링 전략 (TimelineCard)

`viewMode`(`summary` | `detail`)에 따라 표시되는 텍스트와 레이아웃이 결정됩니다.

### A. 요약 모드 (Summary Mode)
- **사용 데이터:** `step.short`
- **특징:**
    - 간결한 문구 중심 (예: "Take the elevator")
    - 텍스트 크기: 12px
    - 행간 및 여백 최소화 (spacing: 4)

### B. 상세 모드 (Detail Mode)
- **사용 데이터:** `step.detail`
- **특징:**
    - 구체적인 안내 포함 (예: "Take the elevator towards Jongno 5(o)-ga Platform")
    - 텍스트 크기: 14px
    - 시인성을 위한 여백 확대 (spacing: 12)

---

## 3. 주요 로직 처리

### 텍스트 전처리 (`moveTrailingParen`)
- 문장 끝의 괄호(`(B1)`)를 추출하여 문장 맨 앞으로 이동(`(B1) Move to...`)시키거나 파란색 강조 텍스트(prefix)로 분리합니다.

### 하차 지점 표기 (Hide) — *최근 변경*
- **변경 사항:** 이동 단계에서 차량 번호/문 번호(예: `5-1`) 칩을 숨김 처리했습니다.
- **사유:** "경로 이동단계에서 지하철 하차 지점 표기 숨김" 요청 반영.
- **구현:** `TimelineCard.tsx`에서 `step.car_position` 렌더링 블록 주석 처리.

---

## 4. 하단 네비게이션 (BottomNav) — *UI 복구*

- **형태:** 상단 모서리 라운드 적용 (`borderTopLeftRadius: 20`, `borderTopRightRadius: 20`)
- **스타일:**
    - 배경색: `#FFFFFF`
    - 그림자: `shadowOpacity: 0.05`
    - 활성 탭: 단청 빨강 (`#C8362A`) 필드(Pill) 형태 표시

---

## 5. 번역 폴백 (Fallback)

Gemini Edge Function을 통한 번역이 불가능하거나 실패할 경우, `RouteAssembler._linesToSteps` 로직이 작동하며 이때는 데이터 일관성을 위해 `short`와 `detail`에 동일한 텍스트가 할당됩니다.
