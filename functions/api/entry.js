import { normalizeEntryInput } from '../../src/core.js';
import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return loadEntry(request, env, user);
    if (request.method === 'POST') return saveEntry(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function loadEntry(request, env, user) {
  const url = new URL(request.url);
  const input = normalizeEntryInput({
    round: url.searchParams.get('round'),
    province_code: user.role === 'admin' ? url.searchParams.get('province_code') : user.province_code,
    plot: url.searchParams.get('plot'),
    bunch: url.searchParams.get('bunch'),
    quality: 0,
    below: 0,
    damaged: 0,
  });

  const row = await env.DB.prepare(`
    SELECT quality, below, damaged, weight, circum, notes, recorded_at
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
  `).bind(input.round, input.province_code, input.plot, input.bunch).first();

  return json({ entry: row || null });
}

async function saveEntry(request, env, user) {
  const body = await readJson(request);
  const input = normalizeEntryInput({
    ...body,
    province_code: user.role === 'admin' ? body.province_code : user.province_code,
  });

  await env.DB.prepare(`
    INSERT INTO entries (
      round, province_code, plot, bunch, quality, below, damaged,
      weight, circum, notes, recorded_at, recorded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(round, province_code, plot, bunch) DO UPDATE SET
      quality = excluded.quality,
      below = excluded.below,
      damaged = excluded.damaged,
      weight = excluded.weight,
      circum = excluded.circum,
      notes = excluded.notes,
      recorded_at = excluded.recorded_at,
      recorded_by = excluded.recorded_by
  `).bind(
    input.round,
    input.province_code,
    input.plot,
    input.bunch,
    input.quality,
    input.below,
    input.damaged,
    input.weight,
    input.circum,
    input.notes,
    user.id,
  ).run();

  return json({ ok: true, entry: input });
}
