import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    const url = new URL(request.url);
    const round = url.searchParams.get('round');
    const province = url.searchParams.get('province_code');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);

    let query = `
      SELECT a.*, u.province_label AS user_label, u.role AS user_role
      FROM entry_audit_log a
      LEFT JOIN users u ON a.changed_by = u.id
    `;
    const conditions = [];
    const params = [];

    if (user.role !== 'admin') {
      conditions.push('a.province_code = ?');
      params.push(user.province_code);
    } else if (province) {
      conditions.push('a.province_code = ?');
      params.push(province);
    }

    if (round) {
      conditions.push('a.round = ?');
      params.push(Number(round));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.changed_at DESC, a.id DESC LIMIT ?';
    params.push(limit);

    const stmt = env.DB.prepare(query);
    const rows = await stmt.bind(...params).all();

    return json({
      logs: rows.results || [],
    });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 500 });
  }
}
