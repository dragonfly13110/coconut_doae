import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') return listOrGetFarmers(request, env, user);
    if (request.method === 'POST') return saveFarmer(request, env, user);
    if (request.method === 'DELETE') return deleteFarmer(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function listOrGetFarmers(request, env, user) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const targetProvince = user.role === 'admin' ? url.searchParams.get('province_code') : user.province_code;

  if (id) {
    const plot = await env.DB.prepare(`
      SELECT * FROM farmer_plots WHERE id = ?
    `).bind(Number(id)).first();

    if (!plot) {
      return json({ error: 'ไม่พบข้อมูลแปลงที่ระบุ' }, { status: 404 });
    }

    if (user.role !== 'admin' && plot.province_code !== user.province_code) {
      return json({ error: 'ไม่มีสิทธิ์เข้าถึงแปลงของจังหวัดอื่น' }, { status: 403 });
    }

    // Get harvest counts summary
    const harvestStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_cuts,
        COALESCE(SUM(total_yield), 0) as sum_yield,
        COALESCE(AVG(yield_per_rai), 0) as avg_yield_per_rai,
        COALESCE(SUM(twin_fruits), 0) as sum_twin,
        COALESCE(SUM(damaged_fruits), 0) as sum_damaged,
        COALESCE(AVG(price_per_fruit), 0) as avg_price
      FROM harvest_cuts
      WHERE plot_id = ?
    `).bind(Number(id)).first();

    return json({ plot, harvestStats });
  }

  let query = 'SELECT * FROM farmer_plots';
  const bindings = [];

  if (targetProvince) {
    query += ' WHERE province_code = ?';
    bindings.push(targetProvince);
  }
  query += ' ORDER BY id ASC, province_code ASC';

  const stmt = env.DB.prepare(query);
  const { results: plots } = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

  return json({ plots: plots || [] });
}

async function saveFarmer(request, env, user) {
  const body = await readJson(request);
  const id = body.id ? Number(body.id) : null;
  const provinceCode = user.role === 'admin' ? (body.province_code || 'ratchaburi') : user.province_code;

  const farmerNo = body.farmer_no ? Number(body.farmer_no) : null;
  const plotLabel = String(body.plot_label || 'แปลงใหม่').trim();
  const fullName = String(body.full_name || '').trim();
  if (!fullName) {
    return json({ error: 'กรุณาระบุชื่อ - สกุล เกษตรกร' }, { status: 400 });
  }

  const address = String(body.address || '').trim();
  const age = body.age ? Number(body.age) : null;
  const phone = String(body.phone || '').trim();
  const totalArea = Number(body.total_area_rai || 0);
  const productiveArea = Number(body.productive_area_rai || 0);
  const plantAge = Number(body.plant_age_years || 0);
  const treesPerRai = Number(body.trees_per_rai || 0);
  const coordZone = String(body.coord_zone || '47P').trim();
  const coordX = body.coord_x ? Number(body.coord_x) : null;
  const coordY = body.coord_y ? Number(body.coord_y) : null;
  const standard = String(body.production_standard || 'GAP').trim();
  const soilSeries = String(body.soil_series || '').trim();

  if (id) {
    // Check permission
    const existing = await env.DB.prepare('SELECT province_code FROM farmer_plots WHERE id = ?').bind(id).first();
    if (!existing) {
      return json({ error: 'ไม่พบข้อมูลแปลงที่ต้องการแก้ไข' }, { status: 404 });
    }
    if (user.role !== 'admin' && existing.province_code !== user.province_code) {
      return json({ error: 'ไม่มีสิทธิ์แก้ไขแปลงของจังหวัดอื่น' }, { status: 403 });
    }

    await env.DB.prepare(`
      UPDATE farmer_plots
      SET 
        farmer_no = ?,
        plot_label = ?,
        full_name = ?,
        address = ?,
        age = ?,
        phone = ?,
        total_area_rai = ?,
        productive_area_rai = ?,
        plant_age_years = ?,
        trees_per_rai = ?,
        coord_zone = ?,
        coord_x = ?,
        coord_y = ?,
        production_standard = ?,
        soil_series = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      farmerNo, plotLabel, fullName, address, age, phone,
      totalArea, productiveArea, plantAge, treesPerRai,
      coordZone, coordX, coordY, standard, soilSeries,
      id
    ).run();

    return json({ success: true, id, message: 'บันทึกการแก้ไขข้อมูลแปลงสำเร็จ' });
  }

  // Insert new
  const result = await env.DB.prepare(`
    INSERT INTO farmer_plots 
    (province_code, farmer_no, plot_label, full_name, address, age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai, coord_zone, coord_x, coord_y, production_standard, soil_series)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    provinceCode, farmerNo, plotLabel, fullName, address, age, phone,
    totalArea, productiveArea, plantAge, treesPerRai,
    coordZone, coordX, coordY, standard, soilSeries
  ).run();

  const newId = result.meta?.last_row_id;
  return json({ success: true, id: newId, message: 'เพิ่มข้อมูลเกษตรกรและแปลงใหม่สำเร็จ' });
}

async function deleteFarmer(request, env, user) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) {
    return json({ error: 'ระบุรหัสแปลงที่ต้องการลบ' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT province_code FROM farmer_plots WHERE id = ?').bind(id).first();
  if (!existing) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }
  if (user.role !== 'admin' && existing.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์ลบแปลงของจังหวัดอื่น' }, { status: 403 });
  }

  // Cascade delete
  await env.DB.prepare('DELETE FROM yield_forecasts WHERE plot_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM harvest_cuts WHERE plot_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM farmer_plots WHERE id = ?').bind(id).run();

  return json({ success: true, message: 'ลบข้อมูลแปลงเรียบร้อยแล้ว' });
}
