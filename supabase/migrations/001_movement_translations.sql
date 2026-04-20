-- ============================================================
-- movement_translations: AI 번역 캐시 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS movement_translations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 캐시 조회용 해시 키
  -- 출발/도착: SHA256(stin_cd + ':' + line + ':' + coalesce(exit_no,'NONE') + ':' + is_destination::text)
  -- 환승:      SHA256(stin_cd + ':' + from_line + ':' + to_line + ':' + next_stin_cd)
  hash_key        text UNIQUE NOT NULL,

  -- 역 식별
  stin_cd         text NOT NULL,
  line            text NOT NULL,
  exit_no         text,                    -- nullable (플랫폼 출발/도착)
  is_destination  boolean DEFAULT false,
  is_transfer     boolean DEFAULT false,
  from_line       text,                    -- 환승역 전용
  to_line         text,                    -- 환승역 전용
  next_stin_cd    text,                    -- 환승 방향 식별

  -- 번역 결과
  -- steps 구조:
  -- [{
  --   "order": 1,
  --   "short":  { "en": "...", "ko": "..." },
  --   "detail": { "en": "...", "ko": "..." },
  --   "floor_from": "B2F",   -- nullable
  --   "floor_to":   "B1F",   -- nullable
  --   "type": "elevator" | "move" | "gate" | "board" | "alight"
  -- }]
  steps           jsonb NOT NULL DEFAULT '[]',

  -- 향후 zh, ja 추가 시 append
  languages_ready text[]       DEFAULT '{en,ko}',

  -- 메타
  created_at      timestamptz  DEFAULT now(),
  model_version   text         DEFAULT 'gemini-2.5-flash'
);

CREATE INDEX IF NOT EXISTS idx_movement_translations_hash
  ON movement_translations (hash_key);

CREATE INDEX IF NOT EXISTS idx_movement_translations_stin
  ON movement_translations (stin_cd, line);

-- ============================================================
-- ai_error_log: AI 호출 에러 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_error_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type  text        NOT NULL,  -- 'quota_exceeded' | 'api_error' | 'parse_error' | 'timeout'
  context     jsonb,                 -- { stin_cd, line, exit_no, is_transfer, ... }
  error_msg   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_error_log_type
  ON ai_error_log (error_type, created_at DESC);
