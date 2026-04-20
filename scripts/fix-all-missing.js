const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const vocab = {
    '공항철도': 'Airport Railroad',
    '대합실': 'Concourse',
    '이동': 'Move/Go',
    '시청': 'City Hall',
    '방면': 'direction',
    '승강장': 'Platform',
    '회현': 'Hoehyeon',
    '하차': 'Exit/Get off',
    '숙대입구': 'Sookmyung Women\'s Univ.',
    '안국': 'Anguk',
    '게이트': 'Gate',
    '통과': 'Pass',
    '운임구역': 'Fare Area',
    '진위': 'Jinwi',
    '진입': 'Enter',
    '남영': 'Namyeong',
    '부근': 'near',
    '경의중앙선': 'Gyeongui-Jungang Line',
    '역사': 'Station',
    '지상': 'Ground-level',
    '환승': 'Transfer',
    '비운임구역': 'Non-fare Area',
    '엘레베이터': 'Elevator',
    '엘리베이터': 'Elevator',
    '출구': 'Exit',
    '외부': 'Outside',
    'KTX 기차역': 'KTX Train Station',
    '공덕': 'Gongdeok',
    '시청': 'City Hall',
    'GTX-A': 'GTX-A',
    '독립문': 'Dongnimmun',
    '승강장 내': 'Inside the platform'
};

function translateSimple(text) {
    let res = text;
    // Handle Floors (B1), (1F) etc.
    res = res.replace(/\((B\d+)\)/g, '($1)');
    res = res.replace(/\(((\d+)F)\)/g, '($1)');

    for (const [ko, en] of Object.entries(vocab)) {
        res = res.replace(new RegExp(ko, 'g'), en);
    }

    // Line names
    res = res.replace(/(\d+)호선/g, 'Line $1');
    return res;
}

async function processAll() {
    const { data: missing, error } = await supabase.from('missing_translations').select('ko_text');
    if (error) {
        console.error(error);
        return;
    }

    if (missing.length === 0) {
        console.log('No missing translations found.');
        return;
    }

    const updates = missing.map(m => ({
        ko_text: m.ko_text,
        en_text: translateSimple(m.ko_text),
        category: 'movement'
    }));

    console.log(`Processing ${updates.length} items...`);

    const { error: upsertError } = await supabase
        .from('translations')
        .upsert(updates, { onConflict: 'ko_text' });

    if (upsertError) {
        console.error('Upsert Error:', upsertError.message);
        return;
    }

    const { error: deleteError } = await supabase
        .from('missing_translations')
        .delete()
        .in('ko_text', missing.map(m => m.ko_text));

    if (deleteError) {
        console.error('Delete Error:', deleteError.message);
    } else {
        console.log('Successfully cleared all missing translations.');
    }
}

processAll();
