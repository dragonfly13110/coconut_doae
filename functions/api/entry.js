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
    SELECT quality, below, damaged, weight, circum, notes, price_standard, price_below, recorded_at
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
  `).bind(input.round, input.province_code, input.plot, input.bunch).first();

  let entry = row || null;
  if (entry) {
    if (entry.price_standard === null || entry.price_below === null) {
      const otherBunch = 3 - input.bunch;
      const otherRow = await env.DB.prepare(`
        SELECT price_standard, price_below
        FROM entries
        WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
      `).bind(input.round, input.province_code, input.plot, otherBunch).first();
      if (otherRow) {
        if (entry.price_standard === null) entry.price_standard = otherRow.price_standard;
        if (entry.price_below === null) entry.price_below = otherRow.price_below;
      }
    }
  } else {
    // If current bunch doesn't exist, check if other bunch of the plot has prices
    const otherBunch = 3 - input.bunch;
    const otherRow = await env.DB.prepare(`
      SELECT price_standard, price_below
      FROM entries
      WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
    `).bind(input.round, input.province_code, input.plot, otherBunch).first();
    if (otherRow && (otherRow.price_standard !== null || otherRow.price_below !== null)) {
      entry = {
        price_standard: otherRow.price_standard,
        price_below: otherRow.price_below
      };
    }
  }

  return json({ entry });
}

async function saveEntry(request, env, user) {
  const body = await readJson(request);
  const input = normalizeEntryInput({
    ...body,
    province_code: user.role === 'admin' ? body.province_code : user.province_code,
  });

  // 1. Insert/Update the current bunch
  await env.DB.prepare(`
    INSERT INTO entries (
      round, province_code, plot, bunch, quality, below, damaged,
      weight, circum, notes, price_standard, price_below, recorded_at, recorded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(round, province_code, plot, bunch) DO UPDATE SET
      quality = excluded.quality,
      below = excluded.below,
      damaged = excluded.damaged,
      weight = excluded.weight,
      circum = excluded.circum,
      notes = excluded.notes,
      price_standard = excluded.price_standard,
      price_below = excluded.price_below,
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
    input.price_standard,
    input.price_below,
    user.id,
  ).run();

  // 2. Synchronize prices to both bunches of this plot
  await env.DB.prepare(`
    UPDATE entries
    SET price_standard = ?, price_below = ?
    WHERE round = ? AND province_code = ? AND plot = ?
  `).bind(input.price_standard, input.price_below, input.round, input.province_code, input.plot).run();

  return json({ ok: true, entry: input });
}
