/**
 * KRIC stationElevator API → elevators 테이블 동기화
 *
 * 사용법:
 *   node scripts/sync-elevators-from-api.js           # 실제 업데이트
 *   node scripts/sync-elevators-from-api.js --dry-run # 변경 건수만 출력
 *
 * 동작:
 *   1. stations 테이블에서 전체 역 목록 로드 (kric_opr_cd, ln_cd, stin_cd)
 *   2. 각 역에 대해 KRIC stationElevator API 호출
 *   3. 기존 DB 레코드와 비교 (중복 기준: stin_cd + exit_no + location_detail_ko)
 *   4. 신규 레코드만 INSERT
 *
 * 주의:
 *   - 9호선(S9)은 KRIC API 미제공으로 스킵
 *   - INSERT 후 populate_direction_data.mjs 실행 필요 (내부 엘리베이터 방향 파싱)
 *
 * 출처 문서: docs/elevators-data-source.md
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');
const SERVICE_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const DELAY_MS = 200; // API 호출 간격 (ms)

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── API 호출 ────────────────────────────────────────────────────────────────

function fetchElevators(railOprIsttCd, lnCd, stinCd) {
  return new Promise((resolve) => {
    const qs = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      format: 'json',
      railOprIsttCd,
      lnCd,
      stinCd,
    }).toString();
    const url = `https://openapi.kric.go.kr/openapi/convenientInfo/stationElevator?${qs}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const arr = Array.isArray(json?.body) ? json.body : [];
          resolve(arr);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '[DRY-RUN] 변경 사항을 DB에 저장하지 않습니다.' : '[LIVE] DB에 저장합니다.');
  console.log('');

  // 1. 전체 역 목록
  const { data: stations, error: staErr } = await supabase
    .from('stations')
    .select('stin_cd, name_ko, line, ln_cd, kric_opr_cd');
  if (staErr) { console.error('stations 조회 실패:', staErr.message); process.exit(1); }

  // 2. 기존 elevators 레코드 (중복 체크용)
  const { data: existing, error: elvErr } = await supabase
    .from('elevators')
    .select('stin_cd, exit_no, location_detail_ko');
  if (elvErr) { console.error('elevators 조회 실패:', elvErr.message); process.exit(1); }

  const existingKeys = new Set(
    existing.map((e) => `${e.stin_cd}|${e.exit_no}|${e.location_detail_ko}`)
  );

  // 3. 현재 최대 id
  const { data: maxRow } = await supabase
    .from('elevators')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  let nextId = (maxRow?.[0]?.id ?? 0) + 1;

  // 4. 역별 API 호출 및 비교
  const toInsert = [];
  let skipped = 0;
  let apiEmpty = 0;

  for (const st of stations) {
    const { stin_cd, name_ko, line, ln_cd, kric_opr_cd } = st;

    // 9호선은 KRIC API 미제공
    if (kric_opr_cd === 'S9') {
      skipped++;
      continue;
    }

    const items = await fetchElevators(kric_opr_cd, ln_cd, stin_cd);
    await sleep(DELAY_MS);

    if (items.length === 0) {
      apiEmpty++;
      continue;
    }

    for (const item of items) {
      const key = `${stin_cd}|${item.exitNo}|${item.dtlLoc}`;
      if (existingKeys.has(key)) continue;

      toInsert.push({
        id: nextId++,
        stin_cd,
        station_name_ko: name_ko,
        line,
        exit_no: item.exitNo,
        location_detail_ko: item.dtlLoc ?? '',
        is_internal: item.exitNo === '내부',
      });
    }

    if (toInsert.length > 0 && toInsert.length % 50 === 0) {
      console.log(`  진행중... 신규 ${toInsert.length}건 발견`);
    }
  }

  // 5. 결과 출력
  console.log(`\n=== 결과 ===`);
  console.log(`전체 역: ${stations.length}개`);
  console.log(`9호선 스킵: ${skipped}개`);
  console.log(`API 데이터 없음: ${apiEmpty}개`);
  console.log(`기존 DB 레코드: ${existing.length}건`);
  console.log(`신규 추가 대상: ${toInsert.length}건`);

  if (toInsert.length > 0) {
    console.log('\n신규 레코드 목록:');
    toInsert.forEach((r) =>
      console.log(`  [${r.stin_cd}] ${r.station_name_ko} | exit_no=${r.exit_no} | ${r.location_detail_ko} | internal=${r.is_internal}`)
    );
  }

  // 6. INSERT
  if (!DRY_RUN && toInsert.length > 0) {
    console.log('\nDB에 INSERT 중...');
    const CHUNK = 100;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await supabase.from('elevators').insert(chunk);
      if (error) {
        console.error(`INSERT 실패 (chunk ${i}~${i + CHUNK}):`, error.message);
        process.exit(1);
      }
      console.log(`  ${i + chunk.length}/${toInsert.length}건 완료`);
    }
    console.log('\n✅ 동기화 완료');
    console.log('⚠️  is_internal=TRUE 레코드가 추가되었다면 아래 명령을 실행하세요:');
    console.log('   node scripts/populate_direction_data.mjs');
  } else if (DRY_RUN) {
    console.log('\n[DRY-RUN] 실제 저장 없이 종료');
  } else {
    console.log('\n신규 레코드 없음. DB가 최신 상태입니다.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
