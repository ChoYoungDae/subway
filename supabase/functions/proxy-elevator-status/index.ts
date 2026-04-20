import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SEOUL_KEY = Deno.env.get('SEOUL_SUBWAY_KEY') ?? '';
const BASE = 'http://openapi.seoul.go.kr:8088';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = `${BASE}/${SEOUL_KEY}/json/getWksnElvtr/1/1000/`;

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
