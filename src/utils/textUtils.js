/**
 * Subway Name Formatter
 * Removes parenthetical descriptions (landmarks/sub-names)
 * Example: "Achasan (Rear Entrance...)" -> "Achasan"
 * Example: "아차산(어린이대공원후문)" -> "아차산"
 */

export function cleanStationName(name) {
    if (!name) return "";
    // Removes text inside parentheses including the parentheses themselves
    // Space before parentheses is also removed if present
    return name.replace(/\s?\(.*?\)/g, "").trim();
}

/**
 * Normalizes a station name for comparison purposes.
 * Removes trailing '역' suffix and parenthetical text.
 * Example: "신도림역" -> "신도림"
 * Example: "아차산(어린이대공원후문)" -> "아차산"
 */
export function normalizeStationName(name) {
    if (!name) return "";
    return cleanStationName(name).replace(/역$/, "");
}
