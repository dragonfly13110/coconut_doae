import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChallengeExcelXml } from '../src/challenge-export.js';
import macroBaseline from '../src/macro-baseline.json' with { type: 'json' };
import { CHALLENGE_PROVINCES, SAMPLE_POINTS, SAMPLE_TREES, MONTH_NAMES, computePlotBoard2D } from '../src/challenge-db.js';

test('macro baseline contains 28 records for Western region and 4 provinces', () => {
  assert.equal(macroBaseline.length, 28);
  const regionTotal = macroBaseline.find((r) => r.province_code === 'western_region');
  assert.ok(regionTotal);
  assert.equal(regionTotal.standing_area_rai, 238578);
  assert.equal(regionTotal.productive_area_rai, 190001);
  assert.equal(regionTotal.total_yield_fruit, 464978826);
  assert.equal(regionTotal.yield_per_productive_rai, 2382);

  // Check Ratchaburi
  const rb = macroBaseline.find((r) => r.province_name === 'ราชบุรี' && r.is_total === 1);
  assert.ok(rb);
  assert.equal(rb.standing_area_rai, 121121);
});

test('challenge provinces, sample points (7), sample trees (5), and months are properly configured', () => {
  assert.equal(CHALLENGE_PROVINCES.length, 4);
  assert.equal(SAMPLE_POINTS.length, 7);
  assert.deepEqual(SAMPLE_POINTS.map((p) => p.label), [
    'จุดที่ 1', 'จุดที่ 2', 'จุดที่ 3', 'จุดที่ 4', 'จุดที่ 5', 'จุดที่ 6', 'จุดที่ 7',
  ]);
  assert.equal(SAMPLE_TREES.length, 5);
  assert.deepEqual(SAMPLE_TREES.map((t) => t.pos), ['C', 'L', 'R', 'F', 'B']);
  // Total sample trees per plot = 7 points x 5 trees = 35 trees
  assert.equal(SAMPLE_POINTS.length * SAMPLE_TREES.length, 35);
  assert.equal(MONTH_NAMES.length, 12);
  assert.equal(MONTH_NAMES[0], 'ม.ค.');
  assert.equal(MONTH_NAMES[11], 'ธ.ค.');
});

test('generateChallengeExcelXml creates all 4 worksheets with correct names', () => {
  const plots = [
    {
      id: 1,
      farmer_no: 1,
      plot_label: 'แปลงที่ 1',
      full_name: 'นายสมชาย มะพร้าวทอง',
      address: 'ดำเนินสะดวก',
      age: 48,
      phone: '0812345678',
      total_area_rai: 15,
      productive_area_rai: 12,
      plant_age_years: 7,
      trees_per_rai: 35,
      coord_zone: '47P',
      coord_x: 605420,
      coord_y: 1492310,
      production_standard: 'GAP',
      soil_series: 'ดำเนินสะดวก',
    },
  ];

  const forecasts = [
    { plot_id: 1, tree_position: 'C', bunch_no: 1, harvest_month: 1, fruit_count: 12 },
    { plot_id: 1, tree_position: 'C', bunch_no: 2, harvest_month: 2, fruit_count: 14 },
  ];

  const harvestCuts = [
    {
      plot_id: 1,
      farmer_name: 'นายสมชาย มะพร้าวทอง',
      province_code: 'ratchaburi',
      cut_round: 1,
      cut_date: '2026-01-15',
      total_yield: 2400,
      yield_per_rai: 200,
      price_per_fruit: 16.5,
      twin_fruits: 120,
      damaged_fruits: 85,
    },
  ];

  const xml = generateChallengeExcelXml({
    plots,
    forecasts,
    harvestCuts,
    macroStats: macroBaseline,
  });

  assert.ok(xml.includes('ss:Name="ข้อมูลทั่วไป (เก็บ 1 ครั้ง)"'));
  assert.ok(xml.includes('ss:Name="คาดการณ์ผลผลิต"'));
  assert.ok(xml.includes('ss:Name="ผลผลิตในรอบการตัด"'));
  assert.ok(xml.includes('ss:Name="ข้อมูลพื้นที่ ผลผลิต 69"'));
  assert.ok(xml.includes('นายสมชาย มะพร้าวทอง'));
  assert.ok(xml.includes('238578'));
});

test('computePlotBoard2D correctly calculates completion, incomplete missing trees, and summaries', () => {
  const plots = [
    { id: 1, plot_label: 'แปลงที่ 1', full_name: 'นายสมชาย มะพร้าวทอง', province_code: 'ratchaburi' },
    { id: 2, plot_label: 'แปลงที่ 2', full_name: 'นางสมศรี สวนน้ำหอม', province_code: 'nakhon_pathom' },
    { id: 3, plot_label: 'แปลงที่ 3', full_name: 'นายบุญมา ท่ามะกา', province_code: 'samut_sakhon' },
  ];

  // Plot 1: Completely filled (7 points x 5 trees = 35 trees)
  const forecasts = [];
  for (let pt = 1; pt <= 7; pt++) {
    for (const pos of ['C', 'L', 'R', 'F', 'B']) {
      forecasts.push({
        plot_id: 1,
        point_label: `จุดที่ ${pt}`,
        tree_position: pos,
        fruit_count: 10,
      });
    }
  }

  // Plot 2: Partially filled (only Point 1 with C, L, R => 3 trees)
  forecasts.push({ plot_id: 2, point_label: 'จุดที่ 1', tree_position: 'C', fruit_count: 12 });
  forecasts.push({ plot_id: 2, point_label: 'จุดที่ 1', tree_position: 'L', fruit_count: 15 });
  forecasts.push({ plot_id: 2, point_label: 'จุดที่ 1', tree_position: 'R', fruit_count: 14 });

  // Plot 3: 0 trees (Not started)

  const cuts = [
    { plot_id: 1, cuts_count: 3, total_cut_yield: 7850, cut_date: '2026-03-02' },
  ];

  const { plots: resultPlots, summary } = computePlotBoard2D(plots, forecasts, cuts);

  assert.equal(resultPlots.length, 3);

  // Plot 1: Complete
  const p1 = resultPlots.find((p) => p.id === 1);
  assert.equal(p1.status, 'complete');
  assert.equal(p1.totalTreesChecked, 35);
  assert.equal(p1.percentComplete, 100);
  assert.equal(p1.completedPoints, 7);
  assert.equal(p1.partialPoints, 0);
  assert.equal(p1.missingPoints, 0);
  assert.equal(p1.cutsCount, 3);
  assert.equal(p1.totalCutYield, 7850);

  // Plot 2: Incomplete (checked 3 of 35 trees)
  const p2 = resultPlots.find((p) => p.id === 2);
  assert.equal(p2.status, 'incomplete');
  assert.equal(p2.totalTreesChecked, 3);
  assert.equal(p2.percentComplete, Math.round((3 / 35) * 100)); // 9%
  assert.equal(p2.completedPoints, 0);
  assert.equal(p2.partialPoints, 1);
  assert.equal(p2.missingPoints, 6);
  assert.ok(p2.missingSummary.includes('ขาด F, B'));
  assert.ok(p2.missingSummary.includes('จุดที่ 2: ยังไม่ตรวจ'));

  // Plot 3: Not started
  const p3 = resultPlots.find((p) => p.id === 3);
  assert.equal(p3.status, 'not_started');
  assert.equal(p3.totalTreesChecked, 0);
  assert.equal(p3.percentComplete, 0);
  assert.equal(p3.completedPoints, 0);
  assert.equal(p3.partialPoints, 0);
  assert.equal(p3.missingPoints, 7);

  // Overarching Summary KPIs
  assert.equal(summary.totalPlots, 3);
  assert.equal(summary.completedPlots, 1);
  assert.equal(summary.incompletePlots, 1);
  assert.equal(summary.notStartedPlots, 1);
  assert.equal(summary.totalPossibleTrees, 3 * 35);
  assert.equal(summary.totalTreesChecked, 38);
});

test('board2d API endpoint returns enriched plot matrix and overarching metrics', async () => {
  const { onRequest: onBoard2DRequest } = await import('../functions/api/challenge/board2d.js');

  const mockPlots = [
    { id: 1, plot_label: 'แปลงที่ 1', full_name: 'นายสมชาย', province_code: 'ratchaburi', productive_area_rai: 12 },
    { id: 2, plot_label: 'แปลงที่ 2', full_name: 'นางสมศรี', province_code: 'ratchaburi', productive_area_rai: 8 },
  ];

  const mockForecasts = [
    { plot_id: 1, point_label: 'จุดที่ 1', tree_position: 'C', total_fruits: 12, bunch_count: 1 },
  ];

  const mockCuts = [
    { plot_id: 1, cuts_count: 2, total_cut_yield: 5000, cut_date: '2026-02-15' },
  ];

  const mockDb = {
    prepare(sql) {
      return {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          return { success: true };
        },
        async first() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM sessions')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          if (s.includes('FROM users')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          return null;
        },
        async all() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM farmer_plots')) {
            return { results: mockPlots };
          }
          if (s.includes('FROM yield_forecasts')) {
            return { results: mockForecasts };
          }
          if (s.includes('FROM harvest_cuts')) {
            return { results: mockCuts };
          }
          return { results: [] };
        },
      };
    },
  };

  const req = new Request('https://coconut-doae.internal/api/challenge/board2d', {
    method: 'GET',
    headers: {
      cookie: 'sid=valid-session-token',
    },
  });

  const res = await onBoard2DRequest({ request: req, env: { DB: mockDb } });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.summary.totalPlots, 2);
  assert.equal(body.summary.incompletePlots, 1);
  assert.equal(body.summary.notStartedPlots, 1);
  assert.equal(body.plots[0].cutsCount, 2);
  assert.equal(body.plots[0].status, 'incomplete');
  assert.equal(body.plots[1].status, 'not_started');
});

test('Form 1 (farmers.js): saves full basic plot data including 4 corners, cost and income', async () => {
  const { onRequest: onFarmersRequest } = await import('../functions/api/challenge/farmers.js');

  let insertedRow = null;
  const mockDb = {
    prepare(sql) {
      return {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO farmer_plots')) {
            insertedRow = this.params;
            return { meta: { last_row_id: 10 } };
          }
          return { success: true };
        },
        async first() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM sessions')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          if (s.includes('FROM users')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  const payload = {
    province_code: 'ratchaburi',
    farmer_no: 1,
    plot_label: 'แปลงที่ 1',
    title: 'นาย',
    first_name: 'สมชาย',
    last_name: 'มะพร้าวทอง',
    address_no: '124',
    street: 'ดำเนินสะดวก',
    moo: '3',
    subdistrict: 'ดำเนินสะดวก',
    district: 'ดำเนินสะดวก',
    province_name: 'ราชบุรี',
    age: 48,
    phone: '081-234-5678',
    total_area_rai: 15.0,
    productive_area_rai: 12.0,
    plant_age_years: 7.5,
    trees_per_rai: 35,
    coord_zone: '47',
    coord_x1: 605420,
    coord_y1: 1492310,
    coord_x2: 605480,
    coord_y2: 1492310,
    coord_x3: 605480,
    coord_y3: 1492250,
    coord_x4: 605420,
    coord_y4: 1492250,
    production_standard: 'GAP',
    soil_series: 'ชุดดินดำเนินสะดวก (Ds)',
    production_cost_per_rai: 12500,
    avg_income_per_rai: 38000,
  };

  const req = new Request('https://coconut-doae.internal/api/challenge/farmers', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'sid=valid-session-token',
    },
    body: JSON.stringify(payload),
  });

  const res = await onFarmersRequest({ request: req, env: { DB: mockDb } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.id, 10);
  assert.ok(insertedRow);
  // Check full_name synthesized
  assert.equal(insertedRow[6], 'นาย สมชาย มะพร้าวทอง');
  // Check cost and income
  assert.equal(insertedRow[33], 12500);
  assert.equal(insertedRow[34], 38000);
});

test('Sheet 3 (harvest.js): saves harvest cut with trees_per_rai and auto-calculates yield_per_tree and yield_per_rai', async () => {
  const { onRequest: onHarvestRequest } = await import('../functions/api/challenge/harvest.js');

  let insertedCut = null;
  const mockDb = {
    prepare(sql) {
      return {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO harvest_cuts')) {
            insertedCut = this.params;
            return { meta: { last_row_id: 88 } };
          }
          return { success: true };
        },
        async first() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM sessions')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          if (s.includes('FROM users')) {
            return { id: 1, province_code: 'ratchaburi', province_label: 'ราชบุรี', role: 'province' };
          }
          if (s.includes('FROM farmer_plots')) {
            return {
              id: 1,
              province_code: 'ratchaburi',
              full_name: 'นาย สมชาย มะพร้าวทอง',
              productive_area_rai: 10,
              trees_per_rai: 40,
            };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };

  const payload = {
    plot_id: 1,
    cut_round: 2,
    cut_date: '2026-05-15',
    total_yield: 2800,
    trees_per_rai: 40, // 40 trees/rai * 10 rai = 400 trees
    price_per_fruit: 18.5,
    twin_fruits: 25,
    damaged_fruits: 15,
    notes: 'คุณภาพดีมาก',
  };

  const req = new Request('https://coconut-doae.internal/api/challenge/harvest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'sid=valid-session-token',
    },
    body: JSON.stringify(payload),
  });

  const res = await onHarvestRequest({ request: req, env: { DB: mockDb } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.id, 88);

  assert.ok(insertedCut);
  // (plot_id, province_code, farmer_name, cut_round, cut_date, total_yield, yield_per_rai, trees_per_rai, yield_per_tree, price_per_fruit, twin_fruits, damaged_fruits, notes)
  assert.equal(insertedCut[0], 1); // plot_id
  assert.equal(insertedCut[1], 'ratchaburi');
  assert.equal(insertedCut[2], 'นาย สมชาย มะพร้าวทอง');
  assert.equal(insertedCut[3], 2); // cut_round
  assert.equal(insertedCut[5], 2800); // total_yield
  assert.equal(insertedCut[6], 280); // yield_per_rai = 2800 / 10 = 280
  assert.equal(insertedCut[7], 40); // trees_per_rai
  assert.equal(insertedCut[8], 7); // yield_per_tree = 280 / 40 = 7
  assert.equal(insertedCut[9], 18.5); // price_per_fruit
});



