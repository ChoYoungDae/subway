-- SQL: get_nearest_elevator
-- Use this script in Supabase SQL Editor to create the RPC function.
--
-- This function takes a user's latitude and longitude and returns
-- the nearest elevator from the `elevators` table using the Haversine formula.

DROP FUNCTION IF EXISTS get_nearest_elevator(float8, float8);

CREATE OR REPLACE FUNCTION get_nearest_elevator(user_lat float8, user_lon float8)
RETURNS TABLE (
    id bigint,
    station_name_ko text,
    line text,
    serial_no text,
    exit_no text,
    location_detail_ko text,
    type text,
    floor_from text,
    floor_to text,
    created_at timestamp with time zone,
    station_id bigint,
    refined_exit_no text,
    refined_route_json jsonb,
    lat float8,
    lon float8,
    capacity_people integer,
    operation_range text,
    distance_meters float8
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id::bigint,
        e.station_name_ko::text,
        e.line::text,
        e.serial_no::text,
        e.exit_no::text,
        e.location_detail_ko::text,
        e.type::text,
        e.floor_from::text,
        e.floor_to::text,
        e.created_at::timestamp with time zone,
        e.station_id::bigint,
        e.refined_exit_no::text,
        e.refined_route_json::jsonb,
        e.lat::float8,
        e.lon::float8,
        e.capacity_people::integer,
        e.operation_range::text,
        (
            6371000 * acos(
                least(1.0, greatest(-1.0, 
                    cos(radians(user_lat)) 
                    * cos(radians(e.lat)) 
                    * cos(radians(e.lon) - radians(user_lon)) 
                    + sin(radians(user_lat)) 
                    * sin(radians(e.lat))
                ))
            )
        )::float8 AS distance_meters
    FROM elevators e
    WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL
    ORDER BY distance_meters ASC
    LIMIT 1;
END;
$$;
