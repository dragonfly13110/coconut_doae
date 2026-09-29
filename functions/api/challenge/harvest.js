import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') return listHarvestCuts(request, env, user);
    if (request.method === 'POST') return saveHarvestCut(request, env, user);
    if (request.method === 'DELETE') return deleteHarvestCut(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function listHarvestCuts(request, env, user) {
  const url = new URL(request.url);
  const plotId = url.searchParams.get('plot_id');
  const targetProvince = user.role === 'admin' ? url.searchParams.get('province_code') : user.province_code;

  let query = `
    SELECT 
      hc.*,
      fp.plot_label,
      fp.full_name as farmer_profile_name,
      fp.productive_area_rai
    FROM harvest_cuts hc
    JOIN farmer_plots fp ON hc.plot_id = fp.id
  `;
  const conditions = [];
  const bindings = [];

  if (plotId) {
    conditions.push('hc.plot_id = ?');
    bindings.push(Number(plotId));
  }
  if (targetProvince) {
    conditions.push('hc.province_code = ?');
    bindings.push(targetProvince);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY hc.cut_round ASC, hc.cut_date DESC';

  const stmt = env.DB.prepare(query);
  const { results: cuts } = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

  // Calculate overall metrics
  let totalYield = 0;
  let totalRevenue = 0;
  let totalTwin = 0;
  let totalDamaged = 0;

  for (const c of (cuts || [])) {
    totalYield += (c.total_yield || 0);
    totalRevenue += (c.total_yield || 0) * (c.price_per_fruit || 0);
    totalTwin += (c.twin_fruits || 0);
    totalDamaged += (c.damaged_fruits || 0);
  }

  const damagePercent = totalYield > 0 ? Math.round((totalDamaged / totalYield) * 1000) / 10 : 0;
  const twinPercent = totalYield > 0 ? Math.round((totalTwin / totalYield) * 1000) / 10 : 0;

  return json({
    cuts: cuts || [],
    summary: {
      totalCuts: (cuts || []).length,
      totalYield,
      totalRevenue: Math.round(totalRevenue),
      totalTwin,
      totalDamaged,
      damagePercent,
      twinPercent,
    }
  });
}

async function saveHarvestCut(request, env, user) {
  const body = await readJson(request);
  const id = body.id ? Number(body.id) : null;
  const plotId = Number(body.plot_id);

  if (!plotId) {
    return json({ error: 'กรุณาเลือกแปลงเกษตรกร' }, { status: 400 });
  }

  const plot = await env.DB.prepare('SELECT id, province_code, full_name, productive_area_rai FROM farmer_plots WHERE id = ?').bind(plotId).first();
  if (!plot) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  if (user.role !== 'admin' && plot.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์บันทึกข้อมูลแปลงของจังหวัดอื่น' }, { status: 403 });
  }

  const cutRound = Number(body.cut_round || 1);
  const cutDate = String(body.cut_date || '').trim() || new Date().toISOString().slice(0, 10);
  const totalYield = Math.max(0, Number(body.total_yield || 0));
  const price = body.price_per_fruit !== undefined && body.price_per_fruit !== '' ? Number(body.price_per_fruit) : null;
  const twin = Math.max(0, Number(body.twin_fruits || 0));
  const damaged = Math.max(0, Number(body.damaged_fruits || 0));
  const notes = String(body.notes || '').trim();

  // Calculate yield per rai
  let yieldPerRai = body.yield_per_rai !== undefined && body.yield_per_rai !== '' ? Number(body.yield_per_rai) : null;
  if (yieldPerRai === null && plot.productive_area_rai > 0) {
    yieldPerRai = Math.round((totalYield / plot.productive_area_rai) * 10) / 10;
  }

  if (id) {
    await env.DB.prepare(`
      UPDATE harvest_cuts
      SET 
        cut_round = ?,
        cut_date = ?,
        total_yield = ?,
        yield_per_rai = ?,
        price_per_fruit = ?,
        twin_fruits = ?,
        damaged_fruits = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(cutRound, cutDate, totalYield, yieldPerRai, price, twin, damaged, notes, id).run();

    return json({ success: true, id, message: 'บันทึกการแก้ไขรอบการตัดสำเร็จ' });
  }

  const result = await env.DB.prepare(`
    INSERT INTO harvest_cuts
    (plot_id, province_code, farmer_name, cut_round, cut_date, total_yield, yield_per_rai, price_per_fruit, twin_fruits, damaged_fruits, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    plotId,
    plot.province_code,
    plot.full_name,
    cutRound,
    cutDate,
    totalYield,
    yieldPerRai,
    price,
    twin,
    damaged,
    notes
  ).run();

  return json({ success: true, id: result.meta?.last_row_id, message: 'บันทึกข้อมูลรอบการตัดสำเร็จ' });
}

async function deleteHarvestCut(request, env, user) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) {
    return json({ error: 'ระบุรหัสข้อมูลรอบการตัดที่ต้องการลบ' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT province_code FROM harvest_cuts WHERE id = ?').bind(id).first();
  if (!existing) {
    return json({ error: 'ไม่พบรายการที่ต้องการลบ' }, { status: 404 });
  }

  if (user.role !== 'admin' && existing.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์ลบข้อมูลของจังหวัดอื่น' }, { status: 403 });
  }

  await env.DB.prepare('DELETE FROM harvest_cuts WHERE id = ?').bind(id).run();
  return json({ success: true, message: 'ลบรายการรอบการตัดเรียบร้อยแล้ว' });
}
