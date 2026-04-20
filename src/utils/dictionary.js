/**
 * Dictionary for subway route parsing and internationalization.
 * Supports Korean keywords, English keywords, and MaterialCommunityIcons.
 */
export const ROUTE_DICTIONARY = {
    ko: {
        locations: {
            '승강장': { en: 'Platform', icon: 'subway-variant' },
            '대합실': { en: 'Concourse', icon: 'door-open' },
            '개찰구': { en: 'Ticket Gate', icon: 'gate' },
            '표 내는 곳': { en: 'Ticket Gate', icon: 'gate' },
            '지상': { en: 'Ground', icon: 'home-outline' },
            '외부': { en: 'Outside', icon: 'map-marker-outline' },
            '출구': { en: 'Exit', icon: 'exit-run' },
            '출입구': { en: 'Exit', icon: 'exit-run' },
            '환승': { en: 'Transfer', icon: 'swap-horizontal' },
            '환승통로': { en: 'Transfer Path', icon: 'walk' },
            '층': { en: 'Floor', icon: 'layers-outline' },
            'F': { en: 'Floor', icon: 'layers-outline' },
        },
        transportation: {
            '엘리베이터': { en: 'Elevator', icon: 'elevator' },
            '연결통로': { en: 'Transfer Path', icon: 'walk' },
            '에스컬레이터': { en: 'Escalator', icon: 'elevator-passenger-outline' },
            '계단': { en: 'Stairs', icon: 'stairs' },
            '경사로': { en: 'Ramp', icon: 'slope-uphill' },
            '분기점': { en: 'Junction', icon: 'source-fork' },
            '승차': { en: 'Boarding', icon: 'train-variant' },
            '진입': { en: 'Entrance', icon: 'login' },
        }
    },
    // Future extension points
    ja: {
        // Japanese translations
    },
    zh: {
        // Chinese translations
    }
};

export const getTranslation = (keyword, type = 'locations', lang = 'ko') => {
    return ROUTE_DICTIONARY[lang]?.[type]?.[keyword] || null;
};
