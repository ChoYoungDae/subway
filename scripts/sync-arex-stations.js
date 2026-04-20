const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const CSV_PATH = path.join(__dirname, '../airport_railroad_temp.csv');
const BATCH_SIZE = 50;

function parseCSV(content) {
    const lines = content.replace(/^\uFEFF/, '').split('\n');
    const headers = lines[0].split(',');

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        values.push(current);

        const row = {};
        headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim() ?? '';
        });
        rows.push(row);
    }
    return rows;
}

async function syncArexStations() {
    console.log('📂 Reading AREX CSV...');
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ File not found: ${CSV_PATH}`);
        return;
    }
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCSV(content);
    console.log(`✅ Parsed ${rows.length} rows from CSV`);

    // Map CSV columns → DB columns
    const records = rows.map(r => ({
        id:          parseInt(r.id),
        name_en:     r.name_en || null,
        name_ko:     r.name_ko || null,
        line:        r.line || null,
        kric_opr_cd: r.kric_opr_cd || null,
        tier:        r.tier || null,
        ln_cd:       r.ln_cd || null,
        stin_cd:     r.stin_cd || null,
        latitude:    r.latitude !== '' ? parseFloat(r.latitude) : null,
        longitude:   r.longitude !== '' ? parseFloat(r.longitude) : null,
        address:     r.address || null,
        platform_type: r.platform_type || null,
        station_cd:  r.station_cd || null,
        is_analyzed: r.is_analyzed === 'TRUE'
    }));

    console.log(`\n🚀 Upserting ${records.length} AREX stations...`);

    const { data, error } = await supabase
        .from('stations')
        .upsert(records, { onConflict: 'id' })
        .select();

    if (error) {
        console.error(`❌ Upsert failed:`, error.message);
    } else {
        console.log(`✅ Successfully upserted ${data.length} stations.`);
        data.forEach(s => {
            console.log(`  - [${s.id}] ${s.name_ko} (${s.line}): Lat=${s.latitude}, Lng=${s.longitude}`);
        });
    }

    console.log(`\n🎉 Done!`);
}

syncArexStations().catch(console.error);
