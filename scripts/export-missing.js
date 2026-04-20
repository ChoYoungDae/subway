const path = require('path');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenvExpand.expand(myEnv);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function exportMissing() {
    const { data, error } = await supabase.from('missing_translations').select('ko_text');
    if (error) { console.error(error); return; }
    console.log('---START---');
    console.log(JSON.stringify(data.map(d => d.ko_text)));
    console.log('---END---');
}
exportMissing();
