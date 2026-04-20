# Step-Free Seoul Subway — UI/UX Design Guide (v1.1.0)

## 앱 기본 정보
- **앱 이름**: Step-Free Seoul Subway
- **한국어 부제**: 서울 지하철: 계단 없이 엘리베이터로
- **태그라인**: No more dragging suitcases!
- **타겟**: 서울을 방문하는 외국인 관광객
- **플랫폼**: Android (React Native + Expo)

## 디자인 철학
**"Foreign-Language First, Soft & Friendly Accessibility."**
(외국어 우선, 부드럽고 친근한 접근성)

핵심 가치: 교통 약자 및 외국인 관광객을 위한 '계단 없는' 서울 지하철 경로 안내.

---

## 브랜딩 & 로고

### 3S 패턴
앱 이름의 세 단어가 모두 S로 시작 → **S**tep-Free **S**eoul **S**ubway
- 세 S를 모두 Dancheong Red(#C8362A)로 강조 표시
- 나머지 글자는 일반 텍스트 색상

### 로고 심볼
- Dancheong Red(#C8362A)로 꽉 채운 원
- 원 안에 흰색 대문자 **S** (Georgia serif, bold)
- S는 원의 정중앙 (가로·세로 모두 `dominant-baseline="central"` + `text-anchor="middle"`)

---

## 컬러 팔레트

| 이름 | HEX | 용도 |
|------|-----|------|
| Dancheong Red | `#C8362A` | 로고, CTA 버튼, 엘리베이터 마커, 3S 강조, 경고 포인트 |
| Gwakgi Dark Gray | `#111116` | 스플래시 배경 (다크) |
| Stone Wall Gray | `#3D3D4A` | UI 카드 배경, 중간 톤 요소 |
| Hangang Silver White | `#8A9CA3` | 보조 정보, 비활성 텍스트, 2번 스텝 색상 |
| Namsan Pine Green | `#2E5E4A` | 환승 배지, 정상 상태(All clear) 표시 |
| Light BG | `#F7F7FA` | 라이트 모드 앱 배경 |
| Card White | `#FFFFFF` | 라이트 모드 카드 배경 |
| Muted Text | `#AAABB8` | 보조 텍스트, 안내 문구 |
| Claude Copper | `#DA7756` | 출발역 닷, DEPARTURE 배지 — Claude AI 브랜드 컬러 |

---

## 화면 구성

### 스플래시 스크린 (다크)
- 배경: `#111116` (Gwakgi Dark Gray)
- 중앙에 Dancheong Red 원형 로고 (S)
- 배경에 Red 동심원 3겹 (희미하게, opacity 8~18%)
- 타이틀: "**S**tep-Free **S**eoul **S**ubway" 한 줄
- 한국어 부제: "서울 지하철: 계단 없이 엘리베이터로"
- 태그라인: "No more dragging suitcases!" (이탤릭, 연한 회색)
- 로딩 인디케이터: Dancheong Red 점 3개 순차 펄스
- 버전 표기: 하단 `v1.0.0` (mono font, 매우 연하게)

### 앱 본체 (라이트 모드)
- 배경: `#F7F7FA`, 카드: `#FFFFFF`
- 헤더: "**S**tep-Free **S**eoul" + 한국어 부제
- 검색바: 둥근 모서리, 연한 회색 배경(`#EEEEF3`)
- 루트 카드: 흰 배경, 왼쪽 컬러 보더 (Elevator → Red, Transfer → Green)
- 하단 탭 4개: Route / Station / Help / Settings

---

## 컴포넌트 스펙

### 디자인 토큰 (Round UI)
기존의 각진 요소를 배제하고 pill-shaped 둥근 UI를 적용한다.

```
--radius-card:     16px (1rem)  — 경로 검색 및 정보 카드
--radius-btn/chip: 9999px       — 모든 CTA 버튼 및 상태 배지 (rounded-full)
```

**Slim Line**: 카드의 왼쪽 노선 강조 테두리는 3px로 슬림하게 유지 (무거운 면 처리 배제).

### 루트 카드
```
배경: #FFFFFF
border-radius: 16px
border: 0.5px solid #E8E8EE
border-left: 3px solid #C8362A  (엘리베이터 루트)
border-left: 3px solid #2E5E4A  (환승 루트)
```

### 배지 (Elevator / Transfer)
```
Elevator: background #C8362A, color #fff, border-radius: 9999px
Transfer: background #2E5E4A, color #fff, border-radius: 9999px
font-size: 9px, padding: 2px 8px
```

### CTA 버튼
```
Primary (Active):   background #C8362A, color #fff, border-radius: 9999px
Primary (Inactive): background #E0E0E8, color #AAABB8, border-radius: 9999px
Secondary:          background #F0F0F5, color #555568, border: 0.5px solid #E0E0E8, border-radius: 9999px
```

### 서울 지하철 노선 배지 색상
| 노선 | HEX | 비고 |
|------|-----|------|
| Line 1 | `#003DA5` | |
| Line 2 | `#00A84F` | |
| Line 3 | `#EF7C1C` | |
| Line 4 | `#00A5DE` | |
| Line 5 | `#996CAC` | |
| Line 6 | `#CD7C2F` | |
| Line 7 | `#747F00` | |
| Line 8 | `#EA545B` | |
| Line 9 | `#BFA46E` | 샴페인 골드 (Champagne Gold) |
| AREX | `#0090D2` | 공항철도 일반열차 (바다색 Azure) |
| AREX Express | `#F07B1D` | 공항철도 직통열차 (주황색) |

---

## 타이포그래피 & 언어 정책

모든 UI에서 외국어를 상단에 배치하고 한국어를 보조로 두는 정책을 엄격히 준수한다.

### 폰트 스택 (Font Stack)
- **Base English & Numbers**: Nunito (Rounded UI의 핵심 서체) — `@expo-google-fonts/nunito`
- **Korean**: Pretendard (자간 `0.015em` 적용하여 Nunito와 균형 확보) — `assets/fonts/Pretendard-*.ttf`

> **Note**: Noto Sans JP(일본어) / Noto Sans SC(중국어) 동적 로드는 현재 미구현. 향후 다국어 확장 시 추가 예정.

### 언어별 위계 (Hierarchy)
- **Primary (Foreign Language)**: Nunito Bold — 한국어 대비 1.4배 크기로 상단 배치
- **Secondary (Korean)**: Pretendard Regular, Muted Gray 색상으로 하단 배치
- **Numeric Data**: 모든 숫자(층수, 시간, 거리)는 언어와 상관없이 Nunito 사용 (심리적 부담 완화)

### Android 폰트 구현 규칙 ⚠️
React Native Android에서 `fontFamily`와 `fontWeight`를 함께 지정하면, Bold 계열(`'700'`/`'800'`/`'600'`)에서 시스템 폰트(Roboto)로 fallback되는 버그가 있다.

**규칙**: `Nunito-Bold` / `Nunito-ExtraBold` / `Nunito-SemiBold` 사용 시 `fontWeight`를 절대 함께 쓰지 않는다.

```js
// ❌ 잘못된 사용 — Android에서 Roboto로 fallback됨
fontFamily: 'Nunito-Bold', fontWeight: '700'

// ✅ 올바른 사용 — 굵기는 폰트 이름에 내장됨
fontFamily: 'Nunito-Bold'
```

`Nunito-Regular` / `Nunito-Medium`은 `fontWeight` 병기 시에도 정상 렌더링되나, 일관성을 위해 생략을 권장한다.

---

## 상태별 인터랙션 (Interactive States)
- **입력 전 (Inactive)**: 'Find Step-Free Route' 버튼은 Light Gray (`#E0E0E8`) 배경에 비활성화 상태
- **입력 후 (Active)**: 출발/도착역이 모두 입력되면 버튼이 Dancheong Red(`#C8362A`)로 활성화되며 부드러운 전환(Transition) 효과 적용

---

## 헤더 로직 (Context-Aware Header)
- **Home**: 브랜드 로고(S)와 풀 타이틀을 강조하여 신뢰 구축

---

## 톤 & 무드
- 스플래시: 다크 + Dancheong Red → 강렬한 첫인상, 브랜드 각인
- 앱 본체: 라이트 → 지하철 밝은 환경에서 장시간 사용 시 눈 피로 최소화
- 전통(단청 레드) + 현대(클린 라이트 UI) 조합
- 외국인 대상 → 영어 우선, 한국어 보조
