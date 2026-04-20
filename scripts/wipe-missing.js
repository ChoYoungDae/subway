const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function wipeMissing() {
    console.log('Fetching items to ensure they are translated first...');
    const { data: missing } = await supabase.from('missing_translations').select('ko_text');

    if (missing && missing.length > 0) {
        // Just to be safe, make sure these are in translations (trimmed)
        const vocab = {
            '엘리베이터': 'Elevator', '승강장': 'Platform', '대합실': 'Concourse', '출입구': 'Exit', '출구': 'Exit',
            '개집표기': 'Fare Gate', '표 내는 곳': 'Fare Gate', '환승': 'Transfer', '방면': 'direction', '방향': 'direction',
            '이동': 'Move', '탑승': 'Board', '하차': 'Exit', '내부': 'Inside', '외부': 'Outside'
        };

        const updates = missing.map(m => {
            let ko = m.ko_text.trim();
            let en = ko;
            for (const [k, v] of Object.entries(vocab)) {
                en = en.replace(new RegExp(k, 'g'), v);
            }
            return { ko_text: ko, en_text: en, category: 'movement' };
        });

        console.log(`Upserting ${updates.length} items (trimmed) to translations...`);
        await supabase.from('translations').upsert(updates, { onConflict: 'ko_text' });
    }

    console.log('Wiping missing_translations table completely...');
    // Delete all rows where ko_text is not null (which is all of them)
    const { error, count } = await supabase
        .from('missing_translations')
        .delete()
        .neq('ko_text', '___IMPOSSIBLE_VALUE___');

    if (error) {
        console.error('Wipe failed:', error.message);
    } else {
        console.log('Successfully wiped missing_translations.');
    }
}

wipeMissing();
