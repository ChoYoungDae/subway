import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Types ──────────────────────────────────────────────────────────────
interface MovementStep {
  order: number;
  text: string; // KRIC mvContDtl raw Korean text
}

interface TranslationRequest {
  stin_cd: string;
  line: string;
  exit_no?: string | null;
  is_destination?: boolean;
  is_transfer?: boolean;
  from_line?: string | null;
  to_line?: string | null;
  next_stin_cd?: string | null;
  analysis_data?: Record<string, unknown> | null;
  movement_steps: MovementStep[];
}

interface StepTranslation {
  order: number;
  short: { en: string; ko: string };
  detail: { en: string; ko: string };
  floor_from?: string | null;
  floor_to?: string | null;
  type: 'elevator' | 'move' | 'gate' | 'board' | 'alight';
}

// ── Hash key generation ────────────────────────────────────────────────
async function makeHashKey(req: TranslationRequest): Promise<string> {
  let raw: string;
  if (req.is_transfer) {
    raw = `${req.stin_cd}:${req.from_line}:${req.to_line}:${req.next_stin_cd}`;
  } else {
    raw = `${req.stin_cd}:${req.line}:${req.exit_no ?? 'NONE'}:${req.is_destination ?? false}`;
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Load glossary from proper_nouns ───────────────────────────────────
async function loadGlossary(): Promise<string> {
  const { data, error } = await supabase
    .from('proper_nouns')
    .select('kr, en')
    .order('kr');

  if (error || !data) return '';

  const lines = data.map((r: { kr: string; en: string }) => `"${r.kr}" → "${r.en}"`);
  return lines.join('\n');
}

// ── Build Gemini prompt ────────────────────────────────────────────────
function buildPrompt(req: TranslationRequest, glossary: string): string {
  const context = req.is_transfer
    ? `Transfer station: ${req.from_line} → ${req.to_line}`
    : `${req.is_destination ? 'Destination' : 'Departure'} station, Exit ${req.exit_no ?? 'N/A'}`;

  const stepsText = req.movement_steps
    .map(s => `${s.order}) ${s.text}`)
    .join('\n');

  const analysisSection = req.analysis_data
    ? `\n[Station Structure JSON]\n${JSON.stringify(req.analysis_data, null, 2)}\n`
    : '';

  return `You are a subway navigation guide for travelers visiting Seoul.
Generate step-by-step elevator route instructions from the provided Korean movement steps.

[Context]
Station: ${req.stin_cd} (${req.line})
Type: ${context}
${analysisSection}
[Glossary — use these translations exactly]
${glossary}

[Korean Movement Steps]
${stepsText}

[Rules]
1. Generate BOTH "short" and "detail" text for every step in English (primary) and Korean (secondary).
2. "short": Focus on the core action and facility. 
   - Keep it concise and readable. (Natural flow is more important than strict character counts).
   - Do NOT repeat the current station name if it's redundant.
   - ALWAYS include a verb (e.g. "Move to", "Pass", "Take").
   - Floor transitions: Use (B2F → B1F) only for actual floor changes. Omit if no change.
3. [English] Terminology:
   - Use "Station Hall" (not "Concourse")
   - Use "Platform" (not "Track")
   - Use "Arrival" (not "Alight")
4. [Korean] Write fully natural Korean suitable for an accessibility app.
   - ⚠️ ABSOLUTELY NO English words in Korean sentences (e.g. "Elevator", "Platform", "Arrival", "Gate").
   - Use "대합실" (for Station Hall)
   - Use "도착" (for Arrival/Alight)
   - Use "개찰구" (for Ticket Gate)
   - Use "승강장" (for Platform)
   - Floor notation (B1F, 1F) is okay.
5. Do NOT use left/right. Use landmarks or floor levels.
6. Remove all "(휠체어칸)" references.
7. type: "elevator", "gate", "board", "alight", or "move".
8. DESTINATION logic: Input "movement_steps" are in descent order (e.g. 7,6,5...). You MUST preserve these order numbers. Reverse the context logic (e.g. "boarding" in raw Korean → "arrival at platform" in your translation).

[Output — strict JSON only]
{
  "steps": [
    {
      "order": <number>,
      "short":  { "en": "...", "ko": "..." },
      "detail": { "en": "...", "ko": "..." },
      "floor_from": "...", "floor_to": "...",
      "type": "..."
    }
  ]
}`;
}

// ── Strip internal elevator IDs and English leakage from AI output ─────
function sanitizeSteps(steps: StepTranslation[]): StepTranslation[] {
  const stripIds = (text: string) =>
    text.replace(/\s*\(EV_[A-Z0-9_]+\)/g, '').replace(/\bEV_[A-Z0-9_]+\b/g, 'the elevator').trim();

  // Remove Korean characters from English fields (floor codes like B1, 1F are Latin so safe)
  const cleanEn = (text: string) =>
    text.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]+/g, '').replace(/\s{2,}/g, ' ').replace(/[\s.,]+$/g, '').trim();

  // Aggressively remove English words from Korean text except for floor/terminal codes
  const cleanKo = (text: string) =>
    text.replace(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g, (m) =>
        /B\d+F?|\d+F?|T\d+|E\/L/.test(m) ? m : ""
    )
    .replace(/개집표기|개표기\/집표기/g, '개찰구')
    .replace(/(\s)+/g, "$1")
    .replace(/[\.,\s]+$/g, "")
    .trim();

  return steps.map(step => ({
    ...step,
    short:  { en: cleanEn(stripIds(step.short.en)),  ko: cleanKo(stripIds(step.short.ko)) },
    detail: { en: cleanEn(stripIds(step.detail.en)), ko: cleanKo(stripIds(step.detail.ko)) },
  }));
}

// ── Call Gemini API ────────────────────────────────────────────────────
async function callGemini(prompt: string): Promise<StepTranslation[]> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const isQuota = res.status === 429;
    throw Object.assign(new Error(errText), { errorType: isQuota ? 'quota_exceeded' : 'api_error' });
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip possible markdown code fences
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.steps)) throw Object.assign(new Error('Invalid response shape'), { errorType: 'parse_error' });
  return parsed.steps as StepTranslation[];
}

// ── Log error to DB ────────────────────────────────────────────────────
async function logError(errorType: string, errorMsg: string, context: Record<string, unknown>) {
  await supabase.from('ai_error_log').insert({ error_type: errorType, error_msg: errorMsg, context });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let body: TranslationRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const { stin_cd, line, movement_steps } = body;
  if (!stin_cd || !line || !movement_steps?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields: stin_cd, line, movement_steps' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const hashKey = await makeHashKey(body);

  // ── 1. Cache check ──────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('movement_translations')
    .select('steps')
    .eq('hash_key', hashKey)
    .maybeSingle();

  if (cached) {
    return new Response(JSON.stringify({ steps: sanitizeSteps(cached.steps), cached: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── 2. Translate via Gemini ─────────────────────────────────────────
  let steps: StepTranslation[];
  try {
    const glossary = await loadGlossary();
    const prompt = buildPrompt(body, glossary);
    steps = sanitizeSteps(await callGemini(prompt));
  } catch (err: unknown) {
    const e = err as Error & { errorType?: string };
    const errorType = e.errorType ?? 'api_error';
    await logError(errorType, e.message, { stin_cd, line, exit_no: body.exit_no, is_transfer: body.is_transfer });
    return new Response(JSON.stringify({ steps: [], error: errorType }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Store in DB ──────────────────────────────────────────────────
  await supabase.from('movement_translations').insert({
    hash_key:           hashKey,
    stin_cd:            body.stin_cd,
    line:               body.line,
    exit_no:            body.exit_no ?? null,
    is_destination:     body.is_destination ?? false,
    is_transfer:        body.is_transfer ?? false,
    from_line:          body.from_line ?? null,
    to_line:            body.to_line ?? null,
    next_stin_cd:       body.next_stin_cd ?? null,
    steps,
    movement_steps_ko:  body.movement_steps,
    translation_status: 'realtime',
  });

  return new Response(JSON.stringify({ steps, cached: false }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
