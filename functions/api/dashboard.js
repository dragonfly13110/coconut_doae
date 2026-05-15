import { summarizeEntries } from '../../src/core.js';
import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    const rows = await loadEntries(env, user);
    return json(summarizeEntries(rows.results || []));
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 500 });
  }
}

function loadEntries(env, user) {
  if (user.role === 'admin') {
    return env.DB.prepare('SELECT * FROM entries ORDER BY round, province_code, plot, bunch').all();
  }

  return env.DB.prepare(
    'SELECT * FROM entries WHERE province_code = ? ORDER BY round, plot, bunch',
  ).bind(user.province_code).all();
}
