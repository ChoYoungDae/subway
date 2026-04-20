-- ============================================================
-- 004: 엘리베이터 탑승 위치 데이터 통합 (boarding_positions)
-- ============================================================
-- toward_station_ko, car_number, door_number, quick_exit_alt를 
-- 하나의 JSONB 컬럼 boarding_positions로 통합합니다.
-- ============================================================

-- 1. 신규 컬럼 추가
ALTER TABLE elevators
  ADD COLUMN IF NOT EXISTS boarding_positions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. 기존 데이터 이관 (Migration)
UPDATE elevators
SET boarding_positions = 
  CASE 
    WHEN toward_station_ko IS NOT NULL THEN 
      jsonb_build_array(
        jsonb_build_object(
          'toward', toward_station_ko,
          'car', car_number,
          'door', door_number
        )
      ) || quick_exit_alt
    ELSE 
      quick_exit_alt
  END
WHERE is_internal = true 
  AND (toward_station_ko IS NOT NULL OR (quick_exit_alt IS NOT NULL AND jsonb_array_length(quick_exit_alt) > 0));

-- 3. 인덱스 업데이트
-- JSONB 배열 내의 toward 매칭을 위한 인덱스는 추후 GIN 인덱스 검토 가능.
-- 일단 기존 btree 인덱스는 유지하거나 boarding_positions 기반으로 새 인덱스 생성.
CREATE INDEX IF NOT EXISTS idx_elevators_boarding_positions
  ON elevators USING GIN (boarding_positions);

-- 주석 추가
COMMENT ON COLUMN elevators.boarding_positions IS '통합된 탑승 위치 목록 [{toward, car, door}]';
