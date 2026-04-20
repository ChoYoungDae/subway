const fs = require('fs');
const path = require('path');

const csvPath = 'd:/projects/subway-access/station_codes.csv';
const jsonPath = 'd:/projects/subway-access/src/data/kricCodes.json';

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');

const result = {};

// Skip header
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [oprCd, oprNm, lnCd, lnNm, stinCd, stinNm] = line.split(',');

    if (!result[stinNm]) {
        result[stinNm] = [];
    }

    result[stinNm].push({
        oprCd,
        lnCd,
        lnNm,
        stinCd
    });
}

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log(`Converted ${lines.length - 1} lines to ${jsonPath}`);
