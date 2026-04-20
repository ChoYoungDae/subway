const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RAW_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const KRIC_API_KEY = RAW_KEY ? RAW_KEY.replace(/\\/g, '') : null;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Enhanced Vocabulary for Landmarks
const vocab = {
    '국민은행': 'KB Bank',
    '신한은행': 'Shinhan Bank',
    '우리은행': 'Woori Bank',
    '하나은행': 'Hana Bank',
    '기업은행': 'IBK Bank',
    '농협은행': 'NH Bank',
    '농협': 'NH Bank',
    '우체국': 'Post Office',
    '병원': 'Hospital',
    '초등학교': 'Elementary School',
    '중학교': 'Middle School',
    '고등학교': 'High School',
    '대학교': 'University',
    '공원': 'Park',
    '백화점': 'Department Store',
    '아파트': 'Apartment',
    '호텔': 'Hotel',
    '센터': 'Center',
    '빌딩': 'Building',
    '상가': 'Shopping Center',
    '시장': 'Market',
    '교회': 'Church',
    '성당': 'Cathedral',
    '사거리': 'Intersection',
    '삼거리': '3-way Intersection',
    '출구': 'Exit',
    '방면': 'Direction',
    '입구': 'Entrance',
    '광장': 'Square/Plaza',
    '시청': 'City Hall',
    '구청': 'District Office',
    '경찰서': 'Police Station',
    '소방서': 'Fire Station',
    '도서관': 'Library',
    '미술관': 'Art Museum',
    '박물관': 'Museum',
    '극장': 'Theater',
    '앞': 'Front',
    '옆': 'Next to',
    '지점': 'Branch',
    '역': 'Station',
    '고용노동부': 'Ministry of Employment and Labor',
    '국세청': 'National Tax Service',
    '세무서': 'Tax Office',
    '보건소': 'Health Center',
    '주민센터': 'Community Center',
};

function getKricItems(res) {
    if (!res) return [];
    if (Array.isArray(res.body)) return res.body;
    if (res.body?.item) return Array.isArray(res.body.item) ? res.body.item : [res.body.item];
    if (res.body?.items) return Array.isArray(res.body.items) ? res.body.items : [res.body.items];
    if (Array.isArray(res.items)) return res.items;
    if (res.items?.item) return Array.isArray(res.items.item) ? res.items.item : [res.items.item];
    if (res.body && typeof res.body === 'object' && !Array.isArray(res.body)) {
        const keys = Object.keys(res.body);
        if (keys.length > 0 && keys.every(k => !isNaN(k))) {
            return Object.values(res.body);
        }
        return [res.body];
    }
    return [];
}

function translateLandmark(text) {
    if (!text) return text;
    let res = text;

    const sortedKeys = Object.keys(vocab).sort((a, b) => b.length - a.length);
    for (const ko of sortedKeys) {
        const en = vocab[ko];
        res = res.replace(new RegExp(ko, 'g'), en);
    }

    res = res.replace(/\(([^)]+)\)/g, (match, p1) => {
        return ` (${p1})`;
    });

    return res;
}

async function fetchKricGateInfo(railOprIsttCd, lnCd, stinCd) {
    const otherParams = new URLSearchParams({
        format: 'json',
        railOprIsttCd,
        lnCd,
        stinCd
    }).toString();

    const url = `https://openapi.kric.go.kr/openapi/convenientInfo/stationGateInfo?serviceKey=${KRIC_API_KEY}&${otherParams}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = getKricItems(data);
        if (items.length > 0) return items;

        // Only log if not '0' or '00'
        if (data.header && data.header.resultCode !== '0' && data.header.resultCode !== '00') {
            console.log(`  KRIC Result: ${data.header.resultCode} - ${data.header.resultMsg} (${stinCd})`);
        }
        return [];
    } catch (err) {
        console.error(`Fetch failed for ${stinCd}:`, err);
        return [];
    }
}

async function syncExits() {
    console.log('--- Starting Station Exit & Landmark Sync ---');

    const { data: stations, error: stError } = await supabase
        .from('stations')
        .select('id, stin_cd, kric_opr_cd, ln_cd, name_ko, name_en');

    if (stError) {
        console.error('Failed to fetch stations:', stError);
        return;
    }

    const { data: elevators, error: elError } = await supabase
        .from('elevators')
        .select('station_name_ko, refined_exit_no, exit_no');

    console.log(`Processing ${stations.length} stations...`);

    for (const station of stations) {
        const stinCd = station.stin_cd;
        if (!stinCd || !station.kric_opr_cd || !station.ln_cd) continue;

        const items = await fetchKricGateInfo(station.kric_opr_cd, station.ln_cd, stinCd);

        if (items.length > 0) {
            console.log(`Processing ${station.name_ko}: Found ${items.length} items.`);
            console.log(`  Keys: ${Object.keys(items[0]).join(', ')}`);
        }
        const exitMap = new Map();

        for (const item of items) {
            const exitNo = item.exitNo || item.gateNo;
            const landmarkKo = item.impFaclNm || item.mainBldgNm;
            if (!exitNo || !landmarkKo) continue;

            if (!exitMap.has(exitNo)) {
                exitMap.set(exitNo, { ko: [], en: [] });
            }

            const landmarks = exitMap.get(exitNo);
            if (!landmarks.ko.includes(landmarkKo)) {
                landmarks.ko.push(landmarkKo);
                landmarks.en.push(translateLandmark(landmarkKo));
            }
        }

        const stationElevators = (elevators || []).filter(e => e.station_name_ko === station.name_ko);

        for (const [exitNo, landmarks] of exitMap.entries()) {
            const hasElevator = stationElevators.some(e => {
                const refined = (e.refined_exit_no || '').split(',').map(s => s.trim());
                const raw = (e.exit_no || '').split(',').map(s => s.trim());
                return refined.includes(exitNo) || raw.includes(exitNo);
            });

            const { error: upsertError } = await supabase
                .from('station_exits')
                .upsert({
                    station_id: station.id,
                    exit_no: exitNo,
                    landmarks: landmarks,
                    has_elevator: hasElevator,
                    updated_at: new Date()
                }, { onConflict: 'station_id, exit_no' });

            if (upsertError) {
                // If table doesn't exist, we'll see it here
                if (upsertError.message.includes('relation "station_exits" does not exist')) {
                    console.error('CRITICAL: Table "station_exits" does not exist. Please run the SQL migration first.');
                    return;
                }
                console.error(`  Upsert error for Exit ${exitNo}:`, upsertError.message);
            }
        }
        console.log(`  Synced ${exitMap.size} exits.`);
    }

    console.log('--- Sync Completed ---');
}

syncExits();
