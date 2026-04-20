
import 'dotenv/config';
import { fetchShtrmPath } from './src/api/seoulApi.js';

async function test() {
    for (const type of ['transfer', 'duration', 'distance']) {
        console.log(`\n=== Search Type: ${type} ===`);
        const result = await fetchShtrmPath({ 
            dptreStnNm: '양천구청', 
            arvlStnNm: '신도림', 
            searchType: type 
        });
        
        if (result.paths) {
            console.log(`Segments: ${result.paths.length}`);
            result.paths.forEach((seg, i) => {
                console.log(`  ${i}: ${seg.dptreStn.stnNm} -> ${seg.arvlStn.stnNm} (stinCnt: ${seg.stinCnt}, trsitYn: ${seg.trsitYn})`);
            });
        }
    }
}

test();
