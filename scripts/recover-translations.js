const fs = require('fs');
const path = require('path');

function recover() {
    const scriptsDir = path.resolve(__dirname, '../scripts');
    const files = [1, 2, 3, 4, 5];
    let merged = {};

    files.forEach(i => {
        const filePath = path.join(scriptsDir, `movements_translations_${i}.json`);
        if (fs.existsSync(filePath)) {
            try {
                // JSON.parse가 실패할 수 있으므로 안전하게 처리
                const content = fs.readFileSync(filePath, 'utf8');
                // 혹시 뒤에 쓰레기 문자가 붙어있을 경우를 대비해 마지막 } 이후 제거
                const lastBrace = content.lastIndexOf('}');
                const sanitized = content.substring(0, lastBrace + 1);
                const data = JSON.parse(sanitized);
                Object.assign(merged, data);
                console.log(`✓ Read ${filePath}: ${Object.keys(data).length} items`);
            } catch (e) {
                console.error(`✗ Error reading ${filePath}:`, e.message);
            }
        }
    });

    // 마스터 파일도 확인
    const masterPath = path.join(scriptsDir, 'movements_translations.json');
    if (fs.existsSync(masterPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
            Object.assign(merged, data);
            console.log(`✓ Read master movements_translations.json: ${Object.keys(data).length} items`);
        } catch (e) { }
    }

    console.log(`\nTotal recovered items: ${Object.keys(merged).length}`);

    // 복구된 통합본 저장
    fs.writeFileSync(path.join(scriptsDir, 'recovered_all_translations.json'), JSON.stringify(merged, null, 2), 'utf8');
}

recover();
