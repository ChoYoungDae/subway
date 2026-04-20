-- ============================================================
-- 003: 방향 판별 + 빠른하차(Quick Exit) 데이터 구조화
-- ============================================================
-- stations: 역구성순서 (KRIC stinConsOrdr) — 호선 내 역 순서 비교용
-- elevators: 빠른하차 구조화 컬럼 (방면역명, 칸번호, 문번호, 플랫폼방향)
-- ============================================================

-- ── stations: 역구성순서 ─────────────────────────────────────
-- 동일 ln_cd 내에서 stin_cd 숫자 오름차순으로 매긴 1-based 순서값.
-- 2호선 본선(201-234) : 순환 방향 판별에 사용 (modulo 연산)
-- 5호선/1호선 분기 구간: 값이 단조증가하므로 선형 비교 적용
-- NULL = 아직 미계산 (scripts/populate_direction_data.mjs 실행 필요)
ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS stin_cons_ordr SMALLINT;

-- ── elevators: 빠른하차 구조화 컬럼 ──────────────────────────
-- toward_station_ko : location_detail_ko에서 파싱한 방면 역명
--                     예) "시청 방면5-3" → "시청"
-- car_number        : 열차 칸 번호 (1-10 정수)
-- door_number       : 문 번호 (1-4 정수)
-- platform_side     : 'higher' (stin_cons_ordr 증가 방향) |
--                     'lower'  (stin_cons_ordr 감소 방향) |
--                     NULL (외부 엘리베이터 등 해당 없음)
-- quick_exit_alt    : 섬식 승강장 양방향 전체 목록
--                     [{toward_station_ko, car_number, door_number}]
--                     단방향이면 빈 배열 []
ALTER TABLE elevators
  ADD COLUMN IF NOT EXISTS toward_station_ko TEXT,
  ADD COLUMN IF NOT EXISTS car_number        SMALLINT,
  ADD COLUMN IF NOT EXISTS door_number       SMALLINT,
  ADD COLUMN IF NOT EXISTS platform_side     TEXT
    CHECK (platform_side IN ('higher', 'lower')),
  ADD COLUMN IF NOT EXISTS quick_exit_alt    JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 인덱스: 빠른하차 조회 성능 (station_cd + toward_station_ko)
CREATE INDEX IF NOT EXISTS idx_elevators_quickexit
  ON elevators (station_cd, toward_station_ko)
  WHERE toward_station_ko IS NOT NULL;

-- 인덱스: platform_side 필터
CREATE INDEX IF NOT EXISTS idx_elevators_platform_side
  ON elevators (station_cd, platform_side)
  WHERE platform_side IS NOT NULL;
