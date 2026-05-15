import { readFile } from 'node:fs/promises';
import { CONFIG, createInitialEntries } from '../src/core.js';
import { hashPin } from '../src/auth.js';

const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseName = process.env.D1_DATABASE_NAME || 'coconut_doae';
const pepper = process.env.PIN_PEPPER || process.env.SESSION_SECRET || '';

if (!token || !accountId) {
  throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
}

if (!pepper) {
  throw new Error('PIN_PEPPER or SESSION_SECRET is required');
}

const database = await ensureDatabase(databaseName);
await query(database.uuid, await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));

const pins = {};
for (const province of CONFIG.provinces) {
  pins[province.code] = process.env[`PIN_${province.code.toUpperCase()}`] || randomPin();
  await query(database.uuid, `
    INSERT INTO users (province_code, province_label, pin_hash, role)
    VALUES (?, ?, ?, 'province')
    ON CONFLICT(province_code) DO UPDATE SET
      province_label = excluded.province_label,
      pin_hash = excluded.pin_hash
  `, [province.code, province.label, await hashPin(pins[province.code], pepper)]);
}

for (const entry of createInitialEntries()) {
  await query(database.uuid, `
    INSERT OR IGNORE INTO entries (
      round, province_code, plot, bunch, quality, below, damaged, weight, circum, notes, recorded_at
    ) VALUES (?, ?, ?, ?, 0, 0, 0, NULL, NULL, '', NULL)
  `, [entry.round, entry.province_code, entry.plot, entry.bunch]);
}

console.log(JSON.stringify({ database, pins }, null, 2));

async function ensureDatabase(name) {
  const list = await cf(`/accounts/${accountId}/d1/database`);
  const existing = list.result.find((db) => db.name === name);
  if (existing) return existing;

  const created = await cf(`/accounts/${accountId}/d1/database`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return created.result;
}

async function query(databaseId, sql, params = []) {
  const response = await cf(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
  if (!response.success) throw new Error(JSON.stringify(response.errors));
  return response.result;
}

async function cf(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(JSON.stringify(data.errors || data));
  }
  return data;
}

function randomPin() {
  return String(100000 + Math.floor(Math.random() * 900000));
}
