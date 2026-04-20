-- SQL Migration: version_info table
CREATE TABLE IF NOT EXISTS public.version_info (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    updated_at timestamptz DEFAULT now()
);

-- Seed initial data
INSERT INTO public.version_info (updated_at) VALUES ('2026-03-01 00:00:00+09');
