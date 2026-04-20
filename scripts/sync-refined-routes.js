const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// --- REFINED DICTIONARY (Simplified for Script) ---
const ROUTE_DICTIONARY_MOCK = {
    locations: {
        '승강장': { en: 'Platform', icon: 'subway-variant' },
        '대합실': { en: 'Concourse', icon: 'gate-and-door' },
        '개찰구': { en: 'Ticket Gate', icon: 'gate' },
        '표 내는 곳': { en: 'Ticket Gate', icon: 'gate' },
        '지상': { en: 'Ground', icon: 'home-outline' },
        '외부': { en: 'Outside', icon: 'map-marker-outline' },
        '출구': { en: 'Exit', icon: 'exit-run' },
        '출입구': { en: 'Exit', icon: 'exit-run' },
        '환승': { en: 'Transfer', icon: 'swap-horizontal' },
        '환승통로': { en: 'Transfer Path', icon: 'walk' },
    },
    transportation: {
        '엘리베이터': { en: 'Elevator', icon: 'elevator' },
        '연결통로': { en: 'Transfer Path', icon: 'walk' },
        '에스컬레이터': { en: 'Escalator', icon: 'elevator-passenger-outline' },
    }
};

/**
 * Strict Refined Parser for DB Synchronization
 */
const refineRoute = (text) => {
    if (!text) return [];

    const locations = ROUTE_DICTIONARY_MOCK.locations;
    const transportation = ROUTE_DICTIONARY_MOCK.transportation;
    const keywords = Object.keys(locations).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${keywords.join('|')})`, 'g');

    let match;
    const steps = [];

    while ((match = regex.exec(text)) !== null) {
        const keyword = match[0];
        const index = match.index;

        // 1. Floor Extraction (Closest before keyword)
        const prefix = text.substring(Math.max(0, index - 30), index);
        const floorMatch = prefix.match(/(?:[ \(\[])?(B?\d+)(?:층|F|[ \)\]])/);
        let floor = floorMatch ? floorMatch[1] : '';
        if (floor && !floor.startsWith('B') && !floor.endsWith('F')) floor = `${floor}F`;

        // 2. Line & Direction (Simplified)
        const lineMatch = prefix.match(/(\d+)(?:호선)/);
        const line = lineMatch ? `Line ${lineMatch[1]}` : null;
        const directionMatch = prefix.match(/([가-힣\w]+)\s*방면/);
        const direction = directionMatch ? `for ${directionMatch[1]}` : null;

        let label = locations[keyword].en;
        let type = 'general';
        let icon = locations[keyword].icon;

        // --- SPECIFIC REFINEMENT RULES ---

        // A. Exit Formatting (Exit [No.])
        if (keyword === '출구' || keyword === '출입구') {
            const exitPattern = /(\d+)번\s*(?:출구|출입구)/;
            const exitMatch = text.match(exitPattern);
            if (exitMatch) label = `Exit ${exitMatch[1]}`;
        }

        // B. Direction & Line (Simplified)
        else if (keyword === '환승' || keyword === '환승통로') {
            if (line) label = `Transfer to ${line}`;
            else label = "Transfer Path";
            type = "transfer";
        }

        else if (keyword === '승강장') {
            if (line && direction) label = `${line} (${direction})`;
            else if (line) label = `${line} Platform`;
            else if (direction) label = `Platform (${direction})`;
            type = "platform";
        }

        // C. Transportation (Detail) - Simplified
        const transKeywords = Object.keys(transportation);
        const transRegex = new RegExp(`(${transKeywords.join('|')})`);
        const contextRange = text.substring(Math.max(0, index - 15), Math.min(text.length, index + 25));
        const transMatch = contextRange.match(transRegex);

        let detail = null;
        if (transMatch) {
            detail = transportation[transMatch[0]].en.toLowerCase();
        } else if (text.includes('엘리베이터')) {
            detail = "elevator";
        }

        // D. label_ko extraction (Refined)
        let labelKo = text;
        labelKo = labelKo.replace(/^[ ]*[\d]+\)[ ]*/, '');
        labelKo = labelKo.replace(/[ ]*(?:탑승|이동|하차|이용|건넌 후|태그|통과|들어가|올라가|내려가|내려|들어옴|도착|위치|위치한|계심)[ ]*/g, ' ').trim();
        labelKo = labelKo.replace(/출입구/g, '출구');

        if (floor) {
            const floorNum = floor.replace('F', '').replace('B', '');
            labelKo = labelKo.replace(new RegExp(`[ ]*${floorNum}[층F][ ]*`, 'g'), ' ');
            labelKo = labelKo.replace(/\([A-Z\d]+\)/g, '');
        }

        const matchedKeyword = Object.keys(locations).find(k => text.includes(k));
        if (matchedKeyword && matchedKeyword.length > 2) {
            labelKo = labelKo.replace(new RegExp(`[ ]*${matchedKeyword}[ ]*`, 'g'), ' ');
        }

        labelKo = labelKo.replace(/\(\s*\)/g, '');
        labelKo = labelKo.replace(/[ ]{2,}/g, ' ').trim();
        if (labelKo.includes('지상')) labelKo = labelKo.replace('지상', '').trim() + ' (지상)';
        if (labelKo.includes('지하')) labelKo = labelKo.replace('지하', '').trim() + ' (지하)';
        labelKo = labelKo.replace(/\(\s*\)/g, '');
        labelKo = labelKo.replace(/[ ]{2,}/g, ' ').trim();

        steps.push({
            floor: floor || null,
            label: label,
            label_ko: labelKo || text,
            type: detail || type,
            icon: icon
        });
    }

    // Deduplicate
    return steps.filter((step, pos, self) =>
        self.findIndex(s => s.label === step.label && s.floor === step.floor) === pos
    );
};

async function syncRefinedRoutes() {
    console.log('--- Starting Subway Route Refinement Sync ---');

    const { data: elevators, error } = await supabase
        .from('elevators')
        .select('id, location_detail_ko, refined_exit_no');

    if (error) {
        console.error('Error fetching elevators:', error.message);
        return;
    }

    console.log(`Processing ${elevators.length} records...`);

    let count = 0;
    for (const e of elevators) {
        const refined = refineRoute(e.location_detail_ko);

        // Extract exit number for refined_exit_no if possible from the new logic
        let exitNo = e.refined_exit_no;
        const exitStep = refined.find(s => s.label.startsWith('Exit '));
        if (exitStep) {
            exitNo = exitStep.label.replace('Exit ', '');
        }

        const { error: updateError } = await supabase
            .from('elevators')
            .update({
                refined_route_json: refined,
                refined_exit_no: exitNo
            })
            .eq('id', e.id);

        if (updateError) {
            console.error(`Error updating record ${e.id}:`, updateError.message);
        } else {
            count++;
            if (count % 50 === 0) console.log(`Progress: ${count}/${elevators.length}...`);
        }
    }

    console.log(`\n✅ Successfully refined and synced ${count} records.`);
    process.exit(0);
}

syncRefinedRoutes().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
