// scripts/find_ambiguous_elevators.mjs
import { createClient } from '@supabase/supabase-js';
import { config }        from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

function parseLocationDetail(text) {
    if (!text) return { results: [], ambiguous: false };
    const pattern = /(.+?)\s*방면(\d+)-(\d+)/g;
    const results = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        results.push({
            toward: match[1].trim(),
            car:    parseInt(match[2], 10),
            door:   parseInt(match[3], 10),
        });
    }
    const ambiguous = results.length === 0 || (text.includes(',') && results.length < 2 && text.includes('방면'));
    return { results, ambiguous };
}

async function main() {
    const { data: elevators, error } = await supabase
        .from('elevators')
        .select('id, stin_cd, station_name_ko, location_detail_ko')
        .eq('is_internal', true);

    if (error) {
        console.error('Error fetching elevators:', error);
        return;
    }

    const ambiguous = elevators.filter(e => {
        const { ambiguous: isAmb } = parseLocationDetail(e.location_detail_ko);
        return isAmb;
    });

    console.log(JSON.stringify(ambiguous, null, 2));
}

main();
