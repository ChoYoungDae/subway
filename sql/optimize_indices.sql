-- SQL Optimization: Performance Indexing for Accessibility Engine
-- Run this in Supabase SQL Editor to optimize real-time route cross-checks.

-- 1. Composite index for elevators table lookup
CREATE INDEX IF NOT EXISTS idx_elevators_station_exit 
ON public.elevators(station_id, exit_no);

-- 2. Index for stations name lookup (for the PathFinder engine)
CREATE INDEX IF NOT EXISTS idx_stations_name_ko 
ON public.stations(name_ko);

-- 3. Comment to verify optimization
COMMENT ON INDEX idx_elevators_station_exit IS 'Optimizes AccessibilityFilter cross-checks for station and exit combination.';
