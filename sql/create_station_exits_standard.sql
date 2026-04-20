-- SQL Migration: Recreate station_exits table with JSON landmarks (Drop and Create)
-- Run this in Supabase SQL Editor to apply structural changes

DROP TABLE IF EXISTS public.station_exits;

CREATE TABLE public.station_exits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    station_id BIGINT REFERENCES public.stations(id) ON DELETE CASCADE,
    exit_no text NOT NULL, -- "1", "2-A" etc.
    landmarks jsonb DEFAULT '{}'::jsonb, -- { "ko": ["국기원"], "en": ["Kukkiwon"] }
    has_elevator boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(station_id, exit_no)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_station_exits_station ON public.station_exits(station_id);

-- Comment to explain the purpose
COMMENT ON TABLE public.station_exits IS 'Stores information about station exits and nearby landmarks in multiple languages based on National Standard Data.';
