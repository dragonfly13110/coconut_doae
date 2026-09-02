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

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions(expires_at);
