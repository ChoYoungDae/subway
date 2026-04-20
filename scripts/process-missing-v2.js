const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const NEW_TRANSLATIONS = [
    { ko: "지하 2층 회현 방면1-1", en: "B2F toward Hoehyeon (Train 1-1)" },
    { ko: "지하 0.5층 회현 방면10-4", en: "B0.5F toward Hoehyeon (Train 10-4)" },
    { ko: "지하1층 2,3,4,5,6,7,8번 출입구쪽, 표 내는 곳 내부", en: "B1F toward Exits 2-8, Inside Fare Gate" },
    { ko: "1,12번 출입구 표 내는 곳 주변", en: "Near Exits 1, 12 Fare Gate" },
    { ko: "8번 출입구 → 1호선환승 방향", en: "Exit 8 → Toward Line 1 Transfer" },
    { ko: "지하1층 9,10번출입구 옆", en: "B1F next to Exits 9, 10" },
    { ko: "지하2층 환승통로", en: "B2F Transfer Passage" },
    { ko: "14번 출입구  옆, 11번 출입구 물품보관함 건너편", en: "Next to Exit 14, Across from Exits 11 Lockers" },
    { ko: "1호선 1,2번 출입구 사이 복도", en: "Hallway between Line 1 Exits 1, 2" },
    { ko: "11,14번 출입구 주변", en: "Near Exits 11, 14" },
    { ko: "지하1층 2번출입구 부근", en: "Near B1F Exit 2" },
    { ko: "지하 1층 2,3번 출입구 복도 사이/화장실 주변", en: "Between B1F Exits 2, 3 Hallways / Near Restroom" },
    { ko: "지하 1층 2,3번 출입구 복도 사이", en: "Between B1F Exits 2, 3 Hallways" },
    { ko: "아차산역 B1층  화장실 주변", en: "Achasan Station B1F, Near Restroom" },
    { ko: "애오개역 B1층 화장실 주변", en: "Aeogae Station B1F, Near Restroom" },
    { ko: "대합실 1층 표 내는 곳 통과 후좌측", en: "Concourse 1F, Left after passing Fare Gate" },
    { ko: "2번출입구,E/V 주변", en: "Near Exit 2 / Elevator" },
    { ko: "지하 1층 3번 출입구 ATM주변", en: "Near B1F Exit 3 ATM" },
    { ko: "지하1층 대합실 이대역방면 끝단", en: "B1F Concourse, end toward Ewha Womans Univ. Station" },
    { ko: "암사역 B1층 4번 출입구 방면", en: "Amsa Station B1F, toward Exit 4" },
    { ko: "발산역 B1층 9번 출입구 방면", en: "Balsan Station B1F, toward Exit 9" },
    { ko: "도림천방면 엘리베이터 이용후 지하2층 승강장 이동", en: "After using elevator toward Dorimcheon, move to B2F platform" },
    { ko: "문래방면 엘리베이터 이용후 지하2층 승강장 이동", en: "After using elevator toward Mullae, move to B2F platform" },
    { ko: "개집표기 외부,1번 출입구방향", en: "Outside Fare Gate, toward Exit 1" },
    { ko: "1번 출입구 표 내는 곳 내부 상가 주변", en: "Inside Exit 1 Fare Gate, near shops" },
    { ko: "표 내는 곳 내부, 1번출입구방향", en: "Inside Fare Gate, toward Exit 1" },
    { ko: "1번 출입구 외부문 주변", en: "Near Exit 1 outer door" },
    { ko: "지하 1층 2번 출입구 주변", en: "Near B1F Exit 2" },
    { ko: "대합실 1층 1, 9번 출입구 사이", en: "Concourse 1F, between Exits 1 and 9" },
    { ko: "B2층 표 내는 곳 주변", en: "Near B2F Fare Gate" },
    { ko: "지하3층 대합실 A계단 방면", en: "B3F Concourse, toward Stairs A" },
    { ko: "지상1층 E/L 1호기 뒤", en: "1F Behind Elevator No. 1" },
    { ko: "지하 1층 6번 출입구 주변", en: "Near B1F Exit 6" },
    { ko: "지하 1층 4번 출입구 주변", en: "Near B1F Exit 4" },
    { ko: "서초방면 대합실 끝(1,4번 출입구방향),표 내는 곳 외부", en: "End of Concourse toward Seocho (direction Exits 1, 4), Outside Fare Gate" },
    { ko: "지하1층 4번 출입구 주변", en: "Near B1F Exit 4" },
    { ko: "(2F) 2층 1호선 대합실 하차", en: "(2F) Exit at 2F Line 1 Concourse" },
    { ko: "1층 구로 방면 승강장 하차", en: "Exit at 1F Guro-bound platform" },
    { ko: "지하1층 2,3,4,5,6,7,8번 출입구쪽,표 내는 곳 내부", en: "B1F toward Exits 2-8, Inside Fare Gate" },
    { ko: "대합실 1층 역무실쪽(1,12번출입구쪽),표 내는 곳 내부", en: "1F Concourse (near Station Office / Exits 1, 12), Inside Fare Gate" }
];

async function processMissing() {
    console.log(`Processing ${NEW_TRANSLATIONS.length} items...`);

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

    const { error: deleteError } = await supabase
        .from('missing_translations')
        .delete()
        .in('ko_text', NEW_TRANSLATIONS.map(t => t.ko).filter(ko => ko));

    if (deleteError) {
        console.error('Failed to clear missing_translations:', deleteError.message);
    } else {
        console.log('Cleared processed items from missing_translations.');
    }
}

processMissing();
