import { ROUTE_DICTIONARY } from './dictionary.js';
import { MOVEMENT_TRANSLATIONS } from '../data/movementTranslations.js';
import { supabase } from '../../lib/supabase.js';

// ── In-memory Cache for Translations ───────────────────────────────────────
let _translationMap = new Map();
let _stationsMap = new Map();
let _isLoaded = false;
const _reportedMissing = new Set(); // avoid duplicate DB writes per session

/**
 * Loads both translation_dict and stations from Supabase into memory.
 */
export const loadTranslationCache = async (force = false) => {
    if (_isLoaded && !force) return;

    try {
        console.log('[Translation] Loading translation cache...');
        const [nounsRes, stationsRes] = await Promise.all([
            supabase.from('translation_dict').select('kr, en'),
            supabase.from('stations').select('name_ko, name_en')
        ]);

        if (nounsRes.data) {
            nounsRes.data.forEach(n => _translationMap.set(n.kr, n.en));
        }

        if (stationsRes.data) {
            stationsRes.data.forEach(s => {
                if (!s.name_ko || !s.name_en) return;
                const cleanKo = s.name_ko.replace(/\s?\(.*?\)/g, '').replace(/역$/, '').trim();
                _stationsMap.set(cleanKo, s.name_en);
                _stationsMap.set(s.name_ko, s.name_en);
            });
        }

        _isLoaded = true;
        console.log(`[Translation] Cache loaded. Nouns: ${_translationMap.size}, Stations: ${_stationsMap.size}`);
    } catch (e) {
        console.error('[Translation] Failed to load cache:', e);
    }
};

/**
 * Sync lookup for a keyword in the cache.
 */
const lookupCache = (text) => {
    if (!text) return null;
    return _translationMap.get(text) || _stationsMap.get(text) || null;
};

const lookupDictionary = (keyword, lang = 'ko') => {
    const dict = ROUTE_DICTIONARY?.[lang];
    if (!dict) return null;
    return dict.locations?.[keyword]?.en || dict.transportation?.[keyword]?.en || null;
};

/**
 * Simple dict-only lookup.
 * - Found in translation_dict → return English
 * - Not found → return original text as-is, report to missing_translations once per session
 */
export const tryTranslate = (text, source = 'StationScreen') => {
    if (!text) return text;
    const hit = _translationMap.get(text) || _stationsMap.get(text);
    if (hit) return hit;
    if (!_reportedMissing.has(text)) {
        _reportedMissing.add(text);
        reportMissingTranslation(text, source);
    }
    return text;
};

export const reportMissingTranslation = async (text, source = 'App') => {
    if (!text || source === 'Quiet') return;

    console.log(`[Missing Translation] ${source}: ${text}`);
    const { error } = await supabase.from('missing_translations').upsert({
        ko_text: text,
        source: source,
        last_seen_at: new Date().toISOString()
    }, { onConflict: 'ko_text' });
    if (error) console.error('[Missing Translation] upsert failed:', error.message);
};

/**
 * Translates Korean location descriptions.
 * Priority: 1. Supabase DB, 2. Hardcoded Dict, 3. Pattern Heuristics
 */
export const translateLocation = (ko, source = 'App') => {
    if (!ko) return '';

    const text = ko.trim();

    // 1. Try Full Match (Cache -> Dict)
    const fullMatch = lookupCache(text) || lookupDictionary(text) || (MOVEMENT_TRANSLATIONS ? MOVEMENT_TRANSLATIONS[text] : null);
    if (fullMatch) return fullMatch;

    // 2. Pattern-based decomposition
    let result = text;

    // Remove numeric prefix e.g., "1) "
    const prefixMatch = result.match(/^(\d+\)\s*)?(.*)$/);
    const prefix = prefixMatch[1] || '';
    let core = prefixMatch[2] || '';

    // Extract parentheses e.g., "(B1)"
    const parenMatch = core.match(/^(.*?)(\s*\([^\)]+\))?$/);
    let main = parenMatch[1] || '';
    let paren = parenMatch[2] || '';

    // 3. Translate components
    const translatePart = (val) => {
        if (!val) return val;
        // Check cache first
        const cacheHit = lookupCache(val) || lookupDictionary(val);
        if (cacheHit) return cacheHit;

        // Apply heuristic patterns
        let temp = val;
        temp = temp.replace(/(\d+)번\s*(?:출입구|출구)/g, 'Exit $1');
        temp = temp.replace(/지하\s*(\d+)층/g, 'B$1F');
        temp = temp.replace(/지상\s*(\d+)층/g, '$1F');
        temp = temp.replace(/(\d+)층/g, '$1F');
        temp = temp.replace(/([가-힣\w\s]+)\s*(?:방면|방향)/g, 'toward $1');
        
        return temp;
    };

    let translatedMain = translatePart(main);
    let translatedParen = paren;
    if (paren) {
        const inside = paren.replace(/[()]/g, '').trim();
        const translatedInside = translatePart(inside);
        translatedParen = `(${translatedInside})`;
    }

    // Capitalize first letter of result
    let finalResult = `${prefix}${translatedMain}${translatedParen}`.trim();
    if (finalResult.length > 0 && /[a-z]/.test(finalResult[0])) {
        finalResult = finalResult.charAt(0).toUpperCase() + finalResult.slice(1);
    }

    // 6. Validation and Reporting
    const hasHangul = /[가-힣]/.test(finalResult);
    if (hasHangul) {
        if (source !== 'Quiet') {
            // Report parts that are still Korean
            if (/[가-힣]/.test(translatedMain)) reportMissingTranslation(main, source);
            if (/[가-힣]/.test(translatedParen)) {
                const inside = paren.replace(/[()]/g, '').trim();
                reportMissingTranslation(inside, source);
            }
        }
    }

    return finalResult;
};

/**
 * Synthesizes a location string from floor and ground division info if missing.
 */
export const synthesizeLocation = (rawItem, locField = 'dtlLoc') => {
    let loc = (rawItem[locField] || '').trim();
    const floor = rawItem.stinFlor || rawItem.runStinFlorFr;
    const grnd = rawItem.grndDvNm || rawItem.grndDvNmFr;

    if (floor && !loc.includes(String(floor))) {
        const floorPrefix = (grnd === '지하' || grnd === 'B' ? '지하 ' : (grnd === '지상' ? '지상 ' : '')) + floor + '층';
        loc = `${floorPrefix} ${loc}`.trim();
    }
    return loc;
};
/**
 * Checks if a facility is inside the fare gate.
 * Uses both KRIC gate codes and text heuristics for accuracy.
 */
export const checkIsInside = (rawItem) => {
    if (!rawItem) return false;
    const gateVal = String(rawItem.gateInout || rawItem.gateInotDvNm || '');

    // Common KRIC codes for Inside Gate
    if (['1', '개', '내'].includes(gateVal)) return true;

    // Text-based fallback
    const loc = (rawItem.dtlLoc || rawItem.lostLcn || '').toLowerCase();
    if (loc.includes('내부') ||
        loc.includes('게이트 안') ||
        loc.includes('개찰구 안') ||
        loc.includes('표 내는 곳 안')) return true;

    return false;
};

/**
 * Normalizes text into "English (Korean)" format.
 * Target: Journey Planner & Timeline nodes.
 */
export const formatDisplayLabel = (item) => {
    if (!item) return '';
    const en = item.name_en || item.title || item.displayEn || '';
    const ko = item.name_ko || item.displayKo || '';
    if (en && ko) return `${en} (${ko})`;
    return en || ko || '';
};
