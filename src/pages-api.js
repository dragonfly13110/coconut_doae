import { clearSessionCookie, parseCookies } from './auth.js';

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed() {
  return json({ error: 'method not allowed' }, { status: 405 });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('invalid json');
  }
}

export async function requireUser(request, env) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  if (!cookies.sid) throw unauthorized();

  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, u.id, u.province_code, u.province_label, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).bind(cookies.sid).first();

  if (!row) throw unauthorized();
  return row;
}

export function authErrorResponse(error) {
  if (error && error.status === 401) {
    return json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'set-cookie': clearSessionCookie() } },
    );
  }
  return null;
}

function unauthorized() {
  const error = new Error('unauthorized');
  error.status = 401;
  return error;
}
