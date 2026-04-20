const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function forceEnglish() {
    console.log('Fetching translations with Korean characters...');
    // We fetch EVERYTHING, filter out those with Korean, and overwrite them.
    let allData = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from('translations').select('ko_text, en_text').range(from, from + 999);
        if (error || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }

    const problemItems = allData.filter(item => /[가-힣]/.test(item.en_text));
    console.log(`Found ${problemItems.length} translations that still contain Korean in en_text.`);

    if (problemItems.length === 0) return;

    const updates = problemItems.map(item => {
        let en = item.en_text;
        // Strip remaining Korean characters or translate them
        en = en.replace(/층/g, 'F')
            .replace(/번/g, 'No.')
            .replace(/역무실쪽/g, 'Station Office side')
            .replace(/출입구쪽/g, 'Exit side')
            .replace(/쪽/g, ' side')
            .replace(/[가-힣]/g, ''); // Delete any other Korean character just to be safe
        return {
            ko_text: item.ko_text,
            en_text: en.trim().replace(/\s+/g, ' '),
            category: 'movement'
        };
    });

    const { error } = await supabase.from('translations').upsert(updates, { onConflict: 'ko_text' });
    if (error) {
        console.error('Failed to fix translations:', error);
    } else {
        console.log('Fixed translations!');
    }
}

forceEnglish();
