const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_URL = 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003544364&fileDetailSn=1';

const vocab = {
    '국민은행': 'KB Bank', '신한은행': 'Shinhan Bank', '우리은행': 'Woori Bank', '하나은행': 'Hana Bank',
    '기업은행': 'IBK Bank', '농협은행': 'NH Bank', '농협': 'NH Bank', '우체국': 'Post Office',
    '병원': 'Hospital', '초등학교': 'Elementary School', '중학교': 'Middle School', '고등학교': 'High School',
    '대학교': 'University', '공원': 'Park', '백화점': 'Department Store', '아파트': 'Apartment',
    '호텔': 'Hotel', '센터': 'Center', '빌딩': 'Building', '상가': 'Shopping Center',
    '시장': 'Market', '교회': 'Church', '성당': 'Cathedral', '사거리': 'Intersection',
    '삼거리': '3-way Intersection', '출구': 'Exit', '방면': 'Direction', '입구': 'Entrance',
    '광장': 'Square/Plaza', '시청': 'City Hall', '구청': 'District Office', '경찰서': 'Police Station',
    '소방서': 'Fire Station', '도서관': 'Library', '미술관': 'Art Museum', '박물관': 'Museum',
    '극장': 'Theater', '앞': 'Front', '옆': 'Next to', '지점': 'Branch', '역': 'Station',
    '고용노동부': 'Ministry of Employment and Labor', '국세청': 'National Tax Service',
    '세무서': 'Tax Office', '보건소': 'Health Center', '주민센터': 'Community Center'
};

function translateLandmark(text) {
    if (!text) return text;
    let res = text.trim();
    const sortedKeys = Object.keys(vocab).sort((a, b) => b.length - a.length);
    for (const ko of sortedKeys) {
        res = res.replace(new RegExp(ko, 'g'), vocab[ko]);
    }
    return res;
}

async function syncExitsOptimized() {
    console.log('--- Starting Optimized Exit Information Sync (JSON Scalability) ---');

    const { data: rawStations, error: stError } = await supabase.from('stations').select('id, name_ko');
    if (stError) throw stError;

    const stationMap = new Map();
    rawStations.forEach(s => {
        if (!stationMap.has(s.name_ko)) stationMap.set(s.name_ko, []);
        stationMap.get(s.name_ko).push(s);
    });

    const { data: elevators } = await supabase.from('elevators').select('station_name_ko, refined_exit_no, exit_no');

    console.log(`Downloading CSV...`);
    const res = await fetch(CSV_URL);
    const buffer = await res.arrayBuffer();
    let csvText = new TextDecoder('euc-kr').decode(buffer);
    if (!csvText.includes('역명')) csvText = new TextDecoder('utf-8').decode(buffer);

    const rows = csvText.split(/\r?\n/).filter(row => row.trim().length > 0);
    const header = rows[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));

    const idx = {
        station: header.findIndex(h => h === '역명'),
        exit: header.findIndex(h => h.includes('출구번호') || h === '출구'),
        facilities: header.findIndex(h => h.includes('시설명') || h.includes('주요시설'))
    };

    const mergedData = new Map();

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        const stationName = (cols[idx.station] || '').trim();
        const rawExitNo = (cols[idx.exit] || '').trim();
        const facilitiesRaw = (cols[idx.facilities] || '').trim();

        if (!stationName || !rawExitNo || !facilitiesRaw) continue;

        const exitNoMatch = rawExitNo.match(/(\d+(?:-[A-Za-z])?)/);
        const exitNo = exitNoMatch ? exitNoMatch[1] : rawExitNo;

        const baseName = stationName.split('(')[0].trim().replace(/\s*역$/, '');
        const matchingStations = stationMap.get(baseName) || [];

        for (const station of matchingStations) {
            const key = `${station.id}_${exitNo}`;
            if (!mergedData.has(key)) {
                mergedData.set(key, {
                    station_id: station.id,
                    exit_no: exitNo,
                    landmarks: new Set(facilitiesRaw.split(',').map(f => f.trim()).filter(f => f.length > 0 && f.length < 15)),
                    station_name: station.name_ko
                });
            } else {
                facilitiesRaw.split(',').forEach(f => {
                    const l = f.trim();
                    if (l.length > 0 && l.length < 15) mergedData.get(key).landmarks.add(l);
                });
            }
        }
    }

    const upsertData = Array.from(mergedData.values()).map(item => {
        const koList = Array.from(item.landmarks).slice(0, 3);
        const hasElevator = (elevators || []).some(e => {
            if (e.station_name_ko !== item.station_name) return false;
            const refined = (e.refined_exit_no || '').split(',').map(s => s.trim());
            const raw = (e.exit_no || '').split(',').map(s => s.trim());
            return refined.includes(item.exit_no) || raw.includes(item.exit_no);
        });

        return {
            station_id: item.station_id,
            exit_no: item.exit_no,
            landmarks: {
                ko: koList,
                en: koList.map(l => translateLandmark(l))
            },
            has_elevator: hasElevator
        };
    }).slice(0, 950);

    console.log(`Upserting ${upsertData.length} records...`);

    const { error } = await supabase.from('station_exits').upsert(upsertData, { onConflict: 'station_id, exit_no' });

    if (error) console.error('Error:', error.message);
    else console.log('Successfully synced optimized JSON data.');

    console.log('--- Sync Completed ---');
}

syncExitsOptimized().catch(console.error);
