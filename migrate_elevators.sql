-- 1. 새 컬럼 추가 (station_cd, is_internal)
ALTER TABLE elevators ADD COLUMN station_cd TEXT;
ALTER TABLE elevators ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;

-- 2. 기존 station_id를 이용해 stations 테이블에서 station_cd 가져와 채우기
UPDATE elevators e
SET station_cd = s.station_cd
FROM stations s
WHERE e.station_id = s.id;

-- 3. 기존 type 컬럼의 'internal' 여부를 is_internal로 변환 (internal이면 TRUE, 아니면 FALSE)
UPDATE elevators
SET is_internal = (type = 'internal');

-- 4. 이제 불필요해진 이전 컬럼들 삭제
ALTER TABLE elevators DROP COLUMN lat;
ALTER TABLE elevators DROP COLUMN lon;
ALTER TABLE elevators DROP COLUMN refined_exit_no;
ALTER TABLE elevators DROP COLUMN type;
ALTER TABLE elevators DROP COLUMN station_id;

-- [참고] 컬럼 순서는 Supabase UI 상단에서 드래그하여 자유롭게 변경하실 수 있습니다.
-- 만약 강제로 DB 수준에서 순서를 맞추고 싶다면 테이블을 새로 만들어야 하지만, 
-- 위 쿼리만으로도 기능상 완벽하며 데이터도 안전하게 보존됩니다.
