// scripts/merge_and_export.js
const fs = require('fs');
const path = require('path');

function main() {
  // 우선 전체 마스터 파일이 있으면 그것을 사용 (단일 소스가 가장 신뢰됨)
  const masterPath = path.join(__dirname, 'movements_translations.json');
  let allTranslations = {};
  if (fs.existsSync(masterPath)) {
    try {
      allTranslations = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      console.log('Using master movements_translations.json as source.');
    } catch (e) {
      console.warn('Failed to parse master file, falling back to split files:', e.message);
    }
  }

  // 마스터가 없거나 파싱에 실패하면 분할 파일들을 읽어서 병합
  if (!allTranslations || Object.keys(allTranslations).length === 0) {
    const trans1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'movements_translations_1.json'), 'utf8'));
    const trans2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'movements_translations_2.json'), 'utf8'));
    const trans3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'movements_translations_3.json'), 'utf8'));
    const trans4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'movements_translations_4.json'), 'utf8'));
    const trans5Path = path.join(__dirname, 'movements_translations_5.json');
    const trans5 = fs.existsSync(trans5Path) ? JSON.parse(fs.readFileSync(trans5Path, 'utf8')) : {};
    allTranslations = {
      ...trans1,
      ...trans2,
      ...trans3,
      ...trans4,
      ...trans5
    };
  }

  // JavaScript export 형태로 만들기
  const jsContent = `// Auto-generated file - Do not edit manually
// Movement translations from Korean to English

export const MOVEMENT_TRANSLATIONS = ${JSON.stringify(allTranslations, null, 2)};
`;

  // src/data 디렉토리 생성 (없을 경우)
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 파일 저장
  const outputPath = path.join(dataDir, 'movementTranslations.js');
  fs.writeFileSync(outputPath, jsContent, 'utf8');

  console.log(`✓ 번역 파일 생성 완료: ${outputPath}`);
  console.log(`  - 총 ${Object.keys(allTranslations).length}개 항목`);
}

main();
