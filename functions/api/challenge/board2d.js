import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb, computePlotBoard2D } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') {
      return getBoard2D(request, env, user);
    }
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function getBoard2D(request, env, user) {
  const url = new URL(request.url);
  const targetProvince = user.role === 'admin'
    ? (url.searchParams.get('province_code') || url.searchParams.get('province') || null)
    : user.province_code;

  let plotQuery = `
    SELECT id, province_code, farmer_no, plot_label, full_name, address, age, phone,
           total_area_rai, productive_area_rai, plant_age_years, trees_per_rai,
           coord_zone, coord_x, coord_y, production_standard, soil_series, updated_at
    FROM farmer_plots
  `;
  const plotBindings = [];

  if (targetProvince && targetProvince !== 'all') {
    plotQuery += ' WHERE province_code = ?';
    plotBindings.push(targetProvince);
  }
  plotQuery += ' ORDER BY province_code ASC, farmer_no ASC, id ASC';

  const { results: plots } = await env.DB.prepare(plotQuery).bind(...plotBindings).all();

  // Query forecast aggregated rows
  let forecastQuery = `
    SELECT plot_id, point_label, tree_position, SUM(fruit_count) as total_fruits, COUNT(*) as bunch_count
    FROM yield_forecasts
    WHERE fruit_count > 0
  `;
  const forecastBindings = [];
  if (targetProvince && targetProvince !== 'all') {
    forecastQuery += ' AND province_code = ?';
    forecastBindings.push(targetProvince);
  }
  forecastQuery += ' GROUP BY plot_id, point_label, tree_position';

  const { results: forecasts } = await env.DB.prepare(forecastQuery).bind(...forecastBindings).all();

  // Query harvest cuts aggregated rows
  let cutsQuery = `
    SELECT plot_id, COUNT(*) as cuts_count, SUM(total_yield) as total_cut_yield, MAX(cut_date) as cut_date
    FROM harvest_cuts
  `;
  const cutsBindings = [];
  if (targetProvince && targetProvince !== 'all') {
    cutsQuery += ' WHERE province_code = ?';
    cutsBindings.push(targetProvince);
  }
  cutsQuery += ' GROUP BY plot_id';

  const { results: cuts } = await env.DB.prepare(cutsQuery).bind(...cutsBindings).all();

  const boardData = computePlotBoard2D(plots || [], forecasts || [], cuts || []);

  return json({
    success: true,
    userRole: user.role,
    userProvince: user.province_code,
    ...boardData,
  });
}
