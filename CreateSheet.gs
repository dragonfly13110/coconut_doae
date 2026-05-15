/**
 * Standalone Apps Script for creating the coconut challenge Google Sheet.
 *
 * Usage:
 * 1. Open https://script.google.com
 * 2. Create a new Apps Script project
 * 3. Paste this file
 * 4. Run createCoconutChallengeSpreadsheet()
 */

const COCONUT_SHEET_CONFIG = {
  spreadsheetId: '1Ru78wrgmx7ZALVualZKmfIU8s7oVbXDme71SUbRrTmk',
  title: 'แบบเก็บข้อมูล ประเด็น Challenge มะพร้าวน้ำหอม',
  sheetName: 'ระดับจังหวัด',
  rowsPerProvince: 20,
  plots: 10,
  bunchesPerPlot: 2,
  timezone: 'Asia/Bangkok'
};

function setupCoconutChallengeSpreadsheet() {
  const ss = SpreadsheetApp.openById(COCONUT_SHEET_CONFIG.spreadsheetId);
  buildProvinceTemplate_(ss);
  setupAllSheets();
  SpreadsheetApp.flush();

  Logger.log('Updated spreadsheet and data system: ' + ss.getUrl());
  return ss.getUrl();
}

function setupThisSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(COCONUT_SHEET_CONFIG.spreadsheetId);
  buildProvinceTemplate_(ss);
  setupAllSheets();
  SpreadsheetApp.flush();

  Logger.log('Updated active spreadsheet and data system: ' + ss.getUrl());
  return ss.getUrl();
}

function createCoconutChallengeSpreadsheet() {
  const ss = SpreadsheetApp.create(COCONUT_SHEET_CONFIG.title);
  buildProvinceTemplate_(ss);
  SpreadsheetApp.flush();

  Logger.log('Created spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}

function buildProvinceTemplate_(ss) {
  let sheet = ss.getSheetByName(COCONUT_SHEET_CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(COCONUT_SHEET_CONFIG.sheetName, 0);
  }

  if (typeof clearSheetState_ === 'function') clearSheetState_(sheet);
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(5);

  const lastRow = 31;
  const lastCol = 10;
  sheet.getRange(1, 1, lastRow, lastCol)
    .setFontFamily('Sarabun')
    .setFontSize(11)
    .setVerticalAlignment('middle');

  sheet.getRange('A1:J1').merge()
    .setValue('แบบเก็บข้อมูล ประเด็น Challenge มะพร้าวน้ำหอม')
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.getRange('A2:J2').merge()
    .setValue('ประเด็น : เพิ่มสัดส่วนขนาดของมะพร้าวน้ำหอมผลผลิตคุณภาพจาก 70 : 30 เป็น 50 : 50 (ขนาดผลเล็ก : ขนาดมาตรฐาน)')
    .setFontWeight('bold')
    .setWrap(true);

  sheet.getRange('A3:J3').merge()
    .setValue('สำนักงานเกษตรจังหวัด............................... ครั้งที่...............')
    .setFontWeight('bold');

  const headers = [[
    'ลำดับ',
    'แปลงที่',
    'ทะลายที่',
    'จำนวนผลคุณภาพ (ผล)\n(1)',
    'จำนวนผล\nต่ำกว่าเกณฑ์ (ผล)\n(2)',
    'จำนวนผลเสีย\n(ผลทุย ผลแตก อื่นๆ) (ผล)\n(3)',
    'จำนวนผลผลิต/ทะลาย (ผล) (1+2+3)',
    'น้ำหนักผลเฉลี่ย\n(กิโลกรัม)\n÷ (1+2)',
    'เส้นรอบวงเฉลี่ย\n(เซนติเมตร)',
    'หมายเหตุ'
  ]];

  sheet.getRange(5, 1, 1, lastCol)
    .setValues(headers)
    .setBackground('#D9EAD3')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.setRowHeight(5, 84);

  const dataRows = [];
  let index = 1;
  for (let plot = 1; plot <= COCONUT_SHEET_CONFIG.plots; plot++) {
    for (let bunch = 1; bunch <= COCONUT_SHEET_CONFIG.bunchesPerPlot; bunch++) {
      dataRows.push([index, bunch === 1 ? plot : '', bunch, '', '', '', '', '', '', '']);
      index++;
    }
  }
  sheet.getRange(6, 1, dataRows.length, lastCol).setValues(dataRows);

  for (let row = 6; row <= 25; row++) {
    sheet.getRange(row, 7).setFormula('=IF(COUNTA(D' + row + ':F' + row + ')=0,"",SUM(D' + row + ':F' + row + '))');
  }

  sheet.getRange('A5:J25')
    .setBorder(true, true, true, true, true, true)
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.getRange('J6:J25').setHorizontalAlignment('left');
  sheet.getRange('D6:I25').setNumberFormat('0.00');
  sheet.getRange('A6:C25').setNumberFormat('0');

  // Keep this printable template simple. The web form validates entries before saving.

  sheet.getRange('A27:G31').merge()
    .setValue('หมายเหตุ / ปัญหา / ข้อเสนอแนะ')
    .setVerticalAlignment('top')
    .setHorizontalAlignment('left')
    .setWrap(true);
  sheet.getRange('H27:J27').merge().setValue('ผู้บันทึกข้อมูล');
  sheet.getRange('H28:J28').merge().setValue('ลงชื่อ........................................');
  sheet.getRange('H29:J29').merge().setValue('(........................................)');
  sheet.getRange('H30:J30').merge().setValue('ตำแหน่ง......................................');
  sheet.getRange('H31:J31').merge().setValue('วันที่........../........../..........');
  sheet.getRange('A27:J31')
    .setBorder(true, true, true, true, true, true)
    .setWrap(true);
  sheet.getRange('H27:J31').setHorizontalAlignment('center');

  const widths = [58, 75, 75, 120, 120, 150, 130, 130, 130, 150];
  widths.forEach(function(width, i) {
    sheet.setColumnWidth(i + 1, width);
  });
  for (let row = 6; row <= 25; row++) sheet.setRowHeight(row, 28);
  for (let row = 27; row <= 31; row++) sheet.setRowHeight(row, 30);

}
