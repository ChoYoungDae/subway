const fetch = require('node-fetch');
const API_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const url = `https://openapi.kric.go.kr/openapi/trafficWeekInfo/stinElevatorMovement?serviceKey=${API_KEY}&format=json&railOprIsttCd=S1&lnCd=2&stinCd=222`;

fetch(url)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    });
