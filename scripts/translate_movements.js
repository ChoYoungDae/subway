const path = require('path');
const https = require('https');
const fs = require('fs');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(texts) {
  const prompt = `Translate these Seoul subway step-free navigation instructions from Korean to English.
Rules:
- Keep step numbers like "1) " as-is
- Keep floor indicators like (B1), (B2), (1F) as-is
- Station names: use romanization (청량리→Cheongnyangni, 신설동→Sinseoldong, etc.)
- Terms: 엘리베이터→Elevator, 승강장→Platform, 대합실→Concourse, 출입구→Exit, 개집표기→Fare gate, 휠체어칸→Wheelchair car, 표 내는 곳→Ticket gate, 환승통로→Transfer corridor, 휠체어리프트→Wheelchair lift, 탑승→Board, 하차→Alight, 이동→Move to, 통과→Pass through, 방면→direction, 호선→Line
- Return ONLY a JSON object, no markdown, no explanation

Input: ${JSON.stringify(texts)}

Output format: {"korean text": "english translation", ...}`;

  const res = await callClaude(prompt);
  if (res.error) throw new Error(res.error.message);
  const text = res.content[0].text.trim();
  const clean = text.replace(/^```json\n?|^```\n?|\n?```$/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  const texts = JSON.parse(fs.readFileSync(path.join(__dirname, 'movements_unique_texts.json'), 'utf8'));
  const BATCH_SIZE = 50;
  const result = {};
  let success = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`번역 중... ${i + 1}~${Math.min(i + BATCH_SIZE, texts.length)} / ${texts.length}`);
    try {
      const translated = await translateBatch(batch);
      Object.assign(result, translated);
      success += Object.keys(translated).length;
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.log(`배치 ${i} 실패:`, e.message, '- 개별 재시도');
      for (const t of batch) {
        try {
          const r = await translateBatch([t]);
          Object.assign(result, r);
          success++;
        } catch (e2) {
          result[t] = t;
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  fs.writeFileSync('/mnt/user-data/outputs/movements_translations.json', JSON.stringify(result, null, 2));
  console.log(`\n완료! ${success} / ${texts.length} 번역됨`);
}

main().catch(console.error);
