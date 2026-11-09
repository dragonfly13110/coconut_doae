import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../../src/pages-api.js';
import { ensureChallengeDb, SAMPLE_POINTS, SAMPLE_TREES, calculatePlot2569BaselineForecast } from '../../../src/challenge-db.js';
import { canUserEditDistrict, recordSystemAuditLog } from '../../../src/user-accounts.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    await ensureChallengeDb(env.DB);

    if (request.method === 'GET') return await getForecast(request, env, user);
    if (request.method === 'POST') return await saveForecast(request, env, user);
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
  const districtParam = url.searchParams.get('district') ? String(url.searchParams.get('district')).trim() : null;
  const sampleTree = SAMPLE_TREES.find((t) => t.pos === treePos);
  const treeNo = Number(url.searchParams.get('tree_no') || sampleTree?.no || 1);
  const harvestYear = Number(url.searchParams.get('year') || url.searchParams.get('harvest_year') || 2570);

  if (!plotId) {
    return json({ error: 'กรุณาระบุรหัสแปลง (plot_id)' }, { status: 400 });
  }

  const plot = await env.DB.prepare('SELECT id, province_code, province_name, district, subdistrict, address, plot_label, full_name, productive_area_rai, total_area_rai, trees_per_rai FROM farmer_plots WHERE id = ?').bind(plotId).first();
  if (!plot) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  // Load forecast entries for this point and tree position (latest per bunch) scoped to harvestYear
  const { results: entries } = await env.DB.prepare(`
    SELECT bunch_no, harvest_month, fruit_count, id, harvest_year
    FROM yield_forecasts
    WHERE plot_id = ? AND point_label = ? AND tree_position = ? AND (harvest_year = ? OR (harvest_year IS NULL AND ? = 2570))
    ORDER BY id DESC
  `).bind(plotId, pointLabel, treePos, harvestYear, harvestYear).all();

  // Matrix: 20 bunches x 12 months
  const monthlyTotals = new Array(12).fill(0);
  let treeTotal = 0;

  const matrixMap = {};
  const seenBunches = new Set();
  (entries || []).forEach((row) => {
    if (seenBunches.has(row.bunch_no)) return;
    seenBunches.add(row.bunch_no);
    matrixMap[`${row.bunch_no}_${row.harvest_month}`] = row.fruit_count;
    matrixMap[row.bunch_no] = {
      month: row.harvest_month,
      fruitCount: row.fruit_count,
    };
    if (row.harvest_month >= 1 && row.harvest_month <= 12) {
      monthlyTotals[row.harvest_month - 1] += row.fruit_count;
      treeTotal += row.fruit_count;
    }
  });

  // Calculate sampling summary across all points and sample trees in this plot for selected harvestYear
  const { results: allPlotEntries } = await env.DB.prepare(`
    SELECT point_label, tree_position, bunch_no, harvest_month, fruit_count, harvest_year
    FROM yield_forecasts
    WHERE plot_id = ? AND (harvest_year = ? OR (harvest_year IS NULL AND ? = 2570))
    ORDER BY id DESC
  `).bind(plotId, harvestYear, harvestYear).all();

  const plotMonthlyTotals = new Array(12).fill(0);
  let grandTotalFruits = 0;
  const activeTreesSet = new Set();
  const completedPointsSet = new Set();
  const pointsSummary = {};

  SAMPLE_POINTS.forEach((p) => {
    pointsSummary[p.label] = {
      completedTrees: 0,
      activeTrees: 0,
      totalTrees: SAMPLE_TREES.length,
      fruitCount: 0,
      treeTotals: {},
    };
  });

  const seenTreeBunches = new Set();
  (allPlotEntries || []).forEach((row) => {
    const key = `${row.point_label}:${row.tree_position}:${row.bunch_no}`;
    if (seenTreeBunches.has(key)) return;
    seenTreeBunches.add(key);

    const treeKey = `${row.point_label}:${row.tree_position}`;
    activeTreesSet.add(treeKey);

    if (row.harvest_month >= 1 && row.harvest_month <= 12) {
      plotMonthlyTotals[row.harvest_month - 1] += row.fruit_count;
      grandTotalFruits += row.fruit_count;
    }

    if (pointsSummary[row.point_label]) {
      pointsSummary[row.point_label].fruitCount += row.fruit_count;
      if (!pointsSummary[row.point_label].treeTotals) {
        pointsSummary[row.point_label].treeTotals = {};
      }
      pointsSummary[row.point_label].treeTotals[row.tree_position] = 
        (pointsSummary[row.point_label].treeTotals[row.tree_position] || 0) + row.fruit_count;
    }
  });

  // Count completed trees per point
  SAMPLE_POINTS.forEach((p) => {
    let treeCount = 0;
    SAMPLE_TREES.forEach((t) => {
      const treeKey = `${p.label}:${t.pos}`;
      if (activeTreesSet.has(treeKey)) treeCount += 1;
    });
    if (pointsSummary[p.label]) {
      pointsSummary[p.label].completedTrees = treeCount;
      pointsSummary[p.label].activeTrees = treeCount;
      if (treeCount === SAMPLE_TREES.length) {
        completedPointsSet.add(p.label);
      }
    }
  });

  const totalTrees = SAMPLE_POINTS.length * SAMPLE_TREES.length; // 7 points x 5 trees = 35 sample trees
  const activeTreesCount = activeTreesSet.size;
  const activePointsCompleted = completedPointsSet.size;
  const activePointsWithData = Object.values(pointsSummary).filter((p) => p.completedTrees > 0).length;

  const avgFruitPerTree = activeTreesCount > 0 ? (grandTotalFruits / activeTreesCount) : 0;
  const estimatedPlotYieldPerYear = Math.round(avgFruitPerTree * (plot.trees_per_rai || 0) * (plot.productive_area_rai || 0));

  // Compute baseline forecast using official 2569 stats (prior anchor)
  const baseline2569 = calculatePlot2569BaselineForecast(plot, undefined, districtParam);
  if (env.DEMO_MODE === 'true' && baseline2569) {
    const sampleMonthlyShares = [9, 9, 8, 7, 6, 6, 7, 9, 10, 10, 10, 9];
    baseline2569.isDemo = true;
    baseline2569.source = 'ข้อมูลจำลองสำหรับสาธิต';
    baseline2569.monthlyDistribution = baseline2569.monthlyDistribution.map((month, index) => ({
      ...month,
      percent: sampleMonthlyShares[index],
      estimatedFruits: Math.round(baseline2569.totalAnnualYield * sampleMonthlyShares[index] / 100),
    }));
  }

  return json({
    plot,
    pointLabel,
    treePos,
    treeNo,
    harvestYear,
    samplePoints: SAMPLE_POINTS,
    sampleTrees: SAMPLE_TREES,
    matrixMap,
    monthlyTotals,
    treeTotal,
    pointsSummary,
    baseline2569,
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
  const harvestYear = Number(body.harvest_year || body.year || 2570);
  const entries = body.entries || [];

  if (!plotId) {
    return json({ error: 'ระบุรหัสแปลง (plot_id)' }, { status: 400 });
  }

  const plot = await env.DB.prepare('SELECT id, province_code, district, plot_label, full_name FROM farmer_plots WHERE id = ?').bind(plotId).first();
  if (!plot) {
    return json({ error: 'ไม่พบข้อมูลแปลง' }, { status: 404 });
  }

  if (!canUserEditDistrict(user, plot.province_code, plot.district)) {
    return json({ error: 'ไม่มีสิทธิ์บันทึกข้อมูลนอกเขตพื้นที่รับผิดชอบของท่าน' }, { status: 403 });
  }

  // Deduplicate entries by bunch_no (1 bunch only belongs to 1 month per tree, last-write-wins)
  const bunchMap = new Map();
  for (const item of entries) {
    const bunchNo = Number(item.bunch_no);
    const harvestMonth = Number(item.harvest_month);
    const fruitCount = Math.max(0, Number(item.fruit_count || 0));

    // Year 2569: Only late year months 11 (พ.ย.) and 12 (ธ.ค.) are open for entry
    if (harvestYear === 2569 && (harvestMonth < 11 || harvestMonth > 12)) {
      continue;
    }

    if (bunchNo >= 1 && bunchNo <= 20 && harvestMonth >= 1 && harvestMonth <= 12) {
      if (fruitCount > 0) {
        bunchMap.set(bunchNo, { bunchNo, harvestMonth, fruitCount });
      } else {
        bunchMap.delete(bunchNo);
      }
    }
  }

  // Cleanly clear existing rows for this specific tree and year so other years are safely preserved
  await env.DB.prepare(`
    DELETE FROM yield_forecasts
    WHERE plot_id = ? AND point_label = ? AND tree_position = ? AND (harvest_year = ? OR (harvest_year IS NULL AND ? = 2570))
  `).bind(plotId, pointLabel, treePos, harvestYear, harvestYear).run();

  // Insert fresh entries
  for (const item of bunchMap.values()) {
    await env.DB.prepare(`
      INSERT INTO yield_forecasts
      (plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, fruit_count, updated_at, harvest_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(
      plotId,
      plot.province_code,
      treeNo,
      treePos,
      pointLabel,
      item.bunchNo,
      item.harvestMonth,
      item.fruitCount,
      harvestYear
    ).run();
  }

  await recordSystemAuditLog(env.DB, {
    action: 'update',
    targetType: 'forecast',
    targetId: plotId,
    targetLabel: `${plot.plot_label} (${pointLabel} ต้นที่ ${treeNo} ปี ${harvestYear})`,
    provinceCode: plot.province_code,
    districtName: plot.district,
    user,
    summary: `บันทึกคาดการณ์ผลผลิตปี ${harvestYear} ${plot.plot_label} ${pointLabel} ต้นที่ ${treeNo} (${treePos}) รวม ${bunchMap.size} ทะลาย`,
    beforeData: null,
    afterData: { harvestYear, pointLabel, treeNo, treePos, bunchCount: bunchMap.size },
  });

  return json({ success: true, message: `บันทึกข้อมูลคาดการณ์ผลผลิตปี ${harvestYear} เรียบร้อยแล้ว`, harvestYear });
}
