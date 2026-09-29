import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') return getMacroStats(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function getMacroStats(request, env, user) {
  const url = new URL(request.url);
  const targetProvince = url.searchParams.get('province_code');

  let query = 'SELECT * FROM macro_district_stats';
  const bindings = [];

  if (targetProvince && targetProvince !== 'all') {
    query += ' WHERE province_code = ?';
    bindings.push(targetProvince);
  }
  query += ' ORDER BY id ASC';

  const stmt = env.DB.prepare(query);
  const { results: rows } = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

  // Summary of 4 target provinces
  const provinceSummary = await env.DB.prepare(`
    SELECT 
      province_name,
      province_code,
      standing_area_rai,
      productive_area_rai,
      total_yield_fruit,
      yield_per_productive_rai
    FROM macro_district_stats
    WHERE is_total = 1 AND province_code != 'western_region'
    ORDER BY total_yield_fruit DESC
  `).all();

  return json({
    records: rows || [],
    provinceSummary: provinceSummary.results || [],
  });
}
