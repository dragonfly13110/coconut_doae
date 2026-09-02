import { normalizeEntryInput } from '../../src/core.js';
import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return loadEntry(request, env, user);
    if (request.method === 'POST') return saveEntry(request, env, user);
    if (request.method === 'DELETE') return deleteEntry(request, env, user);
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
    domestic: 0,
    damaged: 0,
  });

  const row = await env.DB.prepare(`
    SELECT quality, below, domestic, damaged, weight, circum, notes, price_standard, price_below, price_domestic, price_damaged, recorded_at
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
  `).bind(input.round, input.province_code, input.plot, input.bunch).first();

  let entry = row || null;
  if (entry) {
    if (entry.price_standard === null || entry.price_below === null || entry.price_domestic === null || entry.price_damaged === null) {
      const otherBunch = 3 - input.bunch;
      const otherRow = await env.DB.prepare(`
        SELECT price_standard, price_below, price_domestic, price_damaged
        FROM entries
        WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
      `).bind(input.round, input.province_code, input.plot, otherBunch).first();
      if (otherRow) {
        if (entry.price_standard === null) entry.price_standard = otherRow.price_standard;
        if (entry.price_below === null) entry.price_below = otherRow.price_below;
        if (entry.price_domestic === null) entry.price_domestic = otherRow.price_domestic;
        if (entry.price_damaged === null) entry.price_damaged = otherRow.price_damaged;
      }
    }
  } else {
    // If current bunch doesn't exist, check if other bunch of the plot has prices
    const otherBunch = 3 - input.bunch;
    const otherRow = await env.DB.prepare(`
      SELECT price_standard, price_below, price_domestic, price_damaged
      FROM entries
      WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
    `).bind(input.round, input.province_code, input.plot, otherBunch).first();
    if (otherRow && (otherRow.price_standard !== null || otherRow.price_below !== null || otherRow.price_domestic !== null || otherRow.price_damaged !== null)) {
      entry = {
        price_standard: otherRow.price_standard,
        price_below: otherRow.price_below,
        price_domestic: otherRow.price_domestic,
        price_damaged: otherRow.price_damaged
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

  const existing = await env.DB.prepare(`
    SELECT round, province_code, plot, bunch, quality, below, domestic, damaged,
      weight, circum, notes, price_standard, price_below, price_domestic, price_damaged,
      recorded_at, recorded_by
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
  `).bind(input.round, input.province_code, input.plot, input.bunch).first();
  const otherBunch = input.bunch === 1 ? 2 : 1;
  const otherExisting = await env.DB.prepare(`
    SELECT round, province_code, plot, bunch, quality, below, domestic, damaged,
      weight, circum, notes, price_standard, price_below, price_domestic, price_damaged,
      recorded_at, recorded_by
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ? AND bunch = ?
  `).bind(input.round, input.province_code, input.plot, otherBunch).first();
  const recordedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const before = snapshotEntry(existing);
  const after = snapshotEntry({ ...input, recorded_at: recordedAt, recorded_by: user.id });
  const statements = [env.DB.prepare(`
    INSERT INTO entries (
      round, province_code, plot, bunch, quality, below, domestic, damaged,
      weight, circum, notes, price_standard, price_below, price_domestic, price_damaged, recorded_at, recorded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(round, province_code, plot, bunch) DO UPDATE SET
      quality = excluded.quality,
      below = excluded.below,
      domestic = excluded.domestic,
      damaged = excluded.damaged,
      weight = excluded.weight,
      circum = excluded.circum,
      notes = excluded.notes,
      price_standard = excluded.price_standard,
      price_below = excluded.price_below,
      price_domestic = excluded.price_domestic,
      price_damaged = excluded.price_damaged,
      recorded_at = excluded.recorded_at,
      recorded_by = excluded.recorded_by
  `).bind(
    input.round,
    input.province_code,
    input.plot,
    input.bunch,
    input.quality,
    input.below,
    input.domestic,
    input.damaged,
    input.weight,
    input.circum,
    input.notes,
    input.price_standard,
    input.price_below,
    input.price_domestic,
    input.price_damaged,
    recordedAt,
    user.id,
  ), env.DB.prepare(`
    UPDATE entries
    SET price_standard = ?, price_below = ?, price_domestic = ?, price_damaged = ?
    WHERE round = ? AND province_code = ? AND plot = ?
  `).bind(
    input.price_standard,
    input.price_below,
    input.price_domestic,
    input.price_damaged,
    input.round,
    input.province_code,
    input.plot,
  ), auditStatement(env, {
    action: existing?.recorded_at ? 'update' : 'create',
    entry: after,
    before,
    after,
    userId: user.id,
  })];

  if (otherExisting) {
    const otherBefore = snapshotEntry(otherExisting);
    const otherAfter = snapshotEntry({
      ...otherExisting,
      price_standard: input.price_standard,
      price_below: input.price_below,
      price_domestic: input.price_domestic,
      price_damaged: input.price_damaged,
    });
    if (JSON.stringify(otherBefore) !== JSON.stringify(otherAfter)) {
      statements.push(auditStatement(env, {
        action: 'update',
        entry: otherAfter,
        before: otherBefore,
        after: otherAfter,
        userId: user.id,
      }));
    }
  }

  await env.DB.batch(statements);

  return json({ ok: true, entry: input });
}

async function deleteEntry(request, env, user) {
  const url = new URL(request.url);
  const input = normalizeEntryInput({
    round: url.searchParams.get('round'),
    province_code: user.role === 'admin' ? url.searchParams.get('province_code') : user.province_code,
    plot: url.searchParams.get('plot'),
    bunch: 1,
    quality: 0,
    below: 0,
    domestic: 0,
    damaged: 0,
  });

  const rows = await env.DB.prepare(`
    SELECT round, province_code, plot, bunch, quality, below, domestic, damaged,
      weight, circum, notes, price_standard, price_below, price_domestic, price_damaged,
      recorded_at, recorded_by
    FROM entries
    WHERE round = ? AND province_code = ? AND plot = ?
  `).bind(input.round, input.province_code, input.plot).all();
  const statements = [env.DB.prepare(`
    DELETE FROM entries
    WHERE round = ? AND province_code = ? AND plot = ?
  `).bind(input.round, input.province_code, input.plot)];

  for (const row of rows.results || []) {
    statements.push(auditStatement(env, {
      action: 'delete',
      entry: snapshotEntry(row),
      before: snapshotEntry(row),
      after: null,
      userId: user.id,
    }));
  }

  await env.DB.batch(statements);

  return json({ ok: true });
}

function auditStatement(env, { action, entry, before, after, userId }) {
  return env.DB.prepare(`
    INSERT INTO entry_audit_log (
      action, round, province_code, plot, bunch, changed_by, before_json, after_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    action,
    entry.round,
    entry.province_code,
    entry.plot,
    entry.bunch,
    userId,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
  );
}

function snapshotEntry(entry) {
  if (!entry) return null;
  return {
    round: Number(entry.round),
    province_code: String(entry.province_code),
    plot: Number(entry.plot),
    bunch: Number(entry.bunch),
    quality: Number(entry.quality) || 0,
    below: Number(entry.below) || 0,
    domestic: Number(entry.domestic) || 0,
    damaged: Number(entry.damaged) || 0,
    weight: entry.weight ?? null,
    circum: entry.circum ?? null,
    notes: String(entry.notes || ''),
    price_standard: entry.price_standard ?? null,
    price_below: entry.price_below ?? null,
    price_domestic: entry.price_domestic ?? null,
    price_damaged: entry.price_damaged ?? null,
    recorded_at: entry.recorded_at ?? null,
    recorded_by: entry.recorded_by ?? null,
  };
}
