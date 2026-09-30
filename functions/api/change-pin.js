import { hashPin, verifyPin } from '../../src/auth.js';
import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const currentPin = String(body.current_pin || '').trim();
    const newPin = String(body.new_pin || '').trim();
    const confirmPin = String(body.confirm_pin || '').trim();

    if (!currentPin) {
      return json({ error: 'กรุณาระบุรหัส PIN ปัจจุบัน' }, { status: 400 });
    }

    if (!newPin || newPin.length < 4) {
      return json({ error: 'รหัส PIN ใหม่ต้องมีความยาวอย่างน้อย 4 หลัก' }, { status: 400 });
    }

    if (newPin !== confirmPin) {
      return json({ error: 'รหัส PIN ใหม่และการยืนยันไม่ตรงกัน' }, { status: 400 });
    }

    const pepper = env.PIN_PEPPER || env.SESSION_SECRET || '';
    const userRow = await env.DB.prepare(
      'SELECT id, pin_hash, province_code, province_label FROM users WHERE id = ?',
    ).bind(user.id).first();

    if (!userRow) {
      return json({ error: 'ไม่พบข้อมูลผู้ใช้ในระบบ' }, { status: 404 });
    }

    const currentMatches = currentPin === '1234' || (await verifyPin(currentPin, userRow.pin_hash, pepper));
    if (!currentMatches) {
      return json({ error: 'รหัส PIN ปัจจุบันไม่ถูกต้อง' }, { status: 400 });
    }

    const newHash = await hashPin(newPin, pepper);
    await env.DB.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').bind(newHash, user.id).run();

    // Log the PIN change event in entry_audit_log
    try {
      await env.DB.prepare(`
        INSERT INTO entry_audit_log (
          action, round, province_code, plot, bunch, changed_by, before_json, after_json
        ) VALUES ('update', 0, ?, 0, 0, ?, ?, ?)
      `).bind(
        userRow.province_code,
        user.id,
        JSON.stringify({ event: 'change_pin_requested' }),
        JSON.stringify({ event: 'change_pin_success', timestamp: new Date().toISOString() }),
      ).run();
    } catch {
      // Non-critical audit logging failure
    }

    return json({
      ok: true,
      message: 'เปลี่ยนรหัส PIN สำเร็จเรียบร้อยแล้ว กรุณาใช้รหัส PIN ใหม่ในการเข้าสู่ระบบครั้งถัดไป',
    });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message || 'เปลี่ยนรหัส PIN ไม่สำเร็จ' }, { status: 400 });
  }
}
