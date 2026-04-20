const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Natural sort function for alphanumeric strings (e.g., A01, A10, 0137)
function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function extractSequence() {
    console.log('Fetching stations from Supabase...');

    // Using simple fetch to avoid any complex ORM issues for this task
    const { data: stations, error } = await supabase
        .from('stations')
        .select('name_ko, name_en, line, ln_cd, stin_cd, kric_opr_cd');

    if (error) {
        console.error('Error fetching stations:', error.message);
        return;
    }

    console.log(`Found ${stations.length} stations. Processing...`);

    // Group by line
    const grouped = {};
    stations.forEach(s => {
        if (!grouped[s.line]) {
            grouped[s.line] = [];
        }
        grouped[s.line].push(s);
    });

    // Sort each group by stin_cd
    const sequence = {};
    Object.keys(grouped).sort().forEach(line => {
        const sortedStations = grouped[line].sort((a, b) => {
            // Priority: stin_cd
            const valA = a.stin_cd || '';
            const valB = b.stin_cd || '';
            return naturalCompare(valA, valB);
        });

        // Final structure for the JSON
        sequence[line] = sortedStations.map(s => ({
            name_ko: s.name_ko,
            name_en: s.name_en,
            stin_cd: s.stin_cd,
            ln_cd: s.ln_cd,
            opr_cd: s.kric_opr_cd || 'S1'
        }));
    });

    const outputPath = path.join(__dirname, '../station_sequence.json');
    fs.writeFileSync(outputPath, JSON.stringify(sequence, null, 2), 'utf8');

    console.log(`✅ Success! Station sequence saved to: ${outputPath}`);

    // Print summary
    console.log('\nGroup Summary:');
    Object.keys(sequence).forEach(line => {
        console.log(`- ${line}: ${sequence[line].length} stations`);
    });
}

extractSequence().catch(console.error);
