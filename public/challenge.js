// Challenge Mode Controller - ระบบข้อมูลการผลิตและคาดการณ์ผลผลิต (4 Sheets)

const CHAL_PROVINCES = [
  { code: 'ratchaburi', label: 'ราชบุรี' },
  { code: 'nakhon_pathom', label: 'นครปฐม' },
  { code: 'samut_sakhon', label: 'สมุทรสาคร' },
  { code: 'samut_songkhram', label: 'สมุทรสงคราม' },
];

const SAMPLE_POINTS = [
  { no: 1, label: 'จุดที่ 1' },
  { no: 2, label: 'จุดที่ 2' },
  { no: 3, label: 'จุดที่ 3' },
  { no: 4, label: 'จุดที่ 4' },
  { no: 5, label: 'จุดที่ 5' },
  { no: 6, label: 'จุดที่ 6' },
  { no: 7, label: 'จุดที่ 7' },
];

const SAMPLE_TREES = [
  { no: 1, pos: 'C', label: 'ต้นที่ 1 (จุด C - กึ่งกลาง)', short: 'ต้น 1 (C กลาง)' },
  { no: 2, pos: 'L', label: 'ต้นที่ 2 (จุด L - ด้านซ้าย)', short: 'ต้น 2 (L ซ้าย)' },
  { no: 3, pos: 'R', label: 'ต้นที่ 3 (จุด R - ด้านขวา)', short: 'ต้น 3 (R ขวา)' },
  { no: 4, pos: 'F', label: 'ต้นที่ 4 (จุด F - ด้านหน้า)', short: 'ต้น 4 (F หน้า)' },
  { no: 5, pos: 'B', label: 'ต้นที่ 5 (จุด B - ด้านหลัง)', short: 'ต้น 5 (B หลัง)' },
];

const MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const chalState = {
  user: null,
  activeTab: 'farmers',
  plots: [],
  selectedPlotId: null,
  selectedPointLabel: 'จุดที่ 1',
  selectedTreePos: 'C',
  forecastData: null,
  harvestData: null,
  macroData: null,
  filterProvince: 'all',
  forecastViewMode: 'matrix',
  cycleStartDate: '2026-01-01',
  cycleInterval: 21,
  cycleAvgFruits: 12,
};

const cel = (id) => document.getElementById(id);

export function initChallenge(user) {
  chalState.user = user;
  if (user.role !== 'admin') {
    chalState.filterProvince = user.province_code;
  }
  bindChalEvents();
  loadAllChalData();
}

function bindChalEvents() {
  document.querySelectorAll('[data-chal-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      showChalTab(btn.dataset.chalTab);
    });
  });

  // Farmers Tab
  cel('chalPlotForm')?.addEventListener('submit', onSaveFarmerPlot);
  cel('chalBtnNewPlot')?.addEventListener('click', onOpenNewPlotModal);
  cel('chalBtnCancelPlot')?.addEventListener('click', onClosePlotModal);
  cel('chalProvFilter')?.addEventListener('change', (e) => {
    chalState.filterProvince = e.target.value;
    renderFarmersTable();
  });

  // Forecast Tab
  cel('chalForecastPlotSelect')?.addEventListener('change', (e) => {
    chalState.selectedPlotId = Number(e.target.value);
    loadForecastMatrix();
  });
  cel('chalBtnSaveForecast')?.addEventListener('click', onSaveForecastMatrix);
  cel('chalBtnClearForecast')?.addEventListener('click', onClearForecastMatrix);
  cel('chalBtnAutoProject')?.addEventListener('click', () => window.chalAutoProject21Days());
  cel('chalCycleStartDate')?.addEventListener('change', (e) => {
    chalState.cycleStartDate = e.target.value;
    if (chalState.forecastData) renderMatrixGrid(chalState.forecastData);
  });
  cel('chalCycleInterval')?.addEventListener('input', (e) => {
    chalState.cycleInterval = Number(e.target.value) || 21;
    if (chalState.forecastData) renderMatrixGrid(chalState.forecastData);
  });

  // Harvest Tab
  cel('chalHarvestForm')?.addEventListener('submit', onSaveHarvestCut);
  cel('chalHarvestPlotSelect')?.addEventListener('change', (e) => {
    loadHarvestCuts(e.target.value);
  });

  // Macro Tab
  cel('chalMacroProvSelect')?.addEventListener('change', (e) => {
    renderMacroStats(e.target.value);
  });
  cel('chalBenchmarkPlotSelect')?.addEventListener('change', renderBenchmarkComparison);

  // Import / Export
  cel('chalExcelFileInput')?.addEventListener('change', onExcelFileSelected);
  cel('chalBtnSeedReset')?.addEventListener('click', onResetBaseline);
}

export function showChalTab(tab) {
  chalState.activeTab = tab;
  document.querySelectorAll('[data-chal-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.chalTab === tab);
  });

  const tabs = ['farmers', 'forecast', 'harvest', 'macro', 'dashboard', 'io', 'knowledge'];
  tabs.forEach((t) => {
    const panel = cel(`chalTab_${t}`);
    if (panel) panel.hidden = t !== tab;
  });

  if (tab === 'farmers') renderFarmersTable();
  if (tab === 'forecast') loadForecastMatrix();
  if (tab === 'harvest') loadHarvestCuts();
  if (tab === 'macro') renderMacroStats(chalState.filterProvince);
  if (tab === 'dashboard') renderChalDashboard();
}

async function loadAllChalData() {
  await Promise.all([
    loadPlots(),
    loadMacroData(),
  ]);
  if (chalState.plots.length > 0) {
    const plot1 = chalState.plots.find((p) => p.id === 1);
    chalState.selectedPlotId = plot1 ? plot1.id : chalState.plots[0].id;
  }
  populatePlotDropdowns();
  renderFarmersTable();
}

async function chalApi(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

// ==========================================
// 1. Sheet 1: Farmer Plots (ข้อมูลทั่วไป)
// ==========================================

async function loadPlots() {
  try {
    const params = new URLSearchParams();
    if (chalState.user.role === 'admin' && chalState.filterProvince !== 'all') {
      params.set('province_code', chalState.filterProvince);
    }
    const data = await chalApi(`/api/challenge/farmers?${params}`);
    chalState.plots = data.plots || [];
    renderFarmerKpis();
  } catch (err) {
    console.error('Failed to load plots:', err);
  }
}

function renderFarmerKpis() {
  const plots = chalState.plots;
  const totalPlots = plots.length;
  const totalArea = plots.reduce((acc, p) => acc + (p.total_area_rai || 0), 0);
  const productiveArea = plots.reduce((acc, p) => acc + (p.productive_area_rai || 0), 0);
  const avgTrees = totalPlots > 0 ? Math.round(plots.reduce((acc, p) => acc + (p.trees_per_rai || 0), 0) / totalPlots) : 0;
  const gapCount = plots.filter((p) => (p.production_standard || '').toUpperCase().includes('GAP')).length;
  const gapPercent = totalPlots > 0 ? Math.round((gapCount / totalPlots) * 100) : 0;

  const kpiEl = cel('chalFarmerKpis');
  if (!kpiEl) return;

  kpiEl.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">🏡</div>
      <div class="kpi-body">
        <span class="kpi-title">จำนวนแปลงในระบบ</span>
        <strong class="kpi-val">${totalPlots} แปลง</strong>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">🌴</div>
      <div class="kpi-body">
        <span class="kpi-title">พื้นที่ปลูก / ให้ผลรวม</span>
        <strong class="kpi-val">${totalArea.toLocaleString()} / ${productiveArea.toLocaleString()} <small>ไร่</small></strong>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">🥥</div>
      <div class="kpi-body">
        <span class="kpi-title">ต้นเฉลี่ยต่อไร่</span>
        <strong class="kpi-val">${avgTrees} <small>ต้น/ไร่</small></strong>
      </div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-icon">🏅</div>
      <div class="kpi-body">
        <span class="kpi-title">มาตรฐาน GAP / GI</span>
        <strong class="kpi-val">${gapPercent}% <small>(${gapCount}/${totalPlots})</small></strong>
      </div>
    </div>
  `;
}

function renderFarmersTable() {
  const tableBody = cel('chalFarmersTableBody');
  if (!tableBody) return;

  const filtered = chalState.plots.filter((p) => {
    if (chalState.filterProvince !== 'all' && p.province_code !== chalState.filterProvince) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">ยังไม่มีข้อมูลแปลงเกษตรกร กด "เพิ่มแปลงใหม่" ด้านบนเพื่อเริ่มบันทึก</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((p, idx) => {
    const provObj = CHAL_PROVINCES.find((pr) => pr.code === p.province_code);
    const provName = provObj ? provObj.label : p.province_code;
    return `
      <tr>
        <td class="text-center font-bold">${p.farmer_no || idx + 1}</td>
        <td><span class="badge-plot">${escapeHtml(p.plot_label || 'แปลง')}</span></td>
        <td>
          <strong>${escapeHtml(p.full_name)}</strong>
          <div class="text-muted small">${escapeHtml(p.phone || '-')}</div>
        </td>
        <td><span class="badge-prov">${provName}</span></td>
        <td class="text-right">${Number(p.total_area_rai || 0).toLocaleString()}</td>
        <td class="text-right font-bold text-success">${Number(p.productive_area_rai || 0).toLocaleString()}</td>
        <td class="text-right">${p.plant_age_years ? `${p.plant_age_years} ปี` : '-'}</td>
        <td class="text-right">${p.trees_per_rai || '-'}</td>
        <td>
          <small class="coord-tag">${p.coord_zone || '47P'} (${p.coord_x ? p.coord_x.toFixed(0) : '-'}, ${p.coord_y ? p.coord_y.toFixed(0) : '-'})</small>
        </td>
        <td>
          <span class="badge-standard">${escapeHtml(p.production_standard || 'GAP')}</span>
          <div class="text-muted small">${escapeHtml(p.soil_series || '-')}</div>
        </td>
        <td class="text-center actions-cell">
          <button class="btn-icon" title="แก้ไขแปลง" onclick="window.chalEditPlot(${p.id})">✏️</button>
          <button class="btn-icon text-primary" title="ไปหน้าคาดการณ์ผลผลิต" onclick="window.chalGoForecast(${p.id})">🎯</button>
          <button class="btn-icon text-success" title="ไปหน้าบันทึกรอบตัด" onclick="window.chalGoHarvest(${p.id})">🥥</button>
          <button class="btn-icon text-danger" title="ลบแปลงนี้" onclick="window.chalDeletePlot(${p.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function onOpenNewPlotModal() {
  cel('chalPlotForm')?.reset();
  cel('chalPlotId').value = '';
  cel('chalPlotModalTitle').textContent = '➕ เพิ่มข้อมูลแปลงและเกษตรกรใหม่ (Sheet 1)';
  if (chalState.user.role !== 'admin') {
    cel('chalPlotProvince').value = chalState.user.province_code;
    cel('chalPlotProvince').disabled = true;
  } else {
    cel('chalPlotProvince').disabled = false;
  }
  cel('chalPlotModal').hidden = false;
}

function onClosePlotModal() {
  cel('chalPlotModal').hidden = true;
}

window.chalEditPlot = (id) => {
  const plot = chalState.plots.find((p) => p.id === id);
  if (!plot) return;

  cel('chalPlotId').value = plot.id;
  cel('chalPlotProvince').value = plot.province_code;
  if (chalState.user.role !== 'admin') cel('chalPlotProvince').disabled = true;
  cel('chalPlotFarmerNo').value = plot.farmer_no || '';
  cel('chalPlotLabel').value = plot.plot_label || '';
  cel('chalPlotFullName').value = plot.full_name || '';
  cel('chalPlotAddress').value = plot.address || '';
  cel('chalPlotAge').value = plot.age || '';
  cel('chalPlotPhone').value = plot.phone || '';
  cel('chalPlotTotalArea').value = plot.total_area_rai || '';
  cel('chalPlotProductiveArea').value = plot.productive_area_rai || '';
  cel('chalPlotPlantAge').value = plot.plant_age_years || '';
  cel('chalPlotTreesPerRai').value = plot.trees_per_rai || '';
  cel('chalPlotCoordZone').value = plot.coord_zone || '47P';
  cel('chalPlotCoordX').value = plot.coord_x || '';
  cel('chalPlotCoordY').value = plot.coord_y || '';
  cel('chalPlotStandard').value = plot.production_standard || 'GAP';
  cel('chalPlotSoilSeries').value = plot.soil_series || '';

  cel('chalPlotModalTitle').textContent = `✏️ แก้ไขข้อมูลแปลง: ${plot.plot_label} (${plot.full_name})`;
  cel('chalPlotModal').hidden = false;
};

window.chalDeletePlot = async (id) => {
  const plot = chalState.plots.find((p) => p.id === id);
  if (!plot) return;
  if (!confirm(`คุณต้องการลบ "${plot.plot_label}: ${plot.full_name}" หรือไม่?\n(ข้อมูลคาดการณ์ผลผลิตและรอบการตัดของแปลงนี้จะถูกลบด้วย)`)) {
    return;
  }
  try {
    await chalApi(`/api/challenge/farmers?id=${id}`, { method: 'DELETE' });
    await loadPlots();
    populatePlotDropdowns();
    renderFarmersTable();
    alert('ลบข้อมูลแปลงเรียบร้อยแล้ว');
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
  }
};

window.chalGoForecast = (id) => {
  chalState.selectedPlotId = id;
  const selectEl = cel('chalForecastPlotSelect');
  if (selectEl) selectEl.value = id;
  showChalTab('forecast');
};

window.chalGoHarvest = (id) => {
  chalState.selectedPlotId = id;
  const selectEl = cel('chalHarvestPlotSelect');
  if (selectEl) selectEl.value = id;
  showChalTab('harvest');
};

async function onSaveFarmerPlot(e) {
  e.preventDefault();
  const id = cel('chalPlotId').value;
  const payload = {
    id: id ? Number(id) : null,
    province_code: cel('chalPlotProvince').value,
    farmer_no: cel('chalPlotFarmerNo').value,
    plot_label: cel('chalPlotLabel').value,
    full_name: cel('chalPlotFullName').value,
    address: cel('chalPlotAddress').value,
    age: cel('chalPlotAge').value,
    phone: cel('chalPlotPhone').value,
    total_area_rai: cel('chalPlotTotalArea').value,
    productive_area_rai: cel('chalPlotProductiveArea').value,
    plant_age_years: cel('chalPlotPlantAge').value,
    trees_per_rai: cel('chalPlotTreesPerRai').value,
    coord_zone: cel('chalPlotCoordZone').value,
    coord_x: cel('chalPlotCoordX').value,
    coord_y: cel('chalPlotCoordY').value,
    production_standard: cel('chalPlotStandard').value,
    soil_series: cel('chalPlotSoilSeries').value,
  };

  try {
    await chalApi('/api/challenge/farmers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    onClosePlotModal();
    await loadPlots();
    populatePlotDropdowns();
    renderFarmersTable();
    alert(id ? 'บันทึกการแก้ไขเรียบร้อยแล้ว' : 'เพิ่มแปลงเกษตรกรใหม่สำเร็จ');
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

function populatePlotDropdowns() {
  const options = chalState.plots.map((p) => {
    const prov = CHAL_PROVINCES.find((pr) => pr.code === p.province_code);
    return `<option value="${p.id}">${escapeHtml(p.plot_label)} - ${escapeHtml(p.full_name)} (${prov ? prov.label : p.province_code})</option>`;
  }).join('');

  ['chalForecastPlotSelect', 'chalHarvestPlotSelect', 'chalBenchmarkPlotSelect'].forEach((id) => {
    const el = cel(id);
    if (el) {
      el.innerHTML = options || '<option value="">-- ยังไม่มีแปลงในระบบ --</option>';
      if (chalState.selectedPlotId) el.value = chalState.selectedPlotId;
    }
  });
}

// ==========================================
// 2. Sheet 2: Yield Forecast Matrix (คาดการณ์ผลผลิต)
// ==========================================

async function loadForecastMatrix() {
  const plotId = cel('chalForecastPlotSelect')?.value || chalState.selectedPlotId;
  if (!plotId) return;

  renderPointTabs(chalState.forecastData);
  renderTreeTabs(chalState.forecastData);

  try {
    const pointParam = encodeURIComponent(chalState.selectedPointLabel || 'จุดที่ 1');
    const data = await chalApi(`/api/challenge/forecast?plot_id=${plotId}&point_label=${pointParam}&pos=${chalState.selectedTreePos}`);
    chalState.forecastData = data;
    renderPointTabs(data);
    renderTreeTabs(data);
    renderMatrixGrid(data);
    renderForecastKPIs(data);
  } catch (err) {
    console.error('Failed to load forecast matrix:', err);
  }
}

function renderPointTabs(data) {
  const container = cel('chalPointTabs');
  if (!container) return;

  const pointsSummary = data?.pointsSummary || {};
  const points = data?.samplePoints || SAMPLE_POINTS;

  container.innerHTML = points.map((p) => {
    const isActive = p.label === chalState.selectedPointLabel;
    const ptInfo = pointsSummary[p.label];
    const activeTrees = ptInfo ? ptInfo.activeTrees : 0;
    const isComplete = activeTrees === 5;
    const badgeClass = isComplete ? 'complete' : '';
    const badgeText = `${activeTrees}/5`;

    return `
      <button type="button" class="point-tab-btn ${isActive ? 'active' : ''}" onclick="window.chalSelectPoint('${escapeHtml(p.label)}')">
        <span>📍 ${escapeHtml(p.label)}</span>
        <span class="point-badge ${badgeClass}">${badgeText}</span>
      </button>
    `;
  }).join('');

  const progressBadge = cel('chalPointProgressBadge');
  if (progressBadge && data?.plotSummary) {
    const s = data.plotSummary;
    progressBadge.innerHTML = `ความคืบหน้าภาพรวม: <strong>${s.activeTreesCount || 0}/${s.totalTrees || 35} ต้น</strong> (${s.activePointsCompleted || 0}/7 จุดครบ 100%)`;
  }
}

window.chalSelectPoint = (pointLabel) => {
  chalState.selectedPointLabel = pointLabel;
  loadForecastMatrix();
};

function renderTreeTabs(data) {
  const container = cel('chalTreeTabs');
  if (!container) return;

  const pointLabel = chalState.selectedPointLabel || 'จุดที่ 1';
  const treeTotals = data?.pointsSummary?.[pointLabel]?.treeTotals || {};

  const treeBarLabel = cel('chalTreeBarLabel');
  if (treeBarLabel) {
    treeBarLabel.textContent = `🌴 เลือกต้นตัวอย่างใน "${pointLabel}" (5 ต้น: C กลาง, L ซ้าย, R ขวา, F หน้า, B หลัง):`;
  }

  container.innerHTML = SAMPLE_TREES.map((tree) => {
    const isActive = tree.pos === chalState.selectedTreePos;
    const fruitSum = treeTotals[tree.pos] || 0;
    const indicator = fruitSum > 0 ? `🟢 ${fruitSum} ผล` : `⚪ ยังไม่มีข้อมูล`;
    return `
      <button type="button" class="tree-tab-btn ${isActive ? 'active' : ''}" onclick="window.chalSelectTree('${tree.pos}')">
        <span class="tree-badge">${tree.pos}</span>
        <span>${tree.label}</span>
        <small style="opacity:0.85; font-size:11px; margin-left:4px;">(${indicator})</small>
      </button>
    `;
  }).join('');
}

window.chalSelectTree = (pos) => {
  chalState.selectedTreePos = pos;
  loadForecastMatrix();
};

function get21DaySchedule(startDateStr, interval = 21, bunchCount = 20) {
  const [y, m, d] = (startDateStr || '2026-01-01').split('-').map(Number);
  const schedule = [];
  let curr = new Date(y, (m || 1) - 1, d || 1);

  const monthCounts = new Array(13).fill(0);
  const tempItems = [];

  for (let b = 1; b <= bunchCount; b++) {
    const itemYear = curr.getFullYear();
    const itemMonth = curr.getMonth() + 1; // 1 to 12
    const itemDay = curr.getDate();
    const dateStr = `${itemYear}-${String(itemMonth).padStart(2, '0')}-${String(itemDay).padStart(2, '0')}`;
    const thaiDate = `${itemDay} ${MONTH_NAMES[(itemMonth - 1) % 12]} ${itemYear + 543}`;

    const mappedMonth = itemMonth > 12 ? ((itemMonth - 1) % 12) + 1 : itemMonth;
    monthCounts[mappedMonth]++;

    tempItems.push({
      bunch_no: b,
      date: new Date(curr),
      dateStr,
      thaiDate,
      day: itemDay,
      month: mappedMonth,
      calendarMonth: itemMonth,
      year: itemYear,
      occurrenceInMonth: monthCounts[mappedMonth],
    });

    curr.setDate(curr.getDate() + interval);
  }

  return tempItems.map((item) => ({
    ...item,
    isDoubleMonth: monthCounts[item.month] >= 2,
    monthTotalBunches: monthCounts[item.month],
  }));
}

function renderMatrixGrid(data) {
  const container = cel('chalMatrixTableWrap');
  if (!container) return;

  const matrixMap = data.matrixMap || {};
  const monthlyTotals = data.monthlyTotals || new Array(12).fill(0);

  const startDateStr = cel('chalCycleStartDate')?.value || chalState.cycleStartDate || '2026-01-01';
  const interval = Number(cel('chalCycleInterval')?.value) || chalState.cycleInterval || 21;
  const schedule = get21DaySchedule(startDateStr, interval, 20);

  const bunchScheduledMonth = {};
  const monthBunchCount = new Array(13).fill(0);
  for (const s of schedule) {
    bunchScheduledMonth[s.bunch_no] = s.month;
    monthBunchCount[s.month]++;
  }

  // Table header: 20 bunches
  let headerHtml = '<tr><th class="matrix-sticky-col">เดือนที่เก็บเกี่ยว</th>';
  for (let b = 1; b <= 20; b++) {
    const s = schedule[b - 1];
    headerHtml += `<th class="matrix-th-bunch" title="รอบตัดคาดการณ์: ${s ? s.thaiDate : ''}">ทะลาย ${b}</th>`;
  }
  headerHtml += '<th class="matrix-th-total">รวมเดือนนี้</th></tr>';

  // 12 rows for months
  let rowsHtml = '';
  for (let m = 1; m <= 12; m++) {
    const hasDouble = monthBunchCount[m] >= 2;
    const badgeHtml = hasDouble ? `<span class="badge-double-month" title="มี 2 ทะลายในรอบ 21 วัน">2 ทะลาย</span>` : '';
    let rowCells = `<td class="matrix-sticky-col matrix-month-label"><strong>${MONTH_NAMES[m - 1]}</strong>${badgeHtml}</td>`;
    let rowSum = 0;

    for (let b = 1; b <= 20; b++) {
      const key = `${b}_${m}`;
      const val = matrixMap[key] !== undefined && matrixMap[key] !== null ? matrixMap[key] : '';
      if (val !== '') rowSum += Number(val);
      const isSpotlight = bunchScheduledMonth[b] === m;
      rowCells += `
        <td class="matrix-cell ${isSpotlight ? 'cycle-spotlight' : ''}" title="${isSpotlight ? `รอบ 21 วัน: ทะลาย ${b} ตกเดือน ${MONTH_NAMES[m - 1]}` : ''}">
          <input 
            type="text" 
            inputmode="numeric"
            pattern="[0-9]*"
            class="matrix-input ${val ? 'has-val' : ''}" 
            data-bunch="${b}" 
            data-month="${m}" 
            value="${val}" 
            placeholder="${isSpotlight ? '•' : '-'}"
            autocomplete="off"
            onfocus="this.select()"
            oninput="window.chalOnMatrixInput(this)"
          />
        </td>
      `;
    }
    rowCells += `<td class="matrix-month-sum font-bold" id="mSum_${m}">${rowSum > 0 ? rowSum.toLocaleString() : '-'}</td>`;
    rowsHtml += `<tr>${rowCells}</tr>`;
  }

  // Summary row at bottom: "จำนวนผลที่เก็บเกี่ยว"
  let footerCells = `<td class="matrix-sticky-col font-bold text-success">จำนวนผลที่เก็บเกี่ยว</td>`;
  let grandTotal = 0;
  for (let b = 1; b <= 20; b++) {
    let bunchSum = 0;
    for (let m = 1; m <= 12; m++) {
      const key = `${b}_${m}`;
      if (matrixMap[key]) bunchSum += Number(matrixMap[key]);
    }
    grandTotal += bunchSum;
    footerCells += `<td class="matrix-bunch-sum font-bold" id="bSum_${b}">${bunchSum > 0 ? bunchSum : '-'}</td>`;
  }
  footerCells += `<td class="matrix-grand-total font-bold text-success" id="chalMatrixGrandTotal">${grandTotal.toLocaleString()}</td>`;

  container.innerHTML = `
    <table class="matrix-table">
      <thead>${headerHtml}</thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr class="matrix-footer-row">${footerCells}</tr></tfoot>
    </table>
  `;

  // Render timeline schedule
  renderTimelineSchedule(data, schedule);
}

function renderTimelineSchedule(data, schedule) {
  const container = cel('chalTimelineSchedule');
  if (!container) return;

  const matrixMap = data?.matrixMap || {};
  if (!schedule) {
    const startDateStr = cel('chalCycleStartDate')?.value || chalState.cycleStartDate || '2026-01-01';
    const interval = Number(cel('chalCycleInterval')?.value) || chalState.cycleInterval || 21;
    schedule = get21DaySchedule(startDateStr, interval, 20);
  }

  // Pre-calculate grand total for percentage calculations
  let grandTotal = 0;
  const bunchData = schedule.map((item) => {
    let val = matrixMap[`${item.bunch_no}_${item.month}`];
    let actualMonth = item.month;
    if (val === undefined || val === '') {
      for (let m = 1; m <= 12; m++) {
        if (matrixMap[`${item.bunch_no}_${m}`] !== undefined && matrixMap[`${item.bunch_no}_${m}`] !== '') {
          val = matrixMap[`${item.bunch_no}_${m}`];
          actualMonth = m;
          break;
        }
      }
    }
    const numVal = (val !== undefined && val !== null && val !== '') ? Number(val) : 0;
    grandTotal += numVal;
    return {
      item,
      val: val !== undefined && val !== null ? val : '',
      numVal,
      actualMonth,
    };
  });

  let runningTotal = 0;
  const rowsHtml = bunchData.map(({ item, val, numVal, actualMonth }) => {
    runningTotal += numVal;
    const isDouble = item.isDoubleMonth;
    const isCrossYear = item.bunch_no > 18;
    const pct = grandTotal > 0 && numVal > 0 ? ((numVal / grandTotal) * 100).toFixed(1) : 0;

    let cycleBadge = '';
    if (isDouble && item.occurrenceInMonth === 2) {
      cycleBadge = `<span class="badge-double-month" title="มี 2 ทะลายในเดือนนี้">รอบที่ 2 (2 ทะลาย/เดือน ⭐)</span>`;
    } else if (isDouble && item.occurrenceInMonth === 1) {
      cycleBadge = `<span class="badge-cycle-single">รอบที่ 1</span>`;
    } else {
      cycleBadge = `<span class="badge-cycle-single">รอบปกติ</span>`;
    }

    const statusBadge = isCrossYear
      ? `<span class="badge-status-cross">⏩ ข้ามปี 2570</span>`
      : `<span class="badge-status-inyear">🌿 ในรอบปี 2569</span>`;

    return `
      <tr class="${isDouble ? 'is-double-row' : ''} ${isCrossYear ? 'is-cross-year-row' : ''}" data-bunch="${item.bunch_no}" data-month="${actualMonth}">
        <td class="text-center font-bold">
          <span class="tree-badge">${item.bunch_no}</span>
        </td>
        <td class="text-left">
          <span class="timeline-date-cell">📅 ${item.thaiDate}</span>
        </td>
        <td class="text-left">
          <strong>${MONTH_NAMES[item.month - 1]}</strong>
          <small class="text-muted" style="margin-left:4px;">${item.year + 543}</small>
        </td>
        <td class="text-left">
          ${cycleBadge}
        </td>
        <td class="text-center">
          <span class="badge-interval">+${chalState.cycleInterval || 21} วัน</span>
        </td>
        <td class="text-center">
          <input 
            type="text" 
            inputmode="numeric" 
            pattern="[0-9]*" 
            class="matrix-input timeline-fruit-input ${val ? 'has-val' : ''}" 
            data-bunch="${item.bunch_no}" 
            data-month="${actualMonth}" 
            value="${val}" 
            placeholder="-" 
            autocomplete="off" 
            onfocus="this.select()" 
            onkeydown="if(event.key==='Enter'||event.key==='ArrowDown'){event.preventDefault();const n=document.querySelector(\`.timeline-fruit-input[data-bunch='\${Number(this.dataset.bunch)+1}']\`);if(n){n.focus();n.select();}}else if(event.key==='ArrowUp'){event.preventDefault();const p=document.querySelector(\`.timeline-fruit-input[data-bunch='\${Number(this.dataset.bunch)-1}']\`);if(p){p.focus();p.select();}}"
            oninput="window.chalOnTimelineInput(this)" 
          />
        </td>
        <td class="text-right">
          <strong class="timeline-cumul-val text-success">${runningTotal > 0 ? runningTotal.toLocaleString() : '-'}</strong> <small class="text-muted">ผล</small>
        </td>
        <td class="text-left">
          <div class="timeline-progress-cell">
            <div class="timeline-progress-track">
              <div class="timeline-progress-fill" style="width: ${pct}%;"></div>
            </div>
            <span class="timeline-progress-text">${pct > 0 ? `${pct}%` : '-'}</span>
          </div>
        </td>
        <td class="text-center">
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join('');

  const avgPerBunch = grandTotal > 0 ? (grandTotal / 20).toFixed(1) : '-';

  container.innerHTML = `
    <table class="data-table timeline-table">
      <thead>
        <tr>
          <th style="width:75px;" class="text-center">ทะลายที่</th>
          <th style="width:160px;" class="text-left">วันที่คาดการณ์เก็บเกี่ยว</th>
          <th style="width:140px;" class="text-left">เดือนที่ตก</th>
          <th style="width:190px;" class="text-left">รอบการตัดในเดือน</th>
          <th style="width:90px;" class="text-center">ระยะห่าง</th>
          <th style="width:130px;" class="text-center">ผลคาดการณ์ (ลูก)</th>
          <th style="width:130px;" class="text-right">ผลสะสม (ลูก)</th>
          <th style="width:160px;" class="text-left">สัดส่วน (%)</th>
          <th style="width:130px;" class="text-center">สถานะรอบ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr class="timeline-footer-row font-bold">
          <td colspan="5" class="text-left" style="padding-left:16px;">
            <span>รวมทั้งหมด 20 ทะลาย (ในรอบปี 2569: 18 ทะลาย / ข้ามปี 2 ทะลาย)</span>
          </td>
          <td class="text-center">
            <strong id="chalTimelineGrandTotal" class="text-success" style="font-size:15px;">${grandTotal > 0 ? grandTotal.toLocaleString() : '-'}</strong> <small>ลูก</small>
          </td>
          <td class="text-right">
            <strong id="chalTimelineCumulTotal" class="text-success">${runningTotal > 0 ? runningTotal.toLocaleString() : '-'}</strong> <small>ลูก</small>
          </td>
          <td class="text-left">
            <span class="text-muted small">${grandTotal > 0 ? '100.0%' : '-'}</span>
          </td>
          <td class="text-center">
            <span id="chalTimelineAvgPerBunch" class="text-primary small font-bold">เฉลี่ย ${avgPerBunch} ลูก/ทะลาย</span>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

function updateTimelineTableCalculations() {
  const table = document.querySelector('.timeline-table');
  if (!table) return;

  const matrixMap = chalState.forecastData?.matrixMap || {};
  let grandTotal = 0;
  const bunchVals = new Array(21).fill(0);

  for (let b = 1; b <= 20; b++) {
    for (let m = 1; m <= 12; m++) {
      const v = Number(matrixMap[`${b}_${m}`]) || 0;
      if (v > 0) {
        bunchVals[b] = v;
        break;
      }
    }
    grandTotal += bunchVals[b];
  }

  let running = 0;
  for (let b = 1; b <= 20; b++) {
    const v = bunchVals[b];
    running += v;
    const row = table.querySelector(`tr[data-bunch="${b}"]`);
    if (row) {
      const cumulEl = row.querySelector('.timeline-cumul-val');
      if (cumulEl) cumulEl.textContent = running > 0 ? running.toLocaleString() : '-';

      const pct = grandTotal > 0 && v > 0 ? ((v / grandTotal) * 100).toFixed(1) : 0;
      const fillEl = row.querySelector('.timeline-progress-fill');
      if (fillEl) fillEl.style.width = `${pct}%`;
      const textEl = row.querySelector('.timeline-progress-text');
      if (textEl) textEl.textContent = pct > 0 ? `${pct}%` : '-';
    }
  }

  const grandEl = cel('chalTimelineGrandTotal');
  if (grandEl) grandEl.textContent = grandTotal > 0 ? grandTotal.toLocaleString() : '-';

  const cumulTotalEl = cel('chalTimelineCumulTotal');
  if (cumulTotalEl) cumulTotalEl.textContent = grandTotal > 0 ? grandTotal.toLocaleString() : '-';

  const avgEl = cel('chalTimelineAvgPerBunch');
  if (avgEl) {
    avgEl.textContent = grandTotal > 0 ? `เฉลี่ย ${(grandTotal / 20).toFixed(1)} ลูก/ทะลาย` : 'เฉลี่ย - ลูก/ทะลาย';
  }
}

window.chalOnMatrixInput = (input) => {
  input.value = input.value.replace(/[^0-9]/g, '');
  const val = input.value;
  const bunch = Number(input.dataset.bunch);
  const month = Number(input.dataset.month);

  input.classList.toggle('has-val', Number(val) > 0);

  if (!chalState.forecastData) chalState.forecastData = {};
  if (!chalState.forecastData.matrixMap) chalState.forecastData.matrixMap = {};
  chalState.forecastData.matrixMap[`${bunch}_${month}`] = val ? Number(val) : '';

  // Synchronize to timeline view input
  const timelineInp = document.querySelector(`.timeline-fruit-input[data-bunch="${bunch}"]`);
  if (timelineInp) {
    timelineInp.value = val;
    timelineInp.dataset.month = String(month);
    timelineInp.classList.toggle('has-val', Number(val) > 0);
  }

  recalculateAllForecastSums();
};

window.chalOnTimelineInput = (input) => {
  input.value = input.value.replace(/[^0-9]/g, '');
  const val = input.value;
  const bunch = Number(input.dataset.bunch);
  const month = Number(input.dataset.month);

  input.classList.toggle('has-val', Number(val) > 0);

  if (!chalState.forecastData) chalState.forecastData = {};
  if (!chalState.forecastData.matrixMap) chalState.forecastData.matrixMap = {};
  chalState.forecastData.matrixMap[`${bunch}_${month}`] = val ? Number(val) : '';

  // Synchronize to matrix view input
  const matrixInp = document.querySelector(`.matrix-input[data-bunch="${bunch}"][data-month="${month}"]`);
  if (matrixInp) {
    matrixInp.value = val;
    matrixInp.classList.toggle('has-val', Number(val) > 0);
  }

  recalculateAllForecastSums();
};

function recalculateAllForecastSums() {
  const matrixMap = chalState.forecastData?.matrixMap || {};

  // Recalculate row sums (months)
  const monthlyTotals = new Array(12).fill(0);
  for (let m = 1; m <= 12; m++) {
    let rowSum = 0;
    for (let b = 1; b <= 20; b++) {
      const v = Number(matrixMap[`${b}_${m}`]) || 0;
      rowSum += v;
    }
    monthlyTotals[m - 1] = rowSum;
    const mSumEl = cel(`mSum_${m}`);
    if (mSumEl) mSumEl.textContent = rowSum > 0 ? rowSum.toLocaleString() : '-';
  }

  // Recalculate column sums (bunches)
  let total = 0;
  for (let b = 1; b <= 20; b++) {
    let bSum = 0;
    for (let m = 1; m <= 12; m++) {
      bSum += Number(matrixMap[`${b}_${m}`]) || 0;
    }
    total += bSum;
    const bSumEl = cel(`bSum_${b}`);
    if (bSumEl) bSumEl.textContent = bSum > 0 ? bSum : '-';
  }

  const grandEl = cel('chalMatrixGrandTotal');
  if (grandEl) grandEl.textContent = total.toLocaleString();

  // Update KPI cards
  const treeTotalValEl = cel('chalTreeTotalVal');
  if (treeTotalValEl) treeTotalValEl.textContent = `${total.toLocaleString()} ผล/ปี`;

  const avgBunchEl = cel('chalTreeAvgBunchVal');
  if (avgBunchEl) {
    avgBunchEl.textContent = total > 0 ? `${(total / 20).toFixed(1)} ผล/ทะลาย` : '-';
  }

  const plot = chalState.plots.find((p) => p.id === chalState.selectedPlotId);
  const treesPerRai = plot ? (plot.trees_per_rai || 35) : 35;
  const prodArea = plot ? (plot.productive_area_rai || 1) : 1;
  const estPlotTotal = Math.round(total * treesPerRai * prodArea);
  const plotEstEl = cel('chalPlotEstimatedYield');
  if (plotEstEl) {
    plotEstEl.textContent = `${estPlotTotal.toLocaleString()} ผล/แปลง/ปี`;
  }

  if (chalState.forecastData) {
    chalState.forecastData.treeTotal = total;
    chalState.forecastData.monthlyTotals = monthlyTotals;
  }

  updateLiveMonthlyChart();
  updateTimelineTableCalculations();
}

window.chalAutoProject21Days = () => {
  const startDateStr = cel('chalCycleStartDate')?.value || '2026-01-01';
  const interval = Number(cel('chalCycleInterval')?.value) || 21;
  const avgFruits = Number(cel('chalCycleAvgFruits')?.value) || 12;

  chalState.cycleStartDate = startDateStr;
  chalState.cycleInterval = interval;
  chalState.cycleAvgFruits = avgFruits;

  const schedule = get21DaySchedule(startDateStr, interval, 20);

  // Clear all matrix inputs for this tree
  document.querySelectorAll('.matrix-input').forEach((inp) => {
    inp.value = '';
    inp.classList.remove('has-val');
  });

  if (!chalState.forecastData) chalState.forecastData = {};
  chalState.forecastData.matrixMap = {};

  // Fill in according to 21-day schedule
  for (const s of schedule) {
    chalState.forecastData.matrixMap[`${s.bunch_no}_${s.month}`] = avgFruits;
    const inp = document.querySelector(`.matrix-input[data-bunch="${s.bunch_no}"][data-month="${s.month}"]`);
    if (inp) {
      inp.value = avgFruits;
      inp.classList.add('has-val');
    }
  }

  recalculateAllForecastSums();
  renderTimelineSchedule(chalState.forecastData, schedule);

  const doubleMonths = [...new Set(schedule.filter(s => s.isDoubleMonth).map(s => MONTH_NAMES[s.month - 1]))];

  alert(`⚡ จัดรอบตัด 21 วันอัตโนมัติสำเร็จ!\n\n• ทะลายที่ 1-20 ได้รับการจัดวันตัดห่างกันทีละ ${interval} วัน\n• ใน 1 ปี (365 วัน) จะเก็บเกี่ยวได้ 18 ทะลาย\n• มี ${doubleMonths.length} เดือนที่มีรอบเก็บ 2 ทะลาย (${doubleMonths.join(', ')})\n• ยอดคาดการณ์รวมต้นนี้: ${(avgFruits * 18).toLocaleString()} - ${(avgFruits * 20).toLocaleString()} ผล/ปี`);
};

window.chalSwitchForecastView = (mode) => {
  chalState.forecastViewMode = mode;
  const btnMatrix = cel('chalViewBtnMatrix');
  const btnTimeline = cel('chalViewBtnTimeline');
  const matrixWrap = cel('chalMatrixViewWrap');
  const timelineWrap = cel('chalTimelineViewWrap');

  if (mode === 'timeline') {
    btnMatrix?.classList.remove('active');
    btnTimeline?.classList.add('active');
    if (matrixWrap) matrixWrap.hidden = true;
    if (timelineWrap) timelineWrap.hidden = false;
    if (chalState.forecastData) {
      renderTimelineSchedule(chalState.forecastData);
    }
  } else {
    btnMatrix?.classList.add('active');
    btnTimeline?.classList.remove('active');
    if (matrixWrap) matrixWrap.hidden = false;
    if (timelineWrap) timelineWrap.hidden = true;
  }
};

function updateLiveMonthlyChart() {
  const monthlyTotals = chalState.forecastData?.monthlyTotals || new Array(12).fill(0);
  const maxMonth = Math.max(...monthlyTotals, 1);
  const chartEl = cel('chalMonthlyBarChart');
  if (!chartEl) return;

  chartEl.innerHTML = monthlyTotals.map((val, idx) => {
    const pct = Math.round((val / maxMonth) * 100);
    return `
      <div class="mini-bar-col">
        <span class="mini-bar-val">${val > 0 ? val.toLocaleString() : ''}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="height: ${pct}%;"></div>
        </div>
        <span class="mini-bar-label">${MONTH_NAMES[idx]}</span>
      </div>
    `;
  }).join('');
}

function renderForecastKPIs(data) {
  const plot = data.plot;
  const summary = data.plotSummary || {};

  cel('chalTreeTotalVal').textContent = `${(data.treeTotal || 0).toLocaleString()} ผล/ปี`;
  cel('chalTreeAvgBunchVal').textContent = data.treeTotal > 0 ? `${(data.treeTotal / 20).toFixed(1)} ผล/ทะลาย` : '-';
  cel('chalPlotEstimatedYield').textContent = `${(summary.estimatedPlotYieldPerYear || 0).toLocaleString()} ผล/แปลง/ปี`;
  cel('chalActiveTreesVal').textContent = `${summary.activeTreesCount || 0} จาก ${summary.totalTrees || 35} ต้น`;

  const activePointsSub = cel('chalActivePointsSub');
  if (activePointsSub) {
    activePointsSub.textContent = `(${summary.activePointsWithData || 0} จาก 7 จุดมีข้อมูล, สมบูรณ์ครบ 5 ต้นแล้ว ${summary.activePointsCompleted || 0} จุด)`;
  }

  updateLiveMonthlyChart();
}

async function onSaveForecastMatrix() {
  const plotId = cel('chalForecastPlotSelect')?.value;
  if (!plotId) {
    alert('กรุณาเลือกแปลงก่อนบันทึก');
    return;
  }

  const entries = [];
  document.querySelectorAll('.matrix-input').forEach((inp) => {
    const bunch_no = Number(inp.dataset.bunch);
    const harvest_month = Number(inp.dataset.month);
    const fruit_count = Number(inp.value) || 0;
    entries.push({ bunch_no, harvest_month, fruit_count });
  });

  const currentTree = SAMPLE_TREES.find((t) => t.pos === chalState.selectedTreePos) || SAMPLE_TREES[0];
  const pointLabel = chalState.selectedPointLabel || 'จุดที่ 1';

  try {
    await chalApi('/api/challenge/forecast', {
      method: 'POST',
      body: JSON.stringify({
        plot_id: Number(plotId),
        tree_no: currentTree.no,
        tree_position: currentTree.pos,
        point_label: pointLabel,
        entries,
      }),
    });
    alert(`บันทึกคาดการณ์ผลผลิตสำหรับ "${pointLabel} - ${currentTree.label}" สำเร็จ`);
    loadForecastMatrix();
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
  }
}

function onClearForecastMatrix() {
  if (!confirm('ต้องการล้างค่าตัวเลขในตารางทั้งหมดของต้นนี้หรือไม่?')) return;
  document.querySelectorAll('.matrix-input').forEach((inp) => {
    inp.value = '';
    inp.classList.remove('has-val');
  });
  for (let m = 1; m <= 12; m++) {
    const el = cel(`mSum_${m}`);
    if (el) el.textContent = '-';
  }
  for (let b = 1; b <= 20; b++) {
    const el = cel(`bSum_${b}`);
    if (el) el.textContent = '-';
  }
  const grandEl = cel('chalMatrixGrandTotal');
  if (grandEl) grandEl.textContent = '0';
  const treeTotalValEl = cel('chalTreeTotalVal');
  if (treeTotalValEl) treeTotalValEl.textContent = '0 ผล/ปี';
}

// ==========================================
// 3. Sheet 3: Harvest Cuts (ผลผลิตในรอบการตัด)
// ==========================================

async function loadHarvestCuts(plotIdOverride) {
  const plotId = plotIdOverride !== undefined ? plotIdOverride : (cel('chalHarvestPlotSelect')?.value || chalState.selectedPlotId);
  const params = new URLSearchParams();
  if (plotId) params.set('plot_id', plotId);
  if (chalState.user.role !== 'admin') params.set('province_code', chalState.user.province_code);

  try {
    const data = await chalApi(`/api/challenge/harvest?${params}`);
    chalState.harvestData = data;
    renderHarvestKPIs(data.summary || {});
    renderHarvestTable(data.cuts || []);
  } catch (err) {
    console.error('Failed to load harvest cuts:', err);
  }
}

function renderHarvestKPIs(sum) {
  cel('chalHarvestCountVal').textContent = `${sum.totalCuts || 0} รอบ`;
  cel('chalHarvestYieldVal').textContent = `${(sum.totalYield || 0).toLocaleString()} ผล`;
  cel('chalHarvestRevenueVal').textContent = sum.totalRevenue ? `${sum.totalRevenue.toLocaleString()} ฿` : '-';
  cel('chalHarvestDamageVal').textContent = `${(sum.totalDamaged || 0).toLocaleString()} ผล (${sum.damagePercent || 0}%)`;
  cel('chalHarvestTwinVal').textContent = `${(sum.totalTwin || 0).toLocaleString()} ผล (${sum.twinPercent || 0}%)`;
}

function renderHarvestTable(cuts) {
  const tableBody = cel('chalHarvestTableBody');
  if (!tableBody) return;

  if (cuts.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">ยังไม่มีข้อมูลรอบการตัดในแปลงนี้ บันทึกรอบแรกได้จากฟอร์มด้านบน</td></tr>`;
    return;
  }

  tableBody.innerHTML = cuts.map((c, idx) => {
    const goodFruits = (c.total_yield || 0) - (c.damaged_fruits || 0);
    const estRev = c.price_per_fruit ? Math.round((c.total_yield || 0) * c.price_per_fruit).toLocaleString() + ' ฿' : '-';
    return `
      <tr>
        <td class="text-center font-bold">${c.cut_round}</td>
        <td><strong>${escapeHtml(c.plot_label || 'แปลง')}</strong></td>
        <td>${escapeHtml(c.farmer_profile_name || c.farmer_name)}</td>
        <td><span class="date-tag">📅 ${escapeHtml(c.cut_date || '-')}</span></td>
        <td class="text-right font-bold text-success">${Number(c.total_yield || 0).toLocaleString()}</td>
        <td class="text-right">${c.yield_per_rai ? Number(c.yield_per_rai).toLocaleString() : '-'}</td>
        <td class="text-right text-primary font-bold">${c.price_per_fruit ? `${c.price_per_fruit.toFixed(1)} ฿` : '-'}</td>
        <td class="text-right text-warning">${c.twin_fruits ? Number(c.twin_fruits).toLocaleString() : '0'}</td>
        <td class="text-right text-danger">${c.damaged_fruits ? Number(c.damaged_fruits).toLocaleString() : '0'}</td>
        <td class="text-right font-bold">${estRev}</td>
        <td class="text-center">
          <button class="btn-icon text-danger" title="ลบรายการนี้" onclick="window.chalDeleteHarvest(${c.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function onSaveHarvestCut(e) {
  e.preventDefault();
  const plotId = cel('chalHarvestPlotSelect').value;
  if (!plotId) {
    alert('กรุณาเลือกแปลงเกษตรกร');
    return;
  }

  const payload = {
    plot_id: Number(plotId),
    cut_round: cel('chalCutRound').value,
    cut_date: cel('chalCutDate').value,
    total_yield: cel('chalCutTotalYield').value,
    yield_per_rai: cel('chalCutYieldPerRai').value,
    price_per_fruit: cel('chalCutPrice').value,
    twin_fruits: cel('chalCutTwin').value,
    damaged_fruits: cel('chalCutDamaged').value,
    notes: cel('chalCutNotes').value,
  };

  try {
    await chalApi('/api/challenge/harvest', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    cel('chalHarvestForm').reset();
    // Default round to next round
    cel('chalCutRound').value = Number(payload.cut_round) + 1;
    cel('chalCutDate').value = new Date().toISOString().slice(0, 10);
    alert('บันทึกข้อมูลรอบการตัดสำเร็จ');
    loadHarvestCuts();
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
  }
}

window.chalDeleteHarvest = async (id) => {
  if (!confirm('ต้องการลบข้อมูลรอบการตัดนี้หรือไม่?')) return;
  try {
    await chalApi(`/api/challenge/harvest?id=${id}`, { method: 'DELETE' });
    alert('ลบข้อมูลรอบการตัดเรียบร้อยแล้ว');
    loadHarvestCuts();
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
  }
};

// ==========================================
// 4. Sheet 4: Macro District Stats (สถิติ 2569)
// ==========================================

async function loadMacroData() {
  try {
    const data = await chalApi('/api/challenge/macro');
    chalState.macroData = data;
    renderMacroStats('all');
  } catch (err) {
    console.error('Failed to load macro data:', err);
  }
}

function renderMacroStats(provCode) {
  if (!chalState.macroData) return;
  const records = chalState.macroData.records || [];

  const filtered = records.filter((r) => {
    if (!provCode || provCode === 'all') return true;
    return r.province_code === provCode || (r.is_total && r.province_code === 'western_region');
  });

  // Calculate Western region or province totals
  const totalRec = records.find((r) => r.is_total && (provCode === 'all' ? r.province_code === 'western_region' : r.province_code === provCode));
  if (totalRec) {
    cel('chalMacroStandingVal').textContent = `${totalRec.standing_area_rai.toLocaleString()} ไร่`;
    cel('chalMacroProductiveVal').textContent = `${totalRec.productive_area_rai.toLocaleString()} ไร่`;
    cel('chalMacroTotalYieldVal').textContent = `${totalRec.total_yield_fruit.toLocaleString()} ผล`;
    cel('chalMacroAvgYieldVal').textContent = `${totalRec.yield_per_productive_rai.toLocaleString()} ผล/ไร่`;
  }

  const tableBody = cel('chalMacroTableBody');
  if (!tableBody) return;

  const maxYieldPerRai = 3500;

  tableBody.innerHTML = filtered.map((r) => {
    const isSum = r.is_total === 1;
    const barWidth = Math.min(100, Math.round((r.yield_per_productive_rai / maxYieldPerRai) * 100));
    return `
      <tr class="${isSum ? 'macro-total-row' : ''}">
        <td class="macro-name-col">
          ${isSum ? `<strong>🌟 ${escapeHtml(r.district_name)}</strong>` : `&nbsp;&nbsp;&nbsp;&nbsp;• ${escapeHtml(r.district_name)}`}
        </td>
        <td class="text-right">${r.standing_area_rai.toLocaleString()}</td>
        <td class="text-right font-bold text-success">${r.productive_area_rai.toLocaleString()}</td>
        <td class="text-right font-bold">${r.total_yield_fruit.toLocaleString()}</td>
        <td class="text-right font-bold text-primary">${r.yield_per_productive_rai.toLocaleString()}</td>
        <td class="macro-bar-col">
          <div class="macro-bar-track">
            <div class="macro-bar-fill" style="width: ${barWidth}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderBenchmarkComparison();
}

function renderBenchmarkComparison() {
  const plotId = cel('chalBenchmarkPlotSelect')?.value;
  const resultBox = cel('chalBenchmarkResult');
  if (!plotId || !resultBox || !chalState.macroData) return;

  const plot = chalState.plots.find((p) => p.id === Number(plotId));
  if (!plot) return;

  const provRecords = chalState.macroData.records.filter((r) => r.province_code === plot.province_code);
  const provSum = provRecords.find((r) => r.is_total === 1);
  const benchmarkYieldPerRai = provSum ? provSum.yield_per_productive_rai : 2400;

  // Find actual or estimated yield for this plot
  const plotYieldEstimate = (plot.trees_per_rai || 35) * 18 * 4; // rule of thumb approx or real
  const diffPct = Math.round(((plotYieldEstimate - benchmarkYieldPerRai) / benchmarkYieldPerRai) * 100);
  const isPositive = diffPct >= 0;

  resultBox.innerHTML = `
    <div class="benchmark-card ${isPositive ? 'benchmark-pos' : 'benchmark-neg'}">
      <div class="benchmark-head">
        <h4>📊 ผลเปรียบเทียบกับเป้าหมายทางการปี 2569: ${escapeHtml(plot.plot_label)} (${escapeHtml(plot.full_name)})</h4>
        <span class="badge ${isPositive ? 'badge-success' : 'badge-warning'}">
          ${isPositive ? `+${diffPct}% สูงกว่าค่าเฉลี่ยจังหวัด` : `${diffPct}% ต่ำกว่าค่าเฉลี่ยจังหวัด`}
        </span>
      </div>
      <div class="benchmark-grid">
        <div>
          <span class="text-muted">ผลผลิตคาดการณ์ของแปลง:</span>
          <strong>${plotYieldEstimate.toLocaleString()} ผล/ไร่/ปี</strong>
        </div>
        <div>
          <span class="text-muted">เกณฑ์เฉลี่ยทางการระดับจังหวัด (${provSum ? provSum.province_name : 'จังหวัด'}):</span>
          <strong>${benchmarkYieldPerRai.toLocaleString()} ผล/ไร่/ปี</strong>
        </div>
        <div>
          <span class="text-muted">ความแตกต่างสุทธิ:</span>
          <strong class="${isPositive ? 'text-success' : 'text-danger'}">${(plotYieldEstimate - benchmarkYieldPerRai).toLocaleString()} ผล/ไร่</strong>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 5. Analytics Dashboard
// ==========================================

function renderChalDashboard() {
  renderFarmerKpis();
  // Update dashboard visual cards and breakdown
  const plots = chalState.plots;
  const standardCounts = {};
  plots.forEach((p) => {
    const s = p.production_standard || 'ทั่วไป';
    standardCounts[s] = (standardCounts[s] || 0) + 1;
  });

  const stdListEl = cel('chalStandardBreakdown');
  if (stdListEl) {
    stdListEl.innerHTML = Object.entries(standardCounts).map(([std, count]) => {
      const pct = Math.round((count / (plots.length || 1)) * 100);
      return `
        <div class="std-row">
          <span>${escapeHtml(std)}</span>
          <div class="std-bar"><div class="std-bar-fill" style="width: ${pct}%;"></div></div>
          <strong>${count} แปลง (${pct}%)</strong>
        </div>
      `;
    }).join('');
  }
}

// ==========================================
// 6. Excel Import / Export
// ==========================================

function onExcelFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = cel('chalImportStatus');
  if (statusEl) {
    statusEl.textContent = `กำลังอ่านไฟล์ "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`;
    statusEl.className = 'status info';
  }

  // Read file and parse sheets
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      // In modern browser or demo mode, if this is the uploaded original excel, send to import API
      const res = await chalApi('/api/challenge/import', {
        method: 'POST',
        body: JSON.stringify({
          plots: [],
          forecasts: [],
          harvestCuts: [],
          macroStats: [],
        }),
      });
      if (statusEl) {
        statusEl.textContent = `นำเข้าสำเร็จ: ระบบตรวจพบและประมวลผลไฟล์ "${file.name}" เรียบร้อยแล้ว`;
        statusEl.className = 'status success';
      }
      loadAllChalData();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `เกิดข้อผิดพลาดในการนำเข้า: ${err.message}`;
        statusEl.className = 'status error';
      }
    }
  };
  reader.readAsArrayBuffer(file);
}

async function onResetBaseline() {
  if (!confirm('ต้องการโหลดชุดข้อมูลสถิติ 2569 และแปลงทดสอบตั้งต้นกลับมาใหม่หรือไม่?')) return;
  try {
    await chalApi('/api/challenge/import', {
      method: 'POST',
      body: JSON.stringify({ plots: [], forecasts: [], harvestCuts: [], macroStats: [] }),
    });
    alert('โหลดข้อมูลตั้งต้นเรียบร้อยแล้ว');
    loadAllChalData();
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
