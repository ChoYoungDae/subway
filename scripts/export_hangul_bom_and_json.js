const fs = require('fs');
const path = require('path');

const inPath = 'C:\\\\Users\\\\azuca\\\\.cursor\\\\projects\\\\d-projects-subway-access\\\\agent-tools\\\\ba0acae1-a8c9-42e7-a98b-6bea500c2426.txt';
const outCsv = path.join(__dirname, 'hangul_remaining_bom.csv');
const outJson = path.join(__dirname, 'hangul_remaining.json');

if (!fs.existsSync(inPath)) {
  console.error('Input file not found:', inPath);
  process.exit(1);
}

const s = fs.readFileSync(inPath, 'utf8');
const lines = s.split(/\\r?\\n/).filter(Boolean);

const arr = lines.map(l => {
  const parts = l.split('|');
  return {
    file: parts[0] || '',
    original: (parts[1] || '').trim(),
    translation: (parts[2] || '').trim()
  };
});

function esc(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

const csvHeader = '\\uFEFFfile,original,translation\\n';
const csvBody = arr.map(x => [esc(x.file), esc(x.original), esc(x.translation)].join(',')).join('\\n');
fs.writeFileSync(outCsv, csvHeader + csvBody, 'utf8');
fs.writeFileSync(outJson, JSON.stringify(arr, null, 2), 'utf8');
console.log('WROTE', outCsv, outJson);

