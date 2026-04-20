/**
 * routeParser.js: Structural parser for Korean movement path text.
 * Splits bulk KRIC movement text into lines and extracts floor info.
 * English translation is handled by translation.js (translateLocation).
 */

/**
 * Extracts floor string from Korean text (e.g. "지하2층" → "B2F", "지상1층" → "1F").
 */
const extractFloor = (text) => {
    const m = text.match(/(?:지하|지상|B)?\s*\d+\s*(?:F|층)/);
    if (!m) return null;
    let f = m[0].replace(/\s/g, '').toUpperCase();
    f = f.replace('지하', 'B').replace('지상', '').replace('층', 'F');
    if (!f.endsWith('F')) f += 'F';
    return f;
};

/**
 * Parses a bulk block of KRIC movement text into structured line objects.
 * Used by segmentParser and ExitScreen for floor/type detection.
 */
export const parseMovementPath = (bulkText) => {
    if (!bulkText) return [];
    const lines = bulkText.split(/\r?\n/).flatMap(line =>
        line.split(/(?:^|\s)\d+\)/).map(s => s.trim()).filter(Boolean)
    );
    return lines.map(text => ({
        floor: extractFloor(text),
        originalText: text,
    }));
};

export const parseSubwayRoute = parseMovementPath;
