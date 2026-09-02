const ALLOWED_ORIGINS = new Set([
  'https://cfinvesting.com',
  'https://www.cfinvesting.com'
]);

const SOURCE_PATHS = {
  home: '/',
  research: '/research/',
  projects: '/projects/',
  sustainable: '/sustainable-finance/',
  tools: '/tools/',
  education: '/education/',
  institutional: '/institutional/'
};

const INTERESTS = new Set([
  'general',
  'markets',
  'projects-capital',
  'sustainable-finance',
  'education'
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

const validEmail = (value) => {
  if (typeof value !== 'string' || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

async function subscribeToBeehiiv(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed' }, 405);
  }

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, code: 'origin_not_allowed' }, 403);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ ok: false, code: 'invalid_content_type' }, 415);
  }

  const lengthHeader = Number(request.headers.get('content-length') || '0');
  if (lengthHeader > 4096) {
    return json({ ok: false, code: 'payload_too_large' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid_json' }, 400);
  }

  // Honeypot. A normal CF Investing form leaves this field empty.
  if (body.company_website) {
    return json({ ok: true, status: 'pending_confirmation' }, 200);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const language = body.language === 'es' ? 'es' : 'en';
  const source = Object.prototype.hasOwnProperty.call(SOURCE_PATHS, body.source) ? body.source : 'home';
  const interest = INTERESTS.has(body.interest) ? body.interest : 'general';

  if (!validEmail(email)) {
    return json({ ok: false, code: 'invalid_email' }, 400);
  }

  if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) {
    return json({ ok: false, code: 'newsletter_unavailable' }, 503);
  }

  const publicationId = env.BEEHIIV_PUBLICATION_ID;
  const endpoint = `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/subscriptions`;
  const payload = {
    email,
    reactivate_existing: false,
    send_welcome_email: false,
    double_opt_override: 'on',
    utm_source: 'cfinvesting.com',
    utm_medium: 'website',
    utm_campaign: source,
    utm_term: interest,
    utm_content: language,
    referring_site: `https://cfinvesting.com${SOURCE_PATHS[source]}`
  };

  let beehiivResponse;
  try {
    beehiivResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.BEEHIIV_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return json({ ok: false, code: 'provider_unavailable' }, 502);
  }

  if (beehiivResponse.ok) {
    return json({ ok: true, status: 'pending_confirmation' }, 200);
  }

  // Do not relay Beehiiv response bodies to the browser because they may contain
  // operational details. 4xx errors are normalized for a simple public UX.
  if (beehiivResponse.status === 429) {
    return json({ ok: false, code: 'try_again_later' }, 429);
  }
  if (beehiivResponse.status >= 400 && beehiivResponse.status < 500) {
    return json({ ok: false, code: 'subscription_not_created' }, 400);
  }
  return json({ ok: false, code: 'provider_unavailable' }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/newsletter/subscribe') {
      return subscribeToBeehiiv(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, code: 'not_found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
