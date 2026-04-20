export const LINE_COLORS = {
  '1': '#0052A4',
  '2': '#009246',
  '3': '#EF7C1C',
  '4': '#00A2D1',
  '5': '#8B50A4',
  '6': '#C55C1D',
  '7': '#54640D',
  '8': '#E31C79',
  '9': '#BDB092',
  'A': '#4082C4',
  'B': '#E74C3C',
  '경의중앙': '#73B0C5',
  '경춘': '#0C8D44',
  '분당': '#F5A200',
  '신분당': '#D4003B',
  '공항': '#4082C4',
  '공항철도': '#4082C4',
  '수인분당': '#F5A200',
};

export function getLineColor(line) {
  if (!line) return '#9CA3AF';
  const n = getLineNumber(line);
  return LINE_COLORS[n] || '#757575';
}

export function getLineNumber(line) {
  if (!line) return '';
  // "1호선", "1호", "1 " -> "1"
  return String(line)
    .trim()
    .replace(/호선.*$/, '')
    .replace(/선$/, '')
    .replace(/호$/, '')
    .trim();
}


// 원형 배지용 짧은 라벨
export function getLineBadgeLabel(line) {
  const n = getLineNumber(line);
  if (/^\d+$/.test(n)) return n;
  const abbr = {
    '경의중앙': '경중',
    '경춘': '경춘',
    '분당': '분당',
    '신분당': '신분',
    '공항': 'A',
    '공항철도': 'A',
    '수인분당': '수분',
  };
  return abbr[n] || n.slice(0, 2);
}
