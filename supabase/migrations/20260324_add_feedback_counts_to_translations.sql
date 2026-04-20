-- Add feedback counts to movement_translations
ALTER TABLE public.movement_translations
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;

-- RPC function for atomic increment
CREATE OR REPLACE FUNCTION increment_translation_count(target_hash_key TEXT, is_like BOOLEAN)
RETURNS VOID AS $$
BEGIN
    IF is_like THEN
        UPDATE movement_translations
        SET like_count = like_count + 1
        WHERE hash_key = target_hash_key;
    ELSE
        UPDATE movement_translations
        SET dislike_count = dislike_count + 1
        WHERE hash_key = target_hash_key;
    END IF;
END;
$$ LANGUAGE plpgsql;
