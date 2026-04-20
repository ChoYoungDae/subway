require('dotenv').config();

const RAW_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const API_KEY = RAW_KEY ? RAW_KEY.replace(/\\/g, '') : null;
console.log('API_KEY length:', API_KEY ? API_KEY.length : 0);
console.log('API_KEY start:', API_KEY ? API_KEY.substring(0, 10) : 'null');

async function testGateInfo() {
    const otherParams = new URLSearchParams({
        format: 'json',
        railOprIsttCd: 'S1',
        lnCd: '2',
        stinCd: '222'
    }).toString();

    const url = `https://openapi.kric.go.kr/openapi/convenientInfo/stationGateInfo?serviceKey=${API_KEY}&${otherParams}`;
    console.log('GET', url);

    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch failed:', err);
    }
}

testGateInfo();
