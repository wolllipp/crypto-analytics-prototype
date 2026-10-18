/* Прокси для ассистента на публичной ссылке (Cloudflare Worker, бесплатный тариф).
   Ключ OpenRouter хранится в секрете воркера, а не в браузере пользователей.

   Развернуть:
     npm create cloudflare@latest ca-proxy   (шаблон "Hello World", JavaScript)
     заменить src/index.js этим файлом
     npx wrangler secret put OPENROUTER_API_KEY
     в wrangler.toml добавить:  [vars]  ALLOWED_ORIGIN = "https://<логин>.github.io"
     npx wrangler deploy
   Полученный адрес https://ca-proxy.<...>.workers.dev вставить в прототипе: Настройки → Ассистент → «Адрес прокси». */

const UPSTREAM = 'https://openrouter.ai/api/v1/chat/completions';
/* прокси пропускает только эти модели, чтобы чужие не потратили ваш баланс на дорогие */
const ALLOWED_MODELS = ['deepseek/deepseek-v4.1-flash', 'google/gemma-4-31b-it:free'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/chat') return new Response('Not found', { status: 404, headers: cors });

    let body;
    try { body = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: cors }); }
    const out = {
      model: ALLOWED_MODELS.includes(body.model) ? body.model : ALLOWED_MODELS[0],
      messages: Array.isArray(body.messages) ? body.messages.slice(-22) : [],
      stream: true,
      max_tokens: Math.min(Number(body.max_tokens) || 900, 900),
      temperature: 0.4,
    };

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY, 'X-Title': 'Crypto Analytics prototype' },
      body: JSON.stringify(out),
    });
    const headers = new Headers(upstream.headers);
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
