import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const DATA_GO_KR_KEY = Deno.env.get('DATA_GO_KR_API_KEY') ?? '';
const BASE = 'https://apis.data.go.kr/B553766/path';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const { searchParams } = new URL(req.url);
  const dptreStnNm = searchParams.get('dptreStnNm');
  const arvlStnNm = searchParams.get('arvlStnNm');
  const searchType = searchParams.get('searchType') ?? 'transfer';
  const searchDt = searchParams.get('searchDt');

  if (!dptreStnNm || !arvlStnNm) {
    return new Response(JSON.stringify({ error: 'dptreStnNm and arvlStnNm are required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let url = `${BASE}/getShtrmPath?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}` +
    `&dptreStnNm=${encodeURIComponent(dptreStnNm)}` +
    `&arvlStnNm=${encodeURIComponent(arvlStnNm)}` +
    `&searchType=${encodeURIComponent(searchType)}` +
    `&dataType=JSON`;
  if (searchDt) url += `&searchDt=${encodeURIComponent(searchDt)}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: String(e) }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
