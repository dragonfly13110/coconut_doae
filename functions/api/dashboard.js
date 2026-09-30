import { summarizeEntries } from '../../src/core.js';
import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    const rows = await loadEntries(env, user);
    const entries = rows.results || [];
    return json({
      ...summarizeEntries(entries),
      entries,
    });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 500 });
  }
}

function loadEntries(env, user) {
  if (user.role === 'admin') {
    return env.DB.prepare(`
      SELECT e.*, u.province_label AS recorded_by_label
      FROM entries e
      LEFT JOIN users u ON e.recorded_by = u.id
      ORDER BY e.round, e.province_code, e.plot, e.bunch
    `).all();
  } else {
    return env.DB.prepare(`
      SELECT e.*, u.province_label AS recorded_by_label
      FROM entries e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE e.province_code = ?
      ORDER BY e.round, e.plot, e.bunch
    `).bind(user.province_code).all();
  }
}
