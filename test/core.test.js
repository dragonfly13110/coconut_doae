import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONFIG,
  createInitialEntries,
  getRoundDates,
  normalizeEntryInput,
  summarizeEntries,
} from '../src/core.js';

test('creates one empty entry per round, province, plot, and bunch', () => {
  const entries = createInitialEntries();

  assert.equal(
    entries.length,
    CONFIG.totalRounds * CONFIG.provinces.length * CONFIG.maxPlots * CONFIG.bunchesPerPlot,
  );
  assert.deepEqual(entries[0], {
    round: 1,
    province_code: CONFIG.provinces[0].code,
    plot: 1,
    bunch: 1,
    quality: 0,
    below: 0,
    damaged: 0,
    weight: null,
    circum: null,
    notes: '',
    recorded_at: null,
  });
});

test('round dates are generated from start date and round length', () => {
  const rounds = getRoundDates();

  assert.equal(rounds.length, 6);
  assert.equal(rounds[0].label, 'รอบที่ 1');
  assert.equal(rounds[0].start, '2026-06-01');
  assert.equal(rounds[0].end, '2026-06-21');
  assert.equal(rounds[5].start, '2026-09-14');
  assert.equal(rounds[5].end, '2026-10-04');
});

test('normalizes entry input and rejects invalid location', () => {
  const entry = normalizeEntryInput({
    round: '1',
    province_code: CONFIG.provinces[0].code,
    plot: '2',
    bunch: '1',
    quality: '10',
    below: '',
    damaged: '2',
    weight: '1.25',
    circum: '',
    notes: ' ok ',
  });

  assert.equal(entry.total, 12);
  assert.equal(entry.notes, 'ok');
  assert.equal(entry.weight, 1.25);
  assert.equal(entry.circum, null);

  assert.throws(
    () => normalizeEntryInput({ ...entry, plot: 99 }),
    /แปลงไม่ถูกต้อง/,
  );
});

test('summarizes entries by round and province', () => {
  const data = [
    normalizeEntryInput({
      round: 1,
      province_code: 'nakhon_pathom',
      plot: 1,
      bunch: 1,
      quality: 8,
      below: 1,
      damaged: 1,
      weight: 1.2,
      circum: 42,
      notes: '',
    }),
    normalizeEntryInput({
      round: 1,
      province_code: 'ratchaburi',
      plot: 1,
      bunch: 1,
      quality: 4,
      below: 4,
      damaged: 2,
      weight: 1.4,
      circum: 44,
      notes: '',
    }),
  ];

  const summary = summarizeEntries(data);
  const np = summary.rounds[0].provinces.nakhon_pathom;

  assert.equal(np.totalFruits, 10);
  assert.equal(np.qualityRate, 0.8);
  assert.equal(np.avgWeight, 1.2);
  assert.equal(summary.rounds[0].overall.totalFruits, 20);
  assert.equal(summary.rounds[0].overall.qualityRate, 0.6);
});
