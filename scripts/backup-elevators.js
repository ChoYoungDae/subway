const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function backupElevators() {
    console.log('Fetching all elevator data for backup...');
    const { data, error } = await supabase.from('elevators').select('*');

    if (error) {
        console.error('Backup failed:', error.message);
        return;
    }

    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `elevators_backup_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Backup successful: ${filepath}`);
    console.log(`Snapshot size: ${data.length} records.`);
}

backupElevators().catch(console.error);
