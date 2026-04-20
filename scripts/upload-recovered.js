const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function uploadAll() {
    const recoveredPath = path.resolve(__dirname, 'recovered_all_translations.json');
    const data = JSON.parse(fs.readFileSync(recoveredPath, 'utf8'));
    const entries = Object.entries(data);

    console.log(`Starting upload of ${entries.length} items to Supabase...`);

    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
        const chunk = entries.slice(i, i + batchSize).map(([ko, en]) => ({
            ko_text: ko.trim(),
            en_text: en.trim(),
            category: 'movement'
        }));

        console.log(`Uploading ${i + 1} to ${Math.min(i + batchSize, entries.length)}...`);
        const { error } = await supabase
            .from('translations')
            .upsert(chunk, { onConflict: 'ko_text' });

        if (error) {
            console.error('Error at batch:', i, error.message);
        }
    }

    console.log('Done!');
}

uploadAll();
