import { supabase } from '../../lib/supabase.js';
import { PathFinder } from './PathFinder.js';
import { RouteAssembler } from './RouteAssembler.js';
import { loadTranslationCache } from '../utils/translation.js';

/**
 * RouteService: Manages the lifecycle of barrier-free route retrieval.
 * Implements "Cache-Aside" strategy using Supabase to minimize API calls.
 */
export class RouteService {
    constructor() {
        this.pathFinder = new PathFinder();
        this.routeAssembler = null; // initialized after stations load
        this.CACHE_EXPIRY_DAYS = 30;
        this.USE_DB_CACHE = false; // Set to true to enable Supabase caching
        this._stationsCache = null;
    }

    async _loadStations() {
        if (this._stationsCache) return this._stationsCache;
        const { data, error } = await supabase
            .from('stations')
            .select('name_ko, line, ln_cd, kric_opr_cd, stin_cd, analysis_data, datagokr_stn_cd, odsay_station_id')
            .not('stin_cd', 'is', null);
        if (error) {
            console.warn('[RouteService] Failed to load stations from DB:', error.message);
            return [];
        }
        this._stationsCache = data || [];
        console.log(`[RouteService] Loaded ${this._stationsCache.length} stations from DB.`);
        return this._stationsCache;
    }

    /**
     * Phase 1: Finds candidates and identifies which exits actually lead to the valid travel direction.
     * Returns the best candidate and the available origin/destination exits.
     */
    async getRouteAndAvailableExits(departure, destination, onProgress) {
        if (!departure || !destination) return null;

        const [stations] = await Promise.all([
            this._loadStations(),
        ]);
        if (!this.routeAssembler) {
            this.routeAssembler = new RouteAssembler(stations);
        }

        onProgress?.('finding');
        const candidates = await this.pathFinder.findCandidatePaths(departure, destination, null, null);
        
        if (!candidates || candidates.length === 0) return null;
        
        const bestCandidate = candidates[0];
        
        onProgress?.('translating'); // Repurposed message for fetching KRIC paths
        await this.routeAssembler.identifyExitsForCandidate(bestCandidate);

        return {
            candidate: bestCandidate,
            originExits: bestCandidate.availableOriginExits || [],
            destExits: bestCandidate.availableDestExits || []
        };
    }

    /**
     * Phase 2: Given the chosen candidate and user's selected exits, assembles the final timeline.
     */
    async finalizeRoute(candidate, originExit, destExit, departureId, destinationId, onProgress) {
        candidate.originExitNo = originExit || '1';
        candidate.destinationExitNo = destExit || '1';
        
        const [stations] = await Promise.all([
            this._loadStations(),
            loadTranslationCache(),
        ]);
        if (!this.routeAssembler) this.routeAssembler = new RouteAssembler(stations);

        onProgress?.('translating');
        const finalRoute = await this.routeAssembler.findValidatedPath([candidate]);
        
        const routeKey = `${departureId}_${destinationId}_${candidate.originExitNo}_${candidate.destinationExitNo}`;
        const isProd = process.env.NODE_ENV === 'production';
        
        if (finalRoute && this.USE_DB_CACHE && isProd) {
            await this._saveCache(routeKey, finalRoute);
        }

        if (finalRoute) {
            console.log('[RouteService] ✅ AI steps ready:', {
                origin: finalRoute.originSteps?.length ?? 0,
                destination: finalRoute.destinationSteps?.length ?? 0,
                transits: finalRoute.rawItems?.filter(i => i.transitSteps?.length).length ?? 0,
            });
        }

        return finalRoute;
    }

    /**
     * Gets the best barrier-free route in one go (Legacy support or cached hits).
     */
    async getBarrierFreeRoute(departure, destination, onProgress) {
        if (!departure || !destination) return null;

        const originExit = departure.exit_no || '1';
        const destExit = destination.exit_no || '1';
        const routeKey = `${departure.id}_${destination.id}_${originExit}_${destExit}`;

        const isProd = process.env.NODE_ENV === 'production';
        let finalRoute = null;

        if (this.USE_DB_CACHE && isProd) {
            finalRoute = await this._getCache(routeKey);
            if (finalRoute) {
                console.log(`[RouteService] ✅ Cache Hit! Key: ${routeKey}`);
                return finalRoute;
            }
        }

        const data = await this.getRouteAndAvailableExits(departure, destination, onProgress);
        if (!data || !data.candidate) return null;

        // Auto-select exits if they are available
        const selectedOriginExit = data.originExits.length > 0 ? data.originExits[0] : originExit;
        const selectedDestExit = data.destExits.length > 0 ? data.destExits[0] : destExit;

        return await this.finalizeRoute(data.candidate, selectedOriginExit, selectedDestExit, departure.id, destination.id, onProgress);
    }

    /**
     * Retrieves valid cached data from Supabase.
     */
    async _getCache(routeKey) {
        try {
            const { data, error } = await supabase
                .from('cached_routes')
                .select('*')
                .eq('route_key', routeKey)
                .maybeSingle();

            if (error || !data) return null;

            // TTL Verification (30 Days)
            const lastUpdated = new Date(data.last_updated);
            const now = new Date();
            const diffDays = (now - lastUpdated) / (1000 * 60 * 60 * 24);

            if (diffDays > this.CACHE_EXPIRY_DAYS) {
                console.log(`[RouteService] Cache expired (${diffDays.toFixed(1)} days old). Ignoring.`);
                return null;
            }

            return data.full_path_data;
        } catch (err) {
            console.warn('[RouteService] Cache fetch failed. Proceeding without cache.', err);
            return null;
        }
    }

    /**
     * Persists a validated route to the cache table.
     */
    async _saveCache(routeKey, pathData) {
        try {
            const payload = {
                route_key: routeKey,
                full_path_data: pathData,
                transfer_count: pathData.transferCount,
                total_time: pathData.totalTime,
                last_updated: new Date().toISOString()
            };

            const { error } = await supabase
                .from('cached_routes')
                .upsert(payload, { onConflict: 'route_key' });

            if (error) {
                // If the table doesn't exist, we'll get an error. 
                // We should log it so the user knows to create the table.
                if (error.code === '42P01') {
                    console.error('[RouteService] ⚠️ Table "cached_routes" not found in Supabase. Please create it.');
                }
                throw error;
            }
            console.log(`[RouteService] ✅ Route cached: ${routeKey}`);
        } catch (err) {
            console.error('[RouteService] Cache population failed:', err);
        }
    }
}
