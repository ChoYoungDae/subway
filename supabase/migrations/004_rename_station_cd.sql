-- ============================================================
-- 004: station_cd 컬럼 정리
-- ============================================================
-- stations.station_cd  : stin_cd와 중복되어 혼란을 야기 → 삭제
-- elevators.station_cd : stations.stin_cd와 동일한 값 → 이름 통일
-- ============================================================

-- ── stations: station_cd 삭제 ────────────────────────────────
ALTER TABLE stations DROP COLUMN IF EXISTS station_cd;

-- ── elevators: station_cd → stin_cd 이름 변경 ───────────────
-- 인덱스(idx_elevators_quickexit, idx_elevators_platform_side)는
-- PostgreSQL이 RENAME COLUMN 시 자동으로 갱신합니다.
ALTER TABLE elevators RENAME COLUMN station_cd TO stin_cd;
