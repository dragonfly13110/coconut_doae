/**
 * Shared entry validation - frontend version
 * Mirrors backend validation for DRY principle
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

const provinceCodes = new Set(CONFIG.provinces.map((p) => p.code));

const FIELD_LABELS = {
  round: 'รอบการประเมิน',
  plot: 'แปลง',
  bunch: 'ทะลาย',
  quality: 'จำนวนผลคุณภาพ',
  below: 'จำนวนผลต่ำกว่ามาตรฐาน',
  damaged: 'จำนวนผลเสียหาย',
  weight: 'น้ำหนักเฉลี่ย',
  circum: 'เส้นรอบวงเฉลี่ย',
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

export function normalizeEntryInput(input) {
  const round = toInt(input.round, 'round');
  const provinceCode = String(input.province_code || '').trim();
  const plot = toInt(input.plot, 'plot');
  const bunch = toInt(input.bunch, 'bunch');
  const quality = toNonNegativeInt(input.quality, 'quality');
  const below = toNonNegativeInt(input.below, 'below');
  const damaged = toNonNegativeInt(input.damaged, 'damaged');
  const weight = toNullableNumber(input.weight, 'weight');
  const circum = toNullableNumber(input.circum, 'circum');

  if (round < 1 || round > CONFIG.totalRounds) throw new Error('รอบการประเมินไม่ถูกต้อง');
  if (!provinceCodes.has(provinceCode)) throw new Error('จังหวัดไม่ถูกต้อง');
  if (plot < 1 || plot > CONFIG.maxPlots) throw new Error('แปลงไม่ถูกต้อง');
  if (bunch < 1 || bunch > CONFIG.bunchesPerPlot) throw new Error('ทะลายไม่ถูกต้อง');

  return {
    round,
    province_code: provinceCode,
    plot,
    bunch,
    quality,
    below,
    damaged,
    total: quality + below + damaged,
    weight,
    circum,
    notes: String(input.notes || '').trim(),
  };
}

export function calculateProgressPercent(filled, maxRows) {
  if (maxRows <= 0) return 0;
  return Math.round((filled / maxRows) * 100);
}

export function getProgressColorClass(percentage) {
  if (percentage >= 80) return 'progress-green';
  if (percentage >= 40) return 'progress-yellow';
  return 'progress-red';
}
