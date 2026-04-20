const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RAW_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const SERVICE_KEY = RAW_KEY ? RAW_KEY.replace(/\\/g, '') : null;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// API Endpoint for National Standard Subway Exit Information
const API_URL = 'https://api.odcloud.kr/api/15073460/v1/uddi:f1eecd67-f707-4c4c-83fc-ee1245b35b7b';

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
    '주민센터': 'Community Center'
};

function translateLandmark(text) {
    if (!text) return text;
    let res = text.trim();
    const sortedKeys = Object.keys(vocab).sort((a, b) => b.length - a.length);
    for (const ko of sortedKeys) {
        const en = vocab[ko];
        res = res.replace(new RegExp(ko, 'g'), en);
    }
    return res;
}

async function fetchExitData(page = 1, perPage = 100) {
    const url = `${API_URL}?serviceKey=${SERVICE_KEY}&page=${page}&perPage=${perPage}&returnType=JSON`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.data || [];
    } catch (err) {
        console.error(`Fetch failed for page ${page}:`, err);
        return [];
    }
}

async function syncExits() {
    console.log('--- Starting National Standard Exit Information Sync ---');

    // 1. Fetch stations from DB
    const { data: stations, error: stError } = await supabase
        .from('stations')
        .select('id, name_ko, line');

    if (stError) {
        console.error('Failed to fetch stations:', stError);
        return;
    }

    // 2. Fetch elevators to associate
    const { data: elevators } = await supabase
        .from('elevators')
        .select('station_name_ko, refined_exit_no, exit_no');

    console.log(`Processing ${stations.length} stations from database...`);

    // We'll fetch a chunk of data (e.g., first 500 items for demonstration/common stations)
    // In a real scenario, you'd loop through all pages.
    const allExits = await fetchExitData(1, 1000);
    console.log(`Fetched ${allExits.length} exit items from API.`);

    for (const item of allExits) {
        const stationName = item['역명'];
        let rawExitNo = item['출구번호'];
        const facilitiesRaw = item['출구별주요시설명'];

        if (!stationName || !rawExitNo || !facilitiesRaw) continue;

        // Normalize exit number (e.g., "1번 출구" -> "1")
        const exitNoMatch = rawExitNo.match(/(\d+(?:-[A-Za-z])?)/);
        const exitNo = exitNoMatch ? exitNoMatch[1] : rawExitNo;

        // Find station(s) in our DB. Some stations might have duplicate names across lines.
        // We filter by name first.
        const matchingStations = stations.filter(s => {
            // "강남(2)" normalization logic if needed. 
            // Most of our DB names are "강남" type.
            const normalizedApiName = stationName.replace(/\(\d+\)/, '');
            return s.name_ko === normalizedApiName;
        });

        if (matchingStations.length === 0) continue;

        // Facilities processing
        const landmarksKo = facilitiesRaw.split(',').map(f => f.trim()).filter(f => f.length > 0);
        const landmarksEn = landmarksKo.map(f => translateLandmark(f));

        for (const station of matchingStations) {
            // Check elevator association
            const hasElevator = (elevators || []).some(e => {
                if (e.station_name_ko !== station.name_ko) return false;
                const refined = (e.refined_exit_no || '').split(',').map(s => s.trim());
                const raw = (e.exit_no || '').split(',').map(s => s.trim());
                return refined.includes(exitNo) || raw.includes(exitNo);
            });

            const { error: upsertError } = await supabase
                .from('station_exits')
                .upsert({
                    station_id: station.id,
                    exit_no: exitNo,
                    landmarks_ko: landmarksKo,
                    landmarks_en: landmarksEn,
                    has_elevator: hasElevator
                }, { onConflict: 'station_id, exit_no' });

            if (upsertError) {
                console.error(`  Upsert error for ${stationName} Exit ${exitNo}:`, upsertError.message);
            }
        }
    }

    console.log('--- Sync Completed ---');
}

syncExits();
