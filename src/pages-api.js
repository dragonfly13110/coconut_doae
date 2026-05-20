import { clearSessionCookie, parseCookies } from './auth.js';

export async function ensureDbInitialized(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') return;
  try {
    const stmt = db.prepare('SELECT 1 FROM users LIMIT 1');
    if (stmt && typeof stmt.first === 'function') {
      await stmt.first();
    }
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
  } catch (error) {
    if (error.message.includes('no such table') || error.message.includes('SQLITE_ERROR')) {
      const schemaSql = `
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
          damaged INTEGER NOT NULL DEFAULT 0,
          weight REAL,
          circum REAL,
          notes TEXT NOT NULL DEFAULT '',
          recorded_at TEXT,
          recorded_by INTEGER,
          price_standard REAL,
          price_below REAL,
          PRIMARY KEY (round, province_code, plot, bunch),
          FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entries_round_province ON entries(round, province_code);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `;

      const seedSql = `
        INSERT INTO users (province_code, province_label, pin_hash, role) VALUES 
        ('nakhon_pathom', 'นครปฐม', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province'),
        ('ratchaburi', 'ราชบุรี', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province'),
        ('samut_sakhon', 'สมุทรสาคร', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province'),
        ('samut_songkhram', 'สมุทรสงคราม', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province'),
        ('doae', 'กรมส่งเสริมการเกษตร (ส่วนกลาง)', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'admin')
        ON CONFLICT(province_code) DO UPDATE SET pin_hash = excluded.pin_hash;
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
      await runSql(seedSql);
    } else {
      throw error;
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

  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, u.id, u.province_code, u.province_label, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).bind(cookies.sid).first();

  if (!row) throw unauthorized();
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
