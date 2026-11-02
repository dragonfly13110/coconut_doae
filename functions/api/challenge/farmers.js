import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';
import { canUserEditDistrict, recordSystemAuditLog } from '../../../src/user-accounts.js';

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
  const targetProvince = url.searchParams.get('province_code');

  if (id) {
    const plot = await env.DB.prepare(`
      SELECT * FROM farmer_plots WHERE id = ?
    `).bind(Number(id)).first();

    if (!plot) {
      return json({ error: 'ไม่พบข้อมูลแปลงที่ระบุ' }, { status: 404 });
    }

    // Read access is open across all districts/provinces so users can inspect and compare
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

  if (targetProvince && targetProvince !== 'all') {
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

  let provinceCode = body.province_code || user.province_code || 'ratchaburi';
  if (['admin', 'central', 'region'].includes(user.role)) {
    provinceCode = body.province_code || 'ratchaburi';
  } else if (user.role === 'province') {
    provinceCode = user.province_code;
  }

  const farmerNo = body.farmer_no ? Number(body.farmer_no) : null;
  const plotLabel = String(body.plot_label || 'แปลงใหม่').trim();

  const title = String(body.title || '').trim();
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  let fullName = String(body.full_name || '').trim();
  if (firstName) {
    fullName = `${title ? title + ' ' : ''}${firstName} ${lastName}`.trim();
  }

  const addressNo = String(body.address_no || '').trim();
  const street = String(body.street || '').trim();
  const moo = String(body.moo || '').trim();
  const subdistrict = String(body.subdistrict || '').trim();
  const district = String(body.district || '').trim();
  const provinceName = String(body.province_name || '').trim();

  let address = String(body.address || '').trim();
  if (!address && (subdistrict || district)) {
    address = [
      addressNo,
      street ? `ถ.${street}` : '',
      moo ? `ม.${moo}` : '',
      subdistrict ? `ต.${subdistrict}` : '',
      district ? `อ.${district}` : '',
      provinceName ? `จ.${provinceName}` : ''
    ].filter(Boolean).join(' ');
  }

  const age = body.age ? Number(body.age) : null;
  const phone = String(body.phone || '').trim();
  const totalArea = Number(body.total_area_rai) || 0;
  const productiveArea = Number(body.productive_area_rai) || 0;
  const plantAge = Number(body.plant_age_years) || 0;
  const treesPerRai = Number(body.trees_per_rai) || 0;

  const coordZone = String(body.coord_zone || '47').trim();
  const coordX = body.coord_x ? Number(body.coord_x) : null;
  const coordY = body.coord_y ? Number(body.coord_y) : null;
  const coordX1 = body.coord_x1 ? Number(body.coord_x1) : null;
  const coordY1 = body.coord_y1 ? Number(body.coord_y1) : null;
  const coordX2 = body.coord_x2 ? Number(body.coord_x2) : null;
  const coordY2 = body.coord_y2 ? Number(body.coord_y2) : null;
  const coordX3 = body.coord_x3 ? Number(body.coord_x3) : null;
  const coordY3 = body.coord_y3 ? Number(body.coord_y3) : null;
  const coordX4 = body.coord_x4 ? Number(body.coord_x4) : null;
  const coordY4 = body.coord_y4 ? Number(body.coord_y4) : null;

  const standard = String(body.production_standard || 'GAP').trim();
  const soilSeries = String(body.soil_series || '').trim();
  const productionCost = Number(body.production_cost_per_rai) || 0;
  const avgIncome = Number(body.avg_income_per_rai) || 0;

  // Enforce Permission Check: District officers can only edit their own district!
  if (!canUserEditDistrict(user, provinceCode, district)) {
    return json({
      error: `ท่านไม่มีสิทธิ์บันทึก/แก้ไขแปลงนอกเขตพื้นที่รับผิดชอบ (เฉพาะอำเภอ ${user.district_name || user.province_label})`,
    }, { status: 403 });
  }

  if (id) {
    const beforePlot = await env.DB.prepare('SELECT * FROM farmer_plots WHERE id = ?').bind(id).first();
    if (!beforePlot) {
      return json({ error: 'ไม่พบข้อมูลแปลงที่ต้องการแก้ไข' }, { status: 404 });
    }

    if (!canUserEditDistrict(user, beforePlot.province_code, beforePlot.district)) {
      return json({
        error: `ท่านไม่มีสิทธิ์แก้ไขแปลงนี้ (อยู่นอกพื้นที่รับผิดชอบของท่าน)`,
      }, { status: 403 });
    }

    await env.DB.prepare(`
      UPDATE farmer_plots SET
        farmer_no = ?,
        plot_label = ?,
        title = ?,
        first_name = ?,
        last_name = ?,
        full_name = ?,
        address_no = ?,
        street = ?,
        moo = ?,
        subdistrict = ?,
        district = ?,
        province_name = ?,
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
        coord_x1 = ?,
        coord_y1 = ?,
        coord_x2 = ?,
        coord_y2 = ?,
        coord_x3 = ?,
        coord_y3 = ?,
        coord_x4 = ?,
        coord_y4 = ?,
        production_standard = ?,
        soil_series = ?,
        production_cost_per_rai = ?,
        avg_income_per_rai = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      farmerNo, plotLabel, title, firstName, lastName, fullName,
      addressNo, street, moo, subdistrict, district, provinceName, address,
      age, phone, totalArea, productiveArea, plantAge, treesPerRai,
      coordZone, coordX, coordY,
      coordX1, coordY1, coordX2, coordY2, coordX3, coordY3, coordX4, coordY4,
      standard, soilSeries, productionCost, avgIncome,
      id
    ).run();

    await recordSystemAuditLog(env.DB, {
      action: 'update',
      targetType: 'plot',
      targetId: id,
      targetLabel: `${plotLabel} (${fullName})`,
      provinceCode: beforePlot.province_code,
      districtName: district || beforePlot.district,
      user,
      summary: `แก้ไขข้อมูลแปลง ${plotLabel} (${fullName}) อ.${district || beforePlot.district || '-'}`,
      beforeData: beforePlot,
      afterData: body,
    });

    return json({ success: true, id, message: 'บันทึกการแก้ไขข้อมูลแปลงสำเร็จ' });
  }

  // Insert new
  const result = await env.DB.prepare(`
    INSERT INTO farmer_plots 
    (
      province_code, farmer_no, plot_label, title, first_name, last_name, full_name,
      address_no, street, moo, subdistrict, district, province_name, address,
      age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai,
      coord_zone, coord_x, coord_y, coord_x1, coord_y1, coord_x2, coord_y2, coord_x3, coord_y3, coord_x4, coord_y4,
      production_standard, soil_series, production_cost_per_rai, avg_income_per_rai
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    provinceCode, farmerNo, plotLabel, title, firstName, lastName, fullName,
    addressNo, street, moo, subdistrict, district, provinceName, address,
    age, phone, totalArea, productiveArea, plantAge, treesPerRai,
    coordZone, coordX, coordY,
    coordX1, coordY1, coordX2, coordY2, coordX3, coordY3, coordX4, coordY4,
    standard, soilSeries, productionCost, avgIncome
  ).run();

  const newId = result.meta?.last_row_id;

  await recordSystemAuditLog(env.DB, {
    action: 'create',
    targetType: 'plot',
    targetId: newId,
    targetLabel: `${plotLabel} (${fullName})`,
    provinceCode,
    districtName: district,
    user,
    summary: `เพิ่มแปลงเกษตรกรใหม่ ${plotLabel} (${fullName}) อ.${district || '-'}`,
    beforeData: null,
    afterData: body,
  });

  return json({ success: true, id: newId, message: 'เพิ่มข้อมูลเกษตรกรและแปลงใหม่สำเร็จ' });
}

async function deleteFarmer(request, env, user) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) {
    return json({ error: 'ระบุรหัสแปลงที่ต้องการลบ' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT * FROM farmer_plots WHERE id = ?').bind(id).first();
  if (!existing) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  if (!canUserEditDistrict(user, existing.province_code, existing.district)) {
    return json({ error: 'ไม่มีสิทธิ์ลบแปลงนอกเขตพื้นที่รับผิดชอบของท่าน' }, { status: 403 });
  }

  await recordSystemAuditLog(env.DB, {
    action: 'delete',
    targetType: 'plot',
    targetId: id,
    targetLabel: `${existing.plot_label} (${existing.full_name})`,
    provinceCode: existing.province_code,
    districtName: existing.district,
    user,
    summary: `ลบแปลงเกษตรกร ${existing.plot_label} (${existing.full_name}) อ.${existing.district || '-'}`,
    beforeData: existing,
    afterData: null,
  });

  // Cascade delete
  await env.DB.prepare('DELETE FROM yield_forecasts WHERE plot_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM harvest_cuts WHERE plot_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM farmer_plots WHERE id = ?').bind(id).run();

  return json({ success: true, message: 'ลบข้อมูลแปลงเรียบร้อยแล้ว' });
}
