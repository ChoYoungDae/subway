
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'ye', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

export const romanizeHangul = (text) => {
    if (!text) return '';
    return [...text].map(char => {
        const code = char.charCodeAt(0) - 0xAC00;
        if (code < 0 || code > 11171) return char;

        const cho = Math.floor(code / 588);
        const jung = Math.floor((code % 588) / 28);
        const jong = code % 28;

        return CHO[cho] + JUNG[jung] + JONG[jong];
    }).join('')
        .replace(/([aeiou])([aeiou])/g, '$1-$2') // Basic split for readability
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

export const translatePlaceName = (ko, directionMap = {}, nounMap = {}) => {
    if (!ko) return '';
    let result = ko;

    // 1. Try full dictionary match
    if (directionMap[ko]) return directionMap[ko];

    // 2. Replace common nouns
    const commonNouns = {
        '호텔': 'Hotel',
        '빌딩': 'Building',
        '시티': 'City',
        '투어': 'Tour',
        '버스': 'Bus',
        '시청': 'City Hall',
        '광장': 'Square',
        '공원': 'Park',
        '미술관': 'Art Museum',
        '박물관': 'Museum',
        '병원': 'Hospital',
        '대학교': 'Univ.',
        '백화점': 'Department Store',
        '센터': 'Center',
        '타워': 'Tower',
        '아파트': 'Apartment',
        '경기장': 'Stadium',
        '시장': 'Market',
        '커피': 'Coffee',
        '전시관': 'Exhibition Hall',
        '아트홀': 'Art Hall'
    };

    // Merge provided nouns with commons
    const allNouns = { ...commonNouns, ...nounMap };
    const sortedNouns = Object.keys(allNouns).sort((a, b) => b.length - a.length);
    for (const noun of sortedNouns) {
        if (result.includes(noun)) {
            result = result.replace(new RegExp(noun, 'g'), ' ' + allNouns[noun] + ' ');
        }
    }

    // 3. Replace common station/area names
    const sortedDirs = Object.keys(directionMap).sort((a, b) => b.length - a.length);
    for (const dir of sortedDirs) {
        if (result.includes(dir)) {
            result = result.replace(new RegExp(dir, 'g'), ' ' + directionMap[dir] + ' ');
        }
    }

    // 4. Romanize remaining Korean bits
    result = result.split(' ').map(part => {
        if (/[가-힣]/.test(part)) {
            return romanizeHangul(part);
        }
        return part;
    }).join(' ');

    // 5. Cleanup
    return result
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};
