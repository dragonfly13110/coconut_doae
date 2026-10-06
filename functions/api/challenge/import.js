import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    const body = await readJson(request);
    const { plots = [], forecasts = [], harvestCuts = [], macroStats = [] } = body;

    let plotsImported = 0;
    let forecastsImported = 0;
    let cutsImported = 0;
    let macroImported = 0;

    // 1. Import plots
    for (const p of plots) {
      const pCode = user.role === 'admin' ? (p.province_code || 'ratchaburi') : user.province_code;
      if (user.role !== 'admin' && p.province_code && p.province_code !== user.province_code) {
        continue;
      }
      if (!p.full_name) continue;

      const res = await env.DB.prepare(`
        INSERT INTO farmer_plots 
        (province_code, farmer_no, plot_label, full_name, address, age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai, coord_zone, coord_x, coord_y, production_standard, soil_series)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        pCode,
        p.farmer_no ? Number(p.farmer_no) : null,
        p.plot_label || 'แปลงนำเข้า',
        p.full_name,
        p.address || '',
        p.age ? Number(p.age) : null,
        p.phone || '',
        Number(p.total_area_rai || 0),
        Number(p.productive_area_rai || 0),
        Number(p.plant_age_years || 0),
        Number(p.trees_per_rai || 0),
        p.coord_zone || '47P',
        p.coord_x ? Number(p.coord_x) : null,
        p.coord_y ? Number(p.coord_y) : null,
        p.production_standard || 'GAP',
        p.soil_series || ''
      ).run();
      plotsImported++;
    }

    // 2. Import forecasts
    for (const f of forecasts) {
      if (!f.plot_id || !f.bunch_no || !f.harvest_month || !f.fruit_count) continue;
      await env.DB.prepare(`
        INSERT INTO yield_forecasts
        (plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, fruit_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(plot_id, point_label, tree_position, bunch_no, harvest_month)
        DO UPDATE SET fruit_count = excluded.fruit_count, updated_at = CURRENT_TIMESTAMP
      `).bind(
        Number(f.plot_id),
        f.province_code || 'ratchaburi',
        Number(f.tree_no || 1),
        f.tree_position || 'C',
        f.point_label || 'จุดที่ 1',
        Number(f.bunch_no),
        Number(f.harvest_month),
        Number(f.fruit_count)
      ).run();
      forecastsImported++;
    }

    // 3. Import harvest cuts
    for (const c of harvestCuts) {
      if (!c.plot_id) continue;
      await env.DB.prepare(`
        INSERT INTO harvest_cuts
        (plot_id, province_code, farmer_name, cut_round, cut_date, total_yield, yield_per_rai, trees_per_rai, yield_per_tree, price_per_fruit, twin_fruits, damaged_fruits, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        Number(c.plot_id),
        c.province_code || 'ratchaburi',
        c.farmer_name || '',
        Number(c.cut_round || 1),
        c.cut_date || new Date().toISOString().slice(0, 10),
        Number(c.total_yield || 0),
        c.yield_per_rai ? Number(c.yield_per_rai) : null,
        c.trees_per_rai ? Number(c.trees_per_rai) : null,
        c.yield_per_tree ? Number(c.yield_per_tree) : null,
        c.price_per_fruit ? Number(c.price_per_fruit) : null,
        Number(c.twin_fruits || 0),
        Number(c.damaged_fruits || 0),
        c.notes || ''
      ).run();
      cutsImported++;
    }

    // 4. Import macro stats (admin only)
    if (user.role === 'admin' && macroStats.length > 0) {
      for (const m of macroStats) {
        if (!m.province_name || !m.district_name) continue;
        await env.DB.prepare(`
          INSERT OR REPLACE INTO macro_district_stats
          (region, province_code, province_name, district_name, year, standing_area_rai, productive_area_rai, total_yield_fruit, yield_per_productive_rai, is_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          m.region || 'ภาคตะวันตก',
          m.province_code || 'ratchaburi',
          m.province_name,
          m.district_name,
          Number(m.year || 2569),
          Number(m.standing_area_rai || 0),
          Number(m.productive_area_rai || 0),
          Number(m.total_yield_fruit || 0),
          Number(m.yield_per_productive_rai || 0),
          m.is_total ? 1 : 0
        ).run();
        macroImported++;
      }
    }

    return json({
      success: true,
      message: `นำเข้าข้อมูลสำเร็จ: แปลง ${plotsImported} รายการ, คาดการณ์ ${forecastsImported} จุด, รอบตัด ${cutsImported} รายการ, สถิติ 2569 ${macroImported} รายการ`,
      stats: { plotsImported, forecastsImported, cutsImported, macroImported }
    });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}
