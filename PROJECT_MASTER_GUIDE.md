# 🚉 무장애 지하철 내비게이션 프로젝트 마스터 가이드 (Master Blueprint)

## 1. 프로젝트 개요 및 환경
- **목적**: 교통약자를 위한 실시간 데이터 기반 무장애 경로 안내 엔진
- **코어 기술**: React Native (Expo/Metro), Supabase (Cache)
- **데이터 소스**: 공공데이터(경로), KRIC(상세이동), `src/data/mockNavigationData.js` (최적화된 샘플 데이터)
- **제어 스위치**: `.env` 의 `EXPO_PUBLIC_USE_MOCK` (true/false)로 Mock 데이터 사용 여부 결정
- **개발 원칙**: 하드코딩 배제, 범용 로직 기반의 실시간 문장 조립

---

## 2. 핵심 아키텍처 (A-B-C 파이프라인)

### [A] 분석 엔진: Parser (`src/services/routeParser.js`)
- **역할**: 한국어 원문 텍스트에서 원자적 데이터 조각 추출
- **추출 데이터**: `floor` (층수), `exit_no` (출구번호), `facility` (시설물), `action` (동작)
- **데이터 표준화**: 모든 층수는 `1F`, `B1`, `B2` 등 표준 코드로 강제 변환 (지상1층, 1층 등 혼용 금지)

### [B] 제어 엔진: Controller (`src/services/RouteService.js`)
- **역할**: 데이터 결합 및 전체 흐름 제어 (Cache-Aside 전략)
- **데이터 공급**: 실제 API 미작동 시 `.env`의 `USE_MOCK=true`인 경우에만 `src/data/mockNavigationData.js` 참조
- **도착역 역순 로직**: 도착역(Destination) 데이터는 분석 전 **배열을 물리적으로 `Reverse`** 처리

### [C] 조립 엔진: Builder (`src/utils/SentenceBuilder.js`)
- **역할**: JSON 데이터를 기반으로 **English (Korean)** 문장 실시간 생성
- **동사 전환**: Reverse된 경로에 맞춰 `BOARD` ↔ `ALIGHT`, `ENTER` ↔ `EXIT` 자동 스왑
- **문법 가이드**: `subway_navigation_final_for_dev_v3.csv`의 `pure_english` 구조 준수

---

## 3. UI/UX 구현 및 렌더링 원칙 (Core Rules)

### 3.1 언어 병기 원칙 (English-First)
- 모든 텍스트는 영어를 상단(Bold), 국문을 하단(Regular Gray)에 배치한다.
- 폰트: 영문(Roboto/Inter), 국문(Pretendard)을 사용한다.
- 영문이 국문보다 약 1.4배 크며 시각적으로 압도할 것.

### 3.2 사용자 주도권 원칙 (User-Driven)
- 자동화 기능(GPS 등)은 시스템이 강제하지 않고, 사용자가 선택할 수 있는 옵션(Trigger)으로 제공하는 것을 우선한다.

### 3.3 상태 가시성 원칙 (Feedback)
- 비동기 처리(로딩, 탐색) 시에는 반드시 Skeleton UI 또는 Shimmer 애니메이션을 통해 현재 상태를 시각화한다.
---

## 4. 개발 및 유지보수 규칙 (Strict Rules)

1. **Logic over Hardcoding**: 특정 역(Station)을 위한 `if-else` 예외 처리를 금지한다. 모든 처리는 `v3.csv`에 정의된 범용 규칙에 따른다.
2. **Traceability**: 데이터 변환의 모든 단계(`Raw Data` → `Parsed JSON` → `English Sentence`)를 `console.log`로 출력하여 데이터 변질을 상시 추적한다.
3. **Safe-Run (React Native)**: Node.js의 `fs` 모듈을 절대 사용하지 않는다. 모든 데이터는 JavaScript 모듈 `Import` 방식을 유지한다.
4. **Context Maintenance**: Trae/Cursor와 대화 시, 로직이 어긋나면 반드시 이 가이드의 원칙을 기준으로 코드를 교정한다.
5. **Mock Data Optimization**: `src/data/mockNavigationData.js`는 파일 용량 및 메모리 최적화를 위해 **대표 샘플 3~5개**만 유지하며, 수만 줄의 전체 데이터를 포함하지 않는다.

---

**최종 수정일**: 2026-03-05
**버전**: v1.2 (UI 가이드 및 역순 로직 통합본)