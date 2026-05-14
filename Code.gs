/**
 * ระบบเก็บข้อมูลมะพร้าวน้ำหอม 4 จังหวัด
 * (นครปฐม ราชบุรี สมุทรสาคร สมุทรสงคราม)
 *
 * Features: ตั้งค่าแผ่นอัตโนมัติ, ฟอร์มกรอกข้อมูล Sidebar,
 * คำนวณผลรวม D=E+F+G อัตโนมัติ, Validation, สรุปภาพรวม
 *
 * INSTALL: Extensions > Apps Script > paste this > Save > Reload sheet
 */

// --- CONFIGURATION ---
const CONFIG = {
  provinces: ['นครปฐม', 'ราชบุรี', 'สมุทรสาคร', 'สมุทรสงคราม'],
  maxPlots: 10,
  bunchesPerPlot: 2,
  headerRows: 5,
  dataStartRow: 6,
  dashboardSheet: 'สรุปภาพรวม',
  configSheet: 'ตั้งค่า',
  col: {
    order: 1,    // A
    plot: 2,     // B
    bunch: 3,    // C
    total: 4,    // D = E+F+G (auto)
    quality: 5,  // E
    below: 6,    // F
    damaged: 7,  // G
    weight: 8,   // H
    circum: 9,   // I
    notes: 10    // J
  }
};

// --- MENU SETUP ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🥥 จัดการข้อมูลมะพร้าว')
    .addItem('📋 ตั้งค่าเริ่มต้น (สร้างแผ่นทั้งหมด)', 'setupAllSheets')
    .addSeparator()
    .addItem('✏️ กรอกข้อมูล (Sidebar)', 'quickEntryMenu')
    .addSeparator()
    .addItem('📊 สรุปภาพรวม 4 จังหวัด', 'buildDashboard')
    .addItem('🔍 ตรวจสอบข้อมูลทั้งหมด', 'validateAllSheets')
    .addToUi();
}

function quickEntryMenu() {
  showProgress('กำลังโหลดฟอร์ม...', 'quickEntry');
}

// --- SETUP: สร้างแผ่นจังหวัดทั้งหมด ---
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create dashboard and config sheets
  ensureSheet(ss, CONFIG.dashboardSheet, true);
  ensureSheet(ss, CONFIG.configSheet, true);

  // Setup config sheet
  setupConfigSheet(ss.getSheetByName(CONFIG.configSheet));

  // Create province sheets
  CONFIG.provinces.forEach(function(province) {
    setupProvinceSheet(ensureSheet(ss, province));
  });

  // Protect all province sheets
  protectAllSheets(ss);

  SpreadsheetApp.flush();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    '✅ สร้างแผ่นข้อมูลครบ 4 จังหวัดเรียบร้อย', 'ตั้งค่าสำเร็จ', 5
  );
}

function setupProvinceSheet(sheet) {
  const province = sheet.getName();
  sheet.clear();

  // Row 1: empty
  // Row 2-3: merged title (simulate merged cells with formatting)
  sheet.getRange(2, 1, 1, 10).merge()
    .setValue('แบบเก็บข้อมูลประเด็น Challenge มะพร้าวน้ำหอม')
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('center');

  sheet.getRange(3, 1, 1, 10).merge()
    .setValue('ประเด็น : การเพิ่มสัดส่วนของมะพร้าวน้ำหอมคุณภาพ | จังหวัด' + province)
    .setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center');

  // Row 5: Headers
  const headers = [
    'ลำดับ', 'แปลงที่', 'ทะลายที่',
    'จำนวนผลผลิต/ทะลาย\n(ผล) (1+2+3)',
    'จำนวนผลคุณภาพ\n(ผล) (1)',
    'จำนวนผล ต่ำกว่าเกณฑ์\n(ผล)(2)',
    'จำนวนผลเสีย\n(หัวทุย ผลแตก อื่นๆ) (ผล) (3)',
    'น้ำหนักผลเฉลี่ย (1+2)\n(กิโลกรัม)',
    'เส้นรอบวงเฉลี่ย\n(เซนติเมตร)',
    'หมายเหตุ'
  ];
  const headerRange = sheet.getRange(5, 1, 1, 10);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold').setBackground('#E8F5E9')
    .setBorder(true, true, true, true, true, true)
    .setWrap(true).setHorizontalAlignment('center');

  sheet.setRowHeight(5, 58);

  // Rows 6-25: Pre-numbered (10 plots × 2 bunches)
  const data = [];
  for (let plot = 1; plot <= CONFIG.maxPlots; plot++) {
    for (let bunch = 1; bunch <= CONFIG.bunchesPerPlot; bunch++) {
      const rowNum = (plot - 1) * CONFIG.bunchesPerPlot + bunch;
      data.push([rowNum, plot, bunch, '', '', '', '', '', '', '']);
    }
  }
  const dataRange = sheet.getRange(6, 1, data.length, 10);
  dataRange.setValues(data);
  dataRange.setBorder(true, true, true, true, true, true);

  // Format number columns
  sheet.getRange(6, 4, data.length, 7).setNumberFormat('#,##0');
  sheet.getRange(6, 8, data.length, 1).setNumberFormat('#,##0.00');
  sheet.getRange(6, 9, data.length, 1).setNumberFormat('#,##0.00');

  // Center-align A, B, C columns
  sheet.getRange(6, 1, data.length, 3).setHorizontalAlignment('center');

  // Data validation for E, F, G (non-negative integers)
  const nonNegRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(true)
    .setHelpText('กรุณากรอกจำนวนเต็มที่ไม่ติดลบ')
    .build();
  sheet.getRange(6, 5, data.length, 3).setDataValidation(nonNegRule);

  // Data validation for H, I (positive numbers)
  const positiveRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0)
    .setAllowInvalid(true)
    .setHelpText('กรุณากรอกตัวเลขที่มากกว่า 0')
    .build();
  sheet.getRange(6, 8, data.length, 2).setDataValidation(positiveRule);

  // Column D: read-only (auto-calc) — yellow background
  sheet.getRange(6, 4, data.length, 1)
    .setBackground('#FFF9C4');

  // Column widths
  sheet.setColumnWidth(1, 50);   // A
  sheet.setColumnWidth(2, 60);   // B
  sheet.setColumnWidth(3, 60);   // C
  sheet.setColumnWidth(4, 130);  // D
  sheet.setColumnWidth(5, 130);  // E
  sheet.setColumnWidth(6, 130);  // F
  sheet.setColumnWidth(7, 145);  // G
  sheet.setColumnWidth(8, 135);  // H
  sheet.setColumnWidth(9, 145);  // I
  sheet.setColumnWidth(10, 120); // J
}

function setupConfigSheet(sheet) {
  sheet.clear();
  sheet.getRange(1, 1).setValue('จังหวัด').setFontWeight('bold');
  sheet.getRange(1, 2).setValue('จำนวนแปลง').setFontWeight('bold');
  sheet.getRange(1, 3).setValue('ทะลายต่อแปลง').setFontWeight('bold');
  CONFIG.provinces.forEach(function(p, i) {
    sheet.getRange(i + 2, 1).setValue(p);
    sheet.getRange(i + 2, 2).setValue(CONFIG.maxPlots);
    sheet.getRange(i + 2, 3).setValue(CONFIG.bunchesPerPlot);
  });
}

function protectAllSheets(ss) {
  CONFIG.provinces.forEach(function(province) {
    const sheet = ss.getSheetByName(province);
    if (!sheet) return;

    // Protect header rows (1-5)
    const headerProtection = sheet.getRange(1, 1, 5, 10).protect();
    headerProtection.setDescription('Header - ห้ามแก้ไข');
    headerProtection.setWarningOnly(true);

    // Protect columns A, B, C (auto-numbered)
    const autoProtection = sheet.getRange(6, 1, CONFIG.maxPlots * CONFIG.bunchesPerPlot, 3).protect();
    autoProtection.setDescription('ลำดับ/แปลง/ทะลาย - ห้ามแก้ไข');
    autoProtection.setWarningOnly(true);

    // Protect column D (auto-calc)
    const calcProtection = sheet.getRange(6, 4, CONFIG.maxPlots * CONFIG.bunchesPerPlot, 1).protect();
    calcProtection.setDescription('ผลรวมอัตโนมัติ - ห้ามแก้ไข');
    calcProtection.setWarningOnly(true);
  });
}

// --- DATA ENTRY: Sidebar ---
function quickEntry() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('🥥 กรอกข้อมูลมะพร้าวน้ำหอม')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Save entry from sidebar form.
 * MUST be public (no trailing underscore) — called by google.script.run
 */
function saveEntry(province, plot, bunch, quality, below, damaged, weight, circum, notes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(province);
  if (!sheet) throw new Error('ไม่พบแผ่นจังหวัด: ' + province);

  // Find the right row
  const row = CONFIG.dataStartRow + (parseInt(plot) - 1) * CONFIG.bunchesPerPlot + parseInt(bunch) - 1;

  // Write data
  const values = [[
    row - CONFIG.dataStartRow + 1,  // A: ลำดับ
    parseInt(plot),                  // B: แปลงที่
    parseInt(bunch),                 // C: ทะลายที่
    '=E' + row + '+F' + row + '+G' + row, // D: formula
    parseInt(quality) || 0,          // E: ผลคุณภาพ
    parseInt(below) || 0,            // F: ต่ำกว่าเกณฑ์
    parseInt(damaged) || 0,          // G: ผลเสีย
    parseFloat(weight) || '',        // H: น้ำหนัก
    parseFloat(circum) || '',        // I: เส้นรอบวง
    notes || ''                      // J: หมายเหตุ
  ]];
  sheet.getRange(row, 1, 1, 10).setValues(values);

  // Reapply formatting
  sheet.getRange(row, 1, 1, 3).setHorizontalAlignment('center');
  sheet.getRange(row, 4, 1, 1).setBackground('#FFF9C4');
  sheet.getRange(row, 4, 1, 7).setNumberFormat('#,##0');
  sheet.getRange(row, 8, 1, 1).setNumberFormat('#,##0.00');
  sheet.getRange(row, 9, 1, 1).setNumberFormat('#,##0.00');

  // Highlight if quality is low (< 50% of total)
  const total = (parseInt(quality) || 0) + (parseInt(below) || 0) + (parseInt(damaged) || 0);
  if (total > 0) {
    const qualityPct = ((parseInt(quality) || 0) / total) * 100;
    if (qualityPct < 50) {
      sheet.getRange(row, 1, 1, 10).setBackground('#FFEBEE');
    } else {
      sheet.getRange(row, 1, 1, 10).setBackground(null);
    }
  }

  SpreadsheetApp.flush();
  return 'บันทึกสำเร็จ: ' + province + ' แปลงที่ ' + plot + ' ทะลายที่ ' + bunch;
}

/**
 * Load existing data for a plot/bunch (called by sidebar)
 */
function loadEntry(province, plot, bunch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(province);
  if (!sheet) return null;

  const row = CONFIG.dataStartRow + (parseInt(plot) - 1) * CONFIG.bunchesPerPlot + parseInt(bunch) - 1;
  const data = sheet.getRange(row, 1, 1, 10).getValues()[0];

  return {
    quality: data[4] || '',
    below: data[5] || '',
    damaged: data[6] || '',
    weight: data[7] || '',
    circum: data[8] || '',
    notes: data[9] || ''
  };
}

// --- AUTO-CALCULATION onEdit ---
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // Only track province sheets
  if (CONFIG.provinces.indexOf(sheetName) === -1) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Skip header rows
  if (row < CONFIG.dataStartRow) return;

  // Only recalc when E, F, or G changes
  if (col !== CONFIG.col.quality && col !== CONFIG.col.below && col !== CONFIG.col.damaged) return;

  // Set D = formula
  const formula = '=E' + row + '+F' + row + '+G' + row;
  sheet.getRange(row, CONFIG.col.total).setFormula(formula);
  sheet.getRange(row, CONFIG.col.total).setBackground('#FFF9C4');

  // Quality check: highlight row if quality < 50%
  const q = sheet.getRange(row, CONFIG.col.quality).getValue() || 0;
  const b = sheet.getRange(row, CONFIG.col.below).getValue() || 0;
  const d = sheet.getRange(row, CONFIG.col.damaged).getValue() || 0;
  const total = q + b + d;

  if (total > 0) {
    const pct = (q / total) * 100;
    sheet.getRange(row, 1, 1, 10).setBackground(pct < 50 ? '#FFEBEE' : null);
  }
}

// --- DASHBOARD: สรุปภาพรวม ---
function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName(CONFIG.dashboardSheet);
  if (!dash) ensureSheet(ss, CONFIG.dashboardSheet);

  dash.clear();

  // Title
  dash.getRange(1, 1, 1, 9).merge()
    .setValue('📊 สรุปภาพรวมคุณภาพมะพร้าวน้ำหอม 4 จังหวัด')
    .setFontWeight('bold').setFontSize(16)
    .setHorizontalAlignment('center');
  dash.getRange(2, 1, 1, 9).merge()
    .setValue('วันที่: ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm'))
    .setFontSize(11).setHorizontalAlignment('center');

  // Headers
  const headers = [
    'จังหวัด', 'จำนวนทะลาย\nที่บันทึก', 'ผลผลิตทั้งหมด\n(ผล)', 'ผลคุณภาพ\n(ผล)',
    'ต่ำกว่าเกณฑ์\n(ผล)', 'ผลเสีย\n(ผล)', 'อัตราคุณภาพ\n(%)',
    'น้ำหนักเฉลี่ย\n(กก.)', 'เส้นรอบวงเฉลี่ย\n(ซม.)'
  ];
  const headerRow = 4;
  dash.getRange(headerRow, 1, 1, 9).setValues([headers])
    .setFontWeight('bold').setBackground('#E3F2FD')
    .setBorder(true, true, true, true, true, true)
    .setWrap(true).setHorizontalAlignment('center');
  dash.setRowHeight(headerRow, 40);

  // Data per province
  let totalQualityAll = 0, totalBelowAll = 0, totalDamagedAll = 0, totalWeightAll = 0, totalCircumAll = 0;
  let totalWeightCount = 0, totalCircumCount = 0, totalBunchesAll = 0;

  CONFIG.provinces.forEach(function(province, idx) {
    const sheet = ss.getSheetByName(province);
    const dataRow = headerRow + 1 + idx;
    const summary = summarizeProvince(sheet, province);

    dash.getRange(dataRow, 1).setValue(province).setFontWeight('bold');
    dash.getRange(dataRow, 2).setValue(summary.filledBunches);
    dash.getRange(dataRow, 3).setValue(summary.totalQuality + summary.totalBelow + summary.totalDamaged);
    dash.getRange(dataRow, 4).setValue(summary.totalQuality);
    dash.getRange(dataRow, 5).setValue(summary.totalBelow);
    dash.getRange(dataRow, 6).setValue(summary.totalDamaged);
    dash.getRange(dataRow, 7).setValue(summary.totalAll > 0 ? summary.qualityRate : 0);
    dash.getRange(dataRow, 8).setValue(summary.avgWeight || '');
    dash.getRange(dataRow, 9).setValue(summary.avgCircum || '');

    // Format percentage
    dash.getRange(dataRow, 7).setNumberFormat('0.0%');

    // Conditional formatting for quality rate
    if (summary.totalAll > 0 && summary.qualityRate < 0.5) {
      dash.getRange(dataRow, 1, 1, 9).setBackground('#FFEBEE');
    }

    totalQualityAll += summary.totalQuality;
    totalBelowAll += summary.totalBelow;
    totalDamagedAll += summary.totalDamaged;
    totalWeightAll += summary.totalWeightSum;
    totalCircumAll += summary.totalCircumSum;
    totalWeightCount += summary.weightCount;
    totalCircumCount += summary.circumCount;
    totalBunchesAll += summary.filledBunches;
  });

  // Total row
  const totalRow = headerRow + 1 + CONFIG.provinces.length;
  dash.getRange(totalRow, 1).setValue('รวมทั้งหมด').setFontWeight('bold');
  dash.getRange(totalRow, 2).setValue(totalBunchesAll);
  dash.getRange(totalRow, 3).setValue(totalQualityAll + totalBelowAll + totalDamagedAll);
  dash.getRange(totalRow, 4).setValue(totalQualityAll);
  dash.getRange(totalRow, 5).setValue(totalBelowAll);
  dash.getRange(totalRow, 6).setValue(totalDamagedAll);
  const overallRate = (totalQualityAll + totalBelowAll + totalDamagedAll) > 0
    ? totalQualityAll / (totalQualityAll + totalBelowAll + totalDamagedAll)
    : 0;
  dash.getRange(totalRow, 7).setValue(overallRate).setNumberFormat('0.0%');
  dash.getRange(totalRow, 8).setValue(totalWeightCount > 0 ? totalWeightAll / totalWeightCount : '');
  dash.getRange(totalRow, 9).setValue(totalCircumCount > 0 ? totalCircumAll / totalCircumCount : '');
  dash.getRange(totalRow, 1, 1, 9).setBackground('#C8E6C9').setFontWeight('bold');

  // Format
  dash.getRange(headerRow + 1, 3, CONFIG.provinces.length + 1, 7)
    .setNumberFormat('#,##0');
  dash.getRange(headerRow + 1, 8, CONFIG.provinces.length + 1, 1)
    .setNumberFormat('#,##0.00');
  dash.getRange(headerRow + 1, 9, CONFIG.provinces.length + 1, 1)
    .setNumberFormat('#,##0.00');
  dash.autoResizeColumns(1, 9);

  SpreadsheetApp.flush();
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ อัปเดตสรุปภาพรวมเรียบร้อย', '', 4);
}

function summarizeProvince(sheet, province) {
  if (!sheet) return { filledBunches: 0, totalQuality: 0, totalBelow: 0, totalDamaged: 0, totalAll: 0,
                       totalWeightSum: 0, weightCount: 0, totalCircumSum: 0, circumCount: 0,
                       qualityRate: 0, avgWeight: null, avgCircum: null };

  const lastRow = CONFIG.dataStartRow + CONFIG.maxPlots * CONFIG.bunchesPerPlot - 1;
  const data = sheet.getRange(CONFIG.dataStartRow, 1, lastRow - CONFIG.dataStartRow + 1, 10).getValues();

  let totalQuality = 0, totalBelow = 0, totalDamaged = 0;
  let totalWeightSum = 0, weightCount = 0;
  let totalCircumSum = 0, circumCount = 0;
  let filledBunches = 0;

  data.forEach(function(row) {
    const q = Number(row[4]) || 0;  // E
    const b = Number(row[5]) || 0;  // F
    const d = Number(row[6]) || 0;  // G
    const w = Number(row[7]) || 0;  // H
    const c = Number(row[8]) || 0;  // I

    if (q > 0 || b > 0 || d > 0) filledBunches++;
    totalQuality += q;
    totalBelow += b;
    totalDamaged += d;
    if (w > 0) { totalWeightSum += w; weightCount++; }
    if (c > 0) { totalCircumSum += c; circumCount++; }
  });

  const totalAll = totalQuality + totalBelow + totalDamaged;
  return {
    filledBunches: filledBunches,
    totalQuality: totalQuality,
    totalBelow: totalBelow,
    totalDamaged: totalDamaged,
    totalAll: totalAll,
    totalWeightSum: totalWeightSum,
    weightCount: weightCount,
    totalCircumSum: totalCircumSum,
    circumCount: circumCount,
    qualityRate: totalAll > 0 ? totalQuality / totalAll : 0,
    avgWeight: weightCount > 0 ? totalWeightSum / weightCount : null,
    avgCircum: circumCount > 0 ? totalCircumSum / circumCount : null
  };
}

// --- VALIDATION ---
function validateAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let issues = [];

  CONFIG.provinces.forEach(function(province) {
    const sheet = ss.getSheetByName(province);
    if (!sheet) { issues.push('❌ ไม่พบแผ่น: ' + province); return; }

    const lastRow = CONFIG.dataStartRow + CONFIG.maxPlots * CONFIG.bunchesPerPlot - 1;
    const data = sheet.getRange(CONFIG.dataStartRow, 1, lastRow - CONFIG.dataStartRow + 1, 10).getValues();

    data.forEach(function(row, idx) {
      const rowNum = CONFIG.dataStartRow + idx;
      const q = Number(row[4]) || 0;  // E: quality
      const b = Number(row[5]) || 0;  // F: below
      const d = Number(row[6]) || 0;  // G: damaged
      const w = Number(row[7]) || 0;  // H: weight
      const c = Number(row[8]) || 0;  // I: circum

      // Check negatives
      if (q < 0) issues.push('⚠️ ' + province + ' แถว ' + rowNum + ': จำนวนผลคุณภาพติดลบ (' + q + ')');
      if (b < 0) issues.push('⚠️ ' + province + ' แถว ' + rowNum + ': จำนวนผลต่ำกว่าเกณฑ์ติดลบ (' + b + ')');
      if (d < 0) issues.push('⚠️ ' + province + ' แถว ' + rowNum + ': จำนวนผลเสียติดลบ (' + d + ')');

      // Check if any count data entered but weight/circum missing
      if ((q > 0 || b > 0 || d > 0) && w <= 0) {
        issues.push('⚠️ ' + province + ' แถว ' + rowNum + ': กรอกจำนวนผลแล้ว แต่ยังไม่ได้กรอกน้ำหนัก');
      }
      if ((q > 0 || b > 0 || d > 0) && c <= 0) {
        issues.push('⚠️ ' + province + ' แถว ' + rowNum + ': กรอกจำนวนผลแล้ว แต่ยังไม่ได้กรอกเส้นรอบวง');
      }
    });
  });

  if (issues.length === 0) {
    SpreadsheetApp.getUi().alert('✅ ตรวจสอบข้อมูล', 'ไม่พบปัญหาข้อมูล ทั้ง 4 จังหวัดเรียบร้อยดี', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    const msg = 'พบ ' + issues.length + ' รายการ:\n\n' + issues.join('\n');
    if (issues.length > 15) {
      SpreadsheetApp.getUi().alert('⚠️ ตรวจสอบข้อมูล', 'พบ ' + issues.length + ' รายการ\n\nดูรายละเอียดใน Execution Log (View > Logs)', SpreadsheetApp.getUi().ButtonSet.OK);
      console.log(msg);
    } else {
      SpreadsheetApp.getUi().alert('⚠️ ตรวจสอบข้อมูล', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

// --- UTILITIES ---
function ensureSheet(ss, name, hidden) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (hidden) sheet.hideSheet();
  }
  return sheet;
}

// --- PROGRESS DIALOG ---
function showProgress(message, serverFn) {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        height: 100%; margin: 0; padding: 20px; box-sizing: border-box; }
      .spinner { width: 36px; height: 36px; border: 4px solid #e0e0e0;
        border-top: 4px solid #1a73e8; border-radius: 50%;
        animation: spin 0.8s linear infinite; margin-bottom: 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .message { font-size: 14px; color: #333; text-align: center; }
      .done { color: #1e8e3e; font-weight: 500; }
      .error { color: #d93025; font-weight: 500; }
    </style>
    <div class="spinner" id="spinner"></div>
    <div class="message" id="msg">${message}</div>
    <script>
      google.script.run
        .withSuccessHandler(function(r) {
          document.getElementById('spinner').style.display = 'none';
          var m = document.getElementById('msg');
          m.className = 'message done';
          m.innerText = r || 'เสร็จเรียบร้อย';
          setTimeout(function() { google.script.host.close(); }, 1200);
        })
        .withFailureHandler(function(err) {
          document.getElementById('spinner').style.display = 'none';
          var m = document.getElementById('msg');
          m.className = 'message error';
          m.innerText = 'ผิดพลาด: ' + err.message;
          setTimeout(function() { google.script.host.close(); }, 3000);
        })
        .${serverFn}();
    </script>
  `).setWidth(320).setHeight(140);
  SpreadsheetApp.getUi().showModalDialog(html, '⏳ กำลังดำเนินการ...');
}
