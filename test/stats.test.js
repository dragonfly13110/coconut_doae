import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProvinceRoundBunchStats,
  buildSummaryCsvRows,
  computeHistogram,
} from '../src/stats.js';

const provinces = [
  { code: 'nakhon_pathom', label: 'นครปฐม' },
];

test('summary CSV rows keep province, round, and bunch groups separate', () => {
  const entries = [
    { province_code: 'nakhon_pathom', round: 1, bunch: 1, quality: 10, below: 0, damaged: 0, weight: 1.2, circum: 40 },
    { province_code: 'nakhon_pathom', round: 2, bunch: 1, quality: 1, below: 9, damaged: 0, weight: 1.8, circum: 50 },
  ];
  const byProvinceRoundBunch = buildProvinceRoundBunchStats(entries, provinces, 2, 1);

  const rows = buildSummaryCsvRows({ byProvinceRoundBunch }, provinces, 2, 1);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => [row[1], row[3], row[4], row[5]]), [
    ['รอบที่ 1', 1, 10, '1.000'],
    ['รอบที่ 2', 1, 10, '0.100'],
  ]);
});

test('summary CSV rows leave SD blank when a group has only one measurement', () => {
  const entries = [
    { province_code: 'nakhon_pathom', round: 1, bunch: 1, quality: 10, below: 0, damaged: 0, weight: 1.2, circum: 40 },
  ];
  const byProvinceRoundBunch = buildProvinceRoundBunchStats(entries, provinces, 1, 1);

  const [row] = buildSummaryCsvRows({ byProvinceRoundBunch }, provinces, 1, 1);

  assert.equal(row[6], '1.20');
  assert.equal(row[7], '');
  assert.equal(row[8], '40.00');
  assert.equal(row[9], '');
});

test('histogram creates one valid bin when all values are identical', () => {
  const hist = computeHistogram(
    [{ weight: 1.2 }, { weight: 1.2 }, { weight: 1.2 }],
    'weight',
    0.2,
    'กก.',
  );

  assert.deepEqual(hist, [{ label: '1-1 กก.', count: 3 }]);
  assert.equal(Number.isNaN(hist[0].count), false);
});
