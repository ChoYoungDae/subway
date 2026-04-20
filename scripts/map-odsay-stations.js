/**
 * ODSay 역코드 매핑 스크립트
 *
 * 실행 전 필수: Supabase SQL Editor에서 아래 실행
 * ALTER TABLE stations ADD COLUMN IF NOT EXISTS odsay_station_id INTEGER;
 *
 * 실행: node scripts/map-odsay-stations.js
 * 옵션: node scripts/map-odsay-stations.js --dry-run  (DB 저장 없이 매핑 결과만 확인)
 *       node scripts/map-odsay-stations.js --line 2호선  (특정 호선만)
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ODSAY_KEY = process.env.EXPO_PUBLIC_ODSAY_API_KEY;
const ODSAY_BASE = 'https://api.odsay.com/v1/api';

// 옵션 파싱
const isDryRun = process.argv.includes('--dry-run');
const lineFilter = (() => {
    const idx = process.argv.indexOf('--line');
    return idx !== -1 ? process.argv[idx + 1] : null;
})();

// 호선명 정규화 (DB line 필드 ↔ ODSay laneName 비교용)
function normalizeLine(line) {
    if (!line) return '';
    let l = String(line).trim();
    // 공항철도 변형 통일
    if (l.includes('공항') || l.includes('AREX') || l.includes('인천국제')) return '공항철도';
    // "2호선" → "2" → 숫자 비교용
    return l;
}

// ODSay laneName ↔ DB line 일치 여부
function linesMatch(dbLine, odsayLaneName) {
    const a = normalizeLine(dbLine);
    const b = normalizeLine(odsayLaneName);
    if (a === b) return true;
    // "2호선" vs "2" 등 부분 일치 처리
    const stripHoSun = (s) => s.replace(/호선$/, '').replace(/선$/, '').trim();
    return stripHoSun(a) === stripHoSun(b);
}

// ODSay searchStation 호출
async function searchODSayStation(stationName) {
    const url = `${ODSAY_BASE}/searchStation?apiKey=${encodeURIComponent(ODSAY_KEY)}&CID=1000&stationClass=2&stationName=${encodeURIComponent(stationName)}`;
    const res = await fetch(url, { headers: { Referer: 'http://localhost' } });
    const json = await res.json();
    if (json.error) {
        console.warn(`  ⚠️  ODSay error for "${stationName}": ${json.error.message || JSON.stringify(json.error)}`);
        return [];
    }
    return json.result?.station || [];
}

// 역명에서 괄호/역 접미사 제거
function cleanName(name) {
    return (name || '').replace(/\s?\(.*?\)/g, '').replace(/역$/, '').trim();
}

// 지연 함수 (API 과부하 방지)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('=== ODSay 역코드 매핑 스크립트 ===');
    if (isDryRun) console.log('🔍 DRY-RUN 모드: DB에 저장하지 않습니다.');
    if (lineFilter) console.log(`🚇 필터: ${lineFilter}만 처리`);
    console.log('');

    if (!ODSAY_KEY) {
        console.error('❌ EXPO_PUBLIC_ODSAY_API_KEY가 .env에 없습니다.');
        process.exit(1);
    }

    // 1. stations 테이블에서 컬럼 존재 확인
    const { data: colCheck, error: colErr } = await supabase
        .from('stations')
        .select('odsay_station_id')
        .limit(1);

    if (colErr && colErr.message.includes('does not exist')) {
        console.error('❌ odsay_station_id 컬럼이 없습니다.');
        console.error('Supabase SQL Editor에서 먼저 실행하세요:');
        console.error('  ALTER TABLE stations ADD COLUMN IF NOT EXISTS odsay_station_id INTEGER;');
        process.exit(1);
    }

    // 2. 모든 역 조회
    let query = supabase
        .from('stations')
        .select('id, name_ko, line, odsay_station_id')
        .not('stin_cd', 'is', null)
        .order('line')
        .order('name_ko');

    if (lineFilter) {
        query = query.eq('line', lineFilter);
    }

    const { data: stations, error: stErr } = await query;
    if (stErr) {
        console.error('❌ stations 조회 실패:', stErr.message);
        process.exit(1);
    }

    console.log(`✅ ${stations.length}개 역 로드 완료\n`);

    // 3. 이미 매핑된 역 현황
    const alreadyMapped = stations.filter(s => s.odsay_station_id != null).length;
    const toProcess = stations.filter(s => s.odsay_station_id == null);
    console.log(`  - 이미 매핑됨: ${alreadyMapped}개`);
    console.log(`  - 매핑 필요:   ${toProcess.length}개\n`);

    if (toProcess.length === 0) {
        console.log('✅ 모든 역이 이미 매핑되어 있습니다.');
        return;
    }

    // 4. 역별 ODSay stationID 검색 & 업데이트
    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (let i = 0; i < toProcess.length; i++) {
        const station = toProcess[i];
        const cleanedName = cleanName(station.name_ko);
        const progress = `[${i + 1}/${toProcess.length}]`;

        process.stdout.write(`${progress} ${station.name_ko} (${station.line}) → `);

        try {
            const results = await searchODSayStation(cleanedName);

            if (!results.length) {
                console.log('❌ 검색 결과 없음');
                failures.push({ station, reason: 'no_results' });
                failCount++;
            } else {
                // 호선 일치 기준으로 선택
                const matched = results.find(r => linesMatch(station.line, r.laneName));
                const selected = matched || results[0]; // fallback: 첫 번째 결과

                const isExactMatch = !!matched;
                const matchNote = isExactMatch ? '' : ` (fallback: ${selected.laneName})`;
                console.log(`✅ stationID=${selected.stationID}${matchNote}`);

                if (!isDryRun) {
                    const { error: updateErr } = await supabase
                        .from('stations')
                        .update({ odsay_station_id: selected.stationID })
                        .eq('id', station.id);

                    if (updateErr) {
                        console.error(`  ⚠️  DB 저장 실패: ${updateErr.message}`);
                        failures.push({ station, reason: updateErr.message });
                        failCount++;
                        continue;
                    }
                }
                successCount++;
            }
        } catch (err) {
            console.log(`❌ 오류: ${err.message}`);
            failures.push({ station, reason: err.message });
            failCount++;
        }

        // API 호출 간격 (ODSay 무료 1,000건/일 준수)
        await sleep(150);
    }

    // 5. 결과 요약
    console.log('\n=== 결과 요약 ===');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);

    if (failures.length > 0) {
        console.log('\n--- 실패 목록 ---');
        failures.forEach(f => {
            console.log(`  ${f.station.name_ko} (${f.station.line}): ${f.reason}`);
        });
        console.log('\n실패 역은 --dry-run으로 결과를 확인하거나 수동으로 Supabase에서 업데이트하세요.');
    }

    if (!isDryRun && successCount > 0) {
        console.log('\n✅ DB 업데이트 완료. PathFinder에서 odsay_station_id를 바로 사용할 수 있습니다.');
    }
}

main().catch(err => {
    console.error('스크립트 실행 오류:', err);
    process.exit(1);
});
