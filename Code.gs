/**
 * ระบบเก็บข้อมูลมะพร้าวน้ำหอม 4 จังหวัด 6 รอบ
 * -------------------------------------------------
 * - 4 จังหวัด: นครปฐม ราชบุรี สมุทรสาคร สมุทรสงคราม
 * - 6 รอบการเก็บ: รอบละ 21 วัน เริ่ม 1 มิ.ย. 2569
 * - 10 แปลง × 2 ทะลาย = 20 จุดข้อมูล ต่อจังหวัด ต่อรอบ
 * - Entry Form: Modal Dialog เต็มจอ
 * - Dashboard: HTML Web App (doGet)
 *
 * INSTALL: Extensions > Apps Script > paste Code.gs
 *          สร้างไฟล์ HTML: EntryForm.html, Dashboard.html
 *          Deploy > New Deployment > Web App > Execute as "Me" > Anyone
 */

// ======================== CONFIGURATION ========================
const CONFIG = {
  provinces: ['นครปฐม', 'ราชบุรี', 'สมุทรสาคร', 'สมุทรสงคราม'],
  maxPlots: 10,
  bunchesPerPlot: 2,
  totalRounds: 6,
  roundDays: 21,
  startDate: '2026-06-01',
  dataSheet: 'ข้อมูล',
  summarySheet: 'สรุปภาพรวม',
  configSheet: 'ตั้งค่า',
  col: {
    round: 1,       // A
    province: 2,    // B
    plot: 3,        // C
    bunch: 4,       // D
    total: 5,       // E = F+G+H (auto)
    quality: 6,     // F
    below: 7,       // G
    damaged: 8,     // H
    weight: 9,      // I
    circum: 10,     // J
    notes: 11,      // K
    recordedAt: 12  // L
  }
};

function getRoundDates() {
  const rounds = [];
  const start = new Date(CONFIG.startDate + 'T00:00:00+07:00');
  for (let i = 0; i < CONFIG.totalRounds; i++) {
    const s = new Date(start);
    s.setDate(s.getDate() + i * CONFIG.roundDays);
    const e = new Date(s);
    e.setDate(e.getDate() + CONFIG.roundDays - 1);
    rounds.push({
      number: i + 1,
      start: s,
      end: e,
      label: 'รอบที่ ' + (i + 1)
    });
  }
  return rounds;
}

function fmtDate(d) {
  return Utilities.formatDate(d, 'Asia/Bangkok', 'dd/MM/yyyy');
}

// ======================== MENU ========================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🥥 มะพร้าวน้ำหอม')
    .addItem('📋 ตั้งค่าเริ่มต้น', 'setupAllSheets')
    .addSeparator()
    .addItem('✏️ กรอกข้อมูล', 'showEntryForm')
    .addSeparator()
    .addItem('📊 Dashboard', 'openDashboard')
    .addItem('📄 สรุปลง Sheet', 'buildSummarySheet')
    .addItem('🔍 ตรวจสอบข้อมูล', 'validateAll')
    .addToUi();
}

// ======================== SETUP ========================
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rounds = getRoundDates();

  // --- Config sheet ---
  let cfg = ss.getSheetByName(CONFIG.configSheet);
  if (!cfg) cfg = ss.insertSheet(CONFIG.configSheet);
  cfg.clear();
  cfg.getRange(1, 1, 1, 4).setValues([['รอบที่', 'วันที่เริ่ม', 'วันที่สิ้นสุด', 'จำนวนวัน']]).setFontWeight('bold');
  rounds.forEach((r, i) => {
    cfg.getRange(i + 2, 1, 1, 4).setValues([[r.number, fmtDate(r.start), fmtDate(r.end), CONFIG.roundDays]]);
  });
  cfg.autoResizeColumns(1, 4);

  // --- Data sheet ---
  let data = ss.getSheetByName(CONFIG.dataSheet);
  if (data) ss.deleteSheet(data);
  data = ss.insertSheet(CONFIG.dataSheet, 0);

  // Title row
  data.getRange(1, 1, 1, 12).merge()
    .setValue('📋 ข้อมูลคุณภาพมะพร้าวน้ำหอม — 4 จังหวัด 6 รอบการเก็บ')
    .setFontWeight('bold').setFontSize(13)
    .setHorizontalAlignment('center').setBackground('#E8F5E9');

  // Headers
  const headers = [
    'รอบที่', 'จังหวัด', 'แปลงที่', 'ทะลายที่',
    'ผลผลิตทั้งหมด\n(ผล) E=F+G+H', 'ผลคุณภาพ\n(ผล) F',
    'ต่ำกว่าเกณฑ์\n(ผล) G', 'ผลเสีย\n(ผล) H',
    'นน.ผลเฉลี่ย\n(กก.)', 'เส้นรอบวงเฉลี่ย\n(ซม.)',
    'หมายเหตุ', 'วันที่บันทึก'
  ];
  data.getRange(2, 1, 1, 12).setValues([headers])
    .setFontWeight('bold').setBackground('#C8E6C9')
    .setBorder(true, true, true, true, true, true)
    .setWrap(true).setHorizontalAlignment('center');
  data.setRowHeight(2, 45);

  // Pre-populate template rows: round × province × plot × bunch
  const rows = [];
  rounds.forEach(r => {
    CONFIG.provinces.forEach(province => {
      for (let plot = 1; plot <= CONFIG.maxPlots; plot++) {
        for (let bunch = 1; bunch <= CONFIG.bunchesPerPlot; bunch++) {
          rows.push([r.number, province, plot, bunch, '', '', '', '', '', '', '', '']);
        }
      }
    });
  });

  if (rows.length > 0) {
    data.getRange(3, 1, rows.length, 12).setValues(rows);
    data.getRange(3, 1, rows.length, 12).setBorder(true, true, true, true, true, true);
  }

  // Column widths
  const widths = [50, 85, 55, 60, 95, 85, 85, 80, 85, 90, 120, 90];
  widths.forEach((w, i) => data.setColumnWidth(i + 1, w));

  // Center columns A-G, L
  data.getRange(3, 1, rows.length, 4).setHorizontalAlignment('center');
  data.getRange(3, 12, rows.length, 1).setHorizontalAlignment('center');

  // Yellow background for auto-calc column E
  data.getRange(3, 5, rows.length, 1).setBackground('#FFF9C4');

  // Data validation: F, G, H (columns 6-8) = non-negative integer
  const nonNeg = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(true)
    .setHelpText('จำนวนเต็ม ≥ 0').build();
  data.getRange(3, 6, rows.length, 3).setDataValidation(nonNeg);

  // Data validation: I, J (columns 9-10) = positive number
  const positive = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0).setAllowInvalid(true)
    .setHelpText('ตัวเลข > 0').build();
  data.getRange(3, 9, rows.length, 2).setDataValidation(positive);

  // Protect header rows + auto columns
  data.getRange(1, 1, 2, 12).protect().setDescription('Header').setWarningOnly(true);
  data.getRange(3, 1, rows.length, 4).protect().setDescription('รอบ/จังหวัด/แปลง/ทะลาย').setWarningOnly(true);
  data.getRange(3, 5, rows.length, 1).protect().setDescription('ผลรวมอัตโนมัติ').setWarningOnly(true);

  // --- Summary sheet ---
  let summary = ss.getSheetByName(CONFIG.summarySheet);
  if (!summary) summary = ss.insertSheet(CONFIG.summarySheet);
  buildSummarySheet();

  // --- Freeze panes ---
  data.setFrozenRows(2);

  SpreadsheetApp.flush();
  ss.toast('✅ สร้างแผ่นข้อมูลเรียบร้อย! ' + rows.length + ' แถว (4 จังหวัด × 6 รอบ × 10 แปลง × 2 ทะลาย)', '', 6);
}

// ======================== DATA ENTRY (Modal Dialog) ========================
function showEntryForm() {
  const html = HtmlService.createHtmlOutputFromFile('EntryForm')
    .setTitle('🥥 กรอกข้อมูลมะพร้าวน้ำหอม')
    .setWidth(700)
    .setHeight(580);
  SpreadsheetApp.getUi().showModalDialog(html, '🥥 กรอกข้อมูลมะพร้าวน้ำหอม');
}

function findRow(round, province, plot, bunch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName(CONFIG.dataSheet);
  if (!data) throw new Error('ยังไม่ได้ตั้งค่าเริ่มต้น กรุณากด "ตั้งค่าเริ่มต้น" ก่อน');

  const all = data.getRange(3, 1, data.getLastRow() - 2, 4).getValues();
  for (let i = 0; i < all.length; i++) {
    if (all[i][0] == round && all[i][1] === province && all[i][2] == plot && all[i][3] == bunch) {
      return i + 3; // +3 because data starts at row 3
    }
  }
  throw new Error('ไม่พบแถว: รอบที่ ' + round + ' ' + province + ' แปลง ' + plot + ' ทะลาย ' + bunch);
}

function loadEntry(round, province, plot, bunch) {
  try {
    const row = findRow(round, province, plot, bunch);
    const data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.dataSheet);
    const vals = data.getRange(row, 1, 1, 12).getValues()[0];
    return {
      quality: vals[5] || '',
      below: vals[6] || '',
      damaged: vals[7] || '',
      weight: vals[8] || '',
      circum: vals[9] || '',
      notes: vals[10] || ''
    };
  } catch (e) {
    return null;
  }
}

function saveEntry(round, province, plot, bunch, quality, below, damaged, weight, circum, notes) {
  const row = findRow(round, province, plot, bunch);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.dataSheet);

  const values = [[
    round, province, plot, bunch,
    '=F' + row + '+G' + row + '+H' + row, // E = auto formula
    parseInt(quality) || 0,
    parseInt(below) || 0,
    parseInt(damaged) || 0,
    parseFloat(weight) || '',
    parseFloat(circum) || '',
    notes || '',
    Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
  ]];

  sheet.getRange(row, 1, 1, 12).setValues(values);

  // Format
  sheet.getRange(row, 1, 1, 4).setHorizontalAlignment('center');
  sheet.getRange(row, 5, 1, 1).setBackground('#FFF9C4');
  sheet.getRange(row, 12, 1, 1).setHorizontalAlignment('center');

  // Highlight if quality < 50%
  const total = (parseInt(quality) || 0) + (parseInt(below) || 0) + (parseInt(damaged) || 0);
  if (total > 0) {
    const pct = ((parseInt(quality) || 0) / total) * 100;
    sheet.getRange(row, 1, 1, 12).setBackground(pct < 50 ? '#FFEBEE' : null);
  }

  SpreadsheetApp.flush();
  return '✅ บันทึกสำเร็จ: ' + province + ' รอบที่ ' + round + ' แปลงที่ ' + plot + ' ทะลายที่ ' + bunch;
}

// ======================== DASHBOARD (Web App + Modal) ========================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('🥥 Dashboard มะพร้าวน้ำหอม')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function openDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('🥥 Dashboard มะพร้าวน้ำหอม')
    .setWidth(1100)
    .setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Dashboard คุณภาพมะพร้าวน้ำหอม');
}

/**
 * Returns ALL data for the dashboard as JSON.
 */
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.dataSheet);
  if (!sheet) return JSON.stringify({ error: 'ยังไม่มีข้อมูล กรุณากดตั้งค่าเริ่มต้น' });

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return JSON.stringify({ error: 'ยังไม่มีข้อมูล' });

  const raw = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
  const rounds = getRoundDates();

  // Build summary per round per province
  const result = { rounds: [], provinces: CONFIG.provinces, roundDates: [] };

  rounds.forEach(r => {
    result.roundDates.push({
      number: r.number,
      label: r.label,
      start: fmtDate(r.start),
      end: fmtDate(r.end)
    });
  });

  // Per round summary
  rounds.forEach(r => {
    const roundSummary = { round: r.number, label: r.label, provinces: {}, overall: null };
    let rTotalQ = 0, rTotalB = 0, rTotalD = 0, rWSum = 0, rWCount = 0, rCSum = 0, rCCount = 0, rFilled = 0;

    CONFIG.provinces.forEach(p => {
      let pQ = 0, pB = 0, pD = 0, pWSum = 0, pWCount = 0, pCSum = 0, pCCount = 0, pFilled = 0;

      raw.forEach(row => {
        if (row[0] != r.number || row[1] !== p) return;
        const q = Number(row[5]) || 0;
        const b = Number(row[6]) || 0;
        const d = Number(row[7]) || 0;
        const w = Number(row[8]) || 0;
        const c = Number(row[9]) || 0;
        if (q > 0 || b > 0 || d > 0) pFilled++;
        pQ += q; pB += b; pD += d;
        if (w > 0) { pWSum += w; pWCount++; }
        if (c > 0) { pCSum += c; pCCount++; }
      });

      const pTotal = pQ + pB + pD;
      roundSummary.provinces[p] = {
        totalFruits: pTotal,
        quality: pQ,
        below: pB,
        damaged: pD,
        qualityRate: pTotal > 0 ? pQ / pTotal : 0,
        avgWeight: pWCount > 0 ? pWSum / pWCount : null,
        avgCircum: pCCount > 0 ? pCSum / pCCount : null,
        weightSum: pWSum,
        weightCount: pWCount,
        circumSum: pCSum,
        circumCount: pCCount,
        filled: pFilled,
        maxRows: CONFIG.maxPlots * CONFIG.bunchesPerPlot
      };

      rTotalQ += pQ; rTotalB += pB; rTotalD += pD;
      rWSum += pWSum; rWCount += pWCount;
      rCSum += pCSum; rCCount += pCCount;
      rFilled += pFilled;
    });

    const rTotal = rTotalQ + rTotalB + rTotalD;
    roundSummary.overall = {
      totalFruits: rTotal,
      quality: rTotalQ,
      below: rTotalB,
      damaged: rTotalD,
      qualityRate: rTotal > 0 ? rTotalQ / rTotal : 0,
      avgWeight: rWCount > 0 ? rWSum / rWCount : null,
      avgCircum: rCCount > 0 ? rCSum / rCCount : null,
      weightSum: rWSum,
      weightCount: rWCount,
      circumSum: rCSum,
      circumCount: rCCount,
      filled: rFilled
    };

    result.rounds.push(roundSummary);
  });

  return JSON.stringify(result);
}

// ======================== SUMMARY SHEET ========================
function buildSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(CONFIG.summarySheet);
  if (!s) s = ss.insertSheet(CONFIG.summarySheet);
  s.clear();

  const dashboardData = JSON.parse(getDashboardData());
  if (dashboardData.error) {
    s.getRange(1, 1).setValue('⚠️ ' + dashboardData.error);
    SpreadsheetApp.flush();
    ss.toast('ยังไม่มีข้อมูลในแผ่นข้อมูล', '', 4);
    return;
  }

  // Headers
  const headers = ['รอบที่', 'จังหวัด', 'ผลผลิตทั้งหมด', 'ผลคุณภาพ', 'ตํ่ากว่าเกณฑ์', 'ผลเสีย', '%คุณภาพ', 'นน.เฉลี่ย', 'รอบวงเฉลี่ย', 'บันทึกแล้ว'];
  s.getRange(1, 1, 1, 10).setValues([headers])
    .setFontWeight('bold').setBackground('#E3F2FD').setBorder(true, true, true, true, true, true);
  s.setFrozenRows(1);

  let row = 2;
  dashboardData.rounds.forEach(r => {
    CONFIG.provinces.forEach(p => {
      const d = r.provinces[p];
      if (!d) return;
      s.getRange(row, 1, 1, 10).setValues([[
        'รอบที่ ' + r.round, p.toUpperCase(),
        d.totalFruits, d.quality, d.below, d.damaged,
        d.qualityRate, d.avgWeight, d.avgCircum,
        d.filled + '/' + d.maxRows
      ]]);
      s.getRange(row, 7).setNumberFormat('0.0%');
      if (d.qualityRate > 0 && d.qualityRate < 0.5) {
        s.getRange(row, 1, 1, 10).setBackground('#FFEBEE');
      }
      row++;
    });
    // Round total
    s.getRange(row, 1, 1, 10).setValues([[
      'รวมรอบที่ ' + r.round, 'ทั้งหมด',
      r.overall.totalFruits, r.overall.quality, r.overall.below, r.overall.damaged,
      r.overall.qualityRate, r.overall.avgWeight, r.overall.avgCircum, r.overall.filled
    ]]).setFontWeight('bold').setBackground('#F5F5F5');
    s.getRange(row, 7).setNumberFormat('0.0%');
    row++;
    row++; // blank row
  });

  s.autoResizeColumns(1, 10);
  SpreadsheetApp.flush();
  ss.toast('✅ อัปเดตสรุปภาพรวมเรียบร้อย', '', 4);
}

// ======================== AUTO-CALC onEdit ========================
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.dataSheet) return;

  const row = e.range.getRow();
  if (row < 3) return;

  const col = e.range.getColumn();
  // Recalc when F(6), G(7), or H(8) changes
  if (col !== 6 && col !== 7 && col !== 8) return;

  sheet.getRange(row, 5).setFormula('=F' + row + '+G' + row + '+H' + row);
  sheet.getRange(row, 5).setBackground('#FFF9C4');

  // Highlight if quality < 50%
  const vals = sheet.getRange(row, 6, 1, 3).getValues()[0];
  const total = (Number(vals[0]) || 0) + (Number(vals[1]) || 0) + (Number(vals[2]) || 0);
  if (total > 0) {
    const pct = ((Number(vals[0]) || 0) / total) * 100;
    sheet.getRange(row, 1, 1, 12).setBackground(pct < 50 ? '#FFEBEE' : null);
  }
}

// ======================== VALIDATION ========================
function validateAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.dataSheet);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('ยังไม่ได้ตั้งค่าเริ่มต้น');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    SpreadsheetApp.getUi().alert('✅ ยังไม่มีข้อมูลให้ตรวจ');
    return;
  }

  const data = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
  const issues = [];

  data.forEach((row, idx) => {
    const r = idx + 3;
    const round = row[0], province = row[1], plot = row[2], bunch = row[3];
    const q = Number(row[5]) || 0, b = Number(row[6]) || 0, d = Number(row[7]) || 0;
    const w = Number(row[8]) || 0, c = Number(row[9]) || 0;
    const loc = 'ร.' + round + ' ' + province + ' แปลง' + plot + ' ทะลาย' + bunch;

    if (q < 0) issues.push('⚠️ ' + loc + ': ผลคุณภาพติดลบ');
    if (b < 0) issues.push('⚠️ ' + loc + ': ผลตํ่ากว่าเกณฑ์ติดลบ');
    if (d < 0) issues.push('⚠️ ' + loc + ': ผลเสียติดลบ');
    if ((q > 0 || b > 0 || d > 0) && w <= 0) issues.push('⚠️ ' + loc + ': ขาดนํ้าหนัก');
    if ((q > 0 || b > 0 || d > 0) && c <= 0) issues.push('⚠️ ' + loc + ': ขาดเส้นรอบวง');
  });

  if (issues.length === 0) {
    SpreadsheetApp.getUi().alert('✅ ตรวจสอบข้อมูล', 'ไม่พบปัญหาใดๆ', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    const msg = issues.slice(0, 15).join('\n') + (issues.length > 15 ? '\n\n...และอีก ' + (issues.length - 15) + ' รายการ' : '');
    SpreadsheetApp.getUi().alert('⚠️ พบ ' + issues.length + ' รายการ', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
