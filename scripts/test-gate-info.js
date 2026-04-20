const { fetchStationGateInfo, getKricItems } = require('../src/api/seoulApi');
require('dotenv').config();

async function testGateInfo() {
    try {
        console.log('Fetching Gate Info for Gangnam (222, S1)...');
        const res = await fetchStationGateInfo({ railOprIsttCd: 'S1', lnCd: '2', stinCd: '222' });
        const items = getKricItems(res);
        console.log('Total Exits Found:', items.length);
        if (items.length > 0) {
            console.log('Sample Exit Data:', JSON.stringify(items[0], null, 2));
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testGateInfo();
