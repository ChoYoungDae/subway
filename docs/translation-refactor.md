# 번역 시스템 정리 (2026-03-19)

## 테이블 정리

| 변경 | 내용 |
|------|------|
| `proper_nouns` → `translation_dict` | 테이블명 변경, 코드 반영 완료 |
| `translations` | 미사용 확인 → DB에서 삭제 |
| `missing_translations` | 쓰기 전용이었으나 앞으로 읽기도 활용 예정 |

---

## translation.js 변경

### vocab 하드코딩 제거
기존에 코드에 박혀있던 11개 단어를 전부 제거.
DB와 중복이었고, 번역 불일치 문제가 있었음.

| 한글 | 코드 (제거) | DB (`translation_dict`) |
|------|------------|------------------------|
| 환승 | Transfer | Transfer |
| 대합실 | Concourse | Station Hall ⚠️ |
| 하차 | Alight | Arrival ⚠️ |
| 탑승 | Board | Boarding ⚠️ |
| 방향 | Direction | Direction |
| 방면 | Direction | -bound ⚠️ |
| 승강장 | Platform | Platform |
| 표 내는 곳 | Fare Gate | Ticket Gate ⚠️ |
| 개집표기 | Fare Gate | → DB 추가 (Ticket Gate) |
| 연결통로 | Transfer Passage | → DB 추가 (Connecting Passage) |
| 이동 | Go | 번역 불필요 → 삭제 |

> ⚠️ 표시는 코드와 DB 번역이 달랐던 항목. DB 기준으로 통일.

### `tryTranslate()` 함수 추가

```js
tryTranslate(text, source)
```

- `translation_dict` 조회 → hit이면 영어 반환
- miss면 한글 그대로 반환 + `missing_translations`에 리포트 (세션 내 중복 방지)

---

## StationScreen.js 변경

- 마운트 시 `loadTranslationCache()` 호출
- 5개 시설 컴포넌트에 `tryTranslate()` 적용

| 컴포넌트 | 적용 필드 |
|---------|---------|
| `ElevatorItem` | `dtlLoc` |
| `WheelchairLiftItem` | `dtlLoc` |
| `RestroomItem` | `dtlLoc` |
| `ATMItem` | `bank`, `dtlLoc` |
| `LockerItem` | `size`, `dtlLoc`, `fee` |

---

## translation_dict DB 추가

| kr | en |
|----|----|
| 개집표기 | Ticket Gate |
| 연결통로 | Connecting Passage |

---

## 번역 우선순위 (확립된 구조)

```
1. translation_dict (DB)
2. 정규식 패턴 (출구번호: Exit N / 층수: B1F, 2F 등)
3. 한글 그대로 표기 + missing_translations에 리포트
```

> 정규식 패턴은 조합이 무한대(숫자 변수)라 DB에 넣기 불가 → 코드 룰로 유지.
