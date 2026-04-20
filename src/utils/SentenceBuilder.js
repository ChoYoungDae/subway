/**
 * SentenceBuilder.js: Generates human-readable sentences and structured UI data from parsed atoms.
 * Responsibilities:
 * 1.  Generate full English sentences for validation (pure_english).
 * 2.  Generate structured objects for UI rendering (JourneyTimeline.js).
 */

const FACILITY_NAMES_EN = {
    ELEVATOR: 'ELEVATOR',
    LIFT: 'LIFT',
    GATE: 'GATE',
    EXIT: 'EXIT',
    PLATFORM: 'PLATFORM',
    CONCOURSE: 'CONCOURSE',
    General: 'General',
};

export class SentenceBuilder {

    /**
     * Generates a full English sentence for validation, matching the CSV 'pure_english' format.
     * @param {object} atom - A single parsed object, e.g., { action, fac, exit, floor }.
     * @returns {string} A descriptive English sentence.
     */
    static buildPureEnglish(atom) {
        if (!atom) return '';

        const { action, facility, floor, exit } = atom;
        const facilityName = FACILITY_NAMES_EN[facility] || facility.toLowerCase();

        // Capitalize first letter of action
        const capitalizedAction = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();

        let sentence = `${capitalizedAction} the ${facilityName}`;
        if (floor) {
            sentence += ` on ${floor}`;
        }
        if (exit) {
            sentence += ` near Exit ${exit}`;
        }
        return sentence;
    }

    /**
     * Transforms a single parsed atom into a structured object for the UI.
     * This is the primary method for feeding data to JourneyTimeline.js.
     * @param {object} atom - A single parsed object, e.g., { action, facility, exit, floor, category, refined_kr, refined_en, location, emoji }.
     * @returns {object} A structured object for the UI.
     */
    static buildTimelineNode(atom) {
        if (!atom) return null;

        return {
            floor: atom.floor || null,
            facility: atom.facility || 'General',
            action: atom.action || 'MOVE',
            exit: atom.exit || null,
            category: atom.category || "Unknown",
            refined_kr: atom.refined_kr || null,
            refined_en: atom.refined_en || null,
            location: atom.location || null,
            emoji: atom.emoji || "?",
        };
    }

    /**
     * Processes an array of atoms to generate an array of UI-ready node objects.
     * @param {Array<object>} atoms - An array of parsed objects from routeParser.
     * @returns {Array<object>} An array of structured nodes for the UI.
     */
    static buildTimelineNodes(atoms) {
        if (!atoms || atoms.length === 0) return [];
        return atoms.map(SentenceBuilder.buildTimelineNode).filter(Boolean);
    }
}

