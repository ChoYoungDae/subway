-- SQL Migration: Create station_exits table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.station_exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id BIGINT REFERENCES public.stations(id) ON DELETE CASCADE,
    exit_no TEXT NOT NULL,
    landmarks JSONB DEFAULT '{"ko": [], "en": []}'::jsonb,
    has_elevator BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(station_id, exit_no)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_station_exits_station ON public.station_exits(station_id);

-- Comment to explain the purpose
COMMENT ON TABLE public.station_exits IS 'Stores information about station exits and nearby landmarks in multiple languages.';
