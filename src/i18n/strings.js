export const STRINGS = {
  app: {
    title: {
      en: 'Seoul Subway',
      ko: '서울 지하철 무장애 안내',
    },
    subtitle: {
      en: 'Step-Free Access Guide',
      ko: '엘리베이터 · 휠체어 경로',
    },
  },
  home: {
    searchPlaceholder: {
      en: 'Arrival Station / 목적지 역',
      ko: '목적지 역 입력...',
    },
    popularTitle: {
      en: 'All Stations',
      ko: '전체 역',
    },
    favorites: {
      en: 'Favorites',
      ko: '즐겨찾기',
    },
    noFavorites: {
      en: 'No favorites yet',
      ko: '즐겨찾기한 역이 없습니다',
    },
  },
  station: {
    barrierFreeRoute: {
      en: 'Barrier-Free Route',
      ko: '무장애 경로 안내',
    },
    enterExit: {
      en: 'Exit / Enter',
      ko: '출구 · 입구',
    },
    photoPlaceholder: {
      en: 'Station Photo',
      ko: '역 사진',
    },
  },
  exits: {
    screenTitle: {
      en: 'Accessible Exits',
      ko: '무장애 출구 안내',
    },
    exitLabel: {
      en: 'Exit {{number}}',
      ko: '{{number}}번 출구',
    },
    available: {
      en: 'Elevator Available',
      ko: '엘리베이터 이용 가능',
    },
    outOfService: {
      en: 'Out of Service',
      ko: '점검 중',
    },
    noExits: {
      en: 'No accessible exits found',
      ko: '엘리베이터 출구 정보가 없습니다',
    },
  },
  route: {
    unsupportedLineTitle: {
      en: 'Route unavailable',
      ko: '경로 안내 불가',
    },
    unsupportedLineDesc: {
      en: 'This route requires a line not covered by this app.',
      ko: '지원하지 않는 노선을 경유하는 경로만 존재합니다.',
    },
    unsupportedLineHint: {
      en: 'Only routes through unsupported lines (e.g. Sinbundang Line) were found.',
      ko: '신분당선 등 미지원 노선을 경유하는 경로만 발견되었습니다.',
    },
    noRouteTitle: {
      en: 'No step-free route found',
      ko: '계단 없는 경로를 찾지 못했습니다',
    },
    noRouteDesc: {
      en: 'Try another route',
      ko: '다른 경로로 시도해 주세요.',
    },
  },
  common: {
    line: {
      en: 'Line {{number}}',
      ko: '{{number}}호선',
    }
  }
};

export function formatWithVars(template, vars = {}) {
  return Object.keys(vars).reduce((acc, key) => {
    return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(vars[key]));
  }, template);
}
