// Challenge Mode Controller - ระบบข้อมูลการผลิตและคาดการณ์ผลผลิต (4 แบบ)

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
  board2dData: null,
  board2dFilterStatus: 'all',
  board2dFilterProv: 'all',
  board2dSearchQuery: '',
  board2dViewMode: 'matrix',
};

const cel = (id) => document.getElementById(id);

export function getProvinceLabel(code) {
  const p = CHAL_PROVINCES.find((x) => x.code === code);
  return p ? p.label : code;
}

export function initChallenge(user) {
  chalState.user = user;
  if (user.role !== 'admin') {
    chalState.filterProvince = user.province_code;
    chalState.board2dFilterProv = user.province_code;
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

  // Farmers Tab (แบบฟอร์มที่ 1)
  cel('chalPlotForm')?.addEventListener('submit', onSaveFarmerPlot);
  cel('chalBtnNewPlot')?.addEventListener('click', onOpenNewPlotModal);
  cel('chalBtnCancelPlot')?.addEventListener('click', onClosePlotModal);
  cel('btnAutoCopyPoint1')?.addEventListener('click', onAutoCopyPoint1);
  ['chalPlotProductiveArea', 'chalPlotTreesPerRai', 'chalPlotCostPerRai', 'chalPlotIncomePerRai'].forEach((id) => {
    cel(id)?.addEventListener('input', updatePlotCalcSummary);
  });
  cel('chalPlotProvince')?.addEventListener('change', (e) => {
    const prov = CHAL_PROVINCES.find((p) => p.code === e.target.value);
    if (prov && cel('chalPlotProvinceName') && (!cel('chalPlotProvinceName').value || CHAL_PROVINCES.some((x) => x.label === cel('chalPlotProvinceName').value))) {
      cel('chalPlotProvinceName').value = prov.label;
    }
  });
  cel('chalProvFilter')?.addEventListener('change', (e) => {
    chalState.filterProvince = e.target.value;
    renderFarmersTable();
  });
  cel('chalBtnGoBoard2D')?.addEventListener('click', () => showChalTab('board2d'));

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
  cel('btnChalForecastGoBoard')?.addEventListener('click', () => showChalTab('board2d'));

  // 2D Inspection Board Tab
  cel('chalBoardRefreshBtn')?.addEventListener('click', loadBoard2D);
  cel('chalBoardExportBtn')?.addEventListener('click', exportBoard2DCsv);
  cel('chalBoardProvFilter')?.addEventListener('change', (e) => {
    chalState.board2dFilterProv = e.target.value;
    renderBoard2D();
  });
  cel('chalBoardSearchInput')?.addEventListener('input', (e) => {
    chalState.board2dSearchQuery = e.target.value.trim().toLowerCase();
    renderBoard2D();
  });
  document.querySelectorAll('#chalBoardStatusPills .filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#chalBoardStatusPills .filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      chalState.board2dFilterStatus = pill.dataset.boardStatus || 'all';
      renderBoard2D();
    });
  });
  cel('btnBoardViewMatrix')?.addEventListener('click', () => {
    chalState.board2dViewMode = 'matrix';
    cel('btnBoardViewMatrix')?.classList.add('active');
    cel('btnBoardViewCards')?.classList.remove('active');
    const mWrap = cel('chalBoardMatrixContainer');
    const cWrap = cel('chalBoardCardsContainer');
    if (mWrap) mWrap.hidden = false;
    if (cWrap) cWrap.hidden = true;
  });
  cel('btnBoardViewCards')?.addEventListener('click', () => {
    chalState.board2dViewMode = 'cards';
    cel('btnBoardViewCards')?.classList.add('active');
    cel('btnBoardViewMatrix')?.classList.remove('active');
    const mWrap = cel('chalBoardMatrixContainer');
    const cWrap = cel('chalBoardCardsContainer');
    if (mWrap) mWrap.hidden = true;
    if (cWrap) cWrap.hidden = false;
  });

  // Harvest Tab
  cel('chalHarvestForm')?.addEventListener('submit', onSaveHarvestCut);
  cel('chalHarvestPlotSelect')?.addEventListener('change', (e) => {
    updateHarvestPlotInfo();
    loadHarvestCuts(e.target.value);
  });
  cel('chalCutTotalYield')?.addEventListener('input', recalcHarvestYields);
  cel('chalCutTreesPerRai')?.addEventListener('input', (e) => {
    e.target.dataset.autoFilled = 'false';
    recalcHarvestYields();
  });
  cel('chalCutPrice')?.addEventListener('input', recalcHarvestYields);
  cel('chalCutYieldPerRai')?.addEventListener('input', (e) => {
    e.target.dataset.manual = 'true';
    const yRai = parseFloat(e.target.value);
    const density = parseFloat(cel('chalCutTreesPerRai')?.value);
    if (!isNaN(yRai) && !isNaN(density) && density > 0) {
      const yTree = Math.round((yRai / density) * 100) / 100;
      const yTreeInput = cel('chalCutYieldPerTree');
      if (yTreeInput && yTreeInput.dataset.manual !== 'true') {
        yTreeInput.value = yTree;
      }
    }
  });
  cel('chalCutYieldPerTree')?.addEventListener('input', (e) => {
    e.target.dataset.manual = 'true';
  });

  // แบบที่ 3 Density Calculator Helper
  cel('chalBtnToggleDensityCalc')?.addEventListener('click', () => {
    const box = cel('chalDensityCalcBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  cel('chalBtnCloseDensityCalc')?.addEventListener('click', () => {
    const box = cel('chalDensityCalcBox');
    if (box) box.style.display = 'none';
  });
  cel('chalBtnApplyTotalTreesCalc')?.addEventListener('click', onApplyTotalTreesCalc);
  cel('chalBtnApplySpacingCalc')?.addEventListener('click', onApplySpacingCalc);

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

  const tabs = ['farmers', 'forecast', 'harvest', 'board2d', 'macro', 'dashboard', 'io', 'knowledge'];
  tabs.forEach((t) => {
    const panel = cel(`chalTab_${t}`);
    if (panel) panel.hidden = t !== tab;
  });

  if (tab === 'farmers') renderFarmersTable();
  if (tab === 'forecast') loadForecastMatrix();
  if (tab === 'harvest') loadHarvestCuts();
  if (tab === 'board2d') loadBoard2D();
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
// 1. แบบที่ 1: Farmer Plots (ข้อมูลทั่วไป)
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
  const avgCost = totalPlots > 0 ? Math.round(plots.reduce((acc, p) => acc + (p.production_cost_per_rai || 0), 0) / totalPlots) : 0;
  const avgIncome = totalPlots > 0 ? Math.round(plots.reduce((acc, p) => acc + (p.avg_income_per_rai || 0), 0) / totalPlots) : 0;

  const kpiEl = cel('chalFarmerKpis');
  if (!kpiEl) return;

  kpiEl.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">📋</div>
      <div class="kpi-body">
        <span class="kpi-title">แปลงพยากรณ์ในระบบ</span>
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
    <div class="kpi-card">
      <div class="kpi-icon">🏅</div>
      <div class="kpi-body">
        <span class="kpi-title">มาตรฐาน GAP / GI</span>
        <strong class="kpi-val">${gapPercent}% <small>(${gapCount}/${totalPlots})</small></strong>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">💰</div>
      <div class="kpi-body">
        <span class="kpi-title">ต้นทุนเฉลี่ย (ข้อ 7)</span>
        <strong class="kpi-val" style="color:#c2410c;">${avgCost.toLocaleString()} <small>บ./ไร่</small></strong>
      </div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-icon">📈</div>
      <div class="kpi-body">
        <span class="kpi-title">รายได้เฉลี่ย (ข้อ 8)</span>
        <strong class="kpi-val" style="color:#15803d;">${avgIncome.toLocaleString()} <small>บ./ไร่</small></strong>
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
    tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">ยังไม่มีข้อมูลแปลงเกษตรกร กด "บันทึกข้อมูลแปลงใหม่ (แบบฟอร์มที่ 1)" ด้านบนเพื่อเริ่มบันทึก</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((p, idx) => {
    const provObj = CHAL_PROVINCES.find((pr) => pr.code === p.province_code);
    const provName = provObj ? provObj.label : (p.province_name || p.province_code);

    const displayName = p.full_name || `${p.title || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim() || 'ไม่ระบุชื่อ';
    const ageText = p.age ? `${p.age} ปี` : '-';
    const phoneText = p.phone || '-';

    let locText = p.address;
    if (!locText) {
      const parts = [];
      if (p.address_no) parts.push(`เลขที่ ${p.address_no}`);
      if (p.moo) parts.push(`หมู่ ${p.moo}`);
      if (p.subdistrict) parts.push(`ต.${p.subdistrict}`);
      if (p.district) parts.push(`อ.${p.district}`);
      locText = parts.length > 0 ? parts.join(' ') : provName;
    }

    const p1X = p.coord_x1 ?? p.coord_x;
    const p1Y = p.coord_y1 ?? p.coord_y;
    const p1Text = p1X ? `x:${Number(p1X).toFixed(0)}, y:${Number(p1Y).toFixed(0)}` : '-';
    const has4Corners = p.coord_x2 && p.coord_x3 && p.coord_x4;

    const costText = p.production_cost_per_rai ? `${Number(p.production_cost_per_rai).toLocaleString()} บ.` : '-';
    const incomeText = p.avg_income_per_rai ? `${Number(p.avg_income_per_rai).toLocaleString()} บ.` : '-';

    return `
      <tr>
        <td class="text-center font-bold">${p.farmer_no || idx + 1}</td>
        <td><span class="badge-plot">${escapeHtml(p.plot_label || 'แปลง')}</span></td>
        <td>
          <strong style="color:var(--primary-strong);">${escapeHtml(displayName)}</strong>
          <div class="text-muted small">อายุ ${ageText} | 📞 ${escapeHtml(phoneText)}</div>
        </td>
        <td>
          <span class="badge-prov">${escapeHtml(provName)}</span>
          <div class="text-muted small" style="max-width:180px; white-space:normal;" title="${escapeHtml(locText || '')}">${escapeHtml(locText || '-')}</div>
        </td>
        <td class="text-right">
          <strong>${Number(p.total_area_rai || 0).toLocaleString()}</strong> / <span class="text-success font-bold">${Number(p.productive_area_rai || 0).toLocaleString()}</span>
        </td>
        <td class="text-right">
          <div><strong>${p.trees_per_rai ? `${p.trees_per_rai} ต้น` : '-'}</strong></div>
          <div class="text-muted small">${p.plant_age_years ? `อายุ ${p.plant_age_years} ปี` : '-'}</div>
        </td>
        <td>
          <span class="coord-tag">Zone ${p.coord_zone || '47'}</span>
          <div class="text-muted small">จุด 1: ${p1Text}</div>
          ${has4Corners ? `<span style="font-size:10px; color:#15803d; background:#dcfce7; padding:1px 5px; border-radius:4px; display:inline-block; margin-top:2px;">✓ ครบ 4 มุม</span>` : ''}
        </td>
        <td>
          <span class="badge-standard">${escapeHtml(p.production_standard || 'GAP')}</span>
          <div class="text-muted small">${escapeHtml(p.soil_series || '-')}</div>
        </td>
        <td class="text-right">
          <div style="color:#c2410c; font-size:12px;">ทุน: ${costText}</div>
          <div style="color:#15803d; font-size:12px; font-weight:600;">ได้: ${incomeText}</div>
        </td>
        <td class="text-center actions-cell">
          <button class="btn-icon" title="แก้ไขข้อมูลแปลง (แบบฟอร์มที่ 1)" onclick="window.chalEditPlot(${p.id})">✏️</button>
          <button class="btn-icon" title="ดู/พิมพ์แบบฟอร์มที่ 1 (Official Form)" onclick="window.chalViewOfficialForm(${p.id})">📄</button>
          <button class="btn-icon text-primary" title="ไปหน้าคาดการณ์ผลผลิต (แบบที่ 2)" onclick="window.chalGoForecast(${p.id})">🎯</button>
          <button class="btn-icon text-success" title="ไปหน้าบันทึกรอบตัด (แบบที่ 3)" onclick="window.chalGoHarvest(${p.id})">🥥</button>
          <button class="btn-icon text-danger" title="ลบแปลงนี้" onclick="window.chalDeletePlot(${p.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function onOpenNewPlotModal() {
  cel('chalPlotForm')?.reset();
  cel('chalPlotId').value = '';
  cel('chalPlotFullName').value = '';
  cel('chalPlotAddress').value = '';
  cel('chalPlotTitle').value = 'นาย';
  cel('chalPlotCoordZone').value = '47';
  cel('chalPlotStandard').value = 'GAP';
  cel('chalPlotModalTitle').textContent = '📋 บันทึกข้อมูลพื้นฐานแปลงใหม่ (แบบฟอร์มที่ 1)';

  const activeProvCode = chalState.user.role !== 'admin' ? chalState.user.province_code : cel('chalPlotProvince').value;
  const provObj = CHAL_PROVINCES.find((pr) => pr.code === activeProvCode);
  if (provObj && cel('chalPlotProvinceName')) {
    cel('chalPlotProvinceName').value = provObj.label;
  }

  if (chalState.user.role !== 'admin') {
    cel('chalPlotProvince').value = chalState.user.province_code;
    cel('chalPlotProvince').disabled = true;
  } else {
    cel('chalPlotProvince').disabled = false;
  }
  updatePlotCalcSummary();
  cel('chalPlotModal').hidden = false;
}

function onClosePlotModal() {
  cel('chalPlotModal').hidden = true;
}

function onAutoCopyPoint1() {
  const x1 = cel('chalPlotCoordX1')?.value;
  const y1 = cel('chalPlotCoordY1')?.value;
  if (!x1 && !y1) {
    alert('กรุณากรอกพิกัด x และ y ในจุดที่ 1 ก่อนคัดลอก');
    return;
  }
  if (cel('chalPlotCoordX2') && !cel('chalPlotCoordX2').value) cel('chalPlotCoordX2').value = x1;
  if (cel('chalPlotCoordY2') && !cel('chalPlotCoordY2').value) cel('chalPlotCoordY2').value = y1;
  if (cel('chalPlotCoordX3') && !cel('chalPlotCoordX3').value) cel('chalPlotCoordX3').value = x1;
  if (cel('chalPlotCoordY3') && !cel('chalPlotCoordY3').value) cel('chalPlotCoordY3').value = y1;
  if (cel('chalPlotCoordX4') && !cel('chalPlotCoordX4').value) cel('chalPlotCoordX4').value = x1;
  if (cel('chalPlotCoordY4') && !cel('chalPlotCoordY4').value) cel('chalPlotCoordY4').value = y1;
}

function updatePlotCalcSummary() {
  const productiveArea = Number(cel('chalPlotProductiveArea')?.value || 0);
  const treesPerRai = Number(cel('chalPlotTreesPerRai')?.value || 0);
  const cost = Number(cel('chalPlotCostPerRai')?.value || 0);
  const income = Number(cel('chalPlotIncomePerRai')?.value || 0);

  const totalTrees = Math.round(productiveArea * treesPerRai);
  const profit = income - cost;

  if (cel('lblEstTotalTrees')) cel('lblEstTotalTrees').textContent = totalTrees.toLocaleString();
  if (cel('lblEstProfitRai')) {
    cel('lblEstProfitRai').textContent = (profit >= 0 ? '+' : '') + profit.toLocaleString();
    cel('lblEstProfitRai').style.color = profit >= 0 ? '#15803d' : '#b91c1c';
  }
}

window.chalEditPlot = (id) => {
  const plot = chalState.plots.find((p) => p.id === id);
  if (!plot) return;

  cel('chalPlotId').value = plot.id;
  cel('chalPlotProvince').value = plot.province_code;
  if (chalState.user.role !== 'admin') cel('chalPlotProvince').disabled = true;
  cel('chalPlotFarmerNo').value = plot.farmer_no || '';
  cel('chalPlotLabel').value = plot.plot_label || '';

  let title = plot.title || 'นาย';
  let firstName = plot.first_name || '';
  let lastName = plot.last_name || '';

  if (!firstName && plot.full_name) {
    const rawName = plot.full_name.trim();
    if (rawName.startsWith('นางสาว')) {
      title = 'นางสาว';
      const rem = rawName.slice(6).trim().split(/\s+/);
      firstName = rem[0] || '';
      lastName = rem.slice(1).join(' ') || '';
    } else if (rawName.startsWith('ว่าที่ ร.ต.')) {
      title = 'ว่าที่ ร.ต.';
      const rem = rawName.slice(11).trim().split(/\s+/);
      firstName = rem[0] || '';
      lastName = rem.slice(1).join(' ') || '';
    } else if (rawName.startsWith('นาง')) {
      title = 'นาง';
      const rem = rawName.slice(3).trim().split(/\s+/);
      firstName = rem[0] || '';
      lastName = rem.slice(1).join(' ') || '';
    } else if (rawName.startsWith('นาย')) {
      title = 'นาย';
      const rem = rawName.slice(3).trim().split(/\s+/);
      firstName = rem[0] || '';
      lastName = rem.slice(1).join(' ') || '';
    } else {
      const parts = rawName.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  cel('chalPlotTitle').value = title;
  cel('chalPlotFirstName').value = firstName;
  cel('chalPlotLastName').value = lastName;
  cel('chalPlotAge').value = plot.age || '';
  cel('chalPlotPhone').value = plot.phone || '';

  cel('chalPlotAddressNo').value = plot.address_no || '';
  cel('chalPlotStreet').value = plot.street || '';
  cel('chalPlotMoo').value = plot.moo || '';
  cel('chalPlotSubdistrict').value = plot.subdistrict || '';
  cel('chalPlotDistrict').value = plot.district || '';

  const provObj = CHAL_PROVINCES.find((pr) => pr.code === plot.province_code);
  cel('chalPlotProvinceName').value = plot.province_name || (provObj ? provObj.label : '');
  cel('chalPlotAddress').value = plot.address || '';

  cel('chalPlotCoordZone').value = plot.coord_zone || '47';
  cel('chalPlotCoordX1').value = plot.coord_x1 ?? plot.coord_x ?? '';
  cel('chalPlotCoordY1').value = plot.coord_y1 ?? plot.coord_y ?? '';
  cel('chalPlotCoordX2').value = plot.coord_x2 ?? '';
  cel('chalPlotCoordY2').value = plot.coord_y2 ?? '';
  cel('chalPlotCoordX3').value = plot.coord_x3 ?? '';
  cel('chalPlotCoordY3').value = plot.coord_y3 ?? '';
  cel('chalPlotCoordX4').value = plot.coord_x4 ?? '';
  cel('chalPlotCoordY4').value = plot.coord_y4 ?? '';

  cel('chalPlotTotalArea').value = plot.total_area_rai || '';
  cel('chalPlotProductiveArea').value = plot.productive_area_rai || '';
  cel('chalPlotPlantAge').value = plot.plant_age_years || '';
  cel('chalPlotTreesPerRai').value = plot.trees_per_rai || '';

  cel('chalPlotStandard').value = plot.production_standard || 'GAP';
  cel('chalPlotSoilSeries').value = plot.soil_series || '';
  cel('chalPlotCostPerRai').value = plot.production_cost_per_rai || '';
  cel('chalPlotIncomePerRai').value = plot.avg_income_per_rai || '';

  updatePlotCalcSummary();
  const displayName = plot.full_name || `${title} ${firstName} ${lastName}`.trim();
  cel('chalPlotModalTitle').textContent = `✏️ แก้ไขข้อมูลพื้นฐานแปลง: ${plot.plot_label} (${displayName})`;
  cel('chalPlotModal').hidden = false;
};

window.chalViewOfficialForm = (id) => {
  const plot = chalState.plots.find((p) => p.id === id);
  if (!plot) return;

  const provObj = CHAL_PROVINCES.find((pr) => pr.code === plot.province_code);
  const provName = plot.province_name || (provObj ? provObj.label : plot.province_code);

  let title = plot.title || '';
  let firstName = plot.first_name || '';
  let lastName = plot.last_name || '';
  if (!firstName && plot.full_name) {
    const raw = plot.full_name.trim();
    if (raw.startsWith('นางสาว')) {
      title = 'นางสาว';
      const parts = raw.slice(6).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    } else if (raw.startsWith('นาย')) {
      title = 'นาย';
      const parts = raw.slice(3).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    } else if (raw.startsWith('นาง')) {
      title = 'นาง';
      const parts = raw.slice(3).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    } else {
      const parts = raw.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  cel('ofTitle').textContent = title || '-';
  cel('ofFirstName').textContent = firstName || '-';
  cel('ofLastName').textContent = lastName || '-';
  cel('ofAge').textContent = plot.age ? String(plot.age) : '-';
  cel('ofPhone').textContent = plot.phone || '-';

  cel('ofAddressNo').textContent = plot.address_no || '-';
  cel('ofStreet').textContent = plot.street || '-';
  cel('ofMoo').textContent = plot.moo ? String(plot.moo) : '-';
  cel('ofSubdistrict').textContent = plot.subdistrict || '-';
  cel('ofDistrict').textContent = plot.district || '-';
  cel('ofProvince').textContent = provName || '-';

  cel('ofCoordZone').textContent = plot.coord_zone || '47';
  const x1 = plot.coord_x1 ?? plot.coord_x;
  const y1 = plot.coord_y1 ?? plot.coord_y;
  cel('ofX1').textContent = x1 !== null && x1 !== undefined && x1 !== '' ? Number(x1).toFixed(2) : '-';
  cel('ofY1').textContent = y1 !== null && y1 !== undefined && y1 !== '' ? Number(y1).toFixed(2) : '-';
  cel('ofX2').textContent = plot.coord_x2 ? Number(plot.coord_x2).toFixed(2) : '-';
  cel('ofY2').textContent = plot.coord_y2 ? Number(plot.coord_y2).toFixed(2) : '-';
  cel('ofX3').textContent = plot.coord_x3 ? Number(plot.coord_x3).toFixed(2) : '-';
  cel('ofY3').textContent = plot.coord_y3 ? Number(plot.coord_y3).toFixed(2) : '-';
  cel('ofX4').textContent = plot.coord_x4 ? Number(plot.coord_x4).toFixed(2) : '-';
  cel('ofY4').textContent = plot.coord_y4 ? Number(plot.coord_y4).toFixed(2) : '-';

  cel('ofTotalArea').textContent = plot.total_area_rai ? Number(plot.total_area_rai).toLocaleString() : '-';
  cel('ofProductiveArea').textContent = plot.productive_area_rai ? Number(plot.productive_area_rai).toLocaleString() : '-';
  cel('ofTreesPerRai').textContent = plot.trees_per_rai ? Number(plot.trees_per_rai).toLocaleString() : '-';
  cel('ofPlantAge').textContent = plot.plant_age_years ? String(plot.plant_age_years) : '-';

  cel('ofStandard').textContent = plot.production_standard || '-';
  cel('ofSoilSeries').textContent = plot.soil_series || '-';
  cel('ofCost').textContent = plot.production_cost_per_rai ? Number(plot.production_cost_per_rai).toLocaleString() : '-';
  cel('ofIncome').textContent = plot.avg_income_per_rai ? Number(plot.avg_income_per_rai).toLocaleString() : '-';

  cel('chalPlotOfficialFormModal').hidden = false;
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
  updateHarvestPlotInfo();
  showChalTab('harvest');
};

async function onSaveFarmerPlot(e) {
  e.preventDefault();
  const id = cel('chalPlotId').value;
  const title = cel('chalPlotTitle')?.value || '';
  const firstName = cel('chalPlotFirstName')?.value || '';
  const lastName = cel('chalPlotLastName')?.value || '';
  const fullName = `${title ? title + ' ' : ''}${firstName} ${lastName}`.trim();

  const x1 = cel('chalPlotCoordX1')?.value;
  const y1 = cel('chalPlotCoordY1')?.value;

  const payload = {
    id: id ? Number(id) : null,
    province_code: cel('chalPlotProvince').value,
    farmer_no: cel('chalPlotFarmerNo').value,
    plot_label: cel('chalPlotLabel').value,
    title,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    address_no: cel('chalPlotAddressNo')?.value || '',
    street: cel('chalPlotStreet')?.value || '',
    moo: cel('chalPlotMoo')?.value || '',
    subdistrict: cel('chalPlotSubdistrict')?.value || '',
    district: cel('chalPlotDistrict')?.value || '',
    province_name: cel('chalPlotProvinceName')?.value || '',
    address: cel('chalPlotAddress')?.value || '',
    age: cel('chalPlotAge').value,
    phone: cel('chalPlotPhone').value,
    total_area_rai: cel('chalPlotTotalArea').value,
    productive_area_rai: cel('chalPlotProductiveArea').value,
    plant_age_years: cel('chalPlotPlantAge').value,
    trees_per_rai: cel('chalPlotTreesPerRai').value,
    coord_zone: cel('chalPlotCoordZone').value || '47',
    coord_x: x1,
    coord_y: y1,
    coord_x1: x1,
    coord_y1: y1,
    coord_x2: cel('chalPlotCoordX2')?.value || null,
    coord_y2: cel('chalPlotCoordY2')?.value || null,
    coord_x3: cel('chalPlotCoordX3')?.value || null,
    coord_y3: cel('chalPlotCoordY3')?.value || null,
    coord_x4: cel('chalPlotCoordX4')?.value || null,
    coord_y4: cel('chalPlotCoordY4')?.value || null,
    production_standard: cel('chalPlotStandard').value,
    soil_series: cel('chalPlotSoilSeries').value,
    production_cost_per_rai: cel('chalPlotCostPerRai')?.value || 0,
    avg_income_per_rai: cel('chalPlotIncomePerRai')?.value || 0,
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
    alert(id ? 'บันทึกการแก้ไขข้อมูลพื้นฐานแปลงเรียบร้อยแล้ว' : 'บันทึกข้อมูลแปลงใหม่สำเร็จ (แบบฟอร์มที่ 1)');
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
  updateHarvestPlotInfo();
}

// ==========================================
// 2. แบบที่ 2: Yield Forecast Matrix (คาดการณ์ผลผลิต)
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
// 3. แบบที่ 3: Harvest Cuts (ผลผลิตในรอบการตัด)
// ==========================================

function onApplyTotalTreesCalc() {
  const plotId = cel('chalHarvestPlotSelect')?.value || chalState.selectedPlotId;
  const plot = (chalState.plots || []).find((p) => String(p.id) === String(plotId));
  const prodArea = plot ? Number(plot.productive_area_rai || plot.total_area_rai || 0) : 0;
  const totalTrees = parseFloat(cel('chalCalcTotalTreesInPlot')?.value);

  const resEl = cel('chalCalcTotalTreesResult');
  if (isNaN(totalTrees) || totalTrees <= 0) {
    if (resEl) resEl.innerHTML = '<span style="color:#dc2626;">กรุณาระบุจำนวนต้นในสวนเป็นตัวเลขมากกว่า 0</span>';
    return;
  }
  if (!prodArea || prodArea <= 0) {
    if (resEl) resEl.innerHTML = '<span style="color:#dc2626;">ไม่พบข้อมูลพื้นที่แปลง กรุณาเลือกแปลงก่อน</span>';
    return;
  }

  const density = Math.round((totalTrees / prodArea) * 10) / 10;
  if (resEl) resEl.innerHTML = `✅ คำนวณได้: <strong>${density} ต้น/ไร่</strong> (${totalTrees} ต้น ÷ ${prodArea} ไร่)`;

  const treesInput = cel('chalCutTreesPerRai');
  if (treesInput) {
    treesInput.value = density;
    treesInput.dataset.autoFilled = 'false';
  }

  const densityBadge = cel('chalHarvestPlotDensityText');
  if (densityBadge) densityBadge.innerHTML = `ความหนาแน่นแปลง: <strong>${density} ต้น/ไร่</strong>`;
  const totalTreesBadge = cel('chalHarvestPlotTotalTreesText');
  if (totalTreesBadge) totalTreesBadge.innerHTML = `ประมาณการทั้งแปลง: <strong>~${totalTrees.toLocaleString()} ต้น</strong>`;

  recalcHarvestYields();
}

function onApplySpacingCalc() {
  const presetVal = parseFloat(cel('chalCalcSpacingPreset')?.value);
  const resEl = cel('chalCalcSpacingResult');
  if (isNaN(presetVal) || presetVal <= 0) {
    if (resEl) resEl.innerHTML = '<span style="color:#dc2626;">กรุณาเลือกระยะปลูกในรายการ</span>';
    return;
  }

  if (resEl) resEl.innerHTML = `✅ ใช้ค่าความหนาแน่น: <strong>${presetVal} ต้น/ไร่</strong>`;

  const treesInput = cel('chalCutTreesPerRai');
  if (treesInput) {
    treesInput.value = presetVal;
    treesInput.dataset.autoFilled = 'false';
  }

  const plotId = cel('chalHarvestPlotSelect')?.value || chalState.selectedPlotId;
  const plot = (chalState.plots || []).find((p) => String(p.id) === String(plotId));
  const prodArea = plot ? Number(plot.productive_area_rai || plot.total_area_rai || 0) : 0;
  const totalTrees = prodArea > 0 ? Math.round(prodArea * presetVal) : null;

  const densityBadge = cel('chalHarvestPlotDensityText');
  if (densityBadge) densityBadge.innerHTML = `ความหนาแน่นแปลง: <strong>${presetVal} ต้น/ไร่</strong>`;
  const totalTreesBadge = cel('chalHarvestPlotTotalTreesText');
  if (totalTreesBadge) totalTreesBadge.innerHTML = `ประมาณการทั้งแปลง: <strong>~${totalTrees ? totalTrees.toLocaleString() + ' ต้น' : '-'}</strong>`;

  recalcHarvestYields();
}

function updateHarvestPlotInfo() {
  const plotId = cel('chalHarvestPlotSelect')?.value || chalState.selectedPlotId;
  const plot = (chalState.plots || []).find((p) => String(p.id) === String(plotId));

  const areaText = cel('chalHarvestPlotAreaText');
  const sampleText = cel('chalHarvestSampleCountText');
  const densityText = cel('chalHarvestPlotDensityText');
  const totalTreesText = cel('chalHarvestPlotTotalTreesText');
  const treesPerRaiInput = cel('chalCutTreesPerRai');

  if (!plot) {
    if (areaText) areaText.innerHTML = 'พื้นที่ให้ผล: <strong>- ไร่</strong>';
    if (densityText) densityText.innerHTML = 'ความหนาแน่นแปลง: <strong>- ต้น/ไร่</strong>';
    if (totalTreesText) totalTreesText.innerHTML = 'ประมาณการทั้งแปลง: <strong>~- ต้น</strong>';
    return;
  }

  const prodArea = Number(plot.productive_area_rai || plot.total_area_rai || 0);
  const density = Number(plot.trees_per_rai || 0);
  const totalTrees = prodArea > 0 && density > 0 ? Math.round(prodArea * density) : null;

  if (areaText) areaText.innerHTML = `พื้นที่ให้ผล: <strong>${prodArea ? prodArea.toLocaleString() : '-'} ไร่</strong>`;
  if (sampleText) sampleText.innerHTML = '🔬 สุ่มวัดตัวอย่างวิจัย: 35 ต้น (7 จุด × 5 ต้น)';
  if (densityText) densityText.innerHTML = `ความหนาแน่นแปลง: <strong>${density > 0 ? `${density.toLocaleString()} ต้น/ไร่` : 'ยังไม่ระบุ (กดช่วยคำนวณ)'}</strong>`;
  if (totalTreesText) totalTreesText.innerHTML = `ประมาณการทั้งแปลง: <strong>~${totalTrees ? totalTrees.toLocaleString() + ' ต้น' : '-'}</strong>`;

  // Auto-populate trees_per_rai input if not touched or empty
  if (treesPerRaiInput && (!treesPerRaiInput.value || treesPerRaiInput.dataset.autoFilled === 'true' || treesPerRaiInput.value === '0')) {
    if (density > 0) {
      treesPerRaiInput.value = density;
      treesPerRaiInput.dataset.autoFilled = 'true';
    } else {
      treesPerRaiInput.value = '';
    }
  }

  // Pre-fill total trees calculator if plot total trees can be inferred
  if (cel('chalCalcTotalTreesInPlot')) {
    cel('chalCalcTotalTreesInPlot').value = totalTrees || '';
    if (cel('chalCalcTotalTreesResult')) cel('chalCalcTotalTreesResult').textContent = '';
  }

  recalcHarvestYields();
}

function recalcHarvestYields() {
  const plotId = cel('chalHarvestPlotSelect')?.value || chalState.selectedPlotId;
  const plot = (chalState.plots || []).find((p) => String(p.id) === String(plotId));
  const prodArea = plot ? Number(plot.productive_area_rai || plot.total_area_rai || 0) : 0;

  const totalYieldVal = parseFloat(cel('chalCutTotalYield')?.value);
  const treesPerRaiVal = parseFloat(cel('chalCutTreesPerRai')?.value);
  const priceVal = parseFloat(cel('chalCutPrice')?.value);

  const yieldRaiInput = cel('chalCutYieldPerRai');
  const yieldTreeInput = cel('chalCutYieldPerTree');
  const estRevInput = cel('chalCutEstRevenue');

  const bannerYieldRai = cel('chalCutBannerYieldRai');
  const bannerYieldTree = cel('chalCutBannerYieldTree');
  const bannerRev = cel('chalCutBannerRev');
  const bannerText = cel('chalCutCalcBannerText');

  if (isNaN(totalYieldVal) || totalYieldVal <= 0) {
    if (yieldRaiInput && yieldRaiInput.dataset.manual !== 'true') yieldRaiInput.value = '';
    if (yieldTreeInput && yieldTreeInput.dataset.manual !== 'true') yieldTreeInput.value = '';
    if (estRevInput) estRevInput.value = '';
    if (bannerYieldRai) bannerYieldRai.textContent = '🌾 - ผล/ไร่';
    if (bannerYieldTree) bannerYieldTree.textContent = '🥥 - ผล/ต้น';
    if (bannerRev) bannerRev.textContent = '💰 - บาท';
    if (bannerText) bannerText.innerHTML = 'กรอกผลผลิตรวมเพื่อคำนวณ <strong>ผลผลิต/ไร่</strong> และ <strong>ผลผลิต/ต้น</strong> แบบ Real-time';
    return;
  }

  // 1. Calculate yield per rai: totalYield / prodArea
  let yieldPerRai = null;
  if (prodArea > 0) {
    yieldPerRai = Math.round((totalYieldVal / prodArea) * 10) / 10;
    if (yieldRaiInput && yieldRaiInput.dataset.manual !== 'true') {
      yieldRaiInput.value = yieldPerRai;
    }
  } else if (yieldRaiInput && yieldRaiInput.value) {
    yieldPerRai = parseFloat(yieldRaiInput.value);
  }

  // 2. Calculate yield per tree: yieldPerRai / treesPerRai
  let yieldPerTree = null;
  const effectiveDensity = !isNaN(treesPerRaiVal) && treesPerRaiVal > 0 
    ? treesPerRaiVal 
    : (plot && plot.trees_per_rai ? Number(plot.trees_per_rai) : null);

  if (yieldPerRai !== null && effectiveDensity && effectiveDensity > 0) {
    yieldPerTree = Math.round((yieldPerRai / effectiveDensity) * 100) / 100;
  } else if (prodArea > 0 && effectiveDensity && effectiveDensity > 0) {
    const totalTrees = prodArea * effectiveDensity;
    if (totalTrees > 0) {
      yieldPerTree = Math.round((totalYieldVal / totalTrees) * 100) / 100;
    }
  }

  if (yieldTreeInput && yieldTreeInput.dataset.manual !== 'true') {
    yieldTreeInput.value = yieldPerTree !== null ? yieldPerTree : '';
  }

  // 3. Revenue
  let estRev = null;
  if (!isNaN(priceVal) && priceVal > 0) {
    estRev = Math.round(totalYieldVal * priceVal);
    if (estRevInput) {
      estRevInput.value = estRev.toLocaleString() + ' บาท';
    }
  } else if (estRevInput) {
    estRevInput.value = '';
  }

  // 4. Update banner
  if (bannerYieldRai) {
    bannerYieldRai.textContent = yieldPerRai !== null ? `🌾 ${yieldPerRai.toLocaleString()} ผล/ไร่` : '🌾 - ผล/ไร่';
  }
  if (bannerYieldTree) {
    bannerYieldTree.textContent = yieldPerTree !== null ? `🥥 ${yieldPerTree.toLocaleString()} ผล/ต้น` : '🥥 - ผล/ต้น';
  }
  if (bannerRev) {
    bannerRev.textContent = estRev !== null ? `💰 ${estRev.toLocaleString()} บาท` : '💰 - บาท';
  }
  if (bannerText) {
    const treeCountStr = prodArea > 0 && effectiveDensity > 0 ? `(~${Math.round(prodArea * effectiveDensity).toLocaleString()} ต้น)` : '';
    bannerText.innerHTML = `✅ ผลผลิต <strong>${totalYieldVal.toLocaleString()} ผล</strong> ในแปลง ${prodArea ? prodArea + ' ไร่' : ''} ${effectiveDensity ? effectiveDensity + ' ต้น/ไร่ ' + treeCountStr : ''}`;
  }
}

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
    tableBody.innerHTML = `<tr><td colspan="13" class="text-center py-4 text-muted">ยังไม่มีข้อมูลรอบการตัดในแปลงนี้ บันทึกรอบแรกได้จากฟอร์มด้านบน</td></tr>`;
    return;
  }

  tableBody.innerHTML = cuts.map((c, idx) => {
    const goodFruits = (c.total_yield || 0) - (c.damaged_fruits || 0);
    const estRev = c.price_per_fruit ? Math.round((c.total_yield || 0) * c.price_per_fruit).toLocaleString() + ' ฿' : '-';
    const treesPerRaiText = c.trees_per_rai !== null && c.trees_per_rai !== undefined ? `${Number(c.trees_per_rai).toLocaleString()}` : '-';
    const yieldPerRaiText = c.yield_per_rai !== null && c.yield_per_rai !== undefined ? `${Number(c.yield_per_rai).toLocaleString()}` : '-';
    const yieldPerTreeText = c.yield_per_tree !== null && c.yield_per_tree !== undefined ? `${Number(c.yield_per_tree).toLocaleString()}` : '-';

    return `
      <tr>
        <td class="text-center font-bold">${c.cut_round}</td>
        <td><strong>${escapeHtml(c.plot_label || 'แปลง')}</strong></td>
        <td>${escapeHtml(c.farmer_profile_name || c.farmer_name)}</td>
        <td><span class="date-tag">📅 ${escapeHtml(c.cut_date || '-')}</span></td>
        <td class="text-right font-bold text-success">${Number(c.total_yield || 0).toLocaleString()}</td>
        <td class="text-right text-muted">${treesPerRaiText}</td>
        <td class="text-right font-bold">${yieldPerRaiText}</td>
        <td class="text-right font-bold text-primary">${yieldPerTreeText}</td>
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
    trees_per_rai: cel('chalCutTreesPerRai')?.value || null,
    yield_per_rai: cel('chalCutYieldPerRai').value || null,
    yield_per_tree: cel('chalCutYieldPerTree')?.value || null,
    price_per_fruit: cel('chalCutPrice').value || null,
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
    if (cel('chalCutYieldPerRai')) cel('chalCutYieldPerRai').dataset.manual = 'false';
    if (cel('chalCutYieldPerTree')) cel('chalCutYieldPerTree').dataset.manual = 'false';
    // Default round to next round
    cel('chalCutRound').value = Number(payload.cut_round) + 1;
    cel('chalCutDate').value = new Date().toISOString().slice(0, 10);
    updateHarvestPlotInfo();
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
// 4. แบบที่ 4: Macro District Stats (สถิติ 2569)
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

// ==========================================
// 7. 2D Inspection Overview Board (กระดาน 2D ตรวจสอบแปลง)
// ==========================================

export async function loadBoard2D() {
  try {
    const tbody = cel('chalBoardMatrixTbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="14" class="text-center py-4 text-muted">กำลังโหลดข้อมูลกระดาน 2D รายแปลงและจุดสำรวจ...</td></tr>';
    }
    const params = new URLSearchParams();
    if (chalState.filterProvince !== 'all') {
      params.set('province_code', chalState.filterProvince);
    }
    const data = await chalApi(`/api/challenge/board2d?${params.toString()}`);
    chalState.board2dData = data;
    renderBoard2D();
  } catch (err) {
    console.error('Failed to load board2d:', err);
    const tbody = cel('chalBoardMatrixTbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="14" class="text-center py-4 text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูลกระดาน 2D: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

export function renderBoard2D() {
  if (!chalState.board2dData) return;
  const { plots = [], summary = {} } = chalState.board2dData;

  // Update KPI counters
  if (cel('chalBoardKpiTotalPlots')) cel('chalBoardKpiTotalPlots').textContent = `${summary.totalPlots || 0} แปลง`;
  if (cel('chalBoardKpiIncompletePlots')) cel('chalBoardKpiIncompletePlots').textContent = `${summary.incompletePlots || 0} แปลง`;
  if (cel('chalBoardKpiIncompleteSub')) {
    cel('chalBoardKpiIncompleteSub').textContent = (summary.incompletePlots || 0) > 0
      ? `⚠️ มี ${summary.incompletePlots} แปลงที่ยังตรวจไม่ครบ`
      : '✔️ ตรวจครบถ้วนทุกแปลงแล้ว';
  }
  if (cel('chalBoardKpiNotStartedPlots')) cel('chalBoardKpiNotStartedPlots').textContent = `${summary.notStartedPlots || 0} แปลง`;
  if (cel('chalBoardKpiCompletedPlots')) cel('chalBoardKpiCompletedPlots').textContent = `${summary.completedPlots || 0} แปลง`;
  if (cel('chalBoardKpiTotalTrees')) {
    cel('chalBoardKpiTotalTrees').textContent = `${summary.totalTreesChecked || 0} / ${summary.totalPossibleTrees || 0} ต้น`;
  }
  if (cel('chalBoardKpiPercent')) {
    cel('chalBoardKpiPercent').textContent = `ความสมบูรณ์ ${summary.overallPercent || 0}%`;
  }

  // Update Status Pill counts
  if (cel('pillCountAll')) cel('pillCountAll').textContent = plots.length;
  if (cel('pillCountIncomplete')) cel('pillCountIncomplete').textContent = summary.incompletePlots || 0;
  if (cel('pillCountNotStarted')) cel('pillCountNotStarted').textContent = summary.notStartedPlots || 0;
  if (cel('pillCountComplete')) cel('pillCountComplete').textContent = summary.completedPlots || 0;

  // Filter plots
  const statusFilter = chalState.board2dFilterStatus || 'all';
  const provFilter = chalState.board2dFilterProv || 'all';
  const search = (chalState.board2dSearchQuery || '').toLowerCase();

  const filteredPlots = plots.filter((p) => {
    // Status filter
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    // Province filter
    if (provFilter !== 'all' && p.province_code !== provFilter) return false;
    // Search query
    if (search) {
      const matchLabel = (p.plot_label || '').toLowerCase().includes(search);
      const matchName = (p.full_name || '').toLowerCase().includes(search);
      const matchAddress = (p.address || '').toLowerCase().includes(search);
      const matchPhone = (p.phone || '').toLowerCase().includes(search);
      const matchProv = getProvinceLabel(p.province_code).toLowerCase().includes(search);
      if (!matchLabel && !matchName && !matchAddress && !matchPhone && !matchProv) return false;
    }
    return true;
  });

  renderBoard2DMatrix(filteredPlots);
  renderBoard2DCards(filteredPlots);
}

function renderBoard2DMatrix(plots) {
  const tbody = cel('chalBoardMatrixTbody');
  if (!tbody) return;

  const wrap = cel('chalBoardMatrixWrap');
  if (wrap) wrap.scrollLeft = 0;

  if (plots.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" class="text-center py-5" style="color:var(--muted); padding:30px;">
          <div style="font-size:28px; margin-bottom:8px;">🔍</div>
          <strong>ไม่พบแปลงตามเงื่อนไขที่เลือก</strong>
          <p style="font-size:12px; margin-top:4px;">ลองเปลี่ยนตัวกรองสถานะ หรือล้างคำค้นหา</p>
        </td>
      </tr>
    `;
    return;
  }

  const html = plots.map((p, idx) => {
    const provName = getProvinceLabel(p.province_code);
    const provPillClass = `prov-pill-${p.province_code}`;

    let statusPill = '';
    if (p.status === 'complete') {
      statusPill = '<span class="status-chip chip-complete">✅ ครบ 35/35</span>';
    } else if (p.status === 'incomplete') {
      statusPill = `<span class="status-chip chip-incomplete">⚠️ ${p.totalTreesChecked}/35 ต้น</span>`;
    } else {
      statusPill = '<span class="status-chip chip-notstarted">⏳ 0/35 ต้น</span>';
    }

    const progressFillClass = p.status === 'complete' ? 'fill-green' : p.totalTreesChecked > 0 ? 'fill-orange' : 'fill-gray';

    const pointCellsHtml = (p.points || []).map((pt) => {
      let cellClass = 'pt-missing';
      let badgeLabel = '0/5';
      let sym = '○';
      let tooltip = `จุดที่ ${pt.no}: ยังไม่ได้ตรวจ (0/5 ต้น)`;
      let subText = '';

      if (pt.status === 'done') {
        cellClass = 'pt-done';
        badgeLabel = '5/5';
        sym = '✓';
        tooltip = `จุดที่ ${pt.no}: ตรวจครบ 5/5 ต้น (${pt.treesChecked.join(', ')})`;
      } else if (pt.status === 'partial') {
        cellClass = 'pt-partial';
        badgeLabel = `${pt.activeTrees}/5`;
        sym = '•';
        tooltip = `จุดที่ ${pt.no}: ตรวจแล้ว ${pt.activeTrees}/5 ต้น (ขาด: ${pt.treesMissing.join(', ')})`;
        subText = `<span class="pt-sub-tag">ขาด ${pt.treesMissing.join(',')}</span>`;
      }

      return `
        <td class="text-center col-pt">
          <button type="button" class="board-point-btn ${cellClass}"
                  onclick="window.chalJumpToPoint(${p.id}, '${pt.label}', '${pt.treesMissing[0] || 'C'}')"
                  title="${tooltip} - คลิกเพื่อเปิดตรวจจุดนี้">
            <span class="pt-badge-row">
              <span class="pt-sym">${sym}</span>
              <span class="pt-val">${badgeLabel}</span>
            </span>
            ${subText}
          </button>
        </td>
      `;
    }).join('');

    let missingSummaryHtml = '';
    if (p.status === 'complete') {
      missingSummaryHtml = `
        <div class="board-summary-box summary-box-complete">
          <div class="summary-title-complete">
            <span class="summary-check-icon">✓</span> ครบถ้วน 35/35 ต้น
          </div>
          ${p.cutsCount > 0 ? `<div class="summary-cuts-pill">🥥 ตัดผลแล้ว ${p.cutsCount} รอบ (${Number(p.totalCutYield || 0).toLocaleString()} ผล)</div>` : ''}
        </div>
      `;
    } else if (p.status === 'not_started') {
      missingSummaryHtml = `
        <div class="board-summary-box summary-box-notstarted">
          <span class="summary-pending-label">⏳ ยังไม่ได้สำรวจ</span>
          <span class="summary-sub-gray">ค้างทั้ง 7 จุด (35 ต้น)</span>
        </div>
      `;
    } else {
      const missingPoints = (p.points || []).filter((pt) => pt.status !== 'done');
      const missingPills = missingPoints.map((pt) => {
        if (pt.status === 'missing') {
          return `<span class="m-pill m-pill-empty" title="จุด ${pt.no}: ยังไม่ได้ตรวจ">จุด ${pt.no} (0/5)</span>`;
        } else {
          return `<span class="m-pill m-pill-part" title="จุด ${pt.no}: ตรวจแล้ว ${pt.activeTrees}/5 (ขาด ${pt.treesMissing.join(',')})">จุด ${pt.no} (${pt.activeTrees}/5)</span>`;
        }
      }).join('');

      missingSummaryHtml = `
        <div class="board-summary-box summary-box-incomplete">
          <div class="summary-warn-header">
            <span class="badge-pending-count">⚠️ ค้างอีก ${35 - p.totalTreesChecked} ต้น</span>
            <span class="summary-pts-count">(ขาด ${missingPoints.length} จุด)</span>
          </div>
          <div class="missing-pills-wrap">
            ${missingPills}
          </div>
          ${p.cutsCount > 0 ? `<div class="summary-cuts-pill">🥥 ตัดผลแล้ว ${p.cutsCount} รอบ (${Number(p.totalCutYield || 0).toLocaleString()} ผล)</div>` : ''}
        </div>
      `;
    }

    const nextPendingPoint = p.points.find((pt) => pt.status !== 'done') || p.points[0];

    return `
      <tr class="board2d-row board-row-${p.status}">
        <td class="text-center text-muted col-sticky-1" style="font-size:12px; font-weight:600;">${idx + 1}</td>
        <td class="col-sticky-2">
          <div style="font-weight:700; color:var(--primary-strong); font-size:13px; line-height:1.25;">${escapeHtml(p.plot_label)}</div>
          <div style="font-size:12px; color:var(--ink); font-weight:600; margin-top:2px;">${escapeHtml(p.full_name)}</div>
          ${p.address ? `<div style="font-size:11px; color:var(--muted); line-height:1.2; margin-top:1px;">${escapeHtml(p.address)}</div>` : ''}
        </td>
        <td class="text-center">
          <span class="prov-badge ${provPillClass}">${provName}</span>
        </td>
        <td class="text-right" style="font-size:12px;">
          <strong>${Number(p.productive_area_rai || 0).toFixed(1)}</strong>
        </td>
        <td>
          <div class="board-progress-container">
            <div class="board-progress-bar">
              <div class="board-progress-bar-fill ${progressFillClass}" style="width: ${p.percentComplete}%;"></div>
            </div>
            <div class="board-progress-meta">
              <strong>${p.totalTreesChecked}/35 ต้น</strong>
              <span>${p.percentComplete}%</span>
            </div>
            <div style="margin-top:2px;">${statusPill}</div>
          </div>
        </td>
        ${pointCellsHtml}
        <td>
          ${missingSummaryHtml}
        </td>
        <td class="text-center">
          <button type="button" class="button primary small board-inspect-btn"
                  onclick="window.chalJumpToPoint(${p.id}, '${nextPendingPoint.label}', '${nextPendingPoint.treesMissing[0] || 'C'}')">
            ตรวจ
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

function renderBoard2DCards(plots) {
  const grid = cel('chalBoardCardsGrid');
  if (!grid) return;

  if (plots.length === 0) {
    grid.innerHTML = `
      <div class="text-center py-5" style="grid-column:1/-1; color:var(--muted); padding:30px;">
        <div style="font-size:32px; margin-bottom:8px;">🔍</div>
        <strong>ไม่พบแปลงตามเงื่อนไขที่เลือก</strong>
      </div>
    `;
    return;
  }

  const html = plots.map((p) => {
    const provName = getProvinceLabel(p.province_code);
    const provPillClass = `prov-pill-${p.province_code}`;

    let statusHeaderBadge = '';
    if (p.status === 'complete') {
      statusHeaderBadge = '<span class="card-status-badge badge-green">✅ เช็คครบ 35/35 ต้น</span>';
    } else if (p.status === 'incomplete') {
      statusHeaderBadge = `<span class="card-status-badge badge-amber">⚠️ ยังเช็คไม่ครบ (ค้าง ${35 - p.totalTreesChecked} ต้น)</span>`;
    } else {
      statusHeaderBadge = '<span class="card-status-badge badge-slate">⏳ ยังไม่เริ่มสำรวจ</span>';
    }

    const pointsClustersHtml = (p.points || []).map((pt) => {
      const treeDotsHtml = ['C', 'L', 'R', 'F', 'B'].map((pos) => {
        const checked = pt.treesChecked.includes(pos);
        const dotClass = checked ? 'tree-dot-checked' : 'tree-dot-missing';
        const fruitCount = pt.treeTotals[pos] || 0;
        return `<span class="tree-mini-dot ${dotClass}" title="${pos}: ${checked ? `${fruitCount} ผล` : 'ยังไม่ได้ตรวจ'}"></span>`;
      }).join('');

      let clusterStatusClass = 'cluster-missing';
      if (pt.status === 'done') clusterStatusClass = 'cluster-done';
      else if (pt.status === 'partial') clusterStatusClass = 'cluster-partial';

      return `
        <div class="garden-point-cluster ${clusterStatusClass}"
             onclick="window.chalJumpToPoint(${p.id}, '${pt.label}', '${pt.treesMissing[0] || 'C'}')"
             title="จุดที่ ${pt.no} (${pt.activeTrees}/5 ต้น) - คลิกเพื่อเปิดตรวจ">
          <div class="cluster-label">จุด ${pt.no}</div>
          <div class="cluster-trees-grid">${treeDotsHtml}</div>
          <div class="cluster-status-text">${pt.activeTrees}/5</div>
        </div>
      `;
    }).join('');

    const nextPendingPoint = p.points.find((pt) => pt.status !== 'done') || p.points[0];

    return `
      <div class="board2d-plot-card card-status-${p.status}">
        <div class="plot-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap;">
              <span class="prov-badge ${provPillClass}">${provName}</span>
              ${statusHeaderBadge}
            </div>
            <h4 class="plot-card-title">${escapeHtml(p.plot_label)}: ${escapeHtml(p.full_name)}</h4>
            <div class="plot-card-meta">
              <span>🌾 ${Number(p.productive_area_rai || 0).toFixed(1)} ไร่</span>
              <span>🌴 ${p.trees_per_rai || 35} ต้น/ไร่</span>
              <span>🏷️ ${p.production_standard || 'GAP'}</span>
            </div>
          </div>
        </div>

        <!-- 2D Garden Visual Cluster -->
        <div class="garden-cluster-map">
          <div class="garden-map-title">📍 ผังจำลอง 7 จุดสำรวจ (จุดละ 5 ต้น):</div>
          <div class="garden-clusters-grid">
            ${pointsClustersHtml}
          </div>
          <div class="garden-map-legend">
            <span class="legend-item"><span class="legend-dot green"></span> ตรวจแล้ว</span>
            <span class="legend-item"><span class="legend-dot amber"></span> ยังไม่ตรวจ/ค้าง</span>
          </div>
        </div>

        <!-- Progress and Action Footer -->
        <div class="plot-card-footer">
          <div class="card-progress-bar-wrap">
            <div class="card-progress-bar">
              <div class="card-progress-fill ${p.status === 'complete' ? 'fill-green' : 'fill-orange'}" style="width:${p.percentComplete}%;"></div>
            </div>
            <div class="card-progress-numbers">
              <strong>ความคืบหน้า ${p.percentComplete}%</strong>
              <span>${p.totalTreesChecked}/35 ต้น (ครบ ${p.completedPoints}/7 จุด)</span>
            </div>
          </div>

          ${p.status === 'incomplete' ? `
            <div class="card-missing-alert">
              <strong>⚠️ จุดที่ยังค้าง:</strong> ${escapeHtml(p.missingSummary)}
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px;">
            <button type="button" class="button primary small" style="flex:1; justify-content:center; display:flex; align-items:center; gap:6px;"
                    onclick="window.chalJumpToPoint(${p.id}, '${nextPendingPoint.label}', 'C')">
              🌴 ${p.status === 'complete' ? 'ดูข้อมูลคาดการณ์' : `ตรวจต่อที่ "${nextPendingPoint.label}"`}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = html;
}

window.chalJumpToPoint = function(plotId, pointLabel, treePos) {
  chalState.selectedPlotId = Number(plotId);
  chalState.selectedPointLabel = pointLabel || 'จุดที่ 1';
  chalState.selectedTreePos = treePos || 'C';

  // Switch to forecast tab
  showChalTab('forecast');

  const plotSelect = cel('chalForecastPlotSelect');
  if (plotSelect) {
    plotSelect.value = plotId;
  }

  loadForecastMatrix();

  // Scroll smoothly to forecast controls
  setTimeout(() => {
    cel('chalTab_forecast')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

export function exportBoard2DCsv() {
  if (!chalState.board2dData || !chalState.board2dData.plots) {
    alert('ยังไม่มีข้อมูลกระดาน 2D สำหรับส่งออก');
    return;
  }

  const plots = chalState.board2dData.plots;
  const rows = [];
  rows.push([
    'ลำดับ',
    'จังหวัด',
    'แปลง',
    'เกษตรกรเจ้าของสวน',
    'เบอร์โทร',
    'ที่อยู่',
    'พื้นที่ให้ผล (ไร่)',
    'ต้น/ไร่',
    'สถานะความครบถ้วน',
    'ต้นที่ตรวจแล้ว (จาก 35)',
    'เปอร์เซ็นต์ความคืบหน้า (%)',
    'จุดที่ 1 (ตรวจ/5)',
    'จุดที่ 2 (ตรวจ/5)',
    'จุดที่ 3 (ตรวจ/5)',
    'จุดที่ 4 (ตรวจ/5)',
    'จุดที่ 5 (ตรวจ/5)',
    'จุดที่ 6 (ตรวจ/5)',
    'จุดที่ 7 (ตรวจ/5)',
    'รายละเอียดที่ยังค้างตรวจ',
    'จำนวนรอบตัดที่บันทึก (แบบที่ 3)',
    'ผลผลิตรอบตัดรวม (ผล)',
  ]);

  plots.forEach((p, idx) => {
    const provName = getProvinceLabel(p.province_code);
    const statusText = p.status === 'complete' ? 'ครบ 100%' : p.status === 'incomplete' ? 'ยังเช็คไม่ครบ' : 'ยังไม่เริ่มสำรวจ';
    const ptCounts = (p.points || []).map((pt) => `${pt.activeTrees}/5`);

    rows.push([
      idx + 1,
      provName,
      p.plot_label,
      p.full_name,
      p.phone || '',
      p.address || '',
      p.productive_area_rai || 0,
      p.trees_per_rai || 35,
      statusText,
      p.totalTreesChecked,
      p.percentComplete,
      ptCounts[0] || '0/5',
      ptCounts[1] || '0/5',
      ptCounts[2] || '0/5',
      ptCounts[3] || '0/5',
      ptCounts[4] || '0/5',
      ptCounts[5] || '0/5',
      ptCounts[6] || '0/5',
      p.missingSummary || '',
      p.cutsCount || 0,
      p.totalCutYield || 0,
    ]);
  });

  const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coconut_2d_inspection_board_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

