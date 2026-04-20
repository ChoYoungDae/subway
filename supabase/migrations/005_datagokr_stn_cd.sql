-- ============================================================
-- 005: Data.go.kr station code 매핑 컬럼 추가
-- ============================================================
-- stations.datagokr_stn_cd : Data.go.kr getShtrmPath API의 stnCd 값
--   → KRIC stinCd(= stin_cd)와 코드 체계가 달라 별도 보관
--   → 서울교통공사_노선별 지하철역 정보.json의 station_cd 값
-- ============================================================

ALTER TABLE stations ADD COLUMN IF NOT EXISTS datagokr_stn_cd TEXT;

CREATE INDEX IF NOT EXISTS idx_stations_datagokr_stn_cd
    ON stations (datagokr_stn_cd)
    WHERE datagokr_stn_cd IS NOT NULL;
