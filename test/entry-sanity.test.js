import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkExtraZeroSuggestion,
  detectEntryAnomalies,
  getEntryCompleteness,
  scanAllAnomalies,
} from '../shared/entryValidation.js';

test('checkExtraZeroSuggestion detects 10x and 100x numbers', () => {
  // Weight: normal 1.0 - 2.5 kg
  assert.equal(checkExtraZeroSuggestion(18.0, 1.0, 2.5), 1.8);
  assert.equal(checkExtraZeroSuggestion(15.0, 1.0, 2.5), 1.5);
  assert.equal(checkExtraZeroSuggestion(175, 1.0, 2.5), 1.75); // missed decimal point
  assert.equal(checkExtraZeroSuggestion(2.1, 1.0, 2.5), null); // already normal

  // Total fruits: normal 5 - 25 fruits
  assert.equal(checkExtraZeroSuggestion(120, 5, 25), 12);
  assert.equal(checkExtraZeroSuggestion(150, 5, 25), 15);
  assert.equal(checkExtraZeroSuggestion(14, 5, 25), null); // normal

  // Circumference: normal 40 - 68 cm
  assert.equal(checkExtraZeroSuggestion(520, 40, 68), 52);
  assert.equal(checkExtraZeroSuggestion(55, 40, 68), null); // normal

  // Price: normal 3 - 45 THB
  assert.equal(checkExtraZeroSuggestion(200, 3, 45), 20);
  assert.equal(checkExtraZeroSuggestion(25, 3, 45), null); // normal
});

test('detectEntryAnomalies flags abnormal coconut weights and suggests correction', () => {
  const normalEntry = {
    quality: 10,
    below: 2,
    domestic: 1,
    damaged: 1,
    weight: 1.65,
    circum: 48,
    price_standard: 20,
    price_below: 14,
    price_domestic: 8,
    price_damaged: 3,
  };
  assert.deepEqual(detectEntryAnomalies(normalEntry), []);

  const extraZeroWeight = {
    ...normalEntry,
    weight: 18.0, // typed 18.0 instead of 1.80
  };
  const anomalies = detectEntryAnomalies(extraZeroWeight);
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].field, 'weight');
  assert.equal(anomalies[0].suggestion, 1.8);
  assert.equal(anomalies[0].isExtraZeroSuspect, true);
  assert.ok(anomalies[0].message.includes('1.8 กก.'));
});

test('detectEntryAnomalies flags abnormal bunch counts, circumferences, and prices', () => {
  const crazyEntry = {
    quality: 100, // typed 100 instead of 10
    below: 0,
    domestic: 0,
    damaged: 0,
    weight: 1.5,
    circum: 520, // typed 520 instead of 52
    price_standard: 200, // typed 200 instead of 20
  };
  const anomalies = detectEntryAnomalies(crazyEntry);
  assert.ok(anomalies.length >= 3);
  const totalAnomaly = anomalies.find((a) => a.field === 'total');
  const circumAnomaly = anomalies.find((a) => a.field === 'circum');
  const priceAnomaly = anomalies.find((a) => a.field === 'price_standard');

  assert.ok(totalAnomaly && totalAnomaly.suggestion === 10);
  assert.ok(circumAnomaly && circumAnomaly.suggestion === 52);
  assert.ok(priceAnomaly && priceAnomaly.suggestion === 20);
});

test('getEntryCompleteness accurately checks done, incomplete, and missing states', () => {
  assert.equal(getEntryCompleteness(null).status, 'missing');
  assert.equal(getEntryCompleteness({ quality: 0, below: 0, domestic: 0, damaged: 0 }).status, 'missing');

  const incompleteEntry = {
    quality: 10,
    below: 2,
    domestic: 0,
    damaged: 0,
    weight: null, // missing weight
    circum: 45,
    price_standard: 20,
    price_below: 12,
    price_domestic: 8,
    price_damaged: 3,
  };
  const inc = getEntryCompleteness(incompleteEntry);
  assert.equal(inc.status, 'incomplete');
  assert.deepEqual(inc.missingFields, ['น้ำหนัก']);

  const completeEntry = {
    ...incompleteEntry,
    weight: 1.5,
  };
  assert.equal(getEntryCompleteness(completeEntry).status, 'done');
});

test('scanAllAnomalies detects outliers across entries and ignores empty rows', () => {
  const entries = [
    { round: 1, province_code: 'ratchaburi', plot: 1, bunch: 1, quality: 10, below: 2, weight: 1.6, circum: 48, price_standard: 20 },
    { round: 1, province_code: 'ratchaburi', plot: 2, bunch: 1, quality: 120, below: 0, weight: 18.0, circum: 50, price_standard: 20 }, // 2 anomalies!
    { round: 1, province_code: 'ratchaburi', plot: 3, bunch: 1, quality: 0, below: 0, weight: null }, // empty row
  ];

  const flagged = scanAllAnomalies(entries);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].plot, 2);
  assert.equal(flagged[0].hasExtraZero, true);
  assert.equal(flagged[0].anomalies.length, 3); // total, quality, weight
});
