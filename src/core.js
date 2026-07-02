import { CONFIG as SHARED_CONFIG, normalizeEntryInput as sharedNormalize, calculateProgressPercent as sharedCalcProgress } from '../shared/entryValidation.js';

export const CONFIG = SHARED_CONFIG;

const FIELD_LABELS = {
  round: 'รอบการประเมิน',
  plot: 'แปลง',
  bunch: 'ทะลาย',
  quality: 'จำนวนผล 1.80 ขึ้นไป (ไซส์จัมโบ้)',
  below: 'จำนวนผล 1.40 - 1.79 (เกรดมาตรฐาน)',
  domestic: 'จำนวนผล 1.20 - 1.39 (เกรดในประเทศ)',
  damaged: 'จำนวนผลต่ำกว่า 1.20 (ตกเกรด/ไม่ได้มาตรฐาน)',
  weight: 'น้ำหนักเฉลี่ย',
  circum: 'เส้นรอบวงเฉลี่ย',
};

const provinceCodes = new Set(CONFIG.provinces.map((province) => province.code));

export function getRoundDates() {
  const start = parseDate(CONFIG.startDate);

  return Array.from({ length: CONFIG.totalRounds }, (_, index) => {
    const roundStart = addDays(start, index * CONFIG.roundDays);
    const roundEnd = addDays(roundStart, CONFIG.roundDays - 1);

    return {
      number: index + 1,
      label: `รอบที่ ${index + 1}`,
      start: formatDate(roundStart),
      end: formatDate(roundEnd),
    };
  });
}

export function createInitialEntries() {
  const entries = [];

  for (let round = 1; round <= CONFIG.totalRounds; round += 1) {
    for (const province of CONFIG.provinces) {
      for (let plot = 1; plot <= CONFIG.maxPlots; plot += 1) {
        for (let bunch = 1; bunch <= CONFIG.bunchesPerPlot; bunch += 1) {
          entries.push({
            round,
            province_code: province.code,
            plot,
            bunch,
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
          });
        }
      }
    }
  }

  return entries;
}

export function normalizeEntryInput(input) {
  // Delegate to shared validation logic
  return sharedNormalize(input);
}

export function summarizeEntries(entries) {
  const roundDates = getRoundDates();
  const result = {
    provinces: CONFIG.provinces,
    roundDates,
    rounds: [],
  };

  for (const roundInfo of roundDates) {
    const round = {
      round: roundInfo.number,
      label: roundInfo.label,
      provinces: {},
      overall: blankSummary(),
    };

    const maxPlotsPerProvince = {};
    for (const province of CONFIG.provinces) {
      maxPlotsPerProvince[province.code] = CONFIG.maxPlots;
    }
    for (const entry of entries) {
      if (Number(entry.round) !== roundInfo.number) continue;
      const pCode = entry.province_code;
      if (maxPlotsPerProvince[pCode] !== undefined) {
        maxPlotsPerProvince[pCode] = Math.max(maxPlotsPerProvince[pCode], Number(entry.plot));
      }
    }

    for (const province of CONFIG.provinces) {
      round.provinces[province.code] = blankSummary();
      round.provinces[province.code].maxRows = maxPlotsPerProvince[province.code] * CONFIG.bunchesPerPlot;
      round.provinces[province.code].progressPercent = sharedCalcProgress(
        round.provinces[province.code].filled,
        round.provinces[province.code].maxRows
      );
    }

    for (const entry of entries) {
      if (Number(entry.round) !== roundInfo.number) continue;
      if (!round.provinces[entry.province_code]) continue;

      addEntry(round.provinces[entry.province_code], entry);
      addEntry(round.overall, entry);
    }

    for (const province of CONFIG.provinces) {
      finalizeSummary(round.provinces[province.code]);
    }
    finalizeSummary(round.overall);
    result.rounds.push(round);
  }

  return result;
}

function blankSummary() {
  return {
    totalFruits: 0,
    quality: 0,
    below: 0,
    domestic: 0,
    damaged: 0,
    qualityRate: 0,
    avgWeight: null,
    avgCircum: null,
    weightSum: 0,
    weightCount: 0,
    circumSum: 0,
    circumCount: 0,
    filled: 0,
    maxRows: 0,
  };
}

function addEntry(summary, entry) {
  const quality = Number(entry.quality) || 0;
  const below = Number(entry.below) || 0;
  const domestic = Number(entry.domestic) || 0;
  const damaged = Number(entry.damaged) || 0;
  const weight = Number(entry.weight) || 0;
  const circum = Number(entry.circum) || 0;

  summary.quality += quality;
  summary.below += below;
  summary.domestic += domestic;
  summary.damaged += damaged;
  summary.totalFruits += quality + below + domestic + damaged;

  if (quality > 0 || below > 0 || domestic > 0 || damaged > 0) summary.filled += 1;
  if (weight > 0) {
    summary.weightSum += weight;
    summary.weightCount += 1;
  }
  if (circum > 0) {
    summary.circumSum += circum;
    summary.circumCount += 1;
  }
}

function finalizeSummary(summary) {
  summary.qualityRate = summary.totalFruits > 0 ? summary.quality / summary.totalFruits : 0;
  summary.avgWeight = summary.weightCount > 0 ? summary.weightSum / summary.weightCount : null;
  summary.avgCircum = summary.circumCount > 0 ? summary.circumSum / summary.circumCount : null;
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function toInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${fieldLabel(name)}ไม่ถูกต้อง`);
  return number;
}

function toNonNegativeInt(value, name) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = toInt(value, name);
  if (number < 0) throw new Error(`${fieldLabel(name)}ไม่ถูกต้อง`);
  return number;
}

function toNullableNumber(value, name) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${fieldLabel(name)}ไม่ถูกต้อง`);
  return number;
}

function fieldLabel(name) {
  return FIELD_LABELS[name] || name;
}
