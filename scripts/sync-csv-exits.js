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

async function syncExits() {
    console.log('--- Starting Merged Batch Exit Information Sync via CSV ---');

    const { data: stations, error: stError } = await supabase.from('stations').select('id, name_ko');
    if (stError) throw stError;

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

    const mergedMap = new Map(); // key: stationId_exitNo -> { station_id, exit_no, landmarks_ko: Set, landmarks_en: Set, has_elevator: bool }

    console.log(`Analyzing ${rows.length - 1} rows...`);

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        const stationName = (cols[idx.station] || '').trim();
        const rawExitNo = (cols[idx.exit] || '').trim();
        const facilitiesRaw = (cols[idx.facilities] || '').trim();

        if (!stationName || !rawExitNo || !facilitiesRaw) continue;

        const exitNoMatch = rawExitNo.match(/(\d+(?:-[A-Za-z])?)/);
        const exitNo = exitNoMatch ? exitNoMatch[1] : rawExitNo;

        const baseName = stationName.split('(')[0].trim().replace(/\s*역$/, '');
        const matchingStations = stations.filter(s => s.name_ko.startsWith(baseName));

        if (matchingStations.length === 0) continue;

        const landmarksKo = facilitiesRaw.split(',').map(f => f.trim()).filter(f => f.length > 0);

        for (const station of matchingStations) {
            const key = `${station.id}_${exitNo}`;
            if (!mergedMap.has(key)) {
                const hasElevator = (elevators || []).some(e => {
                    if (e.station_name_ko !== station.name_ko) return false;
                    const refined = (e.refined_exit_no || '').split(',').map(s => s.trim());
                    const raw = (e.exit_no || '').split(',').map(s => s.trim());
                    return refined.includes(exitNo) || raw.includes(exitNo);
                });

                mergedMap.set(key, {
                    station_id: station.id,
                    exit_no: exitNo,
                    landmarks_ko: new Set(landmarksKo),
                    has_elevator: hasElevator
                });
            } else {
                const existing = mergedMap.get(key);
                landmarksKo.forEach(l => existing.landmarks_ko.add(l));
            }
        }
    }

    const upsertData = Array.from(mergedMap.values()).map(item => ({
        ...item,
        landmarks_ko: Array.from(item.landmarks_ko),
        landmarks_en: Array.from(item.landmarks_ko).map(l => translateLandmark(l))
    }));

    console.log(`Prepared ${upsertData.length} unique station/exit entries. Starting batch upload...`);

    const BATCH_SIZE = 500;
    for (let i = 0; i < upsertData.length; i += BATCH_SIZE) {
        const batch = upsertData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('station_exits')
            .upsert(batch, { onConflict: 'station_id, exit_no' });

        if (error) {
            console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
        } else {
            console.log(`Batch ${i / BATCH_SIZE + 1} synced (${Math.min(i + BATCH_SIZE, upsertData.length)}/${upsertData.length})`);
        }
    }

    console.log('--- Sync Completed ---');
}

syncExits().catch(console.error);
