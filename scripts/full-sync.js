const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

// .env 로드
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullSync() {
    console.log('🚀 Starting full translation sync...');

    // 1. DB에서 모든 번역 데이터 가져오기 (Pagination 처리)
    let allData = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('translations')
            .select('ko_text, en_text')
            .range(from, from + step - 1);

        if (error) {
            console.error('❌ Error fetching from DB:', error.message);
            return;
        }

        allData = allData.concat(data);
        if (data.length < step) break;
        from += step;
    }

    console.log(`✅ Fetched ${allData.length} items from Supabase.`);

    // 2. 객체 형태로 변환
    const dict = {};
    // 정렬 (일관성을 위해 가나다순)
    allData.sort((a, b) => a.ko_text.localeCompare(b.ko_text));
    allData.forEach(item => {
        dict[item.ko_text] = item.en_text;
    });

    // 3. JS 파일 생성
    const jsContent = `// Auto-generated file - Do not edit manually
// Generated on: ${new Date().toLocaleString()}
// Total items: ${allData.length}

export const MOVEMENT_TRANSLATIONS = ${JSON.stringify(dict, null, 2)};
`;

    const outputPath = path.resolve(__dirname, '../src/data/movementTranslations.js');
    fs.writeFileSync(outputPath, jsContent, 'utf8');

    // 4. 로컬 JSON 마스터 파일도 같이 업데이트 (백업용)
    const jsonPath = path.resolve(__dirname, 'movements_translations.json');
    fs.writeFileSync(jsonPath, JSON.stringify(dict, null, 2), 'utf8');

    console.log(`✨ Full sync complete!`);
    console.log(`📍 Updated: ${outputPath}`);
}

fullSync();
