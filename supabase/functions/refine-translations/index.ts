import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const BATCH_SIZE = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MovementStep {
  order: number;
  text: string;
}

interface StepTranslation {
  order: number;
  short: { en: string; ko: string };
  detail: { en: string; ko: string };
  floor_from?: string | null;
  floor_to?: string | null;
  type: 'elevator' | 'move' | 'gate' | 'board' | 'alight';
}

interface PendingRecord {
  hash_key: string;
  stin_cd: string;
  line: string;
  exit_no: string | null;
  is_destination: boolean;
  is_transfer: boolean;
  from_line: string | null;
  to_line: string | null;
  next_stin_cd: string | null;
  movement_steps_ko: MovementStep[];
  analysis_data?: Record<string, unknown> | null;
}

async function loadGlossary(): Promise<string> {
  const { data, error } = await supabase.from('proper_nouns').select('kr, en').order('kr');
  if (error || !data) return '';
  return data.map((r: { kr: string; en: string }) => `"${r.kr}" → "${r.en}"`).join('\n');
}

function buildRefinedPrompt(rec: PendingRecord, glossary: string): string {
  const context = rec.is_transfer
    ? `Transfer station: ${rec.from_line} → ${rec.to_line}`
    : `${rec.is_destination ? 'Destination' : 'Departure'} station, Exit ${rec.exit_no ?? 'N/A'}`;

  const stepsText = rec.movement_steps_ko
    .map(s => `${s.order}) ${s.text}`)
    .join('\n');

  const analysisSection = rec.analysis_data
    ? `\n[Station Structure JSON]\n${JSON.stringify(rec.analysis_data, null, 2)}\n`
    : '';

  return `You are an expert accessibility guide for international travelers navigating Seoul's subway system.
Your task is to produce the highest-quality English and Korean step-by-step elevator route instructions.
Take your time — accuracy and naturalness matter more than speed.

[Context]
Station code: ${rec.stin_cd} (${rec.line})
Type: ${context}
${analysisSection}
[Glossary — use these translations exactly]
${glossary}

[Korean Movement Steps — raw source data]
${stepsText}

[Quality Standards]
1. Both "short" and "detail" are required for every step, in English (primary) and Korean (secondary).
2. "short": One clear action sentence. Include verb + facility + floor change if applicable.
   - Floor transitions: write as (B2F → B1F) only when floor actually changes.
   - ALWAYS include a verb ("Take", "Pass through", "Move to", "Exit via").
   - Do NOT repeat the station name if obvious from context.
3. "detail": A fuller sentence for screen readers and users who need more guidance.
   - Include directional cues using landmarks or floor levels (never left/right).
   - Mention accessibility features (e.g., tactile paths, wide gates) where present in source.
4. [English terminology]
   - "Station Hall" (not Concourse)
   - "Platform" (not Track)
   - "Ticket Gate" or "Fare Gate" (not Turnstile)
   - "Arrival" (not Alight)
5. [Korean standards]
   - ⚠️ ABSOLUTELY NO English words in Korean sentences.
   - "대합실" for Station Hall, "승강장" for Platform, "개찰구" for Fare Gate, "도착" for Arrival.
   - Floor codes (B1F, 1F, 2F) in Latin characters are acceptable in Korean text.
   - Sentence endings: use natural polite form (e.g., "이용하세요", "이동하세요").
6. Remove all "(휠체어칸)" references.
7. type: one of "elevator", "gate", "board", "alight", "move".
8. DESTINATION logic: if is_destination=true, input steps are in descending order (e.g. 7,6,5…).
   Preserve those order numbers. Interpret "boarding" context as "arriving at platform".

[Output — strict JSON only, no markdown fences]
{
  "steps": [
    {
      "order": <number>,
      "short":  { "en": "...", "ko": "..." },
      "detail": { "en": "...", "ko": "..." },
      "floor_from": "...",
      "floor_to": "...",
      "type": "..."
    }
  ]
}`;
}

function sanitizeSteps(steps: StepTranslation[]): StepTranslation[] {
  const stripIds = (t: string) =>
    t.replace(/\s*\(EV_[A-Z0-9_]+\)/g, '').replace(/\bEV_[A-Z0-9_]+\b/g, 'the elevator').trim();

  const cleanEn = (t: string) =>
    t.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]+/g, '').replace(/\s{2,}/g, ' ').replace(/[\s.,]+$/g, '').trim();

  const cleanKo = (t: string) =>
    t.replace(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g, m => /B\d+F?|\d+F?|T\d+|E\/L/.test(m) ? m : '')
     .replace(/개집표기|개표기\/집표기/g, '개찰구')
     .replace(/(\s)+/g, '$1')
     .replace(/[\.,\s]+$/g, '')
     .trim();

  return steps.map(step => ({
    ...step,
    short:  { en: cleanEn(stripIds(step.short.en)),  ko: cleanKo(stripIds(step.short.ko)) },
    detail: { en: cleanEn(stripIds(step.detail.en)), ko: cleanKo(stripIds(step.detail.ko)) },
  }));
}

async function callGemini(prompt: string): Promise<StepTranslation[]> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.steps)) throw new Error('Invalid response shape');
  return parsed.steps as StepTranslation[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' } });
  }

  // Verify caller is the Vercel cron trigger
  const authHeader = req.headers.get('authorization') ?? '';
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Fetch next batch of realtime records that have Korean source stored
  const { data: pending, error } = await supabase
    .from('movement_translations')
    .select('hash_key, stin_cd, line, exit_no, is_destination, is_transfer, from_line, to_line, next_stin_cd, movement_steps_ko, analysis_data')
    .eq('translation_status', 'realtime')
    .not('movement_steps_ko', 'is', null)
    .limit(BATCH_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!pending?.length) {
    return new Response(JSON.stringify({ processed: 0, message: 'Nothing to refine' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const glossary = await loadGlossary();
  const results = { processed: 0, failed: 0, skipped: 0 };

  for (const rec of pending as PendingRecord[]) {
    if (!rec.movement_steps_ko?.length) { results.skipped++; continue; }

    try {
      const prompt = buildRefinedPrompt(rec, glossary);
      const steps = sanitizeSteps(await callGemini(prompt));

      await supabase
        .from('movement_translations')
        .update({ steps, translation_status: 'verified' })
        .eq('hash_key', rec.hash_key);

      results.processed++;
    } catch (err) {
      console.error(`[refine] ❌ ${rec.hash_key}:`, err);
      results.failed++;
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
