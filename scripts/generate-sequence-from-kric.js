/**
 * KRIC subwayRouteInfo API 기반으로 station_sequence.json 재생성.
 * stinConsOrdr(역구성순서)를 기준으로 올바른 순서를 보장.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SERVICE_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const BASE_URL = 'https://openapi.kric.go.kr/openapi/trainUseInfo/subwayRouteInfo';
const MREA_WIDE_CD = '01'; // 수도권

// 수도권 노선 lnCd 목록 (DB의 ln_cd 값과 동일)
const LINE_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A1'];

// KRIC routNm → 앱에서 사용하는 노선명 보정
const ROUTE_NM_OVERRIDE = {
    '공항': '공항철도',
};

// CSV에서 stin_cd → name_en 룩업 맵 구성
function buildNameEnMap() {
    const csvPath = path.join(__dirname, '../stations_정리_삭제가능.csv');
    const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    const idxStinCd = headers.indexOf('stin_cd');
    const idxNameEn = headers.indexOf('name_en');

    const map = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const stinCd = cols[idxStinCd]?.trim();
        const nameEn = cols[idxNameEn]?.trim();
        if (stinCd && nameEn) map[stinCd] = nameEn;
    }
    return map;
}

async function fetchLine(lnCd) {
    const url = `${BASE_URL}?serviceKey=${SERVICE_KEY}&format=json&mreaWideCd=${MREA_WIDE_CD}&lnCd=${lnCd}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for lnCd=${lnCd}`);
    const json = await resp.json();
    if (json.header?.resultCode !== '00') {
        console.warn(`  ⚠️ lnCd=${lnCd}: ${json.header?.resultMsg}`);
        return [];
    }
    return json.body || [];
}

async function generateSequence() {
    console.log('📂 Building name_en lookup from CSV...');
    const nameEnMap = buildNameEnMap();
    console.log(`  ✓ ${Object.keys(nameEnMap).length} entries`);

    const sequence = {};

    for (const lnCd of LINE_CODES) {
        console.log(`\n🚇 Fetching lnCd=${lnCd}...`);
        try {
            const stations = await fetchLine(lnCd);
            if (stations.length === 0) {
                console.log(`  ⚠️ No data returned`);
                continue;
            }

            // stinConsOrdr 오름차순 정렬
            stations.sort((a, b) => a.stinConsOrdr - b.stinConsOrdr);

            const rawRoutNm = stations[0].routNm;
            const routNm = ROUTE_NM_OVERRIDE[rawRoutNm] || rawRoutNm;
            sequence[routNm] = stations.map(s => ({
                name_ko:  s.stinNm,
                name_en:  nameEnMap[s.stinCd] || s.stinNm,
                stin_cd:  s.stinCd,
                ln_cd:    s.lnCd,
                opr_cd:   s.railOprIsttCd,
            }));

            console.log(`  ✓ ${routNm}: ${sequence[routNm].length} stations`);
        } catch (err) {
            console.error(`  ❌ lnCd=${lnCd} failed:`, err.message);
        }
    }

    const outputPath = path.join(__dirname, '../station_sequence.json');
    fs.writeFileSync(outputPath, JSON.stringify(sequence, null, 2), 'utf8');

    console.log(`\n🎉 Done! Saved to: ${outputPath}`);
    console.log('\nSummary:');
    Object.entries(sequence).forEach(([line, stns]) => {
        console.log(`  ${line}: ${stns.length} stations`);
    });
}

generateSequence().catch(console.error);
