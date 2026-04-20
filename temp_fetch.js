
const API_KEY = '$2a$10$vjwmHxVkoIPU1ZgcF7npnu5FGSNNIE88fH7jUyPGYOF2DDMfCdxtm';

async function getTransferVulnerable(stinCd, lnCd, chgLnCd) {
    const url = `https://openapi.kric.go.kr/openapi/vulnerableUserInfo/transferMovement?serviceKey=${API_KEY}&format=json&railOprIsttCd=S1&stinCd=${stinCd}&lnCd=${lnCd}&chgLnCd=${chgLnCd}`;
    console.log('Fetching:', url);
    const res = await fetch(url);
    const data = await res.json();
    return data;
}

async function run() {
    console.log('--- 을지로3가 (2호선 -> 3호선) ---');
    const d1 = await getTransferVulnerable('203', '2', '3');
    console.log(JSON.stringify(d1, null, 2));

    console.log('\n--- 을지로3가 (3호선 -> 2호선) ---');
    const d2 = await getTransferVulnerable('320', '3', '2');
    console.log(JSON.stringify(d2, null, 2));
}

run();
