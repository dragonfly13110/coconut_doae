import { parseCookies, clearSessionCookie } from '../../src/auth.js';
import { json, methodNotAllowed } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  const cookies = parseCookies(request.headers.get('cookie') || '');
  if (cookies.sid) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(cookies.sid).run();
  }

  return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } });
}
