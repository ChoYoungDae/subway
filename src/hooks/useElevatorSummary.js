// src/hooks/useElevatorSummary.js
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchSeoulElevatorStatus, isElevatorAvailable } from '../api/seoulApi';

/**
 * useElevatorSummary (Schema Part 2 연동)
 * 특정 역의 엘리베이터 ID(station_id)별 실시간 상태를 집계합니다.
 */
export function useElevatorSummary(stationId, stationNameKo) {
    const [summary, setSummary] = useState({
        status: 'UNKNOWN',
        workingCount: 0,
        total: 0,
        lastUpdated: null,
        boardingDoor: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!stationId) return;
        let isMounted = true;

        const loadData = async () => {
            if (!isMounted) return;
            setLoading(true);
            try {
                const { data: routeData } = await supabase
                    .from('step_free_routes')
                    .select('boarding_door')
                    .or(`station_id.eq.${stationId},stin_cd.eq.${stationId}`)
                    .limit(1)
                    .single();

                const apiItems = await fetchSeoulElevatorStatus(stationNameKo);

                if (!isMounted) return;

                if (apiItems && apiItems.length > 0) {
                    const working = apiItems.filter(item => isElevatorAvailable(item.oprtngSitu)).length;
                    setSummary({
                        status: working > 0 ? 'NORMAL' : 'STOP',
                        workingCount: working,
                        total: apiItems.length,
                        lastUpdated: new Date().toLocaleTimeString(),
                        boardingDoor: routeData?.boarding_door || 'N/A'
                    });
                } else {
                    const { data: dbEvs } = await supabase
                        .from('elevators')
                        .select('status')
                        .or(`station_id.eq.${stationId},stin_cd.eq.${stationId}`);

                    if (!isMounted) return;

                    if (dbEvs) {
                        const normalCount = dbEvs.filter(e => e.status === 'NORMAL').length;
                        setSummary({
                            status: normalCount > 0 ? 'NORMAL' : 'STOP',
                            workingCount: normalCount,
                            total: dbEvs.length,
                            lastUpdated: 'Database Sync',
                            boardingDoor: routeData?.boarding_door || 'N/A'
                        });
                    }
                }
            } catch (e) {
                console.error('Data sync failed', e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        const interval = setInterval(loadData, 60000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [stationId, stationNameKo]);

    return { summary, loading };
}
