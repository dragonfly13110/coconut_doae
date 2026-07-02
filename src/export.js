const HEADERS = [
  'รอบการประเมิน',
  'รหัสจังหวัด',
  'จังหวัด',
  'แปลง',
  'ทะลาย',
  'จำนวนผล 1.80 ขึ้นไป (ไซส์จัมโบ้)',
  'จำนวนผล 1.40 - 1.79 (เกรดมาตรฐาน)',
  'จำนวนผล 1.20 - 1.39 (เกรดในประเทศ)',
  'จำนวนผลต่ำกว่า 1.20 (ตกเกรด/ไม่ได้มาตรฐาน)',
  'ผลรวม',
  'อัตรา 1.80+ (ไซส์จัมโบ้)',
  'น้ำหนักเฉลี่ย (กก.)',
  'เส้นรอบวงเฉลี่ย (ซม.)',
  'ราคาเกรด 1.80 ขึ้นไป (บาท)',
  'ราคาเกรด 1.40 - 1.79 (บาท)',
  'ราคาเกรด 1.20 - 1.39 (บาท)',
  'ราคาเกรดต่ำกว่า 1.20 (บาท)',
  'หมายเหตุ',
  'วันเวลาที่บันทึก',
];

export function entriesToExcelHtml(entries) {
  const rows = entries.map((entry) => {
    const quality = Number(entry.quality) || 0;
    const below = Number(entry.below) || 0;
    const domestic = Number(entry.domestic) || 0;
    const damaged = Number(entry.damaged) || 0;
    const total = quality + below + domestic + damaged;
    const rate = total > 0 ? `${((quality / total) * 100).toFixed(2)}%` : '';

    return [
      entry.round,
      entry.province_code,
      entry.province_label || entry.province_code,
      entry.plot,
      entry.bunch,
      quality,
      below,
      domestic,
      damaged,
      total,
      rate,
      entry.weight ?? '',
      entry.circum ?? '',
      entry.price_standard ?? '',
      entry.price_below ?? '',
      entry.price_domestic ?? '',
      entry.price_damaged ?? '',
      entry.notes ?? '',
      entry.recorded_at ?? '',
    ];
  });

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 6px 8px; }
    th { background: #d9ead3; font-weight: bold; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table>
</body>
</html>`;
}

export function exportFilename(date = new Date()) {
  return `coconut-doae-${date.toISOString().slice(0, 10)}.xls`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
