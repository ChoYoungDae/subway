const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const CSV_PATH = path.join(__dirname, '../stations_정리_삭제가능.csv');
const BATCH_SIZE = 50;

function parseCSV(content) {
    const lines = content.replace(/^\uFEFF/, '').split('\n');
    const headers = lines[0].split(',');

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle quoted fields (e.g. name_en with commas)
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

async function syncStations() {
    console.log('📂 Reading CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCSV(content);
    console.log(`✅ Parsed ${rows.length} rows from CSV`);

    // Map CSV columns → DB columns (kric_stin_cd, station_code 제외)
    const records = rows.map(r => ({
        id:          parseInt(r.id),
        name_en:     r.name_en || null,
        name_ko:     r.name_ko || null,
        line:        r.line || null,
        kric_opr_cd: r.kric_opr_cd || null,
        tier:        r.tier || null,
        ln_cd:       r.ln_cd !== '' ? r.ln_cd : null,
        stin_cd:     r.stin_cd !== '' ? r.stin_cd : null,
        latitude:    r.latitude !== '' ? parseFloat(r.latitude) : null,
        longitude:   r.longitude !== '' ? parseFloat(r.longitude) : null,
        address:     r.address || null,
    }));

    console.log(`\n🚀 Upserting ${records.length} stations in batches of ${BATCH_SIZE}...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('stations')
            .upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
            errorCount += batch.length;
        } else {
            successCount += batch.length;
            console.log(`  ✓ ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
        }
    }

    console.log(`\n🎉 Done! Success: ${successCount}, Errors: ${errorCount}`);
}

syncStations().catch(console.error);
