const fs = require('fs');
const path = require('path');

function hasHangul(s) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
}

function main() {
  const dir = __dirname;
  const masterPath = path.join(dir, 'movements_translations.json');
  if (!fs.existsSync(masterPath)) {
    console.error('master file not found:', masterPath);
    process.exit(1);
  }
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

  const files = fs.readdirSync(dir).filter(f => /^movements_translations_\\d+\\.json$/.test(f));
  files.sort((a, b) => {
    const na = parseInt(a.match(/_(\\d+)\\.json$/)[1], 10);
    const nb = parseInt(b.match(/_(\\d+)\\.json$/)[1], 10);
    return na - nb;
  });
  files.forEach((file) => {
    const p = path.join(dir, file);
    let obj = {};
    try {
      obj = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error('Failed to parse', file, e.message);
      return;
    }
    let replaced = 0;
    // 강제로 마스터의 값으로 덮어씀 (마스터가 가장 최신/정확한 소스)
    Object.keys(obj).forEach((k) => {
      if (master[k] && obj[k] !== master[k]) {
        obj[k] = master[k];
        replaced++;
      }
    });
    if (replaced > 0) {
      fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\\n', 'utf8');
      console.log(`${file}: overwritten ${replaced} entries from master`);
    } else {
      console.log(`${file}: already up-to-date`);
    }
  });
}

main();

