// scripts/translate_batch.js
const fs = require('fs');

// 규칙 적용
const translationRules = {
  '엘리베이터': 'Elevator',
  '승강장': 'Platform',
  '대합실': 'Concourse',
  '출입구': 'Exit',
  '개집표기': 'Fare gate',
  '휠체어칸': 'Wheelchair car',
  '표 내는 곳': 'Ticket gate',
  '환승통로': 'Transfer corridor',
  '휠체어리프트': 'Wheelchair lift',
  '방면': 'direction',
  '호선': 'Line',
  '탑승': 'board',
  '이동': 'move',
  '통과': 'pass',
  '하차': 'exit/get off',
  '승차': 'board',
};

// 역명 로마자 표기 매핑
const stationNames = {
  '제기동': 'Jegidong',
  '회기': 'Hoegi',
  '신설동': 'Shinseol-dong',
  '동묘앞': 'Dongmyo',
  '동대문': 'Dongdaemun',
  '종로3가': 'Jongno 3-ga',
  '종로5가': 'Jongno 5-ga',
  '종각': 'Jongak',
  '을지로3가': 'Euljiro 3-ga',
  '을지로4가': 'Euljiro 4-ga',
  '을지로입구': 'Euljiro 1-ga',
  '충정로': 'Chungjeongno',
  '시청': 'City Hall',
  '남영': 'Nam-yeong',
  '신촌': 'Sinchon',
  '아현': 'Ahyeon',
  '이대': 'Ewha Womans Univ.',
  '서강대': 'Sogang Univ.',
  '공덕': 'Gongdeok',
  '교대': 'Gyeongdae',
  '강남': 'Gangnam',
  '역삼': 'Yeoksam',
  '강남구청': 'Gangnam-gu Office',
  '선릉': 'Seolleung',
  '삼성': 'Samsung',
  '종합운동장': 'Olympic Stadium',
  '잠실': 'Jamsil',
  '잠실나루': 'Jamsil-naru',
  '잠실새내': 'Jamsil-saenae',
  '석촌': 'Seokchon',
  '강변': 'Gangbyeon',
  '압구정': 'Apgujeong',
  '신사': 'Sinsa',
  '학동': 'Hakdong',
  '논현': 'Nonhyeon',
  '반포': 'Banpo',
  '서초': 'Seocho',
  '방배': 'Bangbae',
  '사당': 'Sadang',
  '낙성대': 'Naksseongdae',
  '서울대입구': 'Seoul National Univ.',
  '신림': 'Sinlim',
  '봉천': 'Bongcheon',
  '신대방': 'Shindaebang',
  '대림': 'Daerim',
  '구로디지털단지': 'Guro Digital Complex',
  '신도림': 'Shindorim',
  '영등포구청': 'Yeongdeungpo-gu Office',
  '당산': 'Dangsan',
  '홍대입구': 'Hongik Univ.',
  '합정': 'Hapjeong',
  '망원': 'Mangwon',
  '상수': 'Sangsu',
  '광흥창': 'Gwanghungchang',
  '대흥': 'Daehung',
  '효창공원앞': 'Hyochang Park',
  '용산': 'Yongsan',
  '서빙고': 'Seobinggo',
  '이촌': 'Ichon',
  '동작': 'Dongjak',
  '총신대입구': 'Chongshin Univ.',
  '노원': 'Nowon',
  '당고개': 'Danggogae',
  '상계': 'Sanggye',
  '창동': 'Changdong',
  '미아': 'Mia',
  '미아사거리': 'Mia Saggeori',
  '길음': 'Gireeum',
  '한성대입구': 'Hansung Univ.',
  '화랑대': 'Hwarangdae',
  '화이트핸드': 'White Hand',
};

// 간단한 번역 함수
function translateKorean(text) {
  let translated = text;
  
  // 규칙 기반 번역
  for (const [ko, en] of Object.entries(translationRules)) {
    translated = translated.replace(new RegExp(ko, 'g'), en);
  }
  
  // 역명 번역
  for (const [ko, en] of Object.entries(stationNames)) {
    translated = translated.replace(new RegExp(ko, 'g'), en);
  }
  
  // 번호 패턴 유지 (1) → 1))
  translated = translated.replace(/^(\d+)\)\s/gm, '$1) ');
  
  // 층 표시 유지 ((1F), (B1), (B2) 등)
  // 이미 영문이므로 유지됨
  
  return translated;
}

// 메인 함수
function main() {
  const data = JSON.parse(fs.readFileSync('./movements_unique_texts.json', 'utf8'));
  
  const batches = [
    { start: 0, end: 500, file: 'movements_translations_1.json' },
    { start: 500, end: 1000, file: 'movements_translations_2.json' },
    { start: 1000, end: 1500, file: 'movements_translations_3.json' },
    { start: 1500, end: 2459, file: 'movements_translations_4.json' },
  ];
  
  for (const batch of batches) {
    const translations = {};
    const batchData = data.slice(batch.start, batch.end);
    
    batchData.forEach((koText) => {
      const enText = translateKorean(koText);
      translations[koText] = enText;
    });
    
    fs.writeFileSync(batch.file, JSON.stringify(translations, null, 2));
    console.log(`✓ ${batch.file} 완료 (${batch.start + 1}~${batch.end})`);
  }
  
  console.log('\n모든 번역 완료!');
}

main();
