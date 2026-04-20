const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const myEnv = dotenv.config();
dotenvExpand.expand(myEnv);

const API_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;

async function testStructure() {
    const url = `https://openapi.kric.go.kr/openapi/trafficWeekInfo/stinElevatorMovement?serviceKey=${API_KEY}&format=json&railOprIsttCd=S1&lnCd=2&stinCd=222`;
    console.log(`Testing KRIC structure: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('--- HEADER ---');
        console.log(JSON.stringify(data.header, null, 2));
        console.log('--- KEYS ---');
        console.log(Object.keys(data));
        if (data.body) {
            console.log('--- BODY KEYS ---');
            console.log(Object.keys(data.body));
            const items = Array.isArray(data.body) ? data.body : (data.body.item || data.body.items);
            console.log('--- ITEMS PREVIEW (1st item) ---');
            console.log(JSON.stringify(Array.isArray(items) ? items[0] : items, null, 2));
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testStructure();
