import { normalizeEntryInput, detectEntryAnomalies, CONFIG } from '../../src/core.js';
import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return getTemplate(request, env, user);
    if (request.method === 'POST') return handleBatchImport(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function getTemplate(request, env, user) {
  const url = new URL(request.url);
  const round = Number(url.searchParams.get('round')) || 1;
  const province = user.role === 'admin'
    ? (url.searchParams.get('province_code') || 'nakhon_pathom')
    : user.province_code;

  const maxPlots = CONFIG.maxPlots || 10;
  const bunchesPerPlot = CONFIG.bunchesPerPlot || 2;

  const headers = [
    'รอบการประเมิน',
    'รหัสจังหวัด',
    'แปลง',
    'ทะลาย',
    'จำนวนผล_1.80_ขึ้นไป_(จัมโบ้)',
    'จำนวนผล_1.40-1.79_(มาตรฐาน)',
    'จำนวนผล_1.20-1.39_(ในประเทศ)',
    'จำนวนผลต่ำกว่า_1.20_(ตกเกรด)',
    'น้ำหนักเฉลี่ย_(กก.)',
    'เส้นรอบวงเฉลี่ย_(ซม.)',
    'ราคาเกรด_1.80_ขึ้นไป_(บาท)',
    'ราคาเกรด_1.40-1.79_(บาท)',
    'ราคาเกรด_1.20-1.39_(บาท)',
    'ราคาเกรดต่ำกว่า_1.20_(บาท)',
    'หมายเหตุ',
  ];

  const rows = [];
  for (let plot = 1; plot <= maxPlots; plot++) {
    for (let bunch = 1; bunch <= bunchesPerPlot; bunch++) {
      rows.push([
        round,
        province,
        plot,
        bunch,
        0, // quality
        0, // below
        0, // domestic
        0, // damaged
        '', // weight
        '', // circum
        '', // price_standard
        '', // price_below
        '', // price_domestic
        '', // price_damaged
        '', // notes
      ].join(','));
    }
  }

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="DOAE_Coconut_Template_R${round}_${province}.csv"`,
    },
  });
}

async function handleBatchImport(request, env, user) {
  const body = await readJson(request);
  const rows = Array.isArray(body.entries) ? body.entries : [];
  const allowOverriddenAnomalies = Boolean(body.allow_anomalies);

  if (rows.length === 0) {
    return json({ error: 'ไม่พบข้อมูลรายการที่จะนำเข้า' }, { status: 400 });
  }

  if (rows.length > 200) {
    return json({ error: 'ไม่สามารถนำเข้าเกินครั้งละ 200 รายการได้' }, { status: 400 });
  }

  const validEntries = [];
  const errors = [];
  const detectedAnomalies = [];
  const recordedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      const province = user.role === 'admin'
        ? (raw.province_code || user.province_code)
        : user.province_code;

      const normalized = normalizeEntryInput({
        ...raw,
        province_code: province,
      });

      // Anomaly check
      const rowAnomalies = detectEntryAnomalies(normalized);
      if (rowAnomalies.length > 0) {
        detectedAnomalies.push({
          row: i + 1,
          plot: normalized.plot,
          bunch: normalized.bunch,
          round: normalized.round,
          anomalies: rowAnomalies,
        });
      }

      validEntries.push(normalized);
    } catch (err) {
      errors.push({ row: i + 1, error: err.message, data: raw });
    }
  }

  if (errors.length > 0) {
    return json({
      ok: false,
      error: `พบข้อผิดพลาดในการตรวจสอบข้อมูล ${errors.length} รายการ`,
      details: errors,
    }, { status: 400 });
  }

  // If there are severe anomalies and client has not explicitly confirmed override
  const severeCount = detectedAnomalies.filter((d) => d.anomalies.some((a) => a.level === 'error' || a.isExtraZeroSuspect)).length;
  if (severeCount > 0 && !allowOverriddenAnomalies) {
    return json({
      ok: false,
      require_confirmation: true,
      message: `ตรวจพบข้อมูลที่อาจมีเลข 0 เกิน หรือไม่สมเหตุสมผล ${severeCount} แถว`,
      anomalies: detectedAnomalies,
    }, { status: 422 });
  }

  // Execute batch database statements
  const statements = [];
  for (const entry of validEntries) {
    statements.push(env.DB.prepare(`
      INSERT INTO entries (
        round, province_code, plot, bunch, quality, below, domestic, damaged,
        weight, circum, notes, price_standard, price_below, price_domestic, price_damaged,
        recorded_at, recorded_by
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
      entry.round,
      entry.province_code,
      entry.plot,
      entry.bunch,
      entry.quality,
      entry.below,
      entry.domestic,
      entry.damaged,
      entry.weight,
      entry.circum,
      entry.notes,
      entry.price_standard,
      entry.price_below,
      entry.price_domestic,
      entry.price_damaged,
      recordedAt,
      user.id,
    ));

    // Audit row
    statements.push(env.DB.prepare(`
      INSERT INTO entry_audit_log (
        action, round, province_code, plot, bunch, changed_by, before_json, after_json
      ) VALUES ('update', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.round,
      entry.province_code,
      entry.plot,
      entry.bunch,
      user.id,
      JSON.stringify({ import_batch: true }),
      JSON.stringify({ ...entry, imported_at: recordedAt }),
    ));
  }

  await env.DB.batch(statements);

  return json({
    ok: true,
    imported_count: validEntries.length,
    anomalies_detected: detectedAnomalies.length,
  });
}
