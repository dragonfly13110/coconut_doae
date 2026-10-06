CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province_code TEXT NOT NULL UNIQUE,
  province_label TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'province',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entries (
  round INTEGER NOT NULL,
  province_code TEXT NOT NULL,
  plot INTEGER NOT NULL,
  bunch INTEGER NOT NULL,
  quality INTEGER NOT NULL DEFAULT 0,
  below INTEGER NOT NULL DEFAULT 0,
  domestic INTEGER NOT NULL DEFAULT 0,
  damaged INTEGER NOT NULL DEFAULT 0,
  weight REAL,
  circum REAL,
  notes TEXT NOT NULL DEFAULT '',
  recorded_at TEXT,
  recorded_by INTEGER,
  price_standard REAL,
  price_below REAL,
  price_domestic REAL,
  price_damaged REAL,
  PRIMARY KEY (round, province_code, plot, bunch),
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_round_province
ON entries(round, province_code);

CREATE TABLE IF NOT EXISTS entry_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  round INTEGER NOT NULL,
  province_code TEXT NOT NULL,
  plot INTEGER NOT NULL,
  bunch INTEGER NOT NULL,
  changed_by INTEGER,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before_json TEXT,
  after_json TEXT,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_audit_log_lookup
ON entry_audit_log(province_code, round, plot, bunch, changed_at);

CREATE TABLE IF NOT EXISTS entry_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round INTEGER NOT NULL,
  province_code TEXT NOT NULL,
  plot INTEGER NOT NULL,
  bunch INTEGER NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  photo_data TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_photos_lookup
ON entry_photos(round, province_code, plot, bunch);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions(expires_at);

-- ===================================================
-- Challenge / New Mode Database Tables (Excel Dataset)
-- ===================================================

-- 1. Farmer plots (Sheet 1)
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

CREATE INDEX IF NOT EXISTS idx_farmer_plots_province ON farmer_plots(province_code);

-- 2. Yield forecasts (Sheet 2)
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

CREATE INDEX IF NOT EXISTS idx_yield_forecasts_lookup ON yield_forecasts(plot_id, point_label, tree_position, bunch_no);

-- 3. Harvest cuts (Sheet 3)
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

CREATE INDEX IF NOT EXISTS idx_harvest_cuts_plot ON harvest_cuts(plot_id, cut_round);

-- 4. Macro district stats (Sheet 4)
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

CREATE INDEX IF NOT EXISTS idx_macro_stats_province ON macro_district_stats(province_code, year);

