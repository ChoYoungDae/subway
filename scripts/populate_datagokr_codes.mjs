/**
 * populate_datagokr_codes.mjs
 *
 * 서울교통공사_노선별 지하철역 정보.json의 station_cd(Data.go.kr stnCd)를
 * stations 테이블의 datagokr_stn_cd 컬럼에 채워 넣습니다.
 *
 * 실행: node scripts/populate_datagokr_codes.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// JSON 로드
const jsonPath = join(__dirname, '..', '서울교통공사_노선별 지하철역 정보.json');
const { DATA: jsonStations } = JSON.parse(readFileSync(jsonPath, 'utf-8'));

// "01호선" → "1" 정규화 (DB ln_cd 형식)
function normalizeLine(lineNum) {
    return String(lineNum).replace(/^0+/, '').replace(/호선$/, '');
}

// DB stations 전체 로드
const { data: dbStations, error } = await supabase
    .from('stations')
    .select('id, name_ko, ln_cd, stin_cd, datagokr_stn_cd')
    .not('stin_cd', 'is', null);

if (error) {
    console.error('DB 조회 실패:', error.message);
    process.exit(1);
}

console.log(`DB 역 수: ${dbStations.length}, JSON 역 수: ${jsonStations.length}`);

const updates = [];
const unmatched = [];

for (const js of jsonStations) {
    const jsLine = normalizeLine(js.line_num);
    const jsName = js.station_nm.trim();

    const matched = dbStations.find(db =>
        db.name_ko?.replace(/\s?\(.*?\)/g, '').replace(/역$/, '').trim() === jsName &&
        String(db.ln_cd) === jsLine
    );

    if (matched) {
        updates.push({ id: matched.id, datagokr_stn_cd: js.station_cd });
    } else {
        unmatched.push(`${jsName} (${js.line_num}) station_cd=${js.station_cd}`);
    }
}

console.log(`매칭 성공: ${updates.length}, 미매칭: ${unmatched.length}`);
if (unmatched.length > 0) {
    console.log('--- 미매칭 역 목록 ---');
    unmatched.forEach(u => console.log(' ', u));
}

// 개별 update (id 기준)
let successCount = 0;
let failCount = 0;
await Promise.all(updates.map(async ({ id, datagokr_stn_cd }) => {
    const { error: updateErr } = await supabase
        .from('stations')
        .update({ datagokr_stn_cd })
        .eq('id', id);
    if (updateErr) {
        console.error(`id=${id} 실패:`, updateErr.message);
        failCount++;
    } else {
        successCount++;
    }
}));

console.log(`✅ 완료: ${successCount}개 성공, ${failCount}개 실패`);
