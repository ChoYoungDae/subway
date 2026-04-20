const fs = require('fs');
const path = require('path');

function main() {
  const dir = __dirname;
  const masterPath = path.join(dir, 'movements_translations.json');
  if (!fs.existsSync(masterPath)) {
    console.error('master not found:', masterPath);
    process.exit(1);
  }
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const entries = Object.entries(master);
  const total = entries.length;
  const parts = 5;
  const size = Math.ceil(total / parts);

  for (let i = 0; i < parts; i++) {
    const start = i * size;
    const chunk = entries.slice(start, start + size);
    const obj = Object.fromEntries(chunk);
    const outPath = path.join(dir, `movements_translations_${i+1}.json`);
    fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\\n', 'utf8');
    console.log(`WROTE ${outPath} (${Object.keys(obj).length} entries)`);
  }
}

main();

