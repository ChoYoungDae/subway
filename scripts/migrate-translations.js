const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

// .env 로드
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Loading movementTranslations.js...');
    const filePath = path.resolve(__dirname, '../src/data/movementTranslations.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // 간단한 정규식으로 JSON 객체 부분 추출
    const match = content.match(/export const MOVEMENT_TRANSLATIONS = (\{[\s\S]*\});/);
    if (!match) {
        console.error('Could not find MOVEMENT_TRANSLATIONS object');
        return;
    }

    let dict;
    try {
        // 주의: 파일이 순수 JSON이 아닐 수 있으므로 제어된 환경에서 평가하거나 수동 파싱
        // 여기서는 안전을 위해 실질적인 객체 파싱 로직 사용
        const jsonText = match[1]
            .replace(/\/\/.*$/gm, '') // 주석 제거
            .replace(/,\s*}/, '}')    // 마지막 쉼표 제거
            .trim();

        // Eval 대신 Function 생성으로 안전하게 객체화 (간단한 객체인 경우)
        dict = new Function(`return ${jsonText}`)();
    } catch (e) {
        console.error('Failed to parse translation object:', e.message);
        return;
    }

    const entries = Object.entries(dict);
    console.log(`Found ${entries.length} sequences. Preparing chunks...`);

    const category = 'movement';
    const batchSize = 100;

    for (let i = 0; i < entries.length; i += batchSize) {
        const chunk = entries.slice(i, i + batchSize).map(([ko, en]) => ({
            ko_text: ko.trim(),
            en_text: en.trim(),
            category
        }));

        console.log(`Migrating items ${i + 1} to ${Math.min(i + batchSize, entries.length)}...`);

        const { error } = await supabase
            .from('translations')
            .upsert(chunk, { onConflict: 'ko_text' });

        if (error) {
            console.error('Error during upsert:', error.message);
            // 계속 진행 시도
        }
    }

    console.log('Migration complete!');
}

migrate();
