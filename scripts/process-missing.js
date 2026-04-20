const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const NEW_TRANSLATIONS = [
    {
        ko: "대합실 1층 역무실쪽(1,12번출입구쪽),표 내는 곳 내부",
        en: "1F Concourse (near Station Office / Exits 1, 12), Inside Fare Gate"
    },
    {
        ko: "1,12번 출입구 통로 지하1층 9,10번출입구 옆",
        en: "B1F Passage to Exits 1, 12 (near Exits 9, 10)"
    },
    {
        ko: "1호선 환승통로 방면",
        en: "Toward Line 1 Transfer Passage"
    },
    {
        ko: "8번 출입구 → 1호선환승 방향",
        en: "Exit 8 → Toward Line 1 Transfer"
    }
];

async function processMissing() {
    console.log(`Processing ${NEW_TRANSLATIONS.length} items...`);

    // 1. Upsert to translations
    const chunk = NEW_TRANSLATIONS.map(t => ({
        ko_text: t.ko,
        en_text: t.en,
        category: 'movement'
    }));

    const { error: upsertError } = await supabase
        .from('translations')
        .upsert(chunk, { onConflict: 'ko_text' });

    if (upsertError) {
        console.error('Upsert failed:', upsertError.message);
        return;
    }
    console.log('Successfully added to translations table.');

    // 2. Delete from missing_translations
    const { error: deleteError } = await supabase
        .from('missing_translations')
        .delete()
        .in('ko_text', NEW_TRANSLATIONS.map(t => t.ko));

    if (deleteError) {
        console.error('Failed to clear missing_translations:', deleteError.message);
    } else {
        console.log('Cleared processed items from missing_translations.');
    }
}

processMissing();
