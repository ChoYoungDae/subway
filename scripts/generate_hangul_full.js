const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const files = ['movements_translations_1.json','movements_translations_2.json','movements_translations_3.json'];
const outPath = path.join(__dirname, 'hangul_remaining_full.json');

function hasHangul(s) {
  return /[\\u3131-\\u318E\\uAC00-\\uD7A3]/.test(s);
}

const results = [];

for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) continue;
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (hasHangul(val)) {
      results.push({ file: f, original: key, translation: val });
    }
  }
}

fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\\n', 'utf8');
console.log('WROTE', outPath, results.length, 'entries');

