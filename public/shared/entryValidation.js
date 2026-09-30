/**
 * Shared entry validation logic
 * Used by both backend (core.js) and frontend (app.js)
 * DRY principle — validate once, use everywhere
 */

export const CONFIG = {
  provinces: [
    { code: 'nakhon_pathom', label: 'นครปฐม', pinLabel: 'NP' },
    { code: 'ratchaburi', label: 'ราชบุรี', pinLabel: 'RB' },
    { code: 'samut_sakhon', label: 'สมุทรสาคร', pinLabel: 'SSK' },
    { code: 'samut_songkhram', label: 'สมุทรสงคราม', pinLabel: 'SSM' },
  ],
  maxPlots: 10,
  bunchesPerPlot: 2,
  totalRounds: 6,
  roundDays: 21,
  startDate: '2026-06-01',
};

const provinceCodes = new Set(CONFIG.provinces.map((province) => province.code));

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
  price_standard: 'ราคาเกรด 1.80 ขึ้นไป',
  price_below: 'ราคาเกรด 1.40 - 1.79',
  price_domestic: 'ราคาเกรด 1.20 - 1.39',
  price_damaged: 'ราคาเกรดต่ำกว่า 1.20',
};

function toInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${FIELD_LABELS[name] || name}ไม่ถูกต้อง`);
  return number;
}

function toNonNegativeInt(value, name) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = toInt(value, name);
  if (number < 0) throw new Error(`${FIELD_LABELS[name] || name}ไม่ถูกต้อง`);
  return number;
}

function toNullableNumber(value, name) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${FIELD_LABELS[name] || name}ไม่ถูกต้อง`);
  return number;
}

/**
 * Normalize and validate entry input
 * @param {Object} input
 * @returns {Object} normalized entry
 */
export function normalizeEntryInput(input) {
  const round = toInt(input.round, 'round');
  const provinceCode = String(input.province_code || '').trim();
  const plot = toInt(input.plot, 'plot');
  const bunch = toInt(input.bunch, 'bunch');
  const quality = toNonNegativeInt(input.quality, 'quality');
  const below = toNonNegativeInt(input.below, 'below');
  const domestic = toNonNegativeInt(input.domestic, 'domestic');
  const damaged = toNonNegativeInt(input.damaged, 'damaged');
  const weight = toNullableNumber(input.weight, 'weight');
  const circum = toNullableNumber(input.circum, 'circum');
  const price_standard = toNullableNumber(input.price_standard, 'price_standard');
  const price_below = toNullableNumber(input.price_below, 'price_below');
  const price_domestic = toNullableNumber(input.price_domestic, 'price_domestic');
  const price_damaged = toNullableNumber(input.price_damaged, 'price_damaged');

  if (round < 1 || round > CONFIG.totalRounds) throw new Error('รอบการประเมินไม่ถูกต้อง');
  if (!provinceCodes.has(provinceCode)) throw new Error('จังหวัดไม่ถูกต้อง');
  if (plot < 1) throw new Error('แปลงไม่ถูกต้อง');
  if (bunch < 1 || bunch > CONFIG.bunchesPerPlot) throw new Error('ทะลายไม่ถูกต้อง');

  return {
    round,
    province_code: provinceCode,
    plot,
    bunch,
    quality,
    below,
    domestic,
    damaged,
    total: quality + below + domestic + damaged,
    weight,
    circum,
    notes: String(input.notes || '').trim(),
    price_standard,
    price_below,
    price_domestic,
    price_damaged,
  };
}

/**
 * Calculate progress percentage for a province in a round
 * @param {number} filled - number of filled entries
 * @param {number} maxRows - total expected entries
 * @returns {number} percentage (0-100)
 */
export function calculateProgressPercent(filled, maxRows) {
  if (maxRows <= 0) return 0;
  return Math.round((filled / maxRows) * 100);
}

/**
 * Get progress status color based on percentage
 * @param {number} percentage
 * @returns {string} color class
 */
export function getProgressColorClass(percentage) {
  if (percentage >= 80) return 'progress-green';
  if (percentage >= 40) return 'progress-yellow';
  return 'progress-red';
}

/**
 * Realistic sanity bounds for aromatic coconut (มะพร้าวน้ำหอม DOAE)
 */
export const SANITY_BOUNDS = {
  fruitPerBunch: {
    normalMin: 5,
    normalMax: 25,
    warnMax: 30,
    severeMax: 60,
    label: 'จำนวนผลรวมต่อทะลาย',
    unit: 'ผล',
  },
  singleGradeCount: {
    warnMax: 25,
    severeMax: 50,
  },
  weight: {
    normalMin: 1.0,
    normalMax: 2.5,
    warnMin: 0.6,
    warnMax: 3.2,
    severeMax: 5.0,
    label: 'น้ำหนักเฉลี่ยต่อผล',
    unit: 'กก.',
  },
  circum: {
    normalMin: 40,
    normalMax: 68,
    warnMin: 25,
    warnMax: 75,
    severeMax: 90,
    label: 'เส้นรอบวงเฉลี่ย',
    unit: 'ซม.',
  },
  price: {
    normalMin: 3,
    normalMax: 45,
    warnMin: 1,
    warnMax: 60,
    severeMax: 120,
    label: 'ราคาต่อผล',
    unit: 'บาท',
  },
};

/**
 * Check if a number looks like someone typed an extra zero or missed decimal point.
 * e.g. 18 -> 1.8, 150 -> 15, 520 -> 52, 200 -> 20
 * @param {number} val
 * @param {number} normalMin
 * @param {number} normalMax
 * @returns {number|null} suggested value or null
 */
export function checkExtraZeroSuggestion(val, normalMin, normalMax) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;
  // Case 1: Extra zero (divide by 10)
  const div10 = Number((val / 10).toFixed(2));
  if (div10 >= normalMin && div10 <= normalMax) {
    return div10;
  }
  // Case 2: Missed decimal 2 places (divide by 100, e.g. 175 -> 1.75)
  const div100 = Number((val / 100).toFixed(2));
  if (div100 >= normalMin && div100 <= normalMax) {
    return div100;
  }
  return null;
}

/**
 * Detect anomalies, outliers, and suspected extra zeros for a single entry
 * @param {Object} entry
 * @returns {Array<Object>} list of anomaly objects
 */
export function detectEntryAnomalies(entry) {
  if (!entry) return [];
  const anomalies = [];

  const quality = Number(entry.quality) || 0;
  const below = Number(entry.below) || 0;
  const domestic = Number(entry.domestic) || 0;
  const damaged = Number(entry.damaged) || 0;
  const totalFruits = quality + below + domestic + damaged;

  // Fruit count checks
  if (totalFruits > 0) {
    if (totalFruits > SANITY_BOUNDS.fruitPerBunch.warnMax) {
      const isSevere = totalFruits > SANITY_BOUNDS.fruitPerBunch.severeMax;
      const suggestion = checkExtraZeroSuggestion(
        totalFruits,
        SANITY_BOUNDS.fruitPerBunch.normalMin,
        SANITY_BOUNDS.fruitPerBunch.normalMax
      );
      anomalies.push({
        field: 'total',
        label: 'จำนวนผลรวมต่อทะลาย',
        value: totalFruits,
        unit: 'ผล',
        level: isSevere ? 'error' : 'warning',
        suggestion,
        isExtraZeroSuspect: suggestion !== null,
        message: suggestion
          ? `จำนวนผลรวม ${totalFruits} ผล สูงผิดปกติมากสำหรับทะลายมะพร้าว คาดว่ากรอกเลข 0 เกิน (น่าจะเป็น ${suggestion} ผล)`
          : `จำนวนผลรวม ${totalFruits} ผล สูงกว่าเกณฑ์ปกติ (${SANITY_BOUNDS.fruitPerBunch.normalMin}-${SANITY_BOUNDS.fruitPerBunch.normalMax} ผล)`,
      });
    }

    // Check individual grade counts
    const grades = [
      { key: 'quality', label: 'จำนวนผล 1.80+ (จัมโบ้)', val: quality },
      { key: 'below', label: 'จำนวนผล 1.40-1.79 (มาตรฐาน)', val: below },
      { key: 'domestic', label: 'จำนวนผล 1.20-1.39 (ในประเทศ)', val: domestic },
      { key: 'damaged', label: 'จำนวนผล < 1.20 (ตกเกรด)', val: damaged },
    ];
    for (const g of grades) {
      if (g.val > SANITY_BOUNDS.singleGradeCount.warnMax) {
        const isSevere = g.val > SANITY_BOUNDS.singleGradeCount.severeMax;
        const suggestion = checkExtraZeroSuggestion(g.val, 1, 15);
        anomalies.push({
          field: g.key,
          label: g.label,
          value: g.val,
          unit: 'ผล',
          level: isSevere ? 'error' : 'warning',
          suggestion,
          isExtraZeroSuspect: suggestion !== null,
          message: suggestion
            ? `${g.label} ${g.val} ผล สูงผิดปกติ คาดว่ากรอกเลข 0 เกิน (น่าจะเป็น ${suggestion} ผล)`
            : `${g.label} ${g.val} ผล สูงกว่าเกณฑ์ปกติ`,
        });
      }
    }
  }

  // Weight check
  if (entry.weight !== null && entry.weight !== undefined && entry.weight !== '') {
    const w = Number(entry.weight);
    if (!Number.isNaN(w) && w > 0) {
      if (w > SANITY_BOUNDS.weight.warnMax || w < SANITY_BOUNDS.weight.warnMin) {
        const isSevere = w > SANITY_BOUNDS.weight.severeMax;
        const suggestion = checkExtraZeroSuggestion(
          w,
          SANITY_BOUNDS.weight.normalMin,
          SANITY_BOUNDS.weight.normalMax
        );
        anomalies.push({
          field: 'weight',
          label: 'น้ำหนักเฉลี่ย',
          value: w,
          unit: 'กก.',
          level: isSevere ? 'error' : 'warning',
          suggestion,
          isExtraZeroSuspect: suggestion !== null,
          message: suggestion
            ? `น้ำหนัก ${w} กก. สูงผิดปกติมาก (มะพร้าวน้ำหอมปกติ ${SANITY_BOUNDS.weight.normalMin}-${SANITY_BOUNDS.weight.normalMax} กก.) คาดว่ากรอกเลข 0 เกิน หรือลืมใส่จุดทศนิยม (น่าจะเป็น ${suggestion} กก.)`
            : w > SANITY_BOUNDS.weight.warnMax
            ? `น้ำหนัก ${w} กก. สูงกว่าปกติ (ปกติ ${SANITY_BOUNDS.weight.normalMin}-${SANITY_BOUNDS.weight.normalMax} กก.)`
            : `น้ำหนัก ${w} กก. ต่ำกว่าปกติ (ปกติ ${SANITY_BOUNDS.weight.normalMin}-${SANITY_BOUNDS.weight.normalMax} กก.)`,
        });
      }
    }
  }

  // Circumference check
  if (entry.circum !== null && entry.circum !== undefined && entry.circum !== '') {
    const c = Number(entry.circum);
    if (!Number.isNaN(c) && c > 0) {
      if (c > SANITY_BOUNDS.circum.warnMax || c < SANITY_BOUNDS.circum.warnMin) {
        const isSevere = c > SANITY_BOUNDS.circum.severeMax;
        const suggestion = checkExtraZeroSuggestion(
          c,
          SANITY_BOUNDS.circum.normalMin,
          SANITY_BOUNDS.circum.normalMax
        );
        anomalies.push({
          field: 'circum',
          label: 'เส้นรอบวงเฉลี่ย',
          value: c,
          unit: 'ซม.',
          level: isSevere ? 'error' : 'warning',
          suggestion,
          isExtraZeroSuspect: suggestion !== null,
          message: suggestion
            ? `เส้นรอบวง ${c} ซม. ใหญ่เกินจริง คาดว่ากรอก 0 เกิน หรือใส่หน่วยเป็นมิลลิเมตร (น่าจะเป็น ${suggestion} ซม.)`
            : c > SANITY_BOUNDS.circum.warnMax
            ? `เส้นรอบวง ${c} ซม. สูงกว่าปกติ (ปกติ ${SANITY_BOUNDS.circum.normalMin}-${SANITY_BOUNDS.circum.normalMax} ซม.)`
            : `เส้นรอบวง ${c} ซม. ต่ำกว่าปกติ (ปกติ ${SANITY_BOUNDS.circum.normalMin}-${SANITY_BOUNDS.circum.normalMax} ซม.)`,
        });
      }
    }
  }

  // Price checks
  const priceFields = [
    { key: 'price_standard', label: 'ราคาเกรด 1.80+' },
    { key: 'price_below', label: 'ราคาเกรด 1.40-1.79' },
    { key: 'price_domestic', label: 'ราคาเกรด 1.20-1.39' },
    { key: 'price_damaged', label: 'ราคาเกรด < 1.20' },
  ];
  for (const pf of priceFields) {
    if (entry[pf.key] !== null && entry[pf.key] !== undefined && entry[pf.key] !== '') {
      const p = Number(entry[pf.key]);
      if (!Number.isNaN(p) && p > 0) {
        if (p > SANITY_BOUNDS.price.warnMax) {
          const isSevere = p > SANITY_BOUNDS.price.severeMax;
          const suggestion = checkExtraZeroSuggestion(
            p,
            SANITY_BOUNDS.price.normalMin,
            SANITY_BOUNDS.price.normalMax
          );
          anomalies.push({
            field: pf.key,
            label: pf.label,
            value: p,
            unit: 'บาท',
            level: isSevere ? 'error' : 'warning',
            suggestion,
            isExtraZeroSuspect: suggestion !== null,
            message: suggestion
              ? `${pf.label} ${p} บาท สูงผิดปกติ คาดว่ากรอกเลข 0 เกิน (น่าจะเป็น ${suggestion} บาท)`
              : `${pf.label} ${p} บาท สูงกว่าราคาตลาดปกติ (${SANITY_BOUNDS.price.normalMin}-${SANITY_BOUNDS.price.normalMax} บาท)`,
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Scan an array of entries and return all entries with anomalies
 * @param {Array<Object>} entries
 * @returns {Array<Object>} list of flagged entries with their anomalies
 */
export function scanAllAnomalies(entries = []) {
  const flagged = [];
  for (const entry of entries) {
    const total = (Number(entry.quality) || 0) + (Number(entry.below) || 0) + (Number(entry.domestic) || 0) + (Number(entry.damaged) || 0);
    // Ignore completely empty unrecorded entries
    if (total === 0 && !entry.weight && !entry.circum && !entry.recorded_at) continue;

    const anomalies = detectEntryAnomalies(entry);
    if (anomalies.length > 0) {
      flagged.push({
        round: Number(entry.round),
        province_code: entry.province_code,
        plot: Number(entry.plot),
        bunch: Number(entry.bunch),
        recorded_at: entry.recorded_at || null,
        recorded_by: entry.recorded_by || null,
        recorded_by_label: entry.recorded_by_label || null,
        anomalies,
        hasExtraZero: anomalies.some((a) => a.isExtraZeroSuspect),
        hasSevere: anomalies.some((a) => a.level === 'error'),
        entry,
      });
    }
  }
  return flagged;
}

/**
 * Check completeness status of an entry: 'done' | 'incomplete' | 'missing'
 * @param {Object} entry
 * @returns {{ status: string, missingFields: Array<string> }}
 */
export function getEntryCompleteness(entry) {
  if (!entry) return { status: 'missing', missingFields: [] };
  const total = (Number(entry.quality) || 0) + (Number(entry.below) || 0) + (Number(entry.domestic) || 0) + (Number(entry.damaged) || 0);
  if (total === 0) return { status: 'missing', missingFields: [] };

  const missingFields = [];
  const w = entry.weight !== null && entry.weight !== undefined && entry.weight !== '' ? Number(entry.weight) : null;
  const c = entry.circum !== null && entry.circum !== undefined && entry.circum !== '' ? Number(entry.circum) : null;
  const ps = entry.price_standard !== null && entry.price_standard !== undefined && entry.price_standard !== '' ? Number(entry.price_standard) : null;
  const pb = entry.price_below !== null && entry.price_below !== undefined && entry.price_below !== '' ? Number(entry.price_below) : null;
  const pd = entry.price_domestic !== null && entry.price_domestic !== undefined && entry.price_domestic !== '' ? Number(entry.price_domestic) : null;
  const pdm = entry.price_damaged !== null && entry.price_damaged !== undefined && entry.price_damaged !== '' ? Number(entry.price_damaged) : null;

  if (w === null || w <= 0) missingFields.push('น้ำหนัก');
  if (c === null || c <= 0) missingFields.push('เส้นรอบวง');
  if (ps === null || ps < 0) missingFields.push('ราคาเกรด 1.80+');
  if (pb === null || pb < 0) missingFields.push('ราคาเกรด 1.40-1.79');
  if (pd === null || pd < 0) missingFields.push('ราคาเกรด 1.20-1.39');
  if (pdm === null || pdm < 0) missingFields.push('ราคาเกรด < 1.20');

  return {
    status: missingFields.length > 0 ? 'incomplete' : 'done',
    missingFields,
  };
}
