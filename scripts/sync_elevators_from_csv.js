const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncElevators() {
  console.log('Reading elevators_temp_2.csv...');
  const fileContent = fs.readFileSync('elevators_temp_2.csv', 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Initial records found: ${records.length}`);

  // Prepare data for upsert, filtering out invalid rows
  const dataToUpsert = records
    .filter(r => r.id && !isNaN(parseInt(r.id)))
    .map(r => ({
      id: parseInt(r.id),
      station_name_ko: String(r.station_name_ko || '').trim(),
      line: String(r.line || '').trim(),
      serial_no: String(r.serial_no || '').trim(),
      exit_no: String(r.exit_no || '').trim(),
      is_internal: String(r.is_internal || '').toUpperCase().trim() === 'TRUE',
      location_detail_ko: String(r.location_detail_ko || '').trim(),
      station_cd: String(r.station_cd || '').trim(),
    }));

  const skippedCount = records.length - dataToUpsert.length;
  console.log(`Skipped ${skippedCount} records due to invalid ID.`);
  console.log(`Starting upsert for ${dataToUpsert.length} valid records...`);

  // Supabase upsert handles matching by 'id'
  // Using chunks if data is too large, but 1000 records should be fine in one go.
  const { error } = await supabase
    .from('elevators')
    .upsert(dataToUpsert, { onConflict: 'id' });

  if (error) {
    console.error('Error during upsert:', error);
  } else {
    console.log('Successfully synced all records from CSV to Database.');
  }
}

syncElevators();
