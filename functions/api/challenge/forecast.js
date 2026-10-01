import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb, SAMPLE_POINTS, SAMPLE_TREES } from '../../../src/challenge-db.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') return getForecast(request, env, user);
    if (request.method === 'POST') return saveForecast(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function getForecast(request, env, user) {
  const url = new URL(request.url);
  const plotId = Number(url.searchParams.get('plot_id'));
  const pointLabel = String(url.searchParams.get('point_label') || url.searchParams.get('point') || 'จุดที่ 1').trim();
  const treePos = String(url.searchParams.get('pos') || 'C').trim();

  if (!plotId) {
    return json({ error: 'กรุณาระบุรหัสแปลง (plot_id)' }, { status: 400 });
  }

  const plot = await env.DB.prepare('SELECT id, province_code, plot_label, full_name, productive_area_rai, trees_per_rai FROM farmer_plots WHERE id = ?').bind(plotId).first();
  if (!plot) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  if (user.role !== 'admin' && plot.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์เข้าถึงแปลงของจังหวัดอื่น' }, { status: 403 });
  }

  // Load forecast entries for this point and tree position
  const { results: entries } = await env.DB.prepare(`
    SELECT bunch_no, harvest_month, fruit_count
    FROM yield_forecasts
    WHERE plot_id = ? AND point_label = ? AND tree_position = ?
  `).bind(plotId, pointLabel, treePos).all();

  // Matrix: 20 bunches x 12 months
  const monthlyTotals = new Array(12).fill(0);
  let treeTotal = 0;

  const matrixMap = {};
  for (const item of (entries || [])) {
    const key = `${item.bunch_no}_${item.harvest_month}`;
    matrixMap[key] = item.fruit_count;
    if (item.harvest_month >= 1 && item.harvest_month <= 12) {
      monthlyTotals[item.harvest_month - 1] += item.fruit_count;
    }
    treeTotal += item.fruit_count;
  }

  // Plot-wide overview across all 7 points x 5 trees = 35 trees
  const { results: allTreeEntries } = await env.DB.prepare(`
    SELECT point_label, tree_position, harvest_month, SUM(fruit_count) as total_fruits
    FROM yield_forecasts
    WHERE plot_id = ?
    GROUP BY point_label, tree_position, harvest_month
  `).bind(plotId).all();

  const plotMonthlyTotals = new Array(12).fill(0);
  const treeTotalsByPointAndPos = {};
  const pointsSummary = {};

  for (const p of SAMPLE_POINTS) {
    pointsSummary[p.label] = {
      label: p.label,
      no: p.no,
      activeTrees: 0,
      totalFruits: 0,
      treeTotals: { C: 0, L: 0, R: 0, F: 0, B: 0 },
    };
  }

  let grandTotalFruits = 0;
  const distinctTreesWithData = new Set();

  for (const row of (allTreeEntries || [])) {
    const pLabel = row.point_label || 'จุดที่ 1';
    const pos = row.tree_position || 'C';
    const fruits = Number(row.total_fruits) || 0;

    if (row.harvest_month >= 1 && row.harvest_month <= 12) {
      plotMonthlyTotals[row.harvest_month - 1] += fruits;
    }

    if (!treeTotalsByPointAndPos[pLabel]) {
      treeTotalsByPointAndPos[pLabel] = { C: 0, L: 0, R: 0, F: 0, B: 0 };
    }
    treeTotalsByPointAndPos[pLabel][pos] = (treeTotalsByPointAndPos[pLabel][pos] || 0) + fruits;

    if (!pointsSummary[pLabel]) {
      pointsSummary[pLabel] = {
        label: pLabel,
        no: 1,
        activeTrees: 0,
        totalFruits: 0,
        treeTotals: { C: 0, L: 0, R: 0, F: 0, B: 0 },
      };
    }
    pointsSummary[pLabel].treeTotals[pos] = (pointsSummary[pLabel].treeTotals[pos] || 0) + fruits;
    pointsSummary[pLabel].totalFruits += fruits;

    if (fruits > 0) {
      distinctTreesWithData.add(`${pLabel}_${pos}`);
    }

    grandTotalFruits += fruits;
  }

  // Count active trees per point
  let activePointsCompleted = 0;
  let activePointsWithData = 0;

  for (const pLabel in pointsSummary) {
    const pt = pointsSummary[pLabel];
    let treesCount = 0;
    for (const pos in pt.treeTotals) {
      if (pt.treeTotals[pos] > 0) treesCount++;
    }
    pt.activeTrees = treesCount;
    if (treesCount === 5) activePointsCompleted++;
    if (treesCount > 0) activePointsWithData++;
  }

  const activeTreesCount = distinctTreesWithData.size;
  const totalTrees = SAMPLE_POINTS.length * SAMPLE_TREES.length; // 7 x 5 = 35 trees
  const avgFruitPerTree = activeTreesCount > 0 ? (grandTotalFruits / activeTreesCount) : 0;
  const estimatedPlotYieldPerYear = Math.round(avgFruitPerTree * (plot.trees_per_rai || 35) * (plot.productive_area_rai || 1));

  return json({
    plot,
    pointLabel,
    treePos,
    samplePoints: SAMPLE_POINTS,
    sampleTrees: SAMPLE_TREES,
    matrixMap,
    monthlyTotals,
    treeTotal,
    pointsSummary,
    plotSummary: {
      plotMonthlyTotals,
      grandTotalFruits,
      activeTreesCount,
      totalTrees,
      activePointsCompleted,
      activePointsWithData,
      totalPoints: SAMPLE_POINTS.length,
      avgFruitPerTree: Math.round(avgFruitPerTree * 10) / 10,
      estimatedPlotYieldPerYear,
    },
  });
}

async function saveForecast(request, env, user) {
  const body = await readJson(request);
  const plotId = Number(body.plot_id);
  const treeNo = Number(body.tree_no || 1);
  const treePos = String(body.tree_position || 'C').trim();
  const pointLabel = String(body.point_label || 'จุดที่ 1').trim();
  const entries = body.entries || [];

  if (!plotId) {
    return json({ error: 'ระบุรหัสแปลง (plot_id)' }, { status: 400 });
  }

  const plot = await env.DB.prepare('SELECT id, province_code FROM farmer_plots WHERE id = ?').bind(plotId).first();
  if (!plot) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  if (user.role !== 'admin' && plot.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์บันทึกแปลงของจังหวัดอื่น' }, { status: 403 });
  }

  // Begin saving entries
  for (const item of entries) {
    const bunchNo = Number(item.bunch_no);
    const harvestMonth = Number(item.harvest_month);
    const fruitCount = Math.max(0, Number(item.fruit_count || 0));

    if (fruitCount > 0) {
      await env.DB.prepare(`
        INSERT INTO yield_forecasts
        (plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, fruit_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(plot_id, point_label, tree_position, bunch_no, harvest_month)
        DO UPDATE SET fruit_count = excluded.fruit_count, updated_at = CURRENT_TIMESTAMP
      `).bind(
        plotId,
        plot.province_code,
        treeNo,
        treePos,
        pointLabel,
        bunchNo,
        harvestMonth,
        fruitCount
      ).run();
    } else {
      // If 0, delete record to keep DB lightweight
      await env.DB.prepare(`
        DELETE FROM yield_forecasts
        WHERE plot_id = ? AND point_label = ? AND tree_position = ? AND bunch_no = ? AND harvest_month = ?
      `).bind(plotId, pointLabel, treePos, bunchNo, harvestMonth).run();
    }
  }

  return json({ success: true, message: 'บันทึกข้อมูลคาดการณ์ผลผลิตเรียบร้อยแล้ว' });
}
