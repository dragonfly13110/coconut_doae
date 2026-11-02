import { clearSessionCookie, parseCookies } from './auth.js';
import { ensureChallengeDb } from './challenge-db.js';
import { SYSTEM_ACCOUNTS, ensureSystemAuditDb } from './user-accounts.js';

export async function ensureDbInitialized(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') return;
  try {
    const stmt = db.prepare('SELECT 1 FROM users LIMIT 1');
    if (stmt && typeof stmt.first === 'function') {
      await stmt.first();
    }
    await db.prepare(`
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
      )
    `).run();
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_entry_audit_log_lookup
      ON entry_audit_log(province_code, round, plot, bunch, changed_at)
    `).run();
    await db.prepare(`
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
      )
    `).run();
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_entry_photos_lookup
      ON entry_photos(round, province_code, plot, bunch)
    `).run();
    // Check if the price columns exist, if not, add them (self-healing for existing DBs)
    try {
      await db.prepare('SELECT price_standard FROM entries LIMIT 1').first();
    } catch (err) {
      try {
        await db.prepare('ALTER TABLE entries ADD COLUMN price_standard REAL').run();
        await db.prepare('ALTER TABLE entries ADD COLUMN price_below REAL').run();
      } catch (alterError) {
        // ignore
      }
    }
    // Self-healing check for new columns: domestic, price_domestic, price_damaged
    try {
      await db.prepare('SELECT domestic FROM entries LIMIT 1').first();
    } catch (err) {
      try {
        await db.prepare('ALTER TABLE entries ADD COLUMN domestic INTEGER NOT NULL DEFAULT 0').run();
      } catch (alterError) {}
    }
    try {
      await db.prepare('SELECT price_domestic FROM entries LIMIT 1').first();
    } catch (err) {
      try {
        await db.prepare('ALTER TABLE entries ADD COLUMN price_domestic REAL').run();
      } catch (alterError) {}
    }
    try {
      await db.prepare('SELECT price_damaged FROM entries LIMIT 1').first();
    } catch (err) {
      try {
        await db.prepare('ALTER TABLE entries ADD COLUMN price_damaged REAL').run();
      } catch (alterError) {}
    }
    await ensureChallengeDb(db);
    await ensureSystemAuditDb(db);
    await seedSystemUsers(db);
  } catch (error) {
    if (error.message.includes('no such table') || error.message.includes('SQLITE_ERROR')) {
      const schemaSql = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          province_code TEXT NOT NULL,
          province_label TEXT NOT NULL,
          district_code TEXT,
          district_name TEXT,
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
        CREATE INDEX IF NOT EXISTS idx_entries_round_province ON entries(round, province_code);
        CREATE INDEX IF NOT EXISTS idx_entry_audit_log_lookup ON entry_audit_log(province_code, round, plot, bunch, changed_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `;

      const runSql = async (sql) => {
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        for (const stmt of statements) {
          await db.prepare(stmt).run();
        }
      };
      await runSql(schemaSql);
      await ensureSystemAuditDb(db);
      await seedSystemUsers(db);
    } else {
      throw error;
    }
  }
}

export async function seedSystemUsers(db) {
  if (!db || typeof db.prepare !== 'function') return;

  // Self-heal: ensure users table columns exist
  try {
    await db.prepare('SELECT username FROM users LIMIT 1').first();
  } catch {
    try {
      await db.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
    } catch {}
  }
  try {
    await db.prepare('SELECT district_code FROM users LIMIT 1').first();
  } catch {
    try {
      await db.prepare('ALTER TABLE users ADD COLUMN district_code TEXT').run();
      await db.prepare('ALTER TABLE users ADD COLUMN district_name TEXT').run();
    } catch {}
  }



  // Seed / update all system accounts
  for (const acc of SYSTEM_ACCOUNTS) {
    try {
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(acc.username).first();
      if (existing) {
        await db.prepare(`
          UPDATE users SET
            province_code = ?,
            province_label = ?,
            district_code = ?,
            district_name = ?,
            role = ?
          WHERE id = ?
        `).bind(
          acc.province_code,
          acc.province_label,
          acc.district_code,
          acc.district_name,
          acc.role,
          existing.id,
        ).run();
      } else {
        await db.prepare(`
          INSERT INTO users (username, province_code, province_label, district_code, district_name, pin_hash, role)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          acc.username,
          acc.province_code,
          acc.province_label,
          acc.district_code,
          acc.district_name,
          acc.pin_hash,
          acc.role,
        ).run();
      }
    } catch (e) {
      console.error('Failed to seed user account', acc.username, e);
    }
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed() {
  return json({ error: 'ไม่รองรับวิธีเรียกใช้งานนี้' }, { status: 405 });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('รูปแบบข้อมูล JSON ไม่ถูกต้อง');
  }
}

export async function requireUser(request, env) {
  await ensureDbInitialized(env.DB);
  const cookies = parseCookies(request.headers.get('cookie') || '');
  if (!cookies.sid) throw unauthorized();

  let row = null;
  try {
    row = await env.DB.prepare(`
      SELECT s.id AS session_id, u.id, u.username, u.province_code, u.province_label, u.district_code, u.district_name, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).bind(cookies.sid).first();
  } catch {
    row = await env.DB.prepare(`
      SELECT s.id AS session_id, u.id, u.province_code, u.province_label, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).bind(cookies.sid).first();
  }

  if (!row) throw unauthorized();
  if (!row.username) row.username = row.province_code;
  return row;
}

export function authErrorResponse(error) {
  if (error && error.status === 401) {
    return json(
      { error: 'กรุณาเข้าสู่ระบบใหม่' },
      { status: 401, headers: { 'set-cookie': clearSessionCookie() } },
    );
  }
  return null;
}

function unauthorized() {
  const error = new Error('กรุณาเข้าสู่ระบบใหม่');
  error.status = 401;
  return error;
}
