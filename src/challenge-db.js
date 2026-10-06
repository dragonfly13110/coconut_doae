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
  { no: 1, pos: 'C', label: 'ต้นที่ 1 (จุด C - กึ่งกลาง)', shortLabel: 'ต้นที่ 1 (C กลาง)' },
  { no: 2, pos: 'L', label: 'ต้นที่ 2 (จุด L - ด้านซ้าย)', shortLabel: 'ต้นที่ 2 (L ซ้าย)' },
  { no: 3, pos: 'R', label: 'ต้นที่ 3 (จุด R - ด้านขวา)', shortLabel: 'ต้นที่ 3 (R ขวา)' },
  { no: 4, pos: 'F', label: 'ต้นที่ 4 (จุด F - ด้านหน้า)', shortLabel: 'ต้นที่ 4 (F หน้า)' },
  { no: 5, pos: 'B', label: 'ต้นที่ 5 (จุด B - ด้านหลัง)', shortLabel: 'ต้นที่ 5 (B หลัง)' },
];

export const MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export async function ensureChallengeDb(db) {
  if (!db || typeof db.prepare !== 'function') return;

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
      fruit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES farmer_plots(id) ON DELETE CASCADE,
      UNIQUE (plot_id, point_label, tree_position, bunch_no, harvest_month)
    );
  `).run();

  // Ensure migration if existing table lacks point_label in UNIQUE constraint
  try {
    const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='yield_forecasts'").first();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('point_label, tree_position')) {
      await db.prepare(`
        CREATE TABLE yield_forecasts_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plot_id INTEGER NOT NULL,
          province_code TEXT NOT NULL,
          tree_no INTEGER NOT NULL,
          tree_position TEXT NOT NULL,
          point_label TEXT NOT NULL DEFAULT 'จุดที่ 1',
          bunch_no INTEGER NOT NULL,
          harvest_month INTEGER NOT NULL,
          fruit_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plot_id) REFERENCES farmer_plots(id) ON DELETE CASCADE,
          UNIQUE (plot_id, point_label, tree_position, bunch_no, harvest_month)
        );
      `).run();
      await db.prepare(`INSERT OR IGNORE INTO yield_forecasts_v2 SELECT * FROM yield_forecasts;`).run();
      await db.prepare(`DROP TABLE yield_forecasts;`).run();
      await db.prepare(`ALTER TABLE yield_forecasts_v2 RENAME TO yield_forecasts;`).run();
    }
  } catch (err) {
    // Silently continue if already migrated or sqlite_master unavailable in mock
  }

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_yield_forecasts_lookup ON yield_forecasts(plot_id, point_label, tree_position, bunch_no);
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
  } catch (e) {}

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_harvest_cuts_plot ON harvest_cuts(plot_id, cut_round);
  `).run();

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

