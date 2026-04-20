const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const vocab = {
    '엘리베이터': 'Elevator',
    '승강장': 'Platform',
    '대합실': 'Concourse',
    '출입구': 'Exit',
    '출구': 'Exit',
    '개집표기': 'Fare Gate',
    '휠체어칸': 'Wheelchair Car',
    '표 내는 곳': 'Fare Gate',
    '환승통로': 'Transfer Passage',
    '휠체어리프트': 'Wheelchair Lift',
    '방면': 'direction',
    '방향': 'direction',
    '호선': 'Line',
    '탑승': 'Board',
    '이동': 'Go/Move',
    '통과': 'Pass',
    '하차': 'Exit',
    '승차': 'Board',
    '부근': 'near',
    '옆': 'next to',
    '사이': 'between',
    '내부': 'inside',
    '외부': 'outside',
    '지하': 'B',
    '지상': 'F',
    '층': 'F',
    '복도': 'hallway',
    ' ATM': ' ATM',
    '화장실': 'restroom',
    '물품보관함': 'lockers',
    '직원': 'staff',
    '회현': 'Hoehyeon'
};

const stationNames = {
    '제기동': 'Jegidong',
    '회기': 'Hoegi',
    '신설동': 'Sinseol-dong',
    '동묘앞': 'Dongmyo',
    '동대문': 'Dongdaemun',
    '종로3가': 'Jongno 3-ga',
    '종로5가': 'Jongno 5-ga',
    '종각': 'Jongak',
    '을지로3가': 'Euljiro 3-ga',
    '을지로4가': 'Euljiro 4-ga',
    '을지로입구': 'Euljiro 1-ga',
    '충정로': 'Chungjeongno',
    '시청': 'City Hall',
    '서울역': 'Seoul Station',
    '아차산역': 'Achasan Station',
    '애오개역': 'Aeogae Station',
    '암사역': 'Amsa Station',
    '발산역': 'Balsan Station',
    '이대역': 'Ewha Womans Univ. Station',
    '회현': 'Hoehyeon',
    '도림천': 'Dorimcheon',
    '문래': 'Mullae',
    '구로': 'Guro'
};

function translateSimple(text) {
    let res = text;

    // Station names
    for (const [ko, en] of Object.entries(stationNames)) {
        res = res.replace(new RegExp(ko, 'g'), en);
    }

    // Rules
    res = res.replace(/(\d+)번\s*출입구/g, 'Exit $1');
    res = res.replace(/(\d+)번\s*출구/g, 'Exit $1');
    res = res.replace(/지하\s*(\d+)층/g, 'B$1F');
    res = res.replace(/지상\s*(\d+)층/g, '$1F');
    res = res.replace(/(\d+)층/g, '$1F');

    for (const [ko, en] of Object.entries(vocab)) {
        res = res.replace(new RegExp(ko, 'g'), en);
    }

    // Clean up
    res = res.replace(/,\s*,/g, ',');
    res = res.replace(/\(\s*\)/g, '');
    return res.trim();
}

async function collectAndTranslate() {
    const { data: missing, error } = await supabase.from('missing_translations').select('ko_text');
    if (error) {
        console.error(error);
        return;
    }

    const translations = missing.map(m => ({
        ko: m.ko_text,
        en: translateSimple(m.ko_text)
    }));

    console.log(JSON.stringify(translations, null, 2));
}

collectAndTranslate();
