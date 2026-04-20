const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncFromDb() {
    console.log('Fetching translations from Supabase...');

    let allData = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('translations')
            .select('ko_text, en_text')
            .range(from, from + step - 1);

        if (error) {
            console.error('Error fetching translations:', error.message);
            return;
        }

        allData = allData.concat(data);
        if (data.length < step) break;
        from += step;
    }

    console.log(`Fetched ${allData.length} translations.`);

    const dict = {};
    allData.forEach(item => {
        dict[item.ko_text] = item.en_text;
    });

    const outputPath = path.resolve(__dirname, 'movements_translations.json');
    fs.writeFileSync(outputPath, JSON.stringify(dict, null, 2), 'utf8');
    console.log(`✓ Updated ${outputPath}`);
}

syncFromDb();
