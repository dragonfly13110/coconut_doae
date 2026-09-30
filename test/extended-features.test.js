import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest as onPhotoRequest } from '../functions/api/photo.js';
import { onRequest as onChangePinRequest } from '../functions/api/change-pin.js';
import { onRequest as onImportRequest } from '../functions/api/import.js';
import { hashPin } from '../src/auth.js';

const mockUser = {
  id: 3,
  province_code: 'samut_sakhon',
  province_label: 'สมุทรสาคร',
  role: 'province',
};

function makeMockDb(initialState = {}) {
  const photos = initialState.photos || [];
  const entries = initialState.entries || [];
  const users = initialState.users || [
    { id: 3, province_code: 'samut_sakhon', pin_hash: 'c4ca4238a0b923820dcc509a6f75849b' }, // 1
  ];

  return {
    photos,
    entries,
    users,
    prepare(sql) {
      return {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async first() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM sessions')) return mockUser;
          if (s.includes('FROM users WHERE id = ?')) {
            return users.find((u) => u.id === this.params[0]) || null;
          }
          if (s.includes('FROM entry_photos WHERE id = ?')) {
            return photos.find((p) => p.id === this.params[0]) || null;
          }
          return null;
        },
        async all() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('FROM entry_photos')) {
            return { results: photos };
          }
          if (s.includes('FROM entries')) {
            return { results: entries };
          }
          return { results: [] };
        },
        async run() {
          const s = sql.replace(/\s+/g, ' ');
          if (s.includes('INSERT INTO entry_photos')) {
            const newPhoto = {
              id: photos.length + 1,
              round: this.params[0],
              province_code: this.params[1],
              plot: this.params[2],
              bunch: this.params[3],
              caption: this.params[4],
              photo_data: this.params[5],
              size_bytes: this.params[6],
              uploaded_by: this.params[7],
            };
            photos.push(newPhoto);
            return { meta: { last_row_id: newPhoto.id } };
          }
          if (s.includes('DELETE FROM entry_photos WHERE id = ?')) {
            const idx = photos.findIndex((p) => p.id === this.params[0]);
            if (idx !== -1) photos.splice(idx, 1);
            return { success: true };
          }
          if (s.includes('UPDATE users SET pin_hash = ? WHERE id = ?')) {
            const u = users.find((usr) => usr.id === this.params[1]);
            if (u) u.pin_hash = this.params[0];
            return { success: true };
          }
          return { success: true };
        },
      };
    },
    async batch(statements) {
      return statements.map(() => ({ success: true }));
    },
  };
}

test('photo API handles upload, listing, and deletion', async () => {
  const db = makeMockDb();

  // 1. Upload photo
  const uploadReq = new Request('https://example.test/api/photo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sid=valid' },
    body: JSON.stringify({
      round: 1,
      province_code: 'samut_sakhon',
      plot: 2,
      bunch: 1,
      caption: 'ทะลายสมบูรณ์ ผลดก',
      photo_data: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA',
    }),
  });

  const uploadRes = await onPhotoRequest({ request: uploadReq, env: { DB: db } });
  assert.equal(uploadRes.status, 200);
  const uploadData = await uploadRes.json();
  assert.equal(uploadData.ok, true);
  assert.equal(uploadData.id, 1);

  // 2. List photos for that plot
  const listReq = new Request('https://example.test/api/photo?round=1&plot=2&bunch=1', {
    method: 'GET',
    headers: { cookie: 'sid=valid' },
  });
  const listRes = await onPhotoRequest({ request: listReq, env: { DB: db } });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.photos.length, 1);

  // 3. Delete photo
  const deleteReq = new Request('https://example.test/api/photo?id=1', {
    method: 'DELETE',
    headers: { cookie: 'sid=valid' },
  });
  const deleteRes = await onPhotoRequest({ request: deleteReq, env: { DB: db } });
  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.ok, true);
  assert.equal(db.photos.length, 0);
});

test('change-pin API verifies current PIN and updates hash', async () => {
  const initialHash = await hashPin('1111');
  const db = makeMockDb({
    users: [{ id: 3, province_code: 'samut_sakhon', pin_hash: initialHash }],
  });

  // Rejects wrong current PIN
  const wrongReq = new Request('https://example.test/api/change-pin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sid=valid' },
    body: JSON.stringify({
      current_pin: '9999',
      new_pin: '2222',
      confirm_pin: '2222',
    }),
  });
  const wrongRes = await onChangePinRequest({ request: wrongReq, env: { DB: db } });
  assert.equal(wrongRes.status, 400);

  // Rejects mismatched new PIN
  const mismatchReq = new Request('https://example.test/api/change-pin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sid=valid' },
    body: JSON.stringify({
      current_pin: '1111',
      new_pin: '2222',
      confirm_pin: '3333',
    }),
  });
  const mismatchRes = await onChangePinRequest({ request: mismatchReq, env: { DB: db } });
  assert.equal(mismatchRes.status, 400);

  // Accepts valid PIN change
  const okReq = new Request('https://example.test/api/change-pin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sid=valid' },
    body: JSON.stringify({
      current_pin: '1111',
      new_pin: '2222',
      confirm_pin: '2222',
    }),
  });
  const okRes = await onChangePinRequest({ request: okReq, env: { DB: db } });
  assert.equal(okRes.status, 200);
  const okData = await okRes.json();
  assert.equal(okData.ok, true);

  const updatedUser = db.users.find((u) => u.id === 3);
  const expectedHash = await hashPin('2222');
  assert.equal(updatedUser.pin_hash, expectedHash);
});

test('import API returns CSV template and accepts batch entries', async () => {
  const db = makeMockDb();

  // 1. Template download
  const templateReq = new Request('https://example.test/api/import?template=1&round=2', {
    method: 'GET',
    headers: { cookie: 'sid=valid' },
  });
  const templateRes = await onImportRequest({ request: templateReq, env: { DB: db } });
  assert.equal(templateRes.status, 200);
  const csvText = await templateRes.text();
  assert.ok(csvText.includes('รอบการประเมิน'));
  assert.ok(csvText.includes('samut_sakhon'));

  // 2. Batch import valid rows
  const importReq = new Request('https://example.test/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sid=valid' },
    body: JSON.stringify({
      entries: [
        {
          round: 2,
          plot: 1,
          bunch: 1,
          quality: 10,
          below: 2,
          domestic: 1,
          damaged: 0,
          weight: 1.6,
          circum: 48,
          price_standard: 20,
          price_below: 12,
          price_domestic: 8,
          price_damaged: 3,
        },
      ],
    }),
  });
  const importRes = await onImportRequest({ request: importReq, env: { DB: db } });
  assert.equal(importRes.status, 200);
  const importData = await importRes.json();
  assert.equal(importData.ok, true);
  assert.equal(importData.imported_count, 1);
});
