const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkColumns() {
    const { data, error } = await supabase
        .from('elevators')
        .select('id, location_detail_ko, refined_route_json')
        .neq('refined_route_json', '[]')
        .limit(5);

    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('Found records with data:');
        data.forEach(d => {
            console.log(`ID: ${d.id}`);
            console.log(`KO: ${d.location_detail_ko}`);
            console.log(`JSON: ${JSON.stringify(d.refined_route_json, null, 2)}`);
            console.log('---');
        });
    } else {
        console.log('No non-empty data found in elevators table.');
    }
}

checkColumns();
