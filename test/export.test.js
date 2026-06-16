import assert from 'node:assert/strict';
import test from 'node:test';

import { entriesToExcelHtml } from '../src/export.js';

test('entriesToExcelHtml creates Excel-readable table with escaped values', () => {
  const html = entriesToExcelHtml([
    {
      round: 1,
      province_code: 'nakhon_pathom',
      province_label: 'Nakhon Pathom',
      plot: 1,
      bunch: 2,
      quality: 10,
      below: 1,
      damaged: 0,
      weight: 1.2,
      circum: 42,
      notes: '<checked>',
      recorded_at: '2026-06-01 09:00:00',
    },
  ]);

  assert.match(html, /<table>/);
  assert.match(html, /Nakhon Pathom/);
  assert.match(html, /&lt;checked&gt;/);
  assert.match(html, /อัตรา 1.8\+/);
  assert.match(html, /90.91%/);
});
