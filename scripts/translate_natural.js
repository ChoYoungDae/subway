// scripts/translate_natural.js
const fs = require('fs');

// 역명 로마자 표기
const stationNames = {
  '강남': 'Gangnam', '역삼': 'Yeoksam', '선릉': 'Seolleung', '삼성': 'Samsung',
  '잠실': 'Jamsil', '종로3가': 'Jongno 3-ga', '종로5가': 'Jongno 5-ga', '종각': 'Jonggak',
  '시청': 'City Hall', '서울역': 'Seoul Station', '남영': 'Namyeong', '용산': 'Yongsan',
  '이촌': 'Ichon', '동작': 'Dongjak', '교대': 'Gyodae', '서초': 'Seocho', '방배': 'Bangbae',
  '사당': 'Sadang', '낙성대': 'Nakseongdae', '신림': 'Sillim', '봉천': 'Bongcheon',
  '신대방': 'Sindaebang', '대림': 'Daerim', '구로디지털단지': 'Guro Digital Complex',
  '신도림': 'Sindorim', '영등포구청': 'Yeongdeungpo-gu Office', '당산': 'Dangsan',
  '합정': 'Hapjeong', '홍대입구': 'Hongik Univ.', '신촌': 'Sinchon', '이대': 'Ewha Womans Univ.',
  '아현': 'Ahyeon', '충정로': 'Chungjeongno', '을지로입구': 'Euljiro 1-ga',
  '을지로3가': 'Euljiro 3-ga', '을지로4가': 'Euljiro 4-ga', '동대문역사문화공원': 'Dongdaemun History & Culture Park',
  '신당': 'Sindang', '상왕십리': 'Sangwangsimni', '왕십리': 'Wangsimni', '한양대': 'Hanyang Univ.',
  '뚝섬': 'Ttukseom', '성수': 'Seongsu', '건대입구': 'Konkuk Univ.', '구의': 'Guui',
  '강변': 'Gangbyeon', '잠실나루': 'Jamsilnaru', '잠실새내': 'Jamsilsaenae',
  '종합운동장': 'Sports Complex', '삼전': 'Samjeon', '석촌고분': 'Seokchon',
  '석촌': 'Seokchon', '송파': 'Songpa', '가락시장': 'Garak Market', '문정': 'Munjeong',
  '장지': 'Jangji', '복정': 'Bokjeong', '남위례': 'Namwirye', '모란': 'Moran',
  '신설동': 'Sinseol-dong', '제기동': 'Jegi-dong', '청량리': 'Cheongnyangni',
  '회기': 'Hoegi', '외대앞': 'Hankuk Univ. of Foreign Studies', '신이문': 'Sinimun',
  '석계': 'Seokgye', '광운대': 'Kwangwoon Univ.', '월계': 'Wolgye', '녹천': 'Nokcheon',
  '창동': 'Changdong', '방학': 'Banghak', '도봉': 'Dobong', '도봉산': 'Dobongsan',
  '망월사': 'Mangwolsa', '회룡': 'Hoeryong', '의정부': 'Uijeongbu', '노원': 'Nowon',
  '상계': 'Sanggye', '당고개': 'Danggogae', '수유': 'Suyu', '미아': 'Mia',
  '미아사거리': 'Mia Sageori', '길음': 'Gireum', '성신여대입구': 'Sungshin Womens Univ.',
  '한성대입구': 'Hansung Univ.', '혜화': 'Hyehwa', '동대문': 'Dongdaemun',
  '동묘앞': 'Dongmyo', '신설동': 'Sinseol-dong', '보문': 'Bomun', '안암': 'Anam',
  '고려대': 'Korea Univ.', '월곡': 'Wolgok', '상월곡': 'Sangwolgok', '돌곶이': 'Dolgoji',
  '태릉입구': 'Taereung', '화랑대': 'Hwarangdae', '봉화산': 'Bonghwasan',
  '신내': 'Sinnae', '구리': 'Guri', '도농': 'Donong', '양원': 'Yangwon',
  '덕소': 'Deokso', '도심': 'Dosim', '팔당': 'Paldang', '운길산': 'Ungilsan',
  '양수': 'Yangsu', '신원': 'Sinwon', '국수': 'Guksu', '아신': 'Asin',
  '오빈': 'Obin', '양평': 'Yangpyeong', '강남구청': 'Gangnam-gu Office',
  '압구정': 'Apgujeong', '신사': 'Sinsa', '잠원': 'Jamwon', '고속터미널': 'Express Bus Terminal',
  '내방': 'Naebang', '이수': 'Isu', '숭실대입구': 'Soongsil Univ.',
  '남성': 'Namseong', '총신대입구': 'Chongshin Univ.', '남태령': 'Namtaeryeong',
  '선바위': 'Seonbawi', '경마공원': 'Seoul Race Park', '대공원': 'Grand Park',
  '과천': 'Gwacheon', '정부과천청사': 'Government Complex Gwacheon',
  '인덕원': 'Indeogwon', '평촌': 'Pyeongchon', '범계': 'Beomgye',
  '금정': 'Geumjeong', '산본': 'Sanbon', '수리산': 'Surisan', '대야미': 'Daeyami',
  '반월': 'Banwol', '상록수': 'Sangroksu', '한대앞': 'Hanyang Univ. at Ansan',
  '중앙': 'Jungang', '고잔': 'Gojan', '초지': 'Choji', '안산': 'Ansan',
  '신길온천': 'Singil', '정왕': 'Jeongwang', '오이도': 'Oido',
  '광명': 'Gwangmyeong', '철산': 'Cheolsan', '가산디지털단지': 'Gasan Digital Complex',
  '독산': 'Doksan', '금천구청': 'Geumcheon-gu Office', '석수': 'Seoksu',
  '관악': 'Gwanak', '안양': 'Anyang', '명학': 'Myeonghak', '금정': 'Geumjeong',
  '군포': 'Gunpo', '당정': 'Dangjeong', '의왕': 'Uiwang', '성균관대': 'Sungkyunkwan Univ.',
  '화서': 'Hwaseo', '수원': 'Suwon', '세류': 'Seryu', '병점': 'Byeongjeom',
  '세마': 'Sema', '오산대': 'Osan Univ.', '오산': 'Osan', '진위': 'Jinwi',
  '송탄': 'Songtan', '서정리': 'Seojeong-ri', '지제': 'Jije', '평택': 'Pyeongtaek',
  '성환': 'Seonghwan', '직산': 'Jiksan', '두정': 'Dujeong', '천안': 'Cheonan',
  '봉명': 'Bongmyeong', '쌍용': 'Ssangyong', '아산': 'Asan',
};

// 자연스러운 번역 함수
function translateNatural(text) {
  let translated = text;

  // 역명 번역 (먼저 실행)
  for (const [ko, en] of Object.entries(stationNames)) {
    translated = translated.replace(new RegExp(ko, 'g'), en);
  }

  // 패턴 기반 번역 (구체적인 것부터 일반적인 것 순서로)
  
  // 1) X번/Y번 출입구 사이 외부/내부 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*(\d+)번\/(\d+)번\s*출입구\s*사이\s*(외부|내부)?\s*엘리베이터\s*탑승/g, 
    (match, num, exit1, exit2, type) => {
      const typeText = type === '외부' ? ' (external)' : type === '내부' ? ' (internal)' : '';
      return `${num} Take the elevator between Exits ${exit1} and ${exit2}${typeText}`;
    });

  // 2) (Floor) X번 출입구 옆/근처/사이 지상/외부/내부 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*(\d+)번\s*출입구\s*(옆|근처|사이)?\s*(지상|외부|내부)?\s*엘리베이터\s*탑승/g, 
    (match, num, floor, exitNum, pos, type) => {
      const posText = pos === '옆' ? 'at' : pos === '근처' ? 'near' : pos === '사이' ? 'between' : 'at';
      const typeText = type === '지상' ? ' (ground level)' : type === '외부' ? ' (external)' : type === '내부' ? ' (internal)' : '';
      return `${num} (${floor}) Take the elevator ${posText} Exit ${exitNum}${typeText}`;
    });

  // 3) (Floor) X호선 Y 방면 승강장 하차
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*(\d+)호선\s*([^\s]+)\s*방면\s*승강장\s*하차/g, 
    '$1 ($2) Exit at Line $3 $4-bound platform');

  // 4) (Floor) X 방면 승강장 하차
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*([^\s]+)\s*방면\s*승강장\s*하차/g, 
    '$1 ($2) Exit at $3-bound platform');

  // 5) (Floor) X호선 Y 방면 승강장으로 이동
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*(\d+)호선\s*([^\s]+)\s*방면\s*승강장으로\s*이동/g, 
    '$1 ($2) Move to Line $3 $4-bound platform');

  // 6) (Floor) X 방면 승강장으로 이동
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*([^\s]+)\s*방면\s*승강장으로\s*이동/g, 
    '$1 ($2) Move to the $3-bound platform');

  // 7) (Floor) X호선 대합실로 이동
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*(\d+)호선\s*대합실로\s*이동/g, 
    '$1 ($2) Move to Line $3 concourse');

  // 8) (Floor) 대합실로 이동
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*대합실로\s*이동/g, 
    '$1 ($2) Move to the concourse');

  // 9) X호선 Y 방면 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*(\d+)호선\s*([^\s]+)\s*방면\s*엘리베이터\s*탑승/g, 
    '$1 Take the elevator to Line $2 $3 direction');

  // 10) X 방면 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*([^\s]+)\s*방면\s*엘리베이터\s*탑승/g, 
    '$1 Take the elevator to $2 direction');

  // 11) 승강장 방향 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*승강장\s*방향\s*엘리베이터\s*탑승/g, 
    '$1 Take the elevator toward the platform');

  // 12) 대합실 방향 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*대합실\s*방향\s*엘리베이터\s*탑승/g, 
    '$1 Take the elevator toward the concourse');

  // 13) 엘리베이터 탑승
  translated = translated.replace(/(\d+\))\s*엘리베이터\s*탑승/g, 
    '$1 Take the elevator');

  // 14) 개집표기 통과
  translated = translated.replace(/(\d+\))\s*개집표기\s*통과/g, 
    '$1 Pass through the fare gate');

  // 15) 표 내는 곳 통과
  translated = translated.replace(/(\d+\))\s*표\s*내는\s*곳\s*통과/g, 
    '$1 Pass through the ticket gate');

  // 16) 승차 (휠체어칸)
  translated = translated.replace(/(\d+\))\s*승차\s*\(휠체어칸\)/g, 
    '$1 Board the train (wheelchair car)');

  // 17) X호선 방향 환승통로로 이동
  translated = translated.replace(/(\d+\))\s*(\d+)호선\s*방향\s*환승통로로\s*이동/g, 
    '$1 Move to Line $2 transfer corridor');

  // 18) 환승통로로 이동
  translated = translated.replace(/(\d+\))\s*환승통로로\s*이동/g, 
    '$1 Move to the transfer corridor');

  // 19) X 방향 휠체어리프트 탑승
  translated = translated.replace(/(\d+\))\s*([^\s]+)\s*방향\s*휠체어리프트\s*탑승/g, 
    '$1 Take the wheelchair lift toward $2');

  // 20) 휠체어리프트 탑승
  translated = translated.replace(/(\d+\))\s*휠체어리프트\s*탑승/g, 
    '$1 Take the wheelchair lift');

  // 21) 지하 N층으로 이동
  translated = translated.replace(/(\d+\))\s*지하\s*(\d+)층으로\s*이동/g, 
    '$1 Move to basement level $2 (B$2)');

  // 22) 지상으로 이동
  translated = translated.replace(/(\d+\))\s*\(([^)]+)\)\s*지상으로\s*이동/g, 
    '$1 ($2) Move to ground level');

  // 23) X번 출입구 방향으로 이동
  translated = translated.replace(/(\d+\))\s*(\d+)번\s*출입구\s*방향으로\s*이동/g, 
    '$1 Move toward Exit $2');

  // 나머지 한글 용어를 영어로 변환
  translated = translated.replace(/지하\s*(\d+)층/g, 'B$1');
  translated = translated.replace(/지상\s*(\d+)층/g, '$1F');
  translated = translated.replace(/대합실/g, 'concourse');
  translated = translated.replace(/승강장/g, 'platform');
  translated = translated.replace(/출입구/g, 'exit');
  translated = translated.replace(/엘리베이터/g, 'elevator');
  translated = translated.replace(/방면/g, ' direction');
  translated = translated.replace(/호선/g, 'Line ');
  translated = translated.replace(/탑승/g, 'board');
  translated = translated.replace(/하차/g, 'exit');
  translated = translated.replace(/이동/g, 'move');
  translated = translated.replace(/통과/g, 'pass through');
  translated = translated.replace(/승차/g, 'board');
  translated = translated.replace(/방향/g, 'direction');
  translated = translated.replace(/으로/g, 'to');
  translated = translated.replace(/에서/g, 'at');
  translated = translated.replace(/옆/g, 'near');
  translated = translated.replace(/근처/g, 'near');
  translated = translated.replace(/사이/g, 'between');

  return translated;
}

// 메인 함수
function main() {
  const data = JSON.parse(fs.readFileSync('./movements_unique_texts.json', 'utf8'));
  
  const batches = [
    { start: 0, end: 500, file: 'movements_translations_1.json' },
    { start: 500, end: 1000, file: 'movements_translations_2.json' },
    { start: 1000, end: 1500, file: 'movements_translations_3.json' },
    { start: 1500, end: 2326, file: 'movements_translations_4.json' },
  ];
  
  for (const batch of batches) {
    const translations = {};
    const batchData = data.slice(batch.start, batch.end);
    
    batchData.forEach((koText) => {
      const enText = translateNatural(koText);
      translations[koText] = enText;
    });
    
    fs.writeFileSync(batch.file, JSON.stringify(translations, null, 2), 'utf8');
    console.log(`✓ ${batch.file} 완료 (${batch.start + 1}~${batch.end})`);
  }
  
  console.log('\n모든 번역 완료!');
}

main();
