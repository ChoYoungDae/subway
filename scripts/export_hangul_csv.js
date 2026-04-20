const fs = require('fs');
const path = require('path');

const inPath = 'C:\\\\Users\\\\azuca\\\\.cursor\\\\projects\\\\d-projects-subway-access\\\\agent-tools\\\\ba0acae1-a8c9-42e7-a98b-6bea500c2426.txt';
const outPath = path.join(__dirname, 'hangul_remaining.csv');

if (!fs.existsSync(inPath)) {
  console.error('Input file not found:', inPath);
  process.exit(1);
}

const s = fs.readFileSync(inPath, 'utf8');
const lines = s.split(/\r?\n/).filter(Boolean);

function esc(x) {
  return '"' + String(x).replace(/"/g, '""') + '"';
}

const csvLines = lines.map(l => {
  const parts = l.split('|');
  const a = parts[0] || '';
  const b = parts[1] || '';
  const c = parts[2] || '';
  return [esc(a), esc(b), esc(c)].join(',');
});

fs.writeFileSync(outPath, 'file,original,translation\n' + csvLines.join('\n'), 'utf8');
console.log('WROTE', outPath);

