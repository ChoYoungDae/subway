const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkColumn() {
    console.log('Checking refined_exit_no column...');
    // Try to select the column
    const { data, error } = await supabase
        .from('elevators')
        .select('refined_exit_no')
        .limit(1);

    if (error) {
        if (error.message.includes('column "refined_exit_no" does not exist')) {
            console.log('--- ACTION REQUIRED ---');
            console.log('The column "refined_exit_no" does not exist in the "elevators" table.');
            console.log('Please execute the following SQL in your Supabase Dashboard SQL Editor:');
            console.log('\nALTER TABLE elevators ADD COLUMN refined_exit_no TEXT;\n');
        } else {
            console.error('Unexpected error:', error.message);
        }
    } else {
        console.log('✅ Column "refined_exit_no" exists.');
    }
}

checkColumn().catch(console.error);
