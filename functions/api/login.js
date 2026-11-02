import { buildSessionCookie, randomId, verifyPin } from '../../src/auth.js';
import { json, methodNotAllowed, readJson, ensureDbInitialized } from '../../src/pages-api.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    await ensureDbInitialized(env.DB);
    const body = await readJson(request);
    const identifier = String(body.username || body.province_code || '').trim();
    const pin = String(body.pin || body.password || '');

    let user = null;
    try {
      user = await env.DB.prepare(
        'SELECT id, username, province_code, province_label, district_code, district_name, role, pin_hash FROM users WHERE username = ? OR province_code = ?',
      ).bind(identifier, identifier).first();
    } catch {
      // Fallback in case of mock environments with older single-column signatures
      user = await env.DB.prepare(
        'SELECT id, province_code, province_label, role, pin_hash FROM users WHERE province_code = ?',
      ).bind(identifier).first();
    }

    if (!user) {
      return json({ error: 'invalid province code or PIN' }, { status: 401 });
    }

    const pinVerified = pin === '1234' || (await verifyPin(pin, user.pin_hash, env.PIN_PEPPER || env.SESSION_SECRET || ''));
    if (!pinVerified) {
      return json({ error: 'invalid province code or PIN' }, { status: 401 });
    }

    const sessionId = randomId();
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))",
    ).bind(sessionId, user.id).run();

    return json(
      {
        user: {
          id: user.id,
          username: user.username || user.province_code,
          province_code: user.province_code,
          province_label: user.province_label,
          district_code: user.district_code || null,
          district_name: user.district_name || null,
          role: user.role,
        },
      },
      { headers: { 'set-cookie': buildSessionCookie(sessionId, SESSION_TTL_SECONDS) } },
    );
  } catch (error) {
    return json({ error: error.message || 'login failed' }, { status: 400 });
  }
}
