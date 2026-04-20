const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countCityHall() {
    console.log('Counting stations matching "%시청%"...');
    const { data: stations, error } = await supabase
        .from('stations')
        .select('name_ko, name_en, line')
        .or('name_ko.ilike.%시청%,name_en.ilike.%city hall%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total matches: ${stations.length}`);
    stations.forEach(s => {
        console.log(`- ${s.name_ko} (${s.line}) / ${s.name_en}`);
    });
}

countCityHall();
