const fs = require('fs');
const path = require('path');

const files = [1, 2, 3, 4].map(i =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `movements_translations_${i}.json`), 'utf8'))
);

const merged = Object.assign({}, ...files);
fs.writeFileSync(path.join(__dirname, 'movements_translations.json'), JSON.stringify(merged, null, 2));
console.log('완료! 총', Object.keys(merged).length, '개');