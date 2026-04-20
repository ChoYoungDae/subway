const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function getChosung(str) {
  if (!str) return '';
  return [...str].map((ch) => {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return ch;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

export function matchesChosung(query, target) {
  if (!query || !target) return false;
  query = query.trim();
  if (target.toLowerCase().includes(query.toLowerCase())) return true;
  const isAllChosung = [...query].every(ch => CHO.includes(ch));
  if (isAllChosung) {
    const targetChosung = getChosung(target);
    return targetChosung.includes(query);
  }
  return false;
}