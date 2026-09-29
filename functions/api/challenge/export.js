import { generateChallengeExcelXml } from '../../../src/challenge-export.js';
import { authErrorResponse, methodNotAllowed, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    // 1. Plots
    let plotQuery = 'SELECT * FROM farmer_plots';
    const plotBindings = [];
    if (user.role !== 'admin') {
      plotQuery += ' WHERE province_code = ?';
      plotBindings.push(user.province_code);
    }
    plotQuery += ' ORDER BY id ASC';
    const { results: plots } = plotBindings.length > 0 ? await env.DB.prepare(plotQuery).bind(...plotBindings).all() : await env.DB.prepare(plotQuery).all();

    // 2. Forecasts
    let forecastQuery = 'SELECT * FROM yield_forecasts';
    const forecastBindings = [];
    if (user.role !== 'admin') {
      forecastQuery += ' WHERE province_code = ?';
      forecastBindings.push(user.province_code);
    }
    const { results: forecasts } = forecastBindings.length > 0 ? await env.DB.prepare(forecastQuery).bind(...forecastBindings).all() : await env.DB.prepare(forecastQuery).all();

    // 3. Harvest cuts
    let cutQuery = 'SELECT * FROM harvest_cuts';
    const cutBindings = [];
    if (user.role !== 'admin') {
      cutQuery += ' WHERE province_code = ?';
      cutBindings.push(user.province_code);
    }
    cutQuery += ' ORDER BY cut_round ASC';
    const { results: harvestCuts } = cutBindings.length > 0 ? await env.DB.prepare(cutQuery).bind(...cutBindings).all() : await env.DB.prepare(cutQuery).all();

    // 4. Macro stats
    const { results: macroStats } = await env.DB.prepare('SELECT * FROM macro_district_stats ORDER BY id ASC').all();

    const xml = generateChallengeExcelXml({
      plots: plots || [],
      forecasts: forecasts || [],
      harvestCuts: harvestCuts || [],
      macroStats: macroStats || []
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(xml, {
      headers: {
        'content-type': 'application/vnd.ms-excel; charset=utf-8',
        'content-disposition': `attachment; filename="coconut-challenge-export-${dateStr}.xls"`,
      },
    });
  } catch (error) {
    return authErrorResponse(error) || new Response(error.message, { status: 500 });
  }
}
