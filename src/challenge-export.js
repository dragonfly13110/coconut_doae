import { MONTH_NAMES, SAMPLE_POINTS, SAMPLE_TREES } from './challenge-db.js';

function escapeXml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cellXml(value, type = 'String') {
  if (value === null || value === undefined || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  const isNumber = type === 'Number' || typeof value === 'number';
  const valType = isNumber ? 'Number' : 'String';
  return `<Cell><Data ss:Type="${valType}">${escapeXml(value)}</Data></Cell>`;
}

function rowXml(cells) {
  return `<Row>${cells.join('')}</Row>`;
}

export function generateChallengeExcelXml({ plots = [], forecasts = [], harvestCuts = [], macroStats = [] }) {
  // 1. Sheet 1: ข้อมูลทั่วไป (เก็บ 1 ครั้ง)
  const sheet1Rows = [];
  // Row 1 header
  sheet1Rows.push(rowXml([
    cellXml('ลำดับที่'),
    cellXml('ชื่อ - สกุล'),
    cellXml('ที่อยู่'),
    cellXml('อายุ'),
    cellXml('เบอร์โทรศัพท์'),
    cellXml('พื้นที่ปลูกมะพร้าว'),
    cellXml('พื้นที่ให้ผลผลิต'),
    cellXml('อายุพืช'),
    cellXml('จำนวนต้น/ไร่'),
    cellXml('พิกัดแปลง'),
    cellXml(''),
    cellXml(''),
    cellXml('มาตรฐานการผลิต'),
    cellXml('ชุดดิน'),
  ]));
  // Row 2 subheader
  sheet1Rows.push(rowXml([
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml(''),
    cellXml('zone'),
    cellXml('x'),
    cellXml('y'),
    cellXml(''),
    cellXml(''),
  ]));
  // Data rows
  plots.forEach((p, idx) => {
    sheet1Rows.push(rowXml([
      cellXml(p.farmer_no || idx + 1, 'Number'),
      cellXml(p.full_name),
      cellXml(p.address),
      cellXml(p.age || '', 'Number'),
      cellXml(p.phone),
      cellXml(p.total_area_rai || 0, 'Number'),
      cellXml(p.productive_area_rai || 0, 'Number'),
      cellXml(p.plant_age_years || 0, 'Number'),
      cellXml(p.trees_per_rai || 0, 'Number'),
      cellXml(p.coord_zone || '47P'),
      cellXml(p.coord_x || '', 'Number'),
      cellXml(p.coord_y || '', 'Number'),
      cellXml(p.production_standard || 'GAP'),
      cellXml(p.soil_series || ''),
    ]));
  });

  // 2. Sheet 2: คาดการณ์ผลผลิต (7 จุด x 5 ต้น = 35 ต้นต่อแปลง)
  const sheet2Rows = [];
  const forecastMap = {};
  for (const f of forecasts) {
    const pLabel = f.point_label || 'จุดที่ 1';
    const key = `${f.plot_id}_${pLabel}_${f.tree_position}_${f.bunch_no}_${f.harvest_month}`;
    forecastMap[key] = f.fruit_count;
  }

  // Iterate over plots (or default plot 1)
  const activePlots = plots.length > 0 ? plots : [{ id: 1, plot_label: 'แปลงที่ 1' }];
  for (const p of activePlots) {
    for (const point of SAMPLE_POINTS) {
      for (const tree of SAMPLE_TREES) {
        sheet2Rows.push(rowXml([cellXml(p.plot_label || 'แปลงที่ 1')]));

        // Header row with 20 bunches
        const bunchHeaders = [cellXml(`${tree.label} (${point.label})`), cellXml('ทะลายที่')];
        for (let b = 1; b <= 20; b++) {
          bunchHeaders.push(cellXml(b, 'Number'));
        }
        sheet2Rows.push(rowXml(bunchHeaders));

        // 12 months
        const monthlySum = new Array(12).fill(0);
        for (let m = 1; m <= 12; m++) {
          const rowCells = [];
          if (m === 1) {
            rowCells.push(cellXml(tree.pos));
          } else if (m === 2) {
            rowCells.push(cellXml(point.label));
          } else {
            rowCells.push(cellXml(''));
          }
          rowCells.push(cellXml(MONTH_NAMES[m - 1]));

          for (let b = 1; b <= 20; b++) {
            const count = forecastMap[`${p.id}_${point.label}_${tree.pos}_${b}_${m}`] || '';
            if (count !== '') monthlySum[m - 1] += Number(count);
            rowCells.push(cellXml(count, count !== '' ? 'Number' : 'String'));
          }
          sheet2Rows.push(rowXml(rowCells));
        }

        // Summary row
        const summaryCells = [cellXml(''), cellXml('จำนวนผลที่เก็บเกี่ยว')];
        for (let b = 1; b <= 20; b++) {
          let bunchTotal = 0;
          for (let m = 1; m <= 12; m++) {
            bunchTotal += (forecastMap[`${p.id}_${point.label}_${tree.pos}_${b}_${m}`] || 0);
          }
          summaryCells.push(cellXml(bunchTotal > 0 ? bunchTotal : '', bunchTotal > 0 ? 'Number' : 'String'));
        }
        sheet2Rows.push(rowXml(summaryCells));
        sheet2Rows.push(rowXml([cellXml('')])); // empty spacer row
      }
    }
  }

  // 3. Sheet 3: ผลผลิตในรอบการตัด
  const sheet3Rows = [];
  sheet3Rows.push(rowXml([
    cellXml('ลำดับที่'),
    cellXml('ชื่อ สกุล'),
    cellXml('จังหวัด'),
    cellXml('ผลผลิตรวม (ผล)'),
    cellXml('ผลผลิตเฉลี่ยต่อไร่(ผล/ไร่)'),
    cellXml('ราคาผลผลิต (บาท/ผล)'),
    cellXml('ปริมาณผลควบ (ผล)(ประมาณการณ์)'),
    cellXml('ผลเสีย(ผล)(ประมาณการณ์)'),
    cellXml('รอบการตัด'),
    cellXml('วัน/เดือนที่ตัด'),
  ]));
  harvestCuts.forEach((c, idx) => {
    sheet3Rows.push(rowXml([
      cellXml(idx + 1, 'Number'),
      cellXml(c.farmer_name || c.farmer_profile_name || ''),
      cellXml(c.province_code || ''),
      cellXml(c.total_yield || 0, 'Number'),
      cellXml(c.yield_per_rai || '', 'Number'),
      cellXml(c.price_per_fruit || '', 'Number'),
      cellXml(c.twin_fruits || 0, 'Number'),
      cellXml(c.damaged_fruits || 0, 'Number'),
      cellXml(c.cut_round || 1, 'Number'),
      cellXml(c.cut_date || ''),
    ]));
  });

  // 4. Sheet 4: ข้อมูลพื้นที่ ผลผลิต 69
  const sheet4Rows = [];
  sheet4Rows.push(rowXml([cellXml('')]));
  sheet4Rows.push(rowXml([cellXml('มะพร้าวอ่อน : เนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ต่อเนื้อที่ให้ผล รายอำเภอ ปี 2565 - 2568')]));
  sheet4Rows.push(rowXml([cellXml('')]));
  sheet4Rows.push(rowXml([
    cellXml('ภาค/จังหวัด/อำเภอ'),
    cellXml('เนื้อที่ยืนต้น (ไร่) ณ 1 มกราคม'),
    cellXml('เนื้อที่ให้ผล (ไร่)'),
    cellXml('ผลผลิต (ผล)'),
    cellXml('ผลผลิตต่อไร่ต่อเนื้อที่ให้ผล (ผล)'),
  ]));
  sheet4Rows.push(rowXml([
    cellXml(''),
    cellXml('2569'),
    cellXml('2569'),
    cellXml('2569'),
    cellXml('2569'),
  ]));
  macroStats.forEach((m) => {
    sheet4Rows.push(rowXml([
      cellXml(m.district_name || m.province_name),
      cellXml(m.standing_area_rai || 0, 'Number'),
      cellXml(m.productive_area_rai || 0, 'Number'),
      cellXml(m.total_yield_fruit || 0, 'Number'),
      cellXml(m.yield_per_productive_rai || 0, 'Number'),
    ]));
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="ข้อมูลทั่วไป (เก็บ 1 ครั้ง)">
  <Table>
   ${sheet1Rows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="คาดการณ์ผลผลิต">
  <Table>
   ${sheet2Rows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="ผลผลิตในรอบการตัด">
  <Table>
   ${sheet3Rows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="ข้อมูลพื้นที่ ผลผลิต 69">
  <Table>
   ${sheet4Rows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
}
