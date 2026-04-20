
import 'dotenv/config';
import { fetchShtrmPath } from './src/api/seoulApi.js';

async function test() {
    const result = await fetchShtrmPath({ 
        dptreStnNm: '양천구청', 
        arvlStnNm: '신도림', 
        searchType: 'duration' 
    });
    
    if (result.paths && result.paths.length > 0) {
        console.log('Keys in first path segment:', Object.keys(result.paths[0]));
        console.log('Sample segment:', JSON.stringify(result.paths[0], null, 2));
    }
}

test();
