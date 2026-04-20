// scripts/collect_movements.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://zpvlancuprogmakgihad.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdmxhbmN1cHJvZ21ha2dpaGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODI0MDYsImV4cCI6MjA4NzA1ODQwNn0.VbTXNEWSFDKBdQWTe6WLiJbJiH2mxdsQTrK4ezo2VhA'
);
const KRIC_KEY = '$2a$10$vjwmHxVkoIPU1ZgcF7npnu5FGSNNIE88fH7jUyPGYOF2DDMfCdxtm';

async function main() {
  const { data: stations } = await supabase
    .from('stations')
    .select('name_ko, ln_cd, stin_cd')
    .not('ln_cd', 'is', null)
    .not('stin_cd', 'is', null);

  const allItems = [];

  for (const s of stations) {
    const url = `https://openapi.kric.go.kr/openapi/trafficWeekInfo/stinElevatorMovement` +
      `?serviceKey=${KRIC_KEY}&format=json&railOprIsttCd=S1&lnCd=${s.ln_cd}&stinCd=${s.stin_cd}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      let raw = json.body ?? [];
      if (!Array.isArray(raw)) raw = raw?.item ?? [];
      raw.forEach(item => allItems.push({ station: s.name_ko, ...item }));
      await new Promise(r => setTimeout(r, 200)); // API 과호출 방지
    } catch (e) {
      console.log('실패:', s.name_ko, e.message);
    }
  }

  fs.writeFileSync('movements_raw.json', JSON.stringify(allItems, null, 2));
  
  // mvContDtl 유니크 값만 추출
  const unique = [...new Set(allItems.map(i => i.mvContDtl))].filter(Boolean);
  fs.writeFileSync('movements_unique_texts.json', JSON.stringify(unique, null, 2));
  
  console.log('총 항목:', allItems.length);
  console.log('유니크 텍스트:', unique.length);
}

main();