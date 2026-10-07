// Public intake only: this endpoint never touches profiles or Auth accounts.
const allowedOrigins = new Set(['https://www.ardttemp.org', 'https://ardttemp.org']);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
  if (!allowedOrigins.has(origin)) return reply({ok: false, error: 'Forbidden origin'}, 403);
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (req.method !== 'POST') return reply({ok: false, error: 'Method not allowed'}, 405);
  if (!req.headers.get('content-type')?.includes('application/json')) return reply({ok: false, error: 'JSON required'}, 415);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16000) return reply({ok: false, error: 'Request too large'}, 413);
    const body = JSON.parse(raw);
    if (!body || !['contact', 'membership', 'newsletter', 'donation_interest'].includes(body.operation)) return reply({ok: false, error: 'Invalid operation'}, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submission_id || '')) return reply({ok: false, error: 'Invalid request identifier'}, 400);
    if (!['fr','en'].includes(body.language) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return reply({ok: false, error: 'Invalid payload'}, 400);
    if (['role','status','points','matricule','user_id','actor_role'].some(k => k in body.data)) return reply({ok: false, error: 'Privileged fields forbidden'}, 403);
    if (body.operation === 'membership' && !['membre','benevole','volontaire'].includes(body.data.requested_role)) return reply({ok: false, error: 'Invalid requested role'}, 400);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!url || !key) return reply({ok:false,error:'Service unavailable'},503);
    const response = await fetch(url + '/rest/v1/rpc/receive_website_submission', {
      method:'POST', headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
      body:JSON.stringify({p_id:body.submission_id,p_operation:body.operation,p_locale:body.language,p_data:body.data,
        p_source:req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'}),
      signal:AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok) return reply({ok:false,error:'Submission rejected'},result.code === '42501' ? 403 : result.code === '22023' ? 400 : 503);
    if (!result.ok) return reply({ok:false,error:'Too many requests'},429);
    return reply(result,201);
  } catch { return reply({ok:false,error:'Invalid request or unavailable service'},400); }
});
