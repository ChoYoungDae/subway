
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

// Mocking chosung.js content for comparison
const DIRECTION_MAP = {
  '신도림': 'Sindorim', '대림': 'Daerim', '문래': 'Mullae', '영등포구청': 'Yeongdeungpo-gu Office',
  '당산': 'Dangsan', '합정': 'Hapjeong', '홍대입구': 'Hongik Univ.', '신촌': 'Sinchon',
  '이대': 'Ewha Womans Univ.', '아현': 'Ahyeon', '충정로': 'Chungjeongno', '시청': 'City Hall',
  // ... and many more
};

async function compareCoverage() {
    const { data: dbNouns } = await supabase.from('proper_nouns').select('kr, en');
    const dbMap = new Map(dbNouns.map(n => [n.kr, n.en]));
    
    // Read chosung.js to get all keys
    const content = fs.readFileSync('d:/projects/subway-access/src/utils/chosung.js', 'utf8');
    const allMaps = [
        { name: 'DIRECTION_MAP', regex: /'([^']+)': '([^']+)'/g },
        { name: 'VERB_MAP', regex: /'([^']+)': '([^']+)'/g },
        { name: 'NOUN_MAP', regex: /'([^']+)': '([^']+)'/g },
        { name: 'LINE_MAP', regex: /'([^']+)': '([^']+)'/g },
    ];

    let missing = [];
    
    // This is a bit rough but works for a quick check
    const matches = content.matchAll(/'([^']+)':\s*'([^']+)'/g);
    for (const match of matches) {
        const [_, kr, en] = match;
        if (!dbMap.has(kr)) {
            missing.push({ kr, en });
        }
    }

    console.log(`Missing from DB: ${missing.length} items`);
    if (missing.length > 0) {
        console.log('Sample missing:', missing.slice(0, 10));
        // Prepare SQL insert statements or JSON for the user
        fs.writeFileSync('missing_translations.json', JSON.stringify(missing, null, 2));
    }
}

compareCoverage();
