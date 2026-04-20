const fs = require('fs');
const path = require('path');

function main() {
  const file4 = path.join(__dirname, 'movements_translations_4.json');
  const file5 = path.join(__dirname, 'movements_translations_5.json');

  if (!fs.existsSync(file4)) {
    console.error('movements_translations_4.json not found');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file4, 'utf8'));
  const entries = Object.entries(data);
  if (entries.length <= 1) {
    console.log('Not enough entries to split.');
    return;
  }

  const mid = Math.ceil(entries.length / 2);
  const first = Object.fromEntries(entries.slice(0, mid));
  const second = Object.fromEntries(entries.slice(mid));

  fs.writeFileSync(file4, JSON.stringify(first, null, 2) + '\\n', 'utf8');
  fs.writeFileSync(file5, JSON.stringify(second, null, 2) + '\\n', 'utf8');

  console.log(`Split completed. ${Object.keys(first).length} entries -> movements_translations_4.json`);
  console.log(`${Object.keys(second).length} entries -> movements_translations_5.json`);
}

main();

