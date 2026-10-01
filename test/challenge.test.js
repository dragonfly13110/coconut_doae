import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChallengeExcelXml } from '../src/challenge-export.js';
import macroBaseline from '../src/macro-baseline.json' with { type: 'json' };
import { CHALLENGE_PROVINCES, SAMPLE_POINTS, SAMPLE_TREES, MONTH_NAMES } from '../src/challenge-db.js';

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
