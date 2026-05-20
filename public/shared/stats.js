export function blankGroupStats() {
  return {
    n: 0,
    totalFruits: 0,
    quality: 0,
    below: 0,
    damaged: 0,
    qualityRate: 0,
    weightVals: [],
    circumVals: [],
    priceStandardVals: [],
    priceBelowVals: [],
    avgWeight: null,
    sdWeight: null,
    avgCircum: null,
    sdCircum: null,
    avgPriceStandard: null,
    sdPriceStandard: null,
    avgPriceBelow: null,
    sdPriceBelow: null,
    missingWeight: 0,
    missingCircum: 0,
  };
}

export function buildProvinceRoundBunchStats(entries, provinces, totalRounds, bunchesPerPlot) {
  const groups = {};

  for (const province of provinces) {
    for (let round = 1; round <= totalRounds; round += 1) {
      for (let bunch = 1; bunch <= bunchesPerPlot; bunch += 1) {
        groups[groupKey(province.code, round, bunch)] = blankGroupStats();
      }
    }
  }

  for (const entry of entries) {
    const key = groupKey(entry.province_code, Number(entry.round), Number(entry.bunch));
    if (!groups[key]) continue;
    accumGroup(groups[key], entry);
  }

  Object.values(groups).forEach(finalizeGroupStats);
  return groups;
}

export function buildSummaryCsvRows(stats, provinces, totalRounds, bunchesPerPlot) {
  const source = stats.byProvinceRoundBunch || {};
  const rows = [];

  for (const province of provinces) {
    for (let round = 1; round <= totalRounds; round += 1) {
      for (let bunch = 1; bunch <= bunchesPerPlot; bunch += 1) {
        const g = source[groupKey(province.code, round, bunch)] || blankGroupStats();
        rows.push([
          province.label,
          `รอบที่ ${round}`,
          `ทะลายที่ ${bunch}`,
          g.n,
          g.totalFruits,
          g.qualityRate.toFixed(3),
          g.avgWeight !== null ? g.avgWeight.toFixed(2) : '',
          g.sdWeight !== null ? g.sdWeight.toFixed(2) : '',
          g.avgCircum !== null ? g.avgCircum.toFixed(2) : '',
          g.sdCircum !== null ? g.sdCircum.toFixed(2) : '',
        ]);
      }
    }
  }

  return rows;
}

export function computeHistogram(entries, key, binSize, unit) {
  const values = entries
    .map((entry) => Number(entry[key]))
    .filter((value) => value > 0 && Number.isFinite(value));
  if (values.length === 0) return [];

  const min = Math.floor(Math.min(...values) / binSize) * binSize;
  let max = Math.ceil(Math.max(...values) / binSize) * binSize;
  if (max === min) max = min + binSize;

  const bins = {};
  for (let value = min; value < max; value += binSize) {
    bins[histogramLabel(value, binSize, unit)] = 0;
  }

  values.forEach((value) => {
    const bucket = Math.floor(value / binSize) * binSize;
    const clampedBucket = Math.min(bucket, max - binSize);
    bins[histogramLabel(clampedBucket, binSize, unit)] += 1;
  });

  return Object.entries(bins).map(([label, count]) => ({ label, count }));
}

function groupKey(provinceCode, round, bunch) {
  return `${provinceCode}-${round}-${bunch}`;
}

function accumGroup(group, entry) {
  const quality = Number(entry.quality) || 0;
  const below = Number(entry.below) || 0;
  const damaged = Number(entry.damaged) || 0;
  const total = quality + below + damaged;
  const weight = Number(entry.weight);
  const circum = Number(entry.circum);
  const ps = entry.price_standard !== null && entry.price_standard !== undefined && entry.price_standard !== '' ? Number(entry.price_standard) : null;
  const pb = entry.price_below !== null && entry.price_below !== undefined && entry.price_below !== '' ? Number(entry.price_below) : null;

  if (total > 0) group.n += 1;
  group.totalFruits += total;
  group.quality += quality;
  group.below += below;
  group.damaged += damaged;

  if (Number.isFinite(weight) && weight > 0) group.weightVals.push(weight);
  else if (total > 0) group.missingWeight += 1;

  if (Number.isFinite(circum) && circum > 0) group.circumVals.push(circum);
  else if (total > 0) group.missingCircum += 1;

  if (ps !== null && Number.isFinite(ps) && ps >= 0) group.priceStandardVals.push(ps);
  if (pb !== null && Number.isFinite(pb) && pb >= 0) group.priceBelowVals.push(pb);
}

function finalizeGroupStats(group) {
  group.qualityRate = group.totalFruits > 0 ? group.quality / group.totalFruits : 0;
  if (group.weightVals.length) {
    group.avgWeight = group.weightVals.reduce((sum, value) => sum + value, 0) / group.weightVals.length;
    group.sdWeight = stdDev(group.weightVals);
  }
  if (group.circumVals.length) {
    group.avgCircum = group.circumVals.reduce((sum, value) => sum + value, 0) / group.circumVals.length;
    group.sdCircum = stdDev(group.circumVals);
  }
  if (group.priceStandardVals && group.priceStandardVals.length) {
    group.avgPriceStandard = group.priceStandardVals.reduce((sum, value) => sum + value, 0) / group.priceStandardVals.length;
    group.sdPriceStandard = stdDev(group.priceStandardVals);
  } else {
    group.avgPriceStandard = null;
    group.sdPriceStandard = null;
  }
  if (group.priceBelowVals && group.priceBelowVals.length) {
    group.avgPriceBelow = group.priceBelowVals.reduce((sum, value) => sum + value, 0) / group.priceBelowVals.length;
    group.sdPriceBelow = stdDev(group.priceBelowVals);
  } else {
    group.avgPriceBelow = null;
    group.sdPriceBelow = null;
  }
}

function stdDev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function histogramLabel(value, binSize, unit) {
  const digits = value < 1 && binSize < 1 ? 1 : 0;
  return `${value.toFixed(digits)}-${(value + binSize).toFixed(digits)} ${unit}`;
}
