const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

// .env 로드
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissing() {
    console.log('Checking missing_translations table...');
    const { data, error } = await supabase
        .from('missing_translations')
        .select('*')
        .order('count', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('Table is empty.');
    } else {
        console.table(data);
    }
}

checkMissing();
