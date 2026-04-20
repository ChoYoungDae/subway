const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function refineExits() {
    console.log('--- Refining Elevator Exit Numbers ---');

    // 1. Fetch elevators where exit_no is generic or might have info in location_detail_ko
    const { data: elevators, error } = await supabase
        .from('elevators')
        .select('id, exit_no, location_detail_ko, station_name_ko');

    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    console.log(`Auditing ${elevators.length} items...`);

    const updates = [];
    const pattern = /(\d+)(?:번\s*출?구|호\s*출?구|번\s*출입구|호\s*출입구| Exit| Gate)/gi;
    const internalKeywords = ['방면', '승강장', '타는 곳', 'Platform'];

    elevators.forEach(e => {
        const currentExit = (e.exit_no || '').trim();
        const loc = (e.location_detail_ko || '').trim();
        let newRefinedExit = currentExit;

        // Refinement logic:
        // Case A: matches exit number pattern strictly
        const exitMatches = [...loc.matchAll(/(\d+)(?:번\s*출?구|호\s*출?구|번\s*출입구|호\s*출입구| Exit| Gate)/gi)];

        if (exitMatches.length > 0) {
            newRefinedExit = [...new Set(exitMatches.map(m => m[1]))].join(', ');
        } else if (currentExit === '내부' || currentExit === '외부' || !currentExit) {
            // Case B: Descriptive fallback
            const isPlatform = internalKeywords.some(k => loc.includes(k)) || /\d+-\d+/.test(loc);
            if (isPlatform) {
                newRefinedExit = 'Internal';
            } else if (loc.length > 3 && !loc.includes('Audit Sync')) {
                newRefinedExit = 'Unknown';
            }
        }

        // We want to populate refined_exit_no for EVERY row (staged copy)
        updates.push({ id: e.id, refined_exit_no: newRefinedExit, old: currentExit, loc });
    });

    console.log(`Audited ${elevators.length} items.`);
    console.log(`Preparing to populate 'refined_exit_no' for all ${updates.length} records.`);

    // Sample some interesting changes
    const changes = updates.filter(u => u.refined_exit_no !== u.old);
    console.log(`\nDetected ${changes.length} refinements within the set.`);
    if (changes.length > 0) {
        console.log('Sample Refinements:');
        changes.slice(0, 10).forEach(u => {
            console.log(`- [${u.id}] ${u.old} -> ${u.refined_exit_no} (Loc: ${u.loc})`);
        });
    }

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('\nApply these updates to the "refined_exit_no" column in Supabase? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
            console.log('Applying updates...');
            for (const item of updates) {
                const { error: updateError } = await supabase
                    .from('elevators')
                    .update({ refined_exit_no: item.refined_exit_no })
                    .eq('id', item.id);

                if (updateError) console.error(`Failed to update ${item.id}:`, updateError.message);
            }
            console.log('Done.');
        } else {
            console.log('Update cancelled.');
        }
        readline.close();
    });
}

refineExits();
