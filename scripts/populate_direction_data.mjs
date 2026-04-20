/**
 * populate_direction_data.mjs
 *
 * Step 1. stations.stin_cons_ordr 계산·업데이트
 *   - ln_cd 별로 stin_cd 숫자 오름차순 정렬 → 1-based 순서 부여
 *
 * Step 2. elevators (is_internal=TRUE) 컬럼 파싱·업데이트
 *   - location_detail_ko: "방면역명칸-문" 패턴 파싱
 *     예) "시청 방면5-3"         → toward="시청" car=5 door=3
 *         "삼각지 방면4-3, 이태원 방면5-1" → primary + quick_exit_alt
 *   - platform_side: toward 역의 stin_cons_ordr vs 현재 역 비교
 *
 * 실행: node scripts/populate_direction_data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config }        from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const BATCH_SIZE = 100;

// ── 파싱 유틸 ─────────────────────────────────────────────────
// "시청 방면5-3"         → [{ toward: "시청", car: 5, door: 3 }]
// "삼각지 방면4-3, 이태원 방면5-1" → [{...}, {...}]
function parseLocationDetail(text) {
    if (!text) return { results: [], ambiguous: false };
    
    // Improved regex to handle: "방면칸-문", "방면 칸-문", "방면(칸-문)"
    const pattern = /(.+?)\s*방면\s*\(?(\d+)-(\d+)\)?/g;
    const results = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        results.push({
            toward: match[1].trim(),
            car:    parseInt(match[2], 10),
            door:   parseInt(match[3], 10),
        });
    }
    
    // If text contains "방면" but no pattern was matched, or if multiple were expected but only one matched.
    // Also consider "대합실", "환승통로" without boarding info as ambiguous/incomplete if they are is_internal=true.
    const hasTowardKeyword = text.includes('방면') || text.includes('방향');
    const ambiguous = (hasTowardKeyword && results.length === 0) || (!hasTowardKeyword && results.length === 0);
    
    return { results, ambiguous };
}

// 역명 정규화 (괄호 제거, 역 접미사 제거)
function normName(name) {
    return (name || '').replace(/\s?\(.*?\)/g, '').replace(/역$/, '').trim();
}

// ── Step 1: stin_cons_ordr 계산 ───────────────────────────────
async function step1_computeConsOrdr() {
    console.log('[Step 1] stations.stin_cons_ordr 계산 중...');

    const { data: stations, error } = await supabase
        .from('stations')
        .select('id, stin_cd, ln_cd')
        .not('stin_cd', 'is', null);

    if (error) throw new Error(`stations 로드 실패: ${error.message}`);
    console.log(`  → 총 ${stations.length}개 역 로드`);

    // ln_cd 그룹별로 stin_cd 오름차순 정렬 후 1-based 순서 부여
    const byLine = {};
    for (const s of stations) {
        const key = String(s.ln_cd);
        if (!byLine[key]) byLine[key] = [];
        byLine[key].push(s);
    }

    const updates = [];
    for (const [lnCd, stns] of Object.entries(byLine)) {
        stns.sort((a, b) => parseInt(a.stin_cd, 10) - parseInt(b.stin_cd, 10));
        stns.forEach((s, i) => {
            updates.push({ id: s.id, stin_cons_ordr: i + 1 });
        });
        console.log(`  ln_cd=${lnCd}: ${stns.length}개 역, consOrdr 1~${stns.length}`);
    }

    // 병렬 update (BATCH_SIZE씩 묶어서)
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const errors = (await Promise.all(
            batch.map(u =>
                supabase.from('stations')
                    .update({ stin_cons_ordr: u.stin_cons_ordr })
                    .eq('id', u.id)
                    .then(({ error }) => error)
            )
        )).filter(Boolean);
        if (errors.length) throw new Error(`stations update 실패: ${errors[0].message}`);
        console.log(`  업데이트 ${i + 1}~${Math.min(i + BATCH_SIZE, updates.length)}`);
    }

    console.log(`✓ stin_cons_ordr 업데이트 완료 (${updates.length}개)\n`);
}

// ── Step 2: elevators 파싱 ────────────────────────────────────
async function step2_parseElevators() {
    console.log('[Step 2] elevators location_detail_ko 파싱 중...');

    // 역 데이터 (stin_cons_ordr 포함)
    const { data: stations, error: sErr } = await supabase
        .from('stations')
        .select('id, name_ko, stin_cd, ln_cd, stin_cons_ordr')
        .not('stin_cd', 'is', null)
        .not('stin_cons_ordr', 'is', null);
    if (sErr) throw new Error(`stations 로드 실패: ${sErr.message}`);

    // 빠른 조회를 위한 맵 구성
    // key: `${ln_cd}_${normName(name_ko)}` → stin_cons_ordr
    const nameOrdrMap = {};
    // key: stin_cd(string) → station record
    const stinCdMap = {};

    for (const s of stations) {
        stinCdMap[String(s.stin_cd)] = s;
        const norm = normName(s.name_ko);
        const key  = `${s.ln_cd}_${norm}`;
        // 같은 역명이 여러 호선에 있을 수 있으므로 ln_cd 포함 키 사용
        nameOrdrMap[key] = s.stin_cons_ordr;
    }

    // 내부 엘리베이터만 (is_internal=TRUE)
    const { data: elevators, error: eErr } = await supabase
        .from('elevators')
        .select('id, stin_cd, location_detail_ko, line')
        .eq('is_internal', true)
        .not('location_detail_ko', 'is', null);
    if (eErr) throw new Error(`elevators 로드 실패: ${eErr.message}`);

    console.log(`  → ${elevators.length}개 내부 엘리베이터 처리`);

    const updates = [];
    let skipped = 0;

    const ambiguousEntries = [];
    for (const elev of elevators) {
        const { results: entries, ambiguous } = parseLocationDetail(elev.location_detail_ko);
        
        if (ambiguous || entries.length === 0) {
            ambiguousEntries.push({
                id: elev.id,
                stin_cd: elev.stin_cd,
                text: elev.location_detail_ko,
                reason: entries.length === 0 ? 'No pattern match' : 'Partial match / Ambiguous'
            });
            if (entries.length === 0) {
                skipped++;
                continue;
            }
        }

        const primary = entries[0];

        // 현재 역 정보
        const curStation = stinCdMap[String(elev.stin_cd)];
        if (!curStation) {
            console.warn(`  ⚠️ stin_cd=${elev.stin_cd} 역 미발견 (elev id=${elev.id})`);
            skipped++;
            continue;
        }

        // toward 역의 stin_cons_ordr 조회 (같은 노선 기준)
        const lnCd       = String(curStation.ln_cd);
        const normToward = normName(primary.toward);
        const towardOrdr = nameOrdrMap[`${lnCd}_${normToward}`];

        let platformSide = null;
        if (towardOrdr != null && curStation.stin_cons_ordr != null) {
            platformSide = towardOrdr > curStation.stin_cons_ordr ? 'higher' : 'lower';
        } else {
            console.warn(`  ⚠️ toward="${primary.toward}" 역 미발견 또는 ordr 없음 (elev id=${elev.id}, lnCd=${lnCd})`);
        }

        updates.push({
            id:                elev.id,
            toward_station_ko: primary.toward,
            car_number:        primary.car,
            door_number:       primary.door,
            boarding_positions: entries.map(e => ({
                toward: e.toward,
                car:    e.car,
                door:   e.door,
            })),
        });
    }

    if (ambiguousEntries.length > 0) {
        console.log(`\n  ⚠️ 모호한 문구 ${ambiguousEntries.length}개 발견`);
        // We'll write this to a temporary file for the model to read and report
        import('fs').then(fs => {
            fs.writeFileSync('tmp/ambiguous_report.json', JSON.stringify(ambiguousEntries, null, 2));
        });
    }

    console.log(`  파싱 성공: ${updates.length}개 / 스킵(정보없음): ${skipped}개`);

    // 병렬 update (BATCH_SIZE씩 묶어서)
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const errors = (await Promise.all(
            batch.map(({ id, ...fields }) =>
                supabase.from('elevators')
                    .update(fields)
                    .eq('id', id)
                    .then(({ error }) => error)
            )
        )).filter(Boolean);
        if (errors.length) throw new Error(`elevators update 실패: ${errors[0].message}`);
        console.log(`  업데이트 ${i + 1}~${Math.min(i + BATCH_SIZE, updates.length)}`);
    }

    console.log(`✓ elevators 업데이트 완료 (${updates.length}개)\n`);

}

// ── Main ─────────────────────────────────────────────────────
async function main() {
    console.log('=== populate_direction_data.mjs ===\n');
    await step1_computeConsOrdr();
    await step2_parseElevators();
    console.log('✅ 완료!');
}

main().catch(err => {
    console.error('❌ 오류:', err.message);
    process.exit(1);
});
