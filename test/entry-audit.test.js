import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from '../functions/api/entry.js';

const user = {
  id: 2,
  province_code: 'ratchaburi',
  province_label: 'ราชบุรี',
  role: 'province',
};

function makeDb(entryRows = []) {
  const prepared = [];
  const batches = [];
  const db = {
    prepared,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async first() {
          if (sql.includes('FROM sessions')) return user;
          if (sql.includes('SELECT round,') && sql.includes('FROM entries')) {
            return entryRows.find((row) => row.round === this.params[0]
              && row.province_code === this.params[1]
              && row.plot === this.params[2]
              && row.bunch === this.params[3]) || null;
          }
          return {};
        },
        async all() {
          return { results: sql.includes('FROM entries') ? entryRows : [] };
        },
        async run() {
          return { success: true };
        },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
  return db;
}

function request(method, body, query = '') {
  return new Request(`https://example.test/api/entry${query}`, {
    method,
    headers: {
      cookie: 'sid=test-session',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('saving an entry writes an audit row with before and after snapshots', async () => {
  const db = makeDb([{
    round: 1,
    province_code: 'ratchaburi',
    plot: 1,
    bunch: 1,
    quality: 0,
    below: 0,
    domestic: 0,
    damaged: 0,
    weight: null,
    circum: null,
    notes: '',
    price_standard: null,
    price_below: null,
    price_domestic: null,
    price_damaged: null,
    recorded_at: null,
    recorded_by: null,
  }]);

  const response = await onRequest({
    request: request('POST', {
      round: 1,
      province_code: 'nakhon_pathom',
      plot: 1,
      bunch: 1,
      quality: 3,
      below: 2,
      weight: 1.5,
      circum: 45,
    }),
    env: { DB: db },
  });

  assert.equal(response.status, 200);
  const audit = db.batches[0].find((statement) => statement.sql.includes('INSERT INTO entry_audit_log'));
  assert.ok(audit);
  assert.equal(audit.params[0], 'create');
  assert.equal(audit.params[1], 1);
  assert.equal(audit.params[2], 'ratchaburi');
  assert.deepEqual(JSON.parse(audit.params.at(-2)), {
    round: 1,
    province_code: 'ratchaburi',
    plot: 1,
    bunch: 1,
    quality: 0,
    below: 0,
    domestic: 0,
    damaged: 0,
    weight: null,
    circum: null,
    notes: '',
    price_standard: null,
    price_below: null,
    price_domestic: null,
    price_damaged: null,
    recorded_at: null,
    recorded_by: null,
  });
  const after = JSON.parse(audit.params.at(-1));
  assert.equal(after.quality, 3);
  assert.equal(after.recorded_by, 2);
  assert.match(after.recorded_at, /^20\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/);
});

test('deleting a plot writes one audit row for each deleted bunch', async () => {
  const db = makeDb([
    { round: 1, province_code: 'ratchaburi', plot: 2, bunch: 1, quality: 4, recorded_at: '2026-09-02 01:00:00' },
    { round: 1, province_code: 'ratchaburi', plot: 2, bunch: 2, quality: 5, recorded_at: '2026-09-02 01:01:00' },
  ]);

  const response = await onRequest({
    request: request('DELETE', undefined, '?round=1&plot=2'),
    env: { DB: db },
  });

  assert.equal(response.status, 200);
  const auditRows = db.batches[0].filter((statement) => statement.sql.includes('INSERT INTO entry_audit_log'));
  assert.equal(auditRows.length, 2);
  assert.deepEqual(auditRows.map((statement) => statement.params[0]), ['delete', 'delete']);
  assert.deepEqual(auditRows.map((statement) => statement.params[4]), [1, 2]);
  assert.deepEqual(auditRows.map((statement) => statement.params.at(-1)), [null, null]);
});
