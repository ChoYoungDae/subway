const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function inspectSchema() {
    try {
        console.log('--- Inspecting Elevators Table ---');
        const { data: evData, error: evError } = await supabase.from('elevators').select('*').limit(1);
        if (evError) console.error('Elevators error:', evError);
        else console.log('Elevators columns:', Object.keys(evData[0] || {}));

        console.log('\n--- Inspecting Stations Table ---');
        const { data: stData, error: stError } = await supabase.from('stations').select('*').limit(1);
        if (stError) console.error('Stations error:', stError);
        else console.log('Stations columns:', Object.keys(stData[0] || {}));

        console.log('\n--- Checking for Step_Free_Routes Table ---');
        const { data: rtData, error: rtError } = await supabase.from('step_free_routes').select('*').limit(1);
        if (rtError) {
            if (rtError.code === '42P01' || rtError.message?.includes('relation "public.step_free_routes" does not exist')) {
                console.log('Table step_free_routes does not exist.');
            } else {
                console.error('Routes error:', rtError);
            }
        } else {
            console.log('Table step_free_routes exists.');
            console.log('Routes columns:', Object.keys(rtData[0] || {}));
        }
    } catch (err) {
        console.error('Fatal error:', err);
    }
}

inspectSchema();
