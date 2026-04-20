-- SQL script to create the route_feedback table in Supabase
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.route_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_key TEXT NOT NULL,
    segment_index INTEGER NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance when counting feedback for a specific route
CREATE INDEX IF NOT EXISTS idx_route_feedback_route_key ON public.route_feedback(route_key);

-- Add a comment to the table
COMMENT ON TABLE public.route_feedback IS 'Stores user feedback (Like/Dislike) for specific route segments.';
