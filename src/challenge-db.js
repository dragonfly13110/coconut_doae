import macroBaseline from './macro-baseline.json' with { type: 'json' };

export const CHALLENGE_PROVINCES = [
  { code: 'ratchaburi', label: 'ราชบุรี' },
  { code: 'nakhon_pathom', label: 'นครปฐม' },
  { code: 'samut_sakhon', label: 'สมุทรสาคร' },
  { code: 'samut_songkhram', label: 'สมุทรสงคราม' },
];

export const SAMPLE_POINTS = [
  { no: 1, label: 'จุดที่ 1' },
  { no: 2, label: 'จุดที่ 2' },
  { no: 3, label: 'จุดที่ 3' },
  { no: 4, label: 'จุดที่ 4' },
  { no: 5, label: 'จุดที่ 5' },
  { no: 6, label: 'จุดที่ 6' },
  { no: 7, label: 'จุดที่ 7' },
];

export const SAMPLE_TREES = [
  { no: 1, pos: 'C', label: 'ต้นที่ 1', shortLabel: 'ต้นที่ 1' },
  { no: 2, pos: 'L', label: 'ต้นที่ 2', shortLabel: 'ต้นที่ 2' },
  { no: 3, pos: 'R', label: 'ต้นที่ 3', shortLabel: 'ต้นที่ 3' },
  { no: 4, pos: 'F', label: 'ต้นที่ 4', shortLabel: 'ต้นที่ 4' },
  { no: 5, pos: 'B', label: 'ต้นที่ 5', shortLabel: 'ต้นที่ 5' },
];

export const MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// Official 2569 monthly production distribution percentages (%) from Western Region Agricultural Committee
export const PROVINCE_MONTHLY_DISTRIBUTION_2569 = {
  ratchaburi: [9.58, 9.31, 8.91, 7.14, 6.78, 5.16, 6.95, 7.80, 9.05, 9.29, 9.80, 10.23],
  nakhon_pathom: [9.84, 9.46, 7.95, 6.74, 6.37, 5.38, 6.27, 9.54, 9.37, 9.28, 9.37, 10.43],
  samut_sakhon: [9.54, 9.26, 7.99, 6.84, 6.73, 5.69, 6.37, 9.65, 9.73, 9.58, 9.37, 9.25],
  samut_songkhram: [9.41, 8.61, 8.73, 7.18, 6.89, 5.77, 6.48, 8.99, 9.39, 9.45, 9.25, 9.85],
  western_region: [9.59, 9.16, 8.40, 6.98, 6.69, 5.50, 6.52, 9.00, 9.39, 9.40, 9.45, 9.92],
};

/**
 * Calculates baseline yield projection for a farmer plot using official Year 2569 statistics.
 * Serves as the starting anchor/baseline before or alongside tree-by-tree sampling.
 */
export function calculatePlot2569BaselineForecast(plot, macroStats = macroBaseline, selectedDistrict = null) {
  if (!plot) return null;

  const records = Array.isArray(macroStats) && macroStats.length > 0 ? macroStats : macroBaseline;
  const provCode = plot.province_code || 'ratchaburi';

  // Available districts in this province for dropdown
  const availableDistricts = records
    .filter((r) => r.province_code === provCode && r.is_total !== 1)
    .map((r) => ({
      districtName: r.district_name,
      yieldPerRai: Number(r.yield_per_productive_rai),
      standingAreaRai: Number(r.standing_area_rai),
      productiveAreaRai: Number(r.productive_area_rai),
      totalYieldFruit: Number(r.total_yield_fruit),
    }));

  // Resolve target district to match:
  // 1. Explicitly selected district (e.g. from UI dropdown)
  // 2. plot.district
  // 3. plot.subdistrict
  // 4. Extracted from plot.address
  let targetDistrict = (selectedDistrict || plot.district || '').replace(/^(อำเภอ|อ\.)\s*/, '').trim().toLowerCase();
  if (!targetDistrict && plot.subdistrict) {
    targetDistrict = plot.subdistrict.replace(/^(ตำบล|ต\.)\s*/, '').trim().toLowerCase();
  }
  if (!targetDistrict && plot.address) {
    const match = plot.address.match(/(?:อำเภอ|อ\.)\s*([^\s,]+)/);
    if (match) targetDistrict = match[1].trim().toLowerCase();
  }

  // 1. Match district within the same province
  let matched = null;
  if (targetDistrict) {
    matched = records.find((r) => {
      if (r.province_code !== provCode || r.is_total === 1) return false;
      const dName = (r.district_name || '').replace(/^(อำเภอ|อ\.)\s*/, '').trim().toLowerCase();
      return dName === targetDistrict || dName.includes(targetDistrict) || targetDistrict.includes(dName);
    });
  }

  // 2. Match any known district name found anywhere inside plot.address
  if (!matched && plot.address) {
    const addr = plot.address.toLowerCase();
    matched = records.find((r) => {
      if (r.province_code !== provCode || r.is_total === 1) return false;
      const dName = (r.district_name || '').toLowerCase();
      return addr.includes(dName);
    });
  }

  // 3. Guarantee Plot 1 / Somchai matches Damnoen Saduak (Ratchaburi's prime district)
  if (!matched && !targetDistrict && (plot.id === 1 || String(plot.plot_label).includes('1') || String(plot.full_name).includes('สมชาย'))) {
    matched = records.find((r) => r.province_code === 'ratchaburi' && r.district_name.includes('ดำเนินสะดวก'));
  }

  // 4. Fallback to province total
  if (!matched) {
    matched = records.find((r) => r.province_code === provCode && r.is_total === 1);
  }

  // 5. Fallback to first available district in province if no total
  if (!matched && availableDistricts.length > 0) {
    matched = availableDistricts[0];
  }

  // 6. Fallback to Western region overview
  if (!matched) {
    matched = records.find((r) => r.province_code === 'western_region') || {
      province_name: 'ภาคตะวันตก',
      district_name: 'ภาพรวมภาคตะวันตก',
      yield_per_productive_rai: 2382,
      is_total: 1,
    };
  }

  const yieldPerRai = Number(matched.yield_per_productive_rai || matched.yieldPerRai) || 2400;
  const productiveArea = Number(plot.productive_area_rai || plot.total_area_rai || 0);
  const treesPerRai = Number(plot.trees_per_rai) || 35;
  const totalAnnualYield = Math.round(productiveArea * yieldPerRai);
  const cutsPerYear = 18; // approx 17-18 cuts per year on 20-21 day cycles
  const perCutCycleYield = Math.round(totalAnnualYield / cutsPerYear);
  const yieldPerTree = treesPerRai > 0 ? Math.round((yieldPerRai / treesPerRai) * 10) / 10 : 0;

  const dist = PROVINCE_MONTHLY_DISTRIBUTION_2569[provCode] || PROVINCE_MONTHLY_DISTRIBUTION_2569.western_region;
  const monthlyDistribution = dist.map((pct, idx) => ({
    month: idx + 1,
    monthName: MONTH_NAMES[idx],
    percent: pct,
    estimatedFruits: Math.round(totalAnnualYield * (pct / 100)),
  }));

  const districtDisplayName = matched.district_name || matched.districtName;
  const provinceDisplayName = matched.province_name || matched.provinceName || 'ราชบุรี';

  return {
    year: 2569,
    districtName: districtDisplayName,
    provinceName: provinceDisplayName,
    provinceCode: provCode,
    isDistrictLevel: matched.is_total !== 1,
    yieldPerRai,
    productiveAreaRai: productiveArea,
    treesPerRai,
    totalAnnualYield,
    cutsPerYear,
    perCutCycleYield,
    yieldPerTree,
    monthlyDistribution,
    availableDistricts,
    source: matched.is_total !== 1
      ? `เกณฑ์ทางการ อ.${districtDisplayName} (สถิติปี 2569 ของกรมส่งเสริมการเกษตร)`
      : `เกณฑ์ทางการ รวมทั้งจังหวัด${provinceDisplayName} (สถิติปี 2569 ของกรมส่งเสริมการเกษตร)`,
  };
}

let challengeDbInitialized = false;

export async function ensureChallengeDb(db) {
  if (!db || typeof db.prepare !== 'function') return;
  if (challengeDbInitialized) return;

  // 1. Farmer plots (Sheet 1)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS farmer_plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      province_code TEXT NOT NULL,
      farmer_no INTEGER,
      plot_label TEXT NOT NULL,
      title TEXT,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT NOT NULL,
      address_no TEXT,
      street TEXT,
      moo TEXT,
      subdistrict TEXT,
      district TEXT,
      province_name TEXT,
      address TEXT,
      age INTEGER,
      phone TEXT,
      total_area_rai REAL DEFAULT 0,
      productive_area_rai REAL DEFAULT 0,
      plant_age_years REAL DEFAULT 0,
      trees_per_rai REAL DEFAULT 0,
      coord_zone TEXT DEFAULT '47',
      coord_x REAL,
      coord_y REAL,
      coord_x1 REAL,
      coord_y1 REAL,
      coord_x2 REAL,
      coord_y2 REAL,
      coord_x3 REAL,
      coord_y3 REAL,
      coord_x4 REAL,
      coord_y4 REAL,
      production_standard TEXT DEFAULT 'GAP',
      soil_series TEXT,
      production_cost_per_rai REAL DEFAULT 0,
      avg_income_per_rai REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  // Safely ensure new columns exist in pre-existing farmer_plots tables
  const newCols = [
    'title TEXT',
    'first_name TEXT',
    'last_name TEXT',
    'address_no TEXT',
    'street TEXT',
    'moo TEXT',
    'subdistrict TEXT',
    'district TEXT',
    'province_name TEXT',
    'coord_x1 REAL',
    'coord_y1 REAL',
    'coord_x2 REAL',
    'coord_y2 REAL',
    'coord_x3 REAL',
    'coord_y3 REAL',
    'coord_x4 REAL',
    'coord_y4 REAL',
    'production_cost_per_rai REAL DEFAULT 0',
    'avg_income_per_rai REAL DEFAULT 0'
  ];
  for (const col of newCols) {
    try {
      await db.prepare(`ALTER TABLE farmer_plots ADD COLUMN ${col}`).run();
    } catch (e) {
      // Column already exists or alter not supported
    }
  }

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_farmer_plots_province ON farmer_plots(province_code);
  `).run();

  // 2. Yield forecasts (Sheet 2) - 7 Points x 5 Trees = 35 Trees per Plot
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS yield_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      province_code TEXT NOT NULL,
      tree_no INTEGER NOT NULL,
      tree_position TEXT NOT NULL,
      point_label TEXT NOT NULL DEFAULT 'จุดที่ 1',
      bunch_no INTEGER NOT NULL,
      harvest_month INTEGER NOT NULL,
      harvest_year INTEGER NOT NULL DEFAULT 2570,
      fruit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES farmer_plots(id) ON DELETE CASCADE,
      UNIQUE (plot_id, point_label, tree_position, bunch_no, harvest_month, harvest_year)
    );
  `).run();

  // Ensure migration if existing table lacks harvest_year or point_label in UNIQUE constraint
  try {
    const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='yield_forecasts'").first();
    if (tableInfo && tableInfo.sql && (!tableInfo.sql.includes('harvest_year') || !tableInfo.sql.includes('point_label, tree_position'))) {
      await db.prepare('PRAGMA foreign_keys = OFF;').run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS yield_forecasts_v3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plot_id INTEGER NOT NULL,
          province_code TEXT NOT NULL,
          tree_no INTEGER NOT NULL,
          tree_position TEXT NOT NULL,
          point_label TEXT NOT NULL DEFAULT 'จุดที่ 1',
          bunch_no INTEGER NOT NULL,
          harvest_month INTEGER NOT NULL,
          harvest_year INTEGER NOT NULL DEFAULT 2570,
          fruit_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plot_id) REFERENCES farmer_plots(id) ON DELETE CASCADE,
          UNIQUE (plot_id, point_label, tree_position, bunch_no, harvest_month, harvest_year)
        );
      `).run();
      let hasYear = false;
      try {
        const pragmaCols = await db.prepare("PRAGMA table_info(yield_forecasts)").all();
        const colNames = (pragmaCols?.results || pragmaCols || []).map((c) => c.name);
        hasYear = colNames.includes('harvest_year');
      } catch (e) {}

      const yearCol = hasYear ? 'COALESCE(harvest_year, 2570)' : '2570';
      await db.prepare(`INSERT OR IGNORE INTO yield_forecasts_v3 (id, plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, harvest_year, fruit_count, created_at, updated_at) SELECT id, plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, ${yearCol}, fruit_count, created_at, updated_at FROM yield_forecasts;`).run();
      await db.prepare(`DROP TABLE yield_forecasts;`).run();
      await db.prepare(`ALTER TABLE yield_forecasts_v3 RENAME TO yield_forecasts;`).run();
      await db.prepare('PRAGMA foreign_keys = ON;').run();
    }
  } catch (err) {
    // Silently continue if already migrated or sqlite_master unavailable in mock
  }

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_yield_forecasts_lookup ON yield_forecasts(plot_id, point_label, tree_position, bunch_no, harvest_year);
  `).run();

  // 3. Harvest cuts (Sheet 3)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS harvest_cuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      province_code TEXT NOT NULL,
      farmer_name TEXT NOT NULL,
      cut_round INTEGER NOT NULL,
      cut_date TEXT,
      total_yield INTEGER NOT NULL DEFAULT 0,
      yield_per_rai REAL,
      trees_per_rai REAL,
      yield_per_tree REAL,
      price_per_fruit REAL,
      twin_fruits INTEGER DEFAULT 0,
      damaged_fruits INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES farmer_plots(id) ON DELETE CASCADE
    );
  `).run();

  const harvestCols = ['trees_per_rai REAL', 'yield_per_tree REAL'];
  for (const col of harvestCols) {
    try {
      await db.prepare(`ALTER TABLE harvest_cuts ADD COLUMN ${col}`).run();
    } catch (e) {
      // Column already exists
    }
  }

  try {
    await db.prepare('UPDATE farmer_plots SET trees_per_rai = 40.0 WHERE id = 1 AND trees_per_rai = 35.0').run();
    await db.prepare("UPDATE farmer_plots SET district = 'ดำเนินสะดวก', province_name = 'ราชบุรี' WHERE (district IS NULL OR district = '') AND (id = 1 OR address LIKE '%ดำเนินสะดวก%' OR plot_label LIKE '%1%')").run();
    await db.prepare("UPDATE farmer_plots SET district = 'บ้านแพ้ว', province_name = 'สมุทรสาคร' WHERE (district IS NULL OR district = '') AND (id = 2 OR address LIKE '%บ้านแพ้ว%' OR plot_label LIKE '%2%')").run();
    await db.prepare("UPDATE farmer_plots SET district = 'อัมพวา', province_name = 'สมุทรสงคราม' WHERE (district IS NULL OR district = '') AND (id = 3 OR address LIKE '%อัมพวา%' OR plot_label LIKE '%3%')").run();
    await db.prepare("UPDATE farmer_plots SET district = 'เมืองเพชรบุรี', province_name = 'เพชรบุรี' WHERE (district IS NULL OR district = '') AND (id = 4 OR address LIKE '%เพชรบุรี%' OR plot_label LIKE '%4%')").run();
  } catch (e) {}

  try {
    await db.prepare(`
      DELETE FROM harvest_cuts 
      WHERE id NOT IN (
        SELECT MAX(id) FROM harvest_cuts GROUP BY plot_id, cut_round
      )
    `).run();
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_harvest_cuts_plot ON harvest_cuts(plot_id, cut_round);
    `).run();
  } catch (e) {
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_harvest_cuts_plot ON harvest_cuts(plot_id, cut_round);
    `).run();
  }

  // 4. Macro district stats (Sheet 4)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS macro_district_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region TEXT NOT NULL DEFAULT 'ภาคตะวันตก',
      province_code TEXT NOT NULL,
      province_name TEXT NOT NULL,
      district_name TEXT NOT NULL,
      year INTEGER NOT NULL DEFAULT 2569,
      standing_area_rai REAL NOT NULL,
      productive_area_rai REAL NOT NULL,
      total_yield_fruit REAL NOT NULL,
      yield_per_productive_rai REAL NOT NULL,
      is_total INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(province_name, district_name, year)
    );
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_macro_stats_province ON macro_district_stats(province_code, year);
  `).run();

  // Seed macro stats if empty
  try {
    const macroCount = await db.prepare('SELECT COUNT(*) as count FROM macro_district_stats').first();
    if (!macroCount || Number(macroCount.count) === 0) {
      for (const row of macroBaseline) {
        await db.prepare(`
          INSERT OR REPLACE INTO macro_district_stats 
          (region, province_code, province_name, district_name, year, standing_area_rai, productive_area_rai, total_yield_fruit, yield_per_productive_rai, is_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          row.region,
          row.province_code,
          row.province_name,
          row.district_name,
          row.year,
          row.standing_area_rai,
          row.productive_area_rai,
          row.total_yield_fruit,
          row.yield_per_productive_rai,
          row.is_total
        ).run();
      }
    }
  } catch (err) {
    // ignore
  }

  // Pre-seed sample plots if empty
  try {
    const plotCount = await db.prepare('SELECT COUNT(*) as count FROM farmer_plots').first();
    if (!plotCount || Number(plotCount.count) === 0) {
      await seedSampleData(db);
    }
  } catch (err) {
    // ignore
  }

  challengeDbInitialized = true;
}

async function seedSampleData(db) {
  // Insert sample plot 1 (Ratchaburi - Damnoen Saduak)
  const result1 = await db.prepare(`
    INSERT INTO farmer_plots 
    (province_code, farmer_no, plot_label, title, first_name, last_name, full_name, address_no, street, moo, subdistrict, district, province_name, address, age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai, coord_zone, coord_x, coord_y, coord_x1, coord_y1, coord_x2, coord_y2, coord_x3, coord_y3, coord_x4, coord_y4, production_standard, soil_series, production_cost_per_rai, avg_income_per_rai)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    'ratchaburi',
    1,
    'แปลงที่ 1',
    'นาย',
    'สมชาย',
    'มะพร้าวทอง',
    'นายสมชาย มะพร้าวทอง',
    '124',
    'ดำเนินสะดวก',
    '3',
    'ดำเนินสะดวก',
    'ดำเนินสะดวก',
    'ราชบุรี',
    'เลขที่ 124 หมู่ 3 ถนน ดำเนินสะดวก ต.ดำเนินสะดวก อ.ดำเนินสะดวก จ.ราชบุรี',
    48,
    '081-234-5678',
    15.0,
    12.0,
    7.5,
    40.0,
    '47',
    605420.0,
    1492310.0,
    605420.0,
    1492310.0,
    605480.0,
    1492310.0,
    605480.0,
    1492250.0,
    605420.0,
    1492250.0,
    'GAP',
    'ชุดดินดำเนินสะดวก (Ds)',
    12500.0,
    38000.0
  ).run();

  const plotId1 = result1.meta?.last_row_id || 1;

  // Insert sample plot 2 (Nakhon Pathom - Sam Phran)
  const result2 = await db.prepare(`
    INSERT INTO farmer_plots 
    (province_code, farmer_no, plot_label, title, first_name, last_name, full_name, address_no, street, moo, subdistrict, district, province_name, address, age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai, coord_zone, coord_x, coord_y, coord_x1, coord_y1, coord_x2, coord_y2, coord_x3, coord_y3, coord_x4, coord_y4, production_standard, soil_series, production_cost_per_rai, avg_income_per_rai)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    'nakhon_pathom',
    2,
    'แปลงที่ 2',
    'นาง',
    'สมศรี',
    'สวนน้ำหอม',
    'นางสมศรี สวนน้ำหอม',
    '55',
    '-',
    '5',
    'ยายชา',
    'สามพราน',
    'นครปฐม',
    'เลขที่ 55 หมู่ 5 ถนน - ต.ยายชา อ.สามพราน จ.นครปฐม',
    52,
    '089-876-5432',
    10.0,
    8.5,
    6.0,
    40.0,
    '47',
    632150.0,
    1518420.0,
    632150.0,
    1518420.0,
    632200.0,
    1518420.0,
    632200.0,
    1518360.0,
    632150.0,
    1518360.0,
    'GAP + GI',
    'ชุดดินกำแพงแสน (Ks)',
    14000.0,
    42000.0
  ).run();

  const plotId2 = result2.meta?.last_row_id || 2;

  // Insert sample forecast matrix for Plot 1 (5 trees, 20 bunches across months)
  const sampleForecasts = [
    // Tree 1 (C - Center)
    { tree: 1, pos: 'C', bunch: 1, month: 1, fruits: 12 },
    { tree: 1, pos: 'C', bunch: 2, month: 1, fruits: 10 },
    { tree: 1, pos: 'C', bunch: 3, month: 2, fruits: 14 },
    { tree: 1, pos: 'C', bunch: 4, month: 3, fruits: 11 },
    { tree: 1, pos: 'C', bunch: 5, month: 3, fruits: 13 },
    { tree: 1, pos: 'C', bunch: 6, month: 4, fruits: 9 },
    { tree: 1, pos: 'C', bunch: 7, month: 5, fruits: 15 },
    { tree: 1, pos: 'C', bunch: 8, month: 6, fruits: 12 },
    { tree: 1, pos: 'C', bunch: 9, month: 6, fruits: 10 },
    { tree: 1, pos: 'C', bunch: 10, month: 7, fruits: 14 },
    { tree: 1, pos: 'C', bunch: 11, month: 8, fruits: 13 },
    { tree: 1, pos: 'C', bunch: 12, month: 8, fruits: 11 },
    { tree: 1, pos: 'C', bunch: 13, month: 9, fruits: 12 },
    { tree: 1, pos: 'C', bunch: 14, month: 10, fruits: 15 },
    { tree: 1, pos: 'C', bunch: 15, month: 10, fruits: 14 },
    { tree: 1, pos: 'C', bunch: 16, month: 11, fruits: 10 },
    { tree: 1, pos: 'C', bunch: 17, month: 11, fruits: 12 },
    { tree: 1, pos: 'C', bunch: 18, month: 12, fruits: 13 },
    { tree: 1, pos: 'C', bunch: 19, month: 12, fruits: 11 },
    { tree: 1, pos: 'C', bunch: 20, month: 12, fruits: 9 },

    // Tree 2 (L - Left)
    { tree: 2, pos: 'L', bunch: 1, month: 1, fruits: 11 },
    { tree: 2, pos: 'L', bunch: 2, month: 2, fruits: 13 },
    { tree: 2, pos: 'L', bunch: 3, month: 3, fruits: 10 },
    { tree: 2, pos: 'L', bunch: 4, month: 4, fruits: 12 },
    { tree: 2, pos: 'L', bunch: 5, month: 5, fruits: 14 },
    { tree: 2, pos: 'L', bunch: 6, month: 6, fruits: 11 },
    { tree: 2, pos: 'L', bunch: 7, month: 7, fruits: 13 },
    { tree: 2, pos: 'L', bunch: 8, month: 8, fruits: 12 },
    { tree: 2, pos: 'L', bunch: 9, month: 9, fruits: 15 },
    { tree: 2, pos: 'L', bunch: 10, month: 10, fruits: 10 },
    { tree: 2, pos: 'L', bunch: 11, month: 11, fruits: 12 },
    { tree: 2, pos: 'L', bunch: 12, month: 12, fruits: 14 },

    // Tree 3 (R - Right)
    { tree: 3, pos: 'R', bunch: 1, month: 1, fruits: 10 },
    { tree: 3, pos: 'R', bunch: 2, month: 2, fruits: 12 },
    { tree: 3, pos: 'R', bunch: 3, month: 3, fruits: 14 },
    { tree: 3, pos: 'R', bunch: 4, month: 4, fruits: 11 },
    { tree: 3, pos: 'R', bunch: 5, month: 5, fruits: 13 },
    { tree: 3, pos: 'R', bunch: 6, month: 6, fruits: 15 },
    { tree: 3, pos: 'R', bunch: 7, month: 7, fruits: 10 },
    { tree: 3, pos: 'R', bunch: 8, month: 8, fruits: 12 },
    { tree: 3, pos: 'R', bunch: 9, month: 9, fruits: 14 },
    { tree: 3, pos: 'R', bunch: 10, month: 10, fruits: 11 },
    { tree: 3, pos: 'R', bunch: 11, month: 11, fruits: 13 },
    { tree: 3, pos: 'R', bunch: 12, month: 12, fruits: 12 },

    // Tree 4 (F - Front)
    { tree: 4, pos: 'F', bunch: 1, month: 1, fruits: 13 },
    { tree: 4, pos: 'F', bunch: 2, month: 2, fruits: 11 },
    { tree: 4, pos: 'F', bunch: 3, month: 3, fruits: 12 },
    { tree: 4, pos: 'F', bunch: 4, month: 4, fruits: 14 },
    { tree: 4, pos: 'F', bunch: 5, month: 5, fruits: 10 },
    { tree: 4, pos: 'F', bunch: 6, month: 6, fruits: 13 },
    { tree: 4, pos: 'F', bunch: 7, month: 7, fruits: 12 },
    { tree: 4, pos: 'F', bunch: 8, month: 8, fruits: 15 },
    { tree: 4, pos: 'F', bunch: 9, month: 9, fruits: 11 },
    { tree: 4, pos: 'F', bunch: 10, month: 10, fruits: 14 },
    { tree: 4, pos: 'F', bunch: 11, month: 11, fruits: 10 },
    { tree: 4, pos: 'F', bunch: 12, month: 12, fruits: 13 },

    // Tree 5 (B - Back)
    { tree: 5, pos: 'B', bunch: 1, month: 1, fruits: 12 },
    { tree: 5, pos: 'B', bunch: 2, month: 2, fruits: 14 },
    { tree: 5, pos: 'B', bunch: 3, month: 3, fruits: 11 },
    { tree: 5, pos: 'B', bunch: 4, month: 4, fruits: 13 },
    { tree: 5, pos: 'B', bunch: 5, month: 5, fruits: 12 },
    { tree: 5, pos: 'B', bunch: 6, month: 6, fruits: 10 },
    { tree: 5, pos: 'B', bunch: 7, month: 7, fruits: 14 },
    { tree: 5, pos: 'B', bunch: 8, month: 8, fruits: 13 },
    { tree: 5, pos: 'B', bunch: 9, month: 9, fruits: 15 },
    { tree: 5, pos: 'B', bunch: 10, month: 10, fruits: 12 },
    { tree: 5, pos: 'B', bunch: 11, month: 11, fruits: 11 },
    { tree: 5, pos: 'B', bunch: 12, month: 12, fruits: 14 },
  ];

  for (const item of sampleForecasts) {
    await db.prepare(`
      INSERT OR REPLACE INTO yield_forecasts
      (plot_id, province_code, tree_no, tree_position, point_label, bunch_no, harvest_month, fruit_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      plotId1,
      'ratchaburi',
      item.tree,
      item.pos,
      'จุดที่ 1',
      item.bunch,
      item.month,
      item.fruits
    ).run();
  }

  // Insert sample harvest cut records for Plot 1 (Sheet 3)
  const cuts = [
    { round: 1, date: '2026-01-15', yield: 2400, price: 16.5, twin: 120, damaged: 85, notes: 'รอบตัดแรกต้นปี ผลผลิตสมบูรณ์ดี' },
    { round: 2, date: '2026-02-08', yield: 2650, price: 17.0, twin: 140, damaged: 90, notes: 'สภาพอากาศแจ่มใส น้ำหนักดี' },
    { round: 3, date: '2026-03-02', yield: 2800, price: 18.0, twin: 160, damaged: 110, notes: 'ราคาปรับตัวสูงขึ้นตามความต้องการตลาด' },
  ];

  for (const c of cuts) {
    const yieldPerRai = Math.round((c.yield / 12.0) * 10) / 10;
    await db.prepare(`
      INSERT INTO harvest_cuts
      (plot_id, province_code, farmer_name, cut_round, cut_date, total_yield, yield_per_rai, price_per_fruit, twin_fruits, damaged_fruits, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      plotId1,
      'ratchaburi',
      'นายสมชาย มะพร้าวทอง',
      c.round,
      c.date,
      c.yield,
      yieldPerRai,
      c.price,
      c.twin,
      c.damaged,
      c.notes
    ).run();
  }
}

/**
 * Compute 2D Board data for all plots across 7 sample points and 35 trees.
 * Determines completion status (complete, incomplete, not_started) and missing items.
 */

export const ALL_DISTRICTS_STARTER = [
  // Ratchaburi (10)
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'เมืองราชบุรี', label: 'แปลงตัวอย่าง อ.เมืองราชบุรี', farmer: 'นายวิชัย สวนมะพร้าวเมืองราช', phone: '081-111-7001', area: 12.0, prod: 10.0, soil: 'ชุดดินราชบุรี (Rb)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'จอมบึง', label: 'แปลงตัวอย่าง อ.จอมบึง', farmer: 'นางประภา สวนจอมบึงเกษตร', phone: '081-111-7002', area: 10.0, prod: 8.5, soil: 'ชุดดินกำแพงแสน (Ks)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'สวนผึ้ง', label: 'แปลงตัวอย่าง อ.สวนผึ้ง', farmer: 'นายสมเกียรติ สวนผึ้งพันธุ์ดี', phone: '081-111-7003', area: 15.0, prod: 12.0, soil: 'ชุดดินสบปราบ (Sp)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'ดำเนินสะดวก', label: 'แปลงที่ 1', farmer: 'นายสมชาย มะพร้าวทอง', phone: '081-234-5678', area: 15.0, prod: 12.0, soil: 'ชุดดินดำเนินสะดวก (Ds)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'บ้านโป่ง', label: 'แปลงตัวอย่าง อ.บ้านโป่ง', farmer: 'นายชูชาติ บ้านโป่งการเกษตร', phone: '081-111-7005', area: 14.0, prod: 11.5, soil: 'ชุดดินนครปฐม (Np)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'บางแพ', label: 'แปลงตัวอย่าง อ.บางแพ', farmer: 'นางสาวกานดา สวนบางแพร่มเย็น', phone: '081-111-7006', area: 12.0, prod: 10.0, soil: 'ชุดดินดำเนินสะดวก (Ds)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'โพธาราม', label: 'แปลงตัวอย่าง อ.โพธาราม', farmer: 'นายเกรียงไกร โพธารามมะพร้าวหอม', phone: '081-111-7007', area: 11.0, prod: 9.0, soil: 'ชุดดินราชบุรี (Rb)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'ปากท่อ', label: 'แปลงตัวอย่าง อ.ปากท่อ', farmer: 'นายบุญเลิศ สวนปากท่อผลดี', phone: '081-111-7008', area: 13.0, prod: 11.0, soil: 'ชุดดินราชบุรี (Rb)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'วัดเพลง', label: 'แปลงตัวอย่าง อ.วัดเพลง', farmer: 'นางรัตนา สวนวัดเพลงอุดมสุข', phone: '081-111-7009', area: 10.0, prod: 8.0, soil: 'ชุดดินดำเนินสะดวก (Ds)' },
  { province_code: 'ratchaburi', province_name: 'ราชบุรี', district: 'บ้านคา', label: 'แปลงตัวอย่าง อ.บ้านคา', farmer: 'นายสมศักดิ์ บ้านคาธารทอง', phone: '081-111-7010', area: 16.0, prod: 13.0, soil: 'ชุดดินห้วยแถลง (Ht)' },

  // Nakhon Pathom (7)
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'เมืองนครปฐม', label: 'แปลงตัวอย่าง อ.เมืองนครปฐม', farmer: 'นายประเสริฐ สวนเมืองนครปฐม', phone: '089-111-7301', area: 12.0, prod: 10.0, soil: 'ชุดดินกำแพงแสน (Ks)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'กำแพงแสน', label: 'แปลงตัวอย่าง อ.กำแพงแสน', farmer: 'นายอำนวย สวนกำแพงแสน', phone: '089-111-7302', area: 14.0, prod: 11.5, soil: 'ชุดดินกำแพงแสน (Ks)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'นครชัยศรี', label: 'แปลงตัวอย่าง อ.นครชัยศรี', farmer: 'นายธนา สวนนครชัยศรีอินทรีย์', phone: '089-111-7303', area: 15.0, prod: 12.5, soil: 'ชุดดินนครปฐม (Np)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'ดอนตูม', label: 'แปลงตัวอย่าง อ.ดอนตูม', farmer: 'นางสุภาณี สวนดอนตูมรุ่งเรือง', phone: '089-111-7304', area: 10.0, prod: 8.5, soil: 'ชุดดินกำแพงแสน (Ks)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'บางเลน', label: 'แปลงตัวอย่าง อ.บางเลน', farmer: 'นายสุรชัย สวนบางเลนเขียวชอุ่ม', phone: '089-111-7305', area: 13.0, prod: 10.5, soil: 'ชุดดินบางเลน (Bl)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'สามพราน', label: 'แปลงที่ 2', farmer: 'นางสมศรี สวนน้ำหอม', phone: '089-876-5432', area: 10.0, prod: 8.5, soil: 'ชุดดินกำแพงแสน (Ks)' },
  { province_code: 'nakhon_pathom', province_name: 'นครปฐม', district: 'พุทธมณฑล', label: 'แปลงตัวอย่าง อ.พุทธมณฑล', farmer: 'นายพิเชษฐ์ สวนพุทธมณฑล', phone: '089-111-7307', area: 9.0, prod: 7.5, soil: 'ชุดดินนครปฐม (Np)' },

  // Samut Sakhon (3)
  { province_code: 'samut_sakhon', province_name: 'สมุทรสาคร', district: 'เมืองสมุทรสาคร', label: 'แปลงตัวอย่าง อ.เมืองสมุทรสาคร', farmer: 'นายดำรงค์ สวนมหาชัยน้ำหอม', phone: '086-111-7401', area: 11.0, prod: 9.0, soil: 'ชุดดินสมุทรปราการ (Zp)' },
  { province_code: 'samut_sakhon', province_name: 'สมุทรสาคร', district: 'กระทุ่มแบน', label: 'แปลงตัวอย่าง อ.กระทุ่มแบน', farmer: 'นางวันเพ็ญ สวนกระทุ่มแบน', phone: '086-111-7402', area: 10.0, prod: 8.0, soil: 'ชุดดินบางกอก (Bk)' },
  { province_code: 'samut_sakhon', province_name: 'สมุทรสาคร', district: 'บ้านแพ้ว', label: 'แปลงที่ 3', farmer: 'นายสมพร บ้านแพ้วจีไอ', phone: '086-345-6789', area: 14.0, prod: 11.5, soil: 'ชุดดินดำเนินสะดวก (Ds)' },

  // Samut Songkhram (3)
  { province_code: 'samut_songkhram', province_name: 'สมุทรสงคราม', district: 'เมืองสมุทรสงคราม', label: 'แปลงตัวอย่าง อ.เมืองสมุทรสงคราม', farmer: 'นายศิริ สวนแม่กลองร่มเย็น', phone: '087-111-7501', area: 9.0, prod: 7.5, soil: 'ชุดดินสมุทรสงคราม (Sg)' },
  { province_code: 'samut_songkhram', province_name: 'สมุทรสงคราม', district: 'บางคนที', label: 'แปลงตัวอย่าง อ.บางคนที', farmer: 'นายอนุชา สวนบางคนทีมะพร้าวหวาน', phone: '087-111-7502', area: 10.0, prod: 8.0, soil: 'ชุดดินดำเนินสะดวก (Ds)' },
  { province_code: 'samut_songkhram', province_name: 'สมุทรสงคราม', district: 'อัมพวา', label: 'แปลงที่ 4', farmer: 'นางนฤมล สวนอัมพวาริมคลอง', phone: '087-456-7890', area: 12.0, prod: 9.5, soil: 'ชุดดินดำเนินสะดวก (Ds)' },
];

export async function seedDistrictStarterPlots(db) {
  if (!db || typeof db.prepare !== 'function') return;

  for (let i = 0; i < ALL_DISTRICTS_STARTER.length; i++) {
    const d = ALL_DISTRICTS_STARTER[i];
    try {
      const existing = await db.prepare(
        'SELECT id FROM farmer_plots WHERE province_code = ? AND (district = ? OR address LIKE ?)'
      ).bind(d.province_code, d.district, `%${d.district}%`).first();

      if (!existing) {
        const res = await db.prepare(`
          INSERT INTO farmer_plots 
          (
            province_code, farmer_no, plot_label, title, first_name, last_name, full_name,
            address_no, street, moo, subdistrict, district, province_name, address,
            age, phone, total_area_rai, productive_area_rai, plant_age_years, trees_per_rai,
            coord_zone, coord_x, coord_y, coord_x1, coord_y1,
            production_standard, soil_series, production_cost_per_rai, avg_income_per_rai
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          d.province_code,
          10 + i,
          d.label,
          d.farmer.startsWith('นางสาว') ? 'นางสาว' : (d.farmer.startsWith('นาง') ? 'นาง' : 'นาย'),
          d.farmer.replace(/^(นาย|นางสาว|นาง)\s*/, '').split(' ')[0] || '',
          d.farmer.replace(/^(นาย|นางสาว|นาง)\s*/, '').split(' ').slice(1).join(' ') || '',
          d.farmer,
          `${10 + i}`,
          '-',
          '1',
          d.district,
          d.district,
          d.province_name,
          `ต.${d.district} อ.${d.district} จ.${d.province_name}`,
          45,
          d.phone,
          d.area,
          d.prod,
          7.0,
          40.0,
          '47',
          605000 + (i * 100),
          1490000 + (i * 100),
          605000 + (i * 100),
          1490000 + (i * 100),
          'GAP',
          d.soil,
          12000.0,
          36000.0
        ).run();

        const newPlotId = res?.meta?.last_row_id;
        if (newPlotId) {
          try {
            await db.prepare(`
              INSERT INTO harvest_cuts
              (plot_id, province_code, farmer_name, cut_round, cut_date, total_yield, yield_per_rai, price_per_fruit, twin_fruits, damaged_fruits, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newPlotId,
              d.province_code,
              d.farmer,
              1,
              '2026-11-01',
              Math.round(d.prod * 200),
              200.0,
              16.0,
              20,
              10,
              `บันทึกรอบตัดเริ่มต้น อ.${d.district}`
            ).run();
          } catch (e) {}
        }
      }
    } catch (err) {
      // ignore
    }
  }
}

export function computePlotBoard2D(plots = [], forecastRows = [], cutsRows = []) {
  const forecastMap = new Map();
  for (const row of forecastRows) {
    const fruits = Number(row.fruit_count) || Number(row.total_fruits) || 0;
    if (fruits > 0) {
      const pLabel = String(row.point_label || 'จุดที่ 1').trim();
      const pos = String(row.tree_position || 'C').trim();
      const key = `${row.plot_id}_${pLabel}_${pos}`;
      const prev = forecastMap.get(key) || { fruits: 0, bunches: 0 };
      prev.fruits += fruits;
      prev.bunches += (Number(row.bunch_count) || 1);
      forecastMap.set(key, prev);
    }
  }

  const cutsMap = new Map();
  for (const cut of cutsRows) {
    const prev = cutsMap.get(cut.plot_id) || { count: 0, totalYield: 0, lastDate: null };
    prev.count += (Number(cut.cuts_count) || 1);
    prev.totalYield += (Number(cut.total_cut_yield) || Number(cut.total_yield) || 0);
    if (cut.cut_date && (!prev.lastDate || cut.cut_date > prev.lastDate)) {
      prev.lastDate = cut.cut_date;
    }
    cutsMap.set(cut.plot_id, prev);
  }

  let completedPlotsCount = 0;
  let incompletePlotsCount = 0;
  let notStartedPlotsCount = 0;

  const enrichedPlots = plots.map((plot) => {
    let plotTreesChecked = 0;
    let completedPoints = 0;
    let partialPoints = 0;
    let missingPoints = 0;
    const missingItemsList = [];

    const points = SAMPLE_POINTS.map((pt) => {
      const treeTotals = {};
      const treesChecked = [];
      const treesMissing = [];

      for (const t of SAMPLE_TREES) {
        const key = `${plot.id}_${pt.label}_${t.pos}`;
        const record = forecastMap.get(key);
        const fruits = record ? record.fruits : 0;
        treeTotals[t.pos] = fruits;
        if (fruits > 0) {
          treesChecked.push(t.pos);
        } else {
          treesMissing.push(t.pos);
        }
      }

      const activeTrees = treesChecked.length;
      plotTreesChecked += activeTrees;

      let pointStatus = 'missing';
      if (activeTrees === 5) {
        pointStatus = 'done';
        completedPoints++;
      } else if (activeTrees > 0) {
        pointStatus = 'partial';
        partialPoints++;
        missingItemsList.push(`${pt.label}: ขาด ${treesMissing.join(', ')}`);
      } else {
        pointStatus = 'missing';
        missingPoints++;
        missingItemsList.push(`${pt.label}: ยังไม่ตรวจ (0/5)`);
      }

      return {
        label: pt.label,
        no: pt.no,
        activeTrees,
        treeTotals,
        treesChecked,
        treesMissing,
        status: pointStatus,
      };
    });

    const percentComplete = Math.round((plotTreesChecked / 35) * 100);
    let status = 'not_started';
    if (plotTreesChecked === 35) {
      status = 'complete';
      completedPlotsCount++;
    } else if (plotTreesChecked > 0) {
      status = 'incomplete';
      incompletePlotsCount++;
    } else {
      status = 'not_started';
      notStartedPlotsCount++;
    }

    const cutInfo = cutsMap.get(plot.id) || { count: 0, totalYield: 0, lastDate: null };

    return {
      ...plot,
      points,
      totalTreesChecked: plotTreesChecked,
      percentComplete,
      completedPoints,
      partialPoints,
      missingPoints,
      status,
      missingSummary: missingItemsList.length > 0 ? missingItemsList.join(' | ') : 'ครบ 35/35 ต้น',
      cutsCount: cutInfo.count,
      totalCutYield: cutInfo.totalYield,
      lastCutDate: cutInfo.lastDate,
    };
  });

  const totalPossibleTrees = plots.length * 35;
  const totalTreesCheckedAll = enrichedPlots.reduce((acc, p) => acc + p.totalTreesChecked, 0);
  const overallPercent = totalPossibleTrees > 0
    ? Math.round((totalTreesCheckedAll / totalPossibleTrees) * 100)
    : 0;

  return {
    plots: enrichedPlots,
    summary: {
      totalPlots: plots.length,
      completedPlots: completedPlotsCount,
      incompletePlots: incompletePlotsCount,
      notStartedPlots: notStartedPlotsCount,
      totalPossibleTrees,
      totalTreesChecked: totalTreesCheckedAll,
      overallPercent,
    },
  };
}

