import { normalizeEntryInput, calculateProgressPercent, getProgressColorClass } from './shared/entryValidation.js';
import {
  buildProvinceRoundBunchStats,
  buildSummaryCsvRows,
  computeHistogram as buildHistogram,
} from './shared/stats.js';

const PROVINCES = [
  { code: 'nakhon_pathom', label: 'นครปฐม' },
  { code: 'ratchaburi', label: 'ราชบุรี' },
  { code: 'samut_sakhon', label: 'สมุทรสาคร' },
  { code: 'samut_songkhram', label: 'สมุทรสงคราม' },
];

const LOGIN_ACCOUNTS = [
  { code: 'doae', label: 'กรมส่งเสริมการเกษตร (ส่วนกลาง)' },
  ...PROVINCES,
];

const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  province: 'ผู้ใช้งานจังหวัด',
};

const state = {
  user: null,
  data: null,
  activeRound: 1,
  dashboardView: 'cards',
};

function activeProvinces() {
  if (!state.user) return [];
  if (state.user.role === 'admin') return PROVINCES;
  return PROVINCES.filter((p) => p.code === state.user.province_code);
}

const el = (id) => document.getElementById(id);

init();

async function init() {
  fillSelect(el('loginProvince'), LOGIN_ACCOUNTS, 'code', 'label');
  fillSelect(el('province'), PROVINCES, 'code', 'label');
  fillNumberSelect(el('round'), 1, 6, 'รอบที่ ');
  fillNumberSelect(el('plot'), 1, 10, 'แปลงที่ ');
  bindEvents();
  await loadMe();
}

function bindEvents() {
  el('loginForm').addEventListener('submit', login);
  el('logoutBtn').addEventListener('click', logout);
  el('entryForm').addEventListener('submit', saveEntry);
  el('loadBtn').addEventListener('click', loadEntry);
  el('refreshBtn').addEventListener('click', loadDashboard);
  el('econRefreshBtn').addEventListener('click', renderEconomy);
  el('econRecalcBtn').addEventListener('click', renderEconomy);
  ['quality', 'below', 'damaged'].forEach((id) => el(id).addEventListener('input', calcTotal));
  ['round', 'province', 'plot', 'bunch'].forEach((id) => el(id).addEventListener('change', loadEntry));

  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });
}

async function login(event) {
  event.preventDefault();
  setStatus('loginStatus', 'กำลังตรวจสอบ PIN...', '');
  try {
    const response = await api('/api/login', {
      method: 'POST',
      body: {
        province_code: el('loginProvince').value,
        pin: el('loginPin').value,
      },
    });
    state.user = response.user;
    el('loginPin').value = '';
    showApp();
    await loadDashboard();
    await loadEntry();
  } catch (error) {
    setStatus('loginStatus', `เข้าสู่ระบบไม่สำเร็จ: ${error.message}`, 'error');
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST', body: {} }).catch(() => null);
  state.user = null;
  state.data = null;
  showLogin();
}

async function loadMe() {
  try {
    const response = await api('/api/me');
    state.user = response.user;
    showApp();
    await loadDashboard();
    await loadEntry();
  } catch {
    showLogin();
  }
}

async function loadEntry() {
  if (!state.user) return;
  setStatus('entryStatus', 'กำลังโหลดข้อมูลเดิม...', '');
  const params = new URLSearchParams({
    round: el('round').value,
    province_code: provinceForRequest(),
    plot: el('plot').value,
    bunch: el('bunch').value,
  });

  try {
    const { entry } = await api(`/api/entry?${params}`);
    setEntry(entry || {});
    setStatus('entryStatus', entry ? 'โหลดข้อมูลเดิมแล้ว' : 'ยังไม่มีข้อมูลสำหรับจุดนี้', entry ? 'success' : '');
    renderCompletion();
  } catch (error) {
    setStatus('entryStatus', error.message, 'error');
  }
}

async function saveEntry(event) {
  event.preventDefault();
  
  // **1. Validate early with shared logic**
  let validated;
  try {
    validated = normalizeEntryInput({
      round: el('round').value,
      province_code: provinceForRequest(),
      plot: el('plot').value,
      bunch: el('bunch').value,
      quality: el('quality').value,
      below: el('below').value,
      damaged: el('damaged').value,
      weight: el('weight').value,
      circum: el('circum').value,
      notes: el('notes').value,
    });
  } catch (validationError) {
    setStatus('entryStatus', validationError.message, 'error');
    return; // Stop here, don't hit API
  }

  // **2. Set loading state**
  setLoading(true);
  setStatus('entryStatus', 'กำลังบันทึกข้อมูล...', '');

  try {
    await api('/api/entry', {
      method: 'POST',
      body: validated,
    });
    setStatus('entryStatus', 'บันทึกข้อมูลสำเร็จ ✅', 'success');
    setTimeout(() => {
      if (el('entryStatus').textContent.includes('สำเร็จ')) {
        setStatus('entryStatus', '', '');
      }
    }, 3000);
    await loadDashboard();
    renderCompletion();
  } catch (error) {
    setStatus('entryStatus', error.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadDashboard() {
  if (!state.user) return;
  state.data = await api('/api/dashboard');
  buildRoundButtons();
  renderDashboard();
  renderBunchAnalysis();
  renderCompletion();
}

function buildRoundButtons() {
  buildRoundButtonsFor(el('roundButtons'));
  buildRoundButtonsFor(el('analysisRounds'));
}

function buildRoundButtonsFor(wrap) {
  wrap.innerHTML = '';
  wrap.append(roundButton('ทุกรอบ', 'all'));

  for (const round of state.data.roundDates) {
    wrap.append(roundButton(`${round.label} | ${round.start} - ${round.end}`, String(round.number)));
  }
}

function roundButton(label, value) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.round = value;
  button.addEventListener('click', () => {
    state.activeRound = value === 'all' ? 'all' : Number(value);
    renderDashboard();
    renderBunchAnalysis();
  });
  return button;
}

function renderDashboard() {
  const agg = aggregate();
  renderOverall(agg.overall);
  renderCards(agg.provinces);
  renderVisual(agg.provinces);
  renderTable(agg.provinces);
  el('roundButtons').querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', isActiveRoundButton(button));
  });
  el('provinceCards').hidden = false;
  el('dashboardVisual').hidden = false;
  document.querySelector('.table-wrap').hidden = false;
}

function isActiveRoundButton(button) {
  return state.activeRound === 'all'
    ? button.dataset.round === 'all'
    : Number(button.dataset.round) === state.activeRound;
}

function renderCompletion() {
  if (!state.data || !state.user) return;
  const provinceCode = provinceForRequest();
  const roundNumber = Number(el('round').value);
  const round = state.data.rounds.find((item) => item.round === roundNumber);
  const provinceData = round?.provinces?.[provinceCode];
  const filled = provinceData?.filled || 0;
  const maxRows = provinceData?.maxRows || 20;
  const pct = maxRows > 0 ? Math.round((filled / maxRows) * 100) : 0;

  el('completionSummary').innerHTML = `<strong>${filled}/${maxRows}</strong><span>${pct}%</span>`;

  const recorded = getRecordedSet(roundNumber, provinceCode);
  el('completionGrid').innerHTML = Array.from({ length: 10 }, (_, plotIndex) => {
    const plot = plotIndex + 1;
    return `
      <div class="plot-check">
        <div class="plot-check-title">แปลง ${plot}</div>
        <div class="bunch-checks">
          ${[1, 2].map((bunch) => {
            const done = recorded.has(`${plot}:${bunch}`);
            return `
              <button
                type="button"
                class="bunch-check ${done ? 'done' : 'missing'}"
                data-round="${roundNumber}"
                data-province="${provinceCode}"
                data-plot="${plot}"
                data-bunch="${bunch}"
                title="แปลง ${plot} ทะลาย ${bunch}: ${done ? 'บันทึกแล้ว' : 'ยังไม่ได้บันทึก'}"
              >ท${bunch}</button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  el('completionGrid').querySelectorAll('.bunch-check').forEach((button) => {
    button.addEventListener('click', async () => {
      el('round').value = button.dataset.round;
      if (state.user.role === 'admin') el('province').value = button.dataset.province;
      el('plot').value = button.dataset.plot;
      el('bunch').value = button.dataset.bunch;
      await loadEntry();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function getRecordedSet(roundNumber, provinceCode) {
  const set = new Set();
  (state.data.entries || [])
    .filter((entry) => Number(entry.round) === roundNumber && entry.province_code === provinceCode)
    .forEach((entry) => {
      const total = (Number(entry.quality) || 0) + (Number(entry.below) || 0) + (Number(entry.damaged) || 0);
      if (total > 0) set.add(`${entry.plot}:${entry.bunch}`);
    });
  return set;
}

function aggregate() {
  const provinces = Object.fromEntries(activeProvinces().map((province) => [province.code, blankSummary()]));
  const overall = blankSummary();

  for (const round of state.data.rounds) {
    if (state.activeRound !== 'all' && round.round !== state.activeRound) continue;
    for (const province of activeProvinces()) {
      addSummary(provinces[province.code], round.provinces[province.code]);
      addSummary(overall, round.provinces[province.code]);
    }
  }

  Object.values(provinces).forEach(finalize);
  finalize(overall);
  return { provinces, overall };
}

function blankSummary() {
  return {
    totalFruits: 0,
    quality: 0,
    below: 0,
    damaged: 0,
    weightSum: 0,
    weightCount: 0,
    circumSum: 0,
    circumCount: 0,
    filled: 0,
    maxRows: 0,
  };
}

function addSummary(target, source) {
  if (!source) return;
  ['totalFruits', 'quality', 'below', 'damaged', 'weightSum', 'weightCount', 'circumSum', 'circumCount', 'filled', 'maxRows']
    .forEach((key) => { target[key] += Number(source[key]) || 0; });
}

function finalize(summary) {
  summary.qualityRate = summary.totalFruits > 0 ? summary.quality / summary.totalFruits : 0;
  summary.avgWeight = summary.weightCount > 0 ? summary.weightSum / summary.weightCount : null;
  summary.avgCircum = summary.circumCount > 0 ? summary.circumSum / summary.circumCount : null;
}

function renderOverall(overall) {
  el('overall').innerHTML = [
    metric('ผลรวมทั้งหมด', overall.totalFruits.toLocaleString()),
    metric('อัตราผลคุณภาพ', `${(overall.qualityRate * 100).toFixed(1)}%`, rateClass(overall.qualityRate)),
    metric('น้ำหนักเฉลี่ย', overall.avgWeight === null ? '-- กก.' : `${overall.avgWeight.toFixed(2)} กก.`),
    metric('เส้นรอบวงเฉลี่ย', overall.avgCircum === null ? '-- ซม.' : `${overall.avgCircum.toFixed(2)} ซม.`),
  ].join('');
}

function renderCards(provinces) {
  el('provinceCards').innerHTML = activeProvinces().map((province) => {
    const data = provinces[province.code];
    const filled = data.filled || 0;
    const maxRows = data.maxRows || 0;
    const progressPercent = typeof data.progressPercent === 'number' ? data.progressPercent : calculateProgressPercent(filled, maxRows);
    const progressClass = getProgressColorClass(progressPercent);

    return `
      <article class="card">
        <h3>${province.label}<span class="${rateClass(data.qualityRate)}">${(data.qualityRate * 100).toFixed(0)}%</span></h3>
        <div class="rows">
          ${row('ผลรวม', data.totalFruits.toLocaleString())}
          ${row('ผลคุณภาพ', data.quality.toLocaleString())}
          ${row('ต่ำกว่ามาตรฐาน', data.below.toLocaleString())}
          ${row('เสียหาย', data.damaged.toLocaleString())}
          ${row('บันทึกแล้ว', `${filled}/${maxRows}`)}
        </div>
        <div class="progress-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${progressClass}" style="width:${progressPercent}%"></div>
          </div>
          <div class="progress-text">
            <span class="progress-label">กรอกแล้ว</span>
            <span class="progress-pct ${progressClass}">${progressPercent}%</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderVisual(provinces) {
  el('dashboardVisual').innerHTML = `
    ${barsMarkup(provinces)}
    ${trendMarkup()}
    ${metricCompareMarkup(provinces)}
  `;
}

function barsMarkup(provinces) {
  const maxTotal = Math.max(...activeProvinces().map((province) => provinces[province.code].totalFruits), 1);
  return `
    <section class="visual-panel">
      <h3>สัดส่วนข้อมูลรายจังหวัด</h3>
      <div class="bar-list">
        ${activeProvinces().map((province) => {
          const data = provinces[province.code];
          const total = data.totalFruits || 0;
          const width = Math.max((total / maxTotal) * 100, total > 0 ? 6 : 0);
          const q = total > 0 ? (data.quality / total) * 100 : 0;
          const b = total > 0 ? (data.below / total) * 100 : 0;
          const d = total > 0 ? (data.damaged / total) * 100 : 0;
          return `
            <div class="bar-row">
              <div class="bar-name">${province.label}</div>
              <div class="bar-track-wide" style="width:${width}%">
                <span class="seg quality" style="width:${q}%"></span>
                <span class="seg below" style="width:${b}%"></span>
                <span class="seg damaged" style="width:${d}%"></span>
              </div>
              <div class="bar-total">${total.toLocaleString()}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="legend">
        <span><i class="dot quality"></i>ผลคุณภาพ</span>
        <span><i class="dot below"></i>ต่ำกว่ามาตรฐาน</span>
        <span><i class="dot damaged"></i>เสียหาย</span>
      </div>
    </section>
  `;
}

function trendMarkup() {
  const rounds = state.data.rounds.map((round) => {
    const rate = round.overall.qualityRate || 0;
    return {
      label: `รอบที่ ${round.round}`,
      total: round.overall.totalFruits || 0,
      rate,
      height: Math.max(rate * 100, round.overall.totalFruits > 0 ? 3 : 0),
    };
  });

  return `
    <section class="visual-panel">
      <h3>อัตราผลคุณภาพตามรอบการประเมิน</h3>
      <div class="trend-chart">
        ${rounds.map((round) => `
          <div class="trend-item">
            <div class="trend-value">${(round.rate * 100).toFixed(0)}%</div>
            <div class="trend-bar"><span class="${rateClass(round.rate)}" style="height:${round.height}%"></span></div>
            <div class="trend-label">${round.label}</div>
            <div class="trend-total">${round.total.toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function metricCompareMarkup(provinces) {
  const maxWeight = Math.max(...activeProvinces().map((province) => provinces[province.code].avgWeight || 0), 1);
  const maxCircum = Math.max(...activeProvinces().map((province) => provinces[province.code].avgCircum || 0), 1);
  return `
    <section class="visual-panel metric-compare-panel">
      <h3>เทียบขนาดผลเฉลี่ยรายจังหวัด</h3>
      <div class="metric-compare">
        ${activeProvinces().map((province) => {
          const data = provinces[province.code];
          const weight = data.avgWeight || 0;
          const circum = data.avgCircum || 0;
          const weightWidth = Math.max((weight / maxWeight) * 100, weight > 0 ? 5 : 0);
          const circumWidth = Math.max((circum / maxCircum) * 100, circum > 0 ? 5 : 0);
          return `
            <div class="metric-row">
              <div class="metric-name">${province.label}</div>
              <div class="metric-bars">
                <div class="metric-bar-line">
                  <span>น้ำหนัก</span>
                  <div class="metric-track"><i class="weight" style="width:${weightWidth}%"></i></div>
                  <strong>${weight > 0 ? `${weight.toFixed(2)} กก.` : '-'}</strong>
                </div>
                <div class="metric-bar-line">
                  <span>เส้นรอบวง</span>
                  <div class="metric-track"><i class="circum" style="width:${circumWidth}%"></i></div>
                  <strong>${circum > 0 ? `${circum.toFixed(2)} ซม.` : '-'}</strong>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="legend">
        <span><i class="dot weight"></i>น้ำหนักเฉลี่ย</span>
        <span><i class="dot circum"></i>เส้นรอบวงเฉลี่ย</span>
      </div>
    </section>
  `;
}

function renderTable(provinces) {
  el('compareTable').innerHTML = `
    <thead>
      <tr><th>จังหวัด</th><th>ผลรวม</th><th>ผลคุณภาพ</th><th>ต่ำกว่ามาตรฐาน</th><th>เสียหาย</th><th>อัตราคุณภาพ</th><th>บันทึกแล้ว</th></tr>
    </thead>
    <tbody>
      ${activeProvinces().map((province) => {
        const data = provinces[province.code];
        return `
          <tr>
            <td>${province.label}</td>
            <td>${data.totalFruits.toLocaleString()}</td>
            <td>${data.quality.toLocaleString()}</td>
            <td>${data.below.toLocaleString()}</td>
            <td>${data.damaged.toLocaleString()}</td>
            <td class="${rateClass(data.qualityRate)}">${(data.qualityRate * 100).toFixed(1)}%</td>
            <td>${data.filled}/${data.maxRows}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
}

function renderBunchAnalysis() {
  if (!state.data) return;
  const data = aggregateBunch();
  renderBunchOverall(data.overall);
  renderBunchVisual(data);
  renderBunchTable(data.provinces);
  el('analysisRounds').querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', isActiveRoundButton(button));
  });
}

function aggregateBunch() {
  const provinces = Object.fromEntries(activeProvinces().map((province) => [
    province.code,
    { label: province.label, bunches: { 1: blankBunchSummary(), 2: blankBunchSummary() }, total: blankBunchSummary() },
  ]));
  const overall = { bunches: { 1: blankBunchSummary(), 2: blankBunchSummary() }, total: blankBunchSummary() };

  (state.data.entries || []).forEach((entry) => {
    if (state.activeRound !== 'all' && Number(entry.round) !== state.activeRound) return;
    const province = provinces[entry.province_code];
    const bunch = Number(entry.bunch);
    if (!province || !province.bunches[bunch]) return;

    const total = (Number(entry.quality) || 0) + (Number(entry.below) || 0) + (Number(entry.damaged) || 0);
    if (total <= 0) return;

    addBunchEntry(province.bunches[bunch], entry, total);
    addBunchEntry(province.total, entry, total);
    addBunchEntry(overall.bunches[bunch], entry, total);
    addBunchEntry(overall.total, entry, total);
  });

  Object.values(provinces).forEach((province) => {
    finalizeBunch(province.bunches[1]);
    finalizeBunch(province.bunches[2]);
    finalizeBunch(province.total);
  });
  finalizeBunch(overall.bunches[1]);
  finalizeBunch(overall.bunches[2]);
  finalizeBunch(overall.total);

  return { provinces, overall };
}

function blankBunchSummary() {
  return { count: 0, fruits: 0, weightSum: 0, weightCount: 0, circumSum: 0, circumCount: 0 };
}

function addBunchEntry(target, entry, total) {
  target.count += 1;
  target.fruits += total;
  const weight = Number(entry.weight) || 0;
  const circum = Number(entry.circum) || 0;
  if (weight > 0) {
    target.weightSum += weight;
    target.weightCount += 1;
  }
  if (circum > 0) {
    target.circumSum += circum;
    target.circumCount += 1;
  }
}

function finalizeBunch(summary) {
  summary.avgFruits = summary.count > 0 ? summary.fruits / summary.count : null;
  summary.avgWeight = summary.weightCount > 0 ? summary.weightSum / summary.weightCount : null;
  summary.avgCircum = summary.circumCount > 0 ? summary.circumSum / summary.circumCount : null;
}

function renderBunchOverall(overall) {
  el('bunchOverall').innerHTML = [
    metric('ทะลายที่บันทึก', overall.total.count.toLocaleString()),
    metric('ลูกต่อทะลายเฉลี่ย', formatNumber(overall.total.avgFruits, ' ลูก')),
    metric('น้ำหนักเฉลี่ย', formatNumber(overall.total.avgWeight, ' กก.')),
    metric('เส้นรอบวงเฉลี่ย', formatNumber(overall.total.avgCircum, ' ซม.')),
  ].join('');
}

function renderBunchVisual(data) {
  el('bunchVisual').innerHTML = `
    ${bunchProvinceBars(data.provinces, 'avgFruits', 'ลูกต่อทะลายเฉลี่ย', 'ลูก')}
    ${bunchProvinceBars(data.provinces, 'avgWeight', 'น้ำหนักเฉลี่ยรายจังหวัด', 'กก.')}
    ${bunchProvinceBars(data.provinces, 'avgCircum', 'เส้นรอบวงเฉลี่ยรายจังหวัด', 'ซม.')}
  `;
}

function bunchProvinceBars(provinces, key, title, unit) {
  const maxValue = Math.max(...activeProvinces().map((province) => provinces[province.code].total[key] || 0), 1);
  return `
    <section class="visual-panel">
      <h3>${title} รายจังหวัด</h3>
      <div class="bunch-bar-list">
        ${activeProvinces().map((province) => {
          const data = provinces[province.code].total;
          const value = data[key] || 0;
          const width = Math.max((value / maxValue) * 100, value > 0 ? 5 : 0);
          return `
            <div class="bunch-bar-row">
              <span>${province.label}</span>
              <div class="bunch-track"><i style="width:${width}%"></i></div>
              <strong>${value > 0 ? `${value.toFixed(1)} ${unit}` : '-'}</strong>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderBunchTable(provinces) {
  el('bunchTable').innerHTML = `
    <thead>
      <tr><th>จังหวัด</th><th>ทะลาย</th><th>บันทึก</th><th>ลูกต่อทะลาย</th><th>น้ำหนักเฉลี่ย</th><th>เส้นรอบวงเฉลี่ย</th></tr>
    </thead>
    <tbody>
      ${activeProvinces().flatMap((province) => [1, 2].map((bunch) => {
        const data = provinces[province.code].bunches[bunch];
        return `
          <tr>
            <td>${province.label}</td>
            <td>ทะลายที่ ${bunch}</td>
            <td>${data.count.toLocaleString()}</td>
            <td>${formatNumber(data.avgFruits, ' ลูก')}</td>
            <td>${formatNumber(data.avgWeight, ' กก.')}</td>
            <td>${formatNumber(data.avgCircum, ' ซม.')}</td>
          </tr>
        `;
      })).join('')}
    </tbody>
  `;
}

function showApp() {
  el('loginView').hidden = true;
  el('appView').hidden = false;
  el('logoutBtn').hidden = false;
  el('userLine').textContent = `${state.user.province_label} | ${roleLabel(state.user.role)}`;

  const isAdmin = state.user.role === 'admin';
  el('provinceWrap').hidden = !isAdmin;
  if (!isAdmin) el('province').value = state.user.province_code;
}

function showLogin() {
  el('loginView').hidden = false;
  el('appView').hidden = true;
  el('logoutBtn').hidden = true;
  el('userLine').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
}

function showTab(tab) {
  el('entryTab').hidden = tab !== 'entry';
  el('dashboardTab').hidden = tab !== 'dashboard';
  el('economyTab').hidden = tab !== 'economy';
  el('statsTab').hidden = tab !== 'stats';
  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  if (tab === 'stats' && state.data) loadStats();
  if (tab === 'economy' && state.data) renderEconomy();
}

function setEntry(entry) {
  el('quality').value = entry.quality ?? 0;
  el('below').value = entry.below ?? 0;
  el('damaged').value = entry.damaged ?? 0;
  el('weight').value = entry.weight ?? '';
  el('circum').value = entry.circum ?? '';
  el('notes').value = entry.notes ?? '';
  calcTotal();
}

function calcTotal() {
  const total = ['quality', 'below', 'damaged']
    .map((id) => Number(el(id).value) || 0)
    .reduce((sum, value) => sum + value, 0);
  el('total').value = total;
}

function provinceForRequest() {
  return state.user.role === 'admin' ? el('province').value : state.user.province_code;
}

function fillSelect(select, items, valueKey, labelKey) {
  select.innerHTML = items.map((item) => `<option value="${item[valueKey]}">${item[labelKey]}</option>`).join('');
}

function fillNumberSelect(select, start, end, label) {
  select.innerHTML = '';
  for (let value = start; value <= end; value += 1) {
    select.insertAdjacentHTML('beforeend', `<option value="${value}">${label}${value}</option>`);
  }
}

function setStatus(id, message, type) {
  el(id).textContent = message;
  el(id).className = `status ${type || ''}`;
}

function metric(label, value, className = '') {
  return `<div class="stat"><div class="metric-label">${label}</div><div class="metric-value ${className}">${value}</div></div>`;
}

function row(label, value) {
  return `<div class="row"><span>${label}</span><strong>${value}</strong></div>`;
}

function formatNumber(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${value.toFixed(2)}${suffix}`;
}

function formatMeanSd(mean, sd, unit) {
  if (mean === null || mean === undefined) return '-';
  const sdText = sd === null || sd === undefined ? '-' : sd.toFixed(2);
  return `${mean.toFixed(2)} ± ${sdText} ${unit}`;
}

function formatComparison(left, right, unit) {
  if (left === null || left === undefined || right === null || right === undefined) return '-';
  return `${left.toFixed(2)} vs ${right.toFixed(2)} ${unit}`;
}

function rateClass(rate) {
  if (rate >= 0.7) return 'rate-green';
  if (rate >= 0.5) return 'rate-yellow';
  return 'rate-red';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function loadStats() {
  if (!state.data) return;
  state.statsMode = state.statsMode || 'round';
  state.statsRound = state.statsRound || 'all';
  state.showOutliers = state.showOutliers || false;

  const allEntries = state.data.entries || [];
  const stats = computeAllStats(allEntries);

  buildModeControl();
  buildStatsRoundButtons();
  renderSummaryCards(stats);
  renderModeContent(stats);
  renderOutlierPanel(stats);

  el('exportSummaryBtn').onclick = () => exportSummaryCSV(stats);
  el('exportOutlierBtn').onclick = () => exportOutlierCSV(stats);
}

function computeAllStats(entries) {
  const ctx = {
    n: 0,
    totalRecords: entries.length,
    totalFruits: 0,
    totalQuality: 0,
    totalDamaged: 0,
    qualityRate: 0,
    avgWeight: null,
    sdWeight: null,
    avgCircum: null,
    sdCircum: null,
    missingWeight: 0,
    missingCircum: 0,
    outliers: [],
    byProvince: {},
    byRound: {},
    byBunch: { 1: blankGroupStats(), 2: blankGroupStats() },
    byProvinceRound: {},
    byProvinceBunch: {},
    byProvinceRoundBunch: {},
  };

  activeProvinces().forEach((p) => { ctx.byProvince[p.code] = blankGroupStats(); });
  for (let r = 1; r <= 6; r++) { ctx.byRound[r] = blankGroupStats(); }

  const weights = [];
  const circums = [];

  entries.forEach((e) => {
    const q = Number(e.quality) || 0;
    const bl = Number(e.below) || 0;
    const dm = Number(e.damaged) || 0;
    const totalF = q + bl + dm;
    const w = Number(e.weight);
    const c = Number(e.circum);
    const hasValidW = isFinite(w) && w > 0;
    const hasValidC = isFinite(c) && c > 0;

    if (totalF > 0) ctx.n += 1;
    ctx.totalFruits += totalF;
    ctx.totalQuality += q;
    ctx.totalDamaged += dm;

    if (hasValidW) { weights.push(w); }
    else if (totalF > 0) { ctx.missingWeight += 1; }

    if (hasValidC) { circums.push(c); }
    else if (totalF > 0) { ctx.missingCircum += 1; }

    const pCode = e.province_code;
    const round = Number(e.round);
    const bunch = Number(e.bunch);

    accumGroup(ctx.byProvince[pCode], q, bl, dm, w, c, hasValidW, hasValidC);
    accumGroup(ctx.byRound[round], q, bl, dm, w, c, hasValidW, hasValidC);
    accumGroup(ctx.byBunch[bunch], q, bl, dm, w, c, hasValidW, hasValidC);

    const prKey = `${pCode}-${round}`;
    if (!ctx.byProvinceRound[prKey]) ctx.byProvinceRound[prKey] = blankGroupStats();
    accumGroup(ctx.byProvinceRound[prKey], q, bl, dm, w, c, hasValidW, hasValidC);

    const pbKey = `${pCode}-${bunch}`;
    if (!ctx.byProvinceBunch[pbKey]) ctx.byProvinceBunch[pbKey] = blankGroupStats();
    accumGroup(ctx.byProvinceBunch[pbKey], q, bl, dm, w, c, hasValidW, hasValidC);
  });

  ctx.qualityRate = ctx.totalFruits > 0 ? ctx.totalQuality / ctx.totalFruits : 0;

  if (weights.length) {
    ctx.avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    ctx.sdWeight = stdDev(weights);
  }
  if (circums.length) {
    ctx.avgCircum = circums.reduce((a, b) => a + b, 0) / circums.length;
    ctx.sdCircum = stdDev(circums);
  }

  finalizeGroupStats(ctx);
  ctx.byProvinceRoundBunch = buildProvinceRoundBunchStats(entries, PROVINCES, 6, 2);
  detectOutliers(entries, ctx);

  return ctx;
}

function blankGroupStats() {
  return { n: 0, totalFruits: 0, quality: 0, below: 0, damaged: 0, qualityRate: 0, weightVals: [], circumVals: [], avgWeight: null, sdWeight: null, avgCircum: null, sdCircum: null, missingWeight: 0, missingCircum: 0 };
}

function accumGroup(g, q, bl, dm, w, c, hasW, hasC) {
  const total = q + bl + dm;
  if (total > 0) g.n += 1;
  g.totalFruits += total;
  g.quality += q;
  g.below += bl;
  g.damaged += dm;
  if (hasW) g.weightVals.push(w);
  else if (total > 0) g.missingWeight += 1;
  if (hasC) g.circumVals.push(c);
  else if (total > 0) g.missingCircum += 1;
}

function finalizeGroupStats(ctx) {
  const finalize = (g) => {
    g.qualityRate = g.totalFruits > 0 ? g.quality / g.totalFruits : 0;
    if (g.weightVals.length) {
      g.avgWeight = g.weightVals.reduce((a, b) => a + b, 0) / g.weightVals.length;
      g.sdWeight = stdDev(g.weightVals);
    }
    if (g.circumVals.length) {
      g.avgCircum = g.circumVals.reduce((a, b) => a + b, 0) / g.circumVals.length;
      g.sdCircum = stdDev(g.circumVals);
    }
  };
  activeProvinces().forEach((p) => finalize(ctx.byProvince[p.code]));
  for (let r = 1; r <= 6; r++) finalize(ctx.byRound[r]);
  finalize(ctx.byBunch[1]);
  finalize(ctx.byBunch[2]);
  Object.values(ctx.byProvinceRound).forEach(finalize);
  Object.values(ctx.byProvinceBunch).forEach(finalize);
}

function detectOutliers(entries, ctx) {
  const weight3SD = ctx.sdWeight ? ctx.avgWeight + 3 * ctx.sdWeight : Infinity;
  const circum3SD = ctx.sdCircum ? ctx.avgCircum + 3 * ctx.sdCircum : Infinity;

  entries.forEach((e) => {
    const q = Number(e.quality) || 0;
    const bl = Number(e.below) || 0;
    const dm = Number(e.damaged) || 0;
    const totalF = q + bl + dm;
    const rawW = e.weight;
    const rawC = e.circum;
    const hasW = rawW !== null && rawW !== undefined && rawW !== '';
    const hasC = rawC !== null && rawC !== undefined && rawC !== '';
    const w = hasW ? Number(rawW) : null;
    const c = hasC ? Number(rawC) : null;
    const reasons = [];

    if (!hasW && totalF > 0) {
      reasons.push('น้ำหนักหาย');
    } else if (hasW && isFinite(w)) {
      if (w <= 0) reasons.push('น้ำหนัก ≤ 0');
      else if (w > weight3SD) reasons.push(`น้ำหนักสูงผิดปกติ (${w.toFixed(2)} กก.)`);
    }

    if (!hasC && totalF > 0) {
      reasons.push('เส้นรอบวงหาย');
    } else if (hasC && isFinite(c)) {
      if (c <= 0) reasons.push('เส้นรอบวง ≤ 0');
      else if (c > circum3SD) reasons.push(`เส้นรอบวงสูงผิดปกติ (${c.toFixed(2)} ซม.)`);
    }

    if (totalF === 0 && (hasW || hasC)) {
      reasons.push('มีน้ำหนัก/รอบวงแต่ไม่มีจำนวนผล');
    }

    if (reasons.length) {
      ctx.outliers.push({
        entry: e,
        reasons,
        provinceLabel: PROVINCES.find((p) => p.code === e.province_code)?.label || e.province_code,
      });
    }
  });
}

function buildStatsRoundButtons() {
  const wrap = el('statsRounds');
  wrap.innerHTML = '';
  wrap.append(roundBtn('ทุกรอบ', 'all'));
  for (const round of state.data.roundDates) {
    wrap.append(roundBtn(`${round.label} | ${round.start} - ${round.end}`, String(round.number)));
  }
  updateRoundVisibility();
}

function roundBtn(label, value) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.round = value;
  button.addEventListener('click', () => {
    state.statsRound = value === 'all' ? 'all' : Number(value);
    const allEntries = state.data.entries || [];
    const stats = computeAllStats(allEntries);
    renderModeContent(stats);
    el('statsRounds').querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', String(state.statsRound) === btn.dataset.round);
    });
  });
  if (String(state.statsRound) === value) button.classList.add('active');
  return button;
}

function updateRoundVisibility() {
  const show = state.statsMode === 'round' || state.statsMode === 'dist';
  el('statsRounds').hidden = !show;
}

function filterEntries() {
  const entries = state.data.entries || [];
  if (state.statsRound === 'all') return entries;
  return entries.filter((e) => Number(e.round) === state.statsRound);
}

function renderSummaryCards(stats) {
  const completion = stats.totalRecords > 0 ? ((stats.n / stats.totalRecords) * 100).toFixed(0) : 0;
  el('statsSummaryCards').innerHTML = `
    <div class="summary-card">
      <div class="card-value">${stats.n} <span style="font-size:14px;font-weight:400;color:var(--muted)">/ ${stats.totalRecords}</span></div>
      <div class="card-label">จำนวนบันทึก</div>
      <div class="card-sub">อัตราการกรอก ${completion}%</div>
    </div>
    <div class="summary-card">
      <div class="card-value">${stats.totalFruits} <span style="font-size:14px;font-weight:400;color:var(--muted)">ลูก</span></div>
      <div class="card-label">จำนวนผลรวม</div>
      <div class="card-sub">คุณภาพ ${stats.totalQuality} / ต่ำมาตรฐาน ${stats.totalFruits - stats.totalQuality - stats.totalDamaged} / เสียหาย ${stats.totalDamaged}</div>
    </div>
    <div class="summary-card">
      <div class="card-value ${rateClass(stats.qualityRate)}">${(stats.qualityRate * 100).toFixed(1)}%</div>
      <div class="card-label">อัตราผลคุณภาพ</div>
      <div class="card-sub">quality / จำนวนผลรวม</div>
    </div>
    <div class="summary-card">
      <div class="card-value">${stats.avgWeight !== null ? stats.avgWeight.toFixed(2) : '-'} <span style="font-size:13px;font-weight:400;color:var(--muted)">±${stats.sdWeight !== null ? stats.sdWeight.toFixed(2) : '-'} กก.</span></div>
      <div class="card-label">น้ำหนักเฉลี่ย</div>
      <div class="card-sub">${stats.missingWeight > 0 ? `<span class="warn">หาย ${stats.missingWeight}/${stats.n+stats.missingWeight}</span>` : 'ครบทุกบันทึก'}</div>
    </div>
    <div class="summary-card">
      <div class="card-value">${stats.avgCircum !== null ? stats.avgCircum.toFixed(2) : '-'} <span style="font-size:13px;font-weight:400;color:var(--muted)">±${stats.sdCircum !== null ? stats.sdCircum.toFixed(2) : '-'} ซม.</span></div>
      <div class="card-label">เส้นรอบวงเฉลี่ย</div>
      <div class="card-sub">${stats.missingCircum > 0 ? `<span class="warn">หาย ${stats.missingCircum}/${stats.n+stats.missingCircum}</span>` : 'ครบทุกบันทึก'}</div>
    </div>
  `;
}

function buildModeControl() {
  const modes = [
    { value: 'round', label: 'ตามรอบ' },
    { value: 'province', label: 'ตามจังหวัด' },
    { value: 'dist', label: 'การกระจาย' },
  ];
  const wrap = el('statsModeControl');
  wrap.innerHTML = '';
  modes.forEach((m) => {
    const btn = document.createElement('button');
    btn.textContent = m.label;
    btn.dataset.mode = m.value;
    btn.addEventListener('click', () => {
      state.statsMode = m.value;
      state.statsRound = 'all';
      const allEntries = state.data.entries || [];
      const stats = computeAllStats(allEntries);
      buildModeControl();
      buildStatsRoundButtons();
      renderModeContent(stats);
    });
    if (state.statsMode === m.value) btn.classList.add('active');
    wrap.append(btn);
  });
}

function renderModeContent(stats) {
  el('statsModeContent').innerHTML = '';
  switch (state.statsMode) {
    case 'round': renderRoundComparison(stats); break;
    case 'province': renderProvinceTrends(stats); break;
    case 'dist': renderDistribution(stats); break;
  }
}

function renderRoundComparison(stats) {
  const entries = filterEntries();
  const round = state.statsRound;
  const subStats = computeAllStats(entries);

  if (round === 'all') {
    el('statsModeContent').innerHTML = renderAllRoundTable(stats);
    return;
  }

  const provinceData = activeProvinces().map((p) => {
    const g = subStats.byProvince[p.code];
    const nWarn = g.n < 5;
    return {
      label: p.label,
      code: p.code,
      n: g.n,
      nWarn,
      qualityRate: g.qualityRate,
      avgWeight: g.avgWeight,
      sdWeight: g.sdWeight,
      avgCircum: g.avgCircum,
      sdCircum: g.sdCircum,
      totalFruits: g.totalFruits,
    };
  });

  const maxRate = Math.max(...provinceData.map((d) => d.qualityRate), 0.01);
  const colors = ['var(--primary)', 'var(--blue)', 'var(--amber)', 'var(--red)'];

  el('statsModeContent').innerHTML = `
    <section class="visual-panel">
      <h3>เปรียบเทียบจังหวัด — รอบที่ ${round}</h3>
      <div class="comp-bar-chart">
        ${provinceData.map((d, idx) => `
          <div class="comp-bar-row">
            <span>${d.label}${d.nWarn ? ' <span class="badge-warn">ข้อมูลน้อย</span>' : ''}</span>
            <div class="comp-bar-track">
              <i style="width:${(d.qualityRate / maxRate) * 100}%; background:${colors[idx]}"></i>
            </div>
            <strong>${(d.qualityRate * 100).toFixed(0)}%</strong>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--muted)">
        ${provinceData.map((d) => `
          <span style="margin-right:16px">${d.label}: n=${d.n}, นน.${formatMeanSd(d.avgWeight, d.sdWeight, 'กก.')}, รอบวง${formatMeanSd(d.avgCircum, d.sdCircum, 'ซม.')}</span>
        `).join('<br>')}
      </div>
    </section>
  `;
}

function renderAllRoundTable(stats) {
  const rows = [];
  for (let r = 1; r <= 6; r++) {
    const rStats = stats.byRound[r];
    if (rStats.n === 0) continue;
    rows.push({ round: r, ...rStats });
  }
  return `
    <section class="visual-panel">
      <h3>ภาพรวมทุกรอบ</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>รอบ</th><th>จำนวนบันทึก</th><th>จำนวนผลรวม</th><th>อัตราผลคุณภาพ</th><th>น้ำหนักเฉลี่ย ± SD</th><th>เส้นรอบวงเฉลี่ย ± SD</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td>รอบที่ ${r.round}</td>
                <td>${r.n}</td>
                <td>${r.totalFruits}</td>
                <td class="${rateClass(r.qualityRate)}">${(r.qualityRate * 100).toFixed(1)}%</td>
                <td>${formatMeanSd(r.avgWeight, r.sdWeight, 'กก.')}</td>
                <td>${formatMeanSd(r.avgCircum, r.sdCircum, 'ซม.')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProvinceTrends(stats) {
  const maxRounds = state.data.roundDates.length;
  const colors = ['var(--primary)', 'var(--blue)', 'var(--amber)', 'var(--red)'];

  const trends = activeProvinces().map((p) => {
    const points = [];
    for (let r = 1; r <= maxRounds; r++) {
      const key = `${p.code}-${r}`;
      const g = stats.byProvinceRound[key];
      points.push({
        round: r,
        rate: g && g.n > 0 ? g.qualityRate : null,
        n: g ? g.n : 0,
      });
    }
    return { province: p, points };
  });

  el('statsModeContent').innerHTML = `
    <section class="visual-panel">
      <h3>แนวโน้มอัตราผลคุณภาพรายจังหวัดตามรอบ</h3>
      <div class="multi-trend">
        <div class="multi-trend-chart">
          ${trends.map((t, idx) => `
            <div class="trend-line-row">
              <span class="trend-line-name">${t.province.label}</span>
              <div class="trend-line-track">
                ${t.points.map((p) => {
                  const hasData = p.rate !== null;
                  const isLowN = p.n > 0 && p.n < 5;
                  const title = `รอบ ${p.round}: ${hasData ? (p.rate * 100).toFixed(0) + '% (n=' + p.n + ')' : 'ไม่มีข้อมูล'}`;
                  const bubbleStyle = hasData
                    ? `background:${colors[idx]}; bottom:${Math.max(p.rate * 100, 2)}%; ${isLowN ? 'opacity:0.4' : ''}`
                    : '';
                  return `
                    <div class="trend-point-wrap" title="${title}">
                      <div class="trend-bubble ${hasData ? '' : 'no-data'}" style="${bubbleStyle}"></div>
                      <span>${p.round}${isLowN ? '⚠' : ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="legend">
          ${trends.map((t, idx) => `
            <span><i class="dot" style="background:${colors[idx]}"></i>${t.province.label}</span>
          `).join('')}
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:8px">⚠ = ข้อมูลน้อย (n < 5) ยังไม่ควรสรุปแนวโน้ม</p>
      </div>
    </section>
  `;
}

function renderBunchComparison(stats) {
  PROVINCES.forEach((p) => {
    for (let b = 1; b <= 2; b++) {
      const key = `${p.code}-${b}`;
      if (!stats.byProvinceBunch[key]) stats.byProvinceBunch[key] = blankGroupStats();
    }
  });

  const colors = ['var(--primary)', 'var(--blue)', 'var(--amber)', 'var(--red)'];

  const overallB1 = stats.byBunch[1] || blankGroupStats();
  const overallB2 = stats.byBunch[2] || blankGroupStats();

  el('statsModeContent').innerHTML = `
    <section class="visual-panel">
      <h3>เปรียบเทียบ ทะลายที่ 1 vs ทะลายที่ 2</h3>
      <div class="table-wrap" style="margin-bottom:16px">
        <table>
          <thead>
            <tr><th>จังหวัด</th><th>ทะลาย</th><th>n</th><th>จำนวนผลรวม</th><th>อัตราผลคุณภาพ</th><th>นน.เฉลี่ย ± SD</th><th>รอบวงเฉลี่ย ± SD</th></tr>
          </thead>
          <tbody>
            ${PROVINCES.map((p) => {
              const b1 = stats.byProvinceBunch[`${p.code}-1`] || blankGroupStats();
              const b2 = stats.byProvinceBunch[`${p.code}-2`] || blankGroupStats();
              return `
                <tr><td rowspan="2"><strong>${p.label}</strong></td>
                  <td>ทะลายที่ 1</td><td>${b1.n}</td><td>${b1.totalFruits}</td><td class="${rateClass(b1.qualityRate)}">${(b1.qualityRate * 100).toFixed(1)}%</td>
                  <td>${formatMeanSd(b1.avgWeight, b1.sdWeight, 'กก.')}</td>
                  <td>${formatMeanSd(b1.avgCircum, b1.sdCircum, 'ซม.')}</td></tr>
                <tr>
                  <td>ทะลายที่ 2</td><td>${b2.n}</td><td>${b2.totalFruits}</td><td class="${rateClass(b2.qualityRate)}">${(b2.qualityRate * 100).toFixed(1)}%</td>
                  <td>${formatMeanSd(b2.avgWeight, b2.sdWeight, 'กก.')}</td>
                  <td>${formatMeanSd(b2.avgCircum, b2.sdCircum, 'ซม.')}</td></tr>
              `;
            }).join('')}
            <tr style="border-top:2px solid var(--primary);font-weight:700">
              <td colspan="2">รวมทุกจังหวัด</td><td>ทะลาย 1: ${overallB1.n} / ทะลาย 2: ${overallB2.n}</td>
              <td>ท1: ${overallB1.totalFruits} / ท2: ${overallB2.totalFruits}</td>
              <td>ท1: <span class="${rateClass(overallB1.qualityRate)}">${(overallB1.qualityRate * 100).toFixed(1)}%</span> / ท2: <span class="${rateClass(overallB2.qualityRate)}">${(overallB2.qualityRate * 100).toFixed(1)}%</span></td>
              <td>${formatComparison(overallB1.avgWeight, overallB2.avgWeight, 'กก.')}</td>
              <td>${formatComparison(overallB1.avgCircum, overallB2.avgCircum, 'ซม.')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h4 style="margin-bottom:10px">อัตราผลคุณภาพ ทะลาย 1 vs 2</h4>
      <div class="comp-bar-chart">
        ${PROVINCES.map((p, idx) => {
          const b1 = stats.byProvinceBunch[`${p.code}-1`] || blankGroupStats();
          const b2 = stats.byProvinceBunch[`${p.code}-2`] || blankGroupStats();
          const maxR = Math.max(b1.qualityRate, b2.qualityRate, 0.01);
          return `
            <div class="comp-bar-row" style="grid-template-columns:100px minmax(0,1fr) minmax(0,1fr) 100px">
              <span>${p.label}</span>
              <div>
                <div style="font-size:10px;color:var(--muted)">ทลาย 1</div>
                <div class="comp-bar-track"><i style="width:${(b1.qualityRate/maxR)*100}%;background:${colors[idx]}"></i></div><small>${(b1.qualityRate*100).toFixed(0)}%</small>
              </div>
              <div>
                <div style="font-size:10px;color:var(--muted)">ทลาย 2</div>
                <div class="comp-bar-track"><i style="width:${(b2.qualityRate/maxR)*100}%;background:${colors[idx]};opacity:0.5"></i></div><small>${(b2.qualityRate*100).toFixed(0)}%</small>
              </div>
              <span style="font-size:12px;color:var(--muted)">Δ ${(b1.qualityRate - b2.qualityRate > 0 ? '+' : '')}${((b1.qualityRate - b2.qualityRate) * 100).toFixed(1)}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderDistribution(stats) {
  const entries = filterEntries();
  const filteredStats = computeAllStats(entries);

  const selectedProvince = state.distProvince || 'all';
  const selectedBunch = state.distBunch || 'all';

  let distEntries = entries;
  if (selectedProvince !== 'all') distEntries = distEntries.filter((e) => e.province_code === selectedProvince);
  if (selectedBunch !== 'all') distEntries = distEntries.filter((e) => Number(e.bunch) === Number(selectedBunch));

  const weightHist = buildHistogram(distEntries, 'weight', 0.2, 'กก.');
  const circumHist = buildHistogram(distEntries, 'circum', 5, 'ซม.');

  const wVals = distEntries.map((e) => Number(e.weight)).filter((v) => isFinite(v) && v > 0);
  const cVals = distEntries.map((e) => Number(e.circum)).filter((v) => isFinite(v) && v > 0);

  const wMed = wVals.length ? median(wVals) : null;
  const cMed = cVals.length ? median(cVals) : null;

  el('statsModeContent').innerHTML = `
    <section class="visual-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <label style="font-size:13px">จังหวัด:
          <select id="distProvinceFilter">
            <option value="all" ${selectedProvince === 'all' ? 'selected' : ''}>ทุกจังหวัด</option>
            ${PROVINCES.map((p) => `<option value="${p.code}" ${selectedProvince === p.code ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </label>
        <label style="font-size:13px">ทะลาย:
          <select id="distBunchFilter">
            <option value="all" ${selectedBunch === 'all' ? 'selected' : ''}>ทั้งสองทะลาย</option>
            <option value="1" ${selectedBunch === '1' ? 'selected' : ''}>ทะลายที่ 1</option>
            <option value="2" ${selectedBunch === '2' ? 'selected' : ''}>ทะลายที่ 2</option>
          </select>
        </label>
      </div>
    </section>
    <div class="histogram-grid">
      <section class="visual-panel">
        <h3>การกระจายตัวของน้ำหนัก</h3>
        ${wVals.length ? histogramStatsRow(wVals, wMed, 0.2, 'กก.') : ''}
        ${histogramBars(weightHist, 'var(--blue)', wMed)}
      </section>
      <section class="visual-panel">
        <h3>การกระจายตัวของเส้นรอบวง</h3>
        ${cVals.length ? histogramStatsRow(cVals, cMed, 5, 'ซม.') : ''}
        ${histogramBars(circumHist, 'var(--primary)', cMed)}
      </section>
    </div>
  `;

  el('distProvinceFilter').addEventListener('change', function () {
    state.distProvince = this.value;
    renderDistribution(stats);
  });
  el('distBunchFilter').addEventListener('change', function () {
    state.distBunch = this.value;
    renderDistribution(stats);
  });
}

function histogramStatsRow(values, med, binSize, unit) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = stdDev(values);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  return `<div class="histogram-stats"><span>n = <strong>${n}</strong></span><span>ค่าเฉลี่ย = <strong>${mean.toFixed(2)} ${unit}</strong></span><span>มัธยฐาน = <strong>${med.toFixed(2)} ${unit}</strong></span><span>SD = <strong>${sd !== null ? sd.toFixed(2) : '-'}</strong></span><span>IQR = <strong>${q1.toFixed(2)} – ${q3.toFixed(2)} ${unit}</strong></span></div>`;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function histogramBars(hist, color, med) {
  if (hist.length === 0) return '<p class="status">ยังไม่มีข้อมูล</p>';
  const maxCount = Math.max(...hist.map((b) => b.count), 1);
  return `
    <div class="histogram-bars">
      ${hist.map((b) => `
        <div class="histogram-row">
          <span>${b.label}</span>
          <div class="histogram-track">
            <i style="width:${(b.count / maxCount) * 100}%; background:${color}"></i>
          </div>
          <strong>${b.count}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderOutlierPanel(stats) {
  const outlet = el('outlierPanel');
  const exportBtn = el('exportOutlierBtn');

  if (stats.outliers.length === 0) {
    outlet.hidden = true;
    exportBtn.style.display = 'none';
    return;
  }

  outlet.hidden = false;
  exportBtn.style.display = '';

  el('outlierSummary').innerHTML = `
    <p>พบ <strong>${stats.outliers.length}</strong> รายการที่ควรตรวจสอบ
    ${stats.outliers.filter((o) => o.reasons.some((r) => r.includes('น้ำหนัก'))).length > 0 ? ' | น้ำหนักผิดปกติ: ' + stats.outliers.filter((o) => o.reasons.some((r) => r.includes('น้ำหนัก'))).length : ''}
    ${stats.outliers.filter((o) => o.reasons.some((r) => r.includes('เส้นรอบวง'))).length > 0 ? ' | เส้นรอบวงผิดปกติ: ' + stats.outliers.filter((o) => o.reasons.some((r) => r.includes('เส้นรอบวง'))).length : ''}
    ${stats.outliers.filter((o) => o.reasons.some((r) => r.includes('หาย'))).length > 0 ? ' | ข้อมูลหาย: ' + stats.outliers.filter((o) => o.reasons.some((r) => r.includes('หาย'))).length : ''}
    </p>
    <button id="outlierToggle" class="button ghost small">${state.showOutliers ? 'ซ่อน' : 'แสดง'}รายการผิดปกติ</button>
  `;

  el('outlierTable').innerHTML = `
    <table>
      <thead><tr><th>รอบ</th><th>จังหวัด</th><th>แปลง</th><th>ทะลาย</th><th>ผลคุณภาพ</th><th>ต่ำ</th><th>เสียหาย</th><th>น้ำหนัก</th><th>รอบวง</th><th>เหตุผล</th></tr></thead>
      <tbody>
        ${stats.outliers.map((o) => `
          <tr>
            <td>รอบที่ ${o.entry.round}</td>
            <td>${o.provinceLabel}</td>
            <td>แปลงที่ ${o.entry.plot}</td>
            <td>ทะลายที่ ${o.entry.bunch}</td>
            <td>${o.entry.quality || 0}</td>
            <td>${o.entry.below || 0}</td>
            <td>${o.entry.damaged || 0}</td>
            <td>${o.entry.weight ?? '-'}</td>
            <td>${o.entry.circum ?? '-'}</td>
            <td>${o.reasons.join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  el('outlierTable').hidden = !state.showOutliers;

  el('outlierToggle').onclick = () => {
    state.showOutliers = !state.showOutliers;
    renderOutlierPanel(stats);
  };
}

function renderStatsTable(stats) {
  const tablePanel = document.createElement('section');
  tablePanel.className = 'visual-panel';
  tablePanel.innerHTML = `
    <h3>ตารางสรุปสถิติรายจังหวัด × ทะลาย</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>จังหวัด</th><th>ทะลาย</th><th>จำนวนบันทึก</th><th>จำนวนผลรวม</th><th>อัตราผลคุณภาพ</th>
            <th>นน.เฉลี่ย</th><th>นน.SD</th><th>นน.ต่ำสุด</th><th>นน.สูงสุด</th>
            <th>รอบวงเฉลี่ย</th><th>รอบวง SD</th><th>รอบวงต่ำสุด</th><th>รอบวงสูงสุด</th>
          </tr>
        </thead>
        <tbody>
          ${PROVINCES.map((province) => {
            return [1, 2].map((bunch) => {
              const pKey = `${province.code}-${bunch}`;
              const g = stats.byProvinceBunch[pKey] || blankGroupStats();
              const nWarn = g.n > 0 && g.n < 5;
              return `
                <tr>
                  <td>${province.label}</td>
                  <td>ทะลายที่ ${bunch}</td>
                  <td>${g.n}${nWarn ? ' <span class="badge-warn">ข้อมูลน้อย</span>' : ''}</td>
                  <td>${g.totalFruits}</td>
                  <td class="${rateClass(g.qualityRate)}">${(g.qualityRate * 100).toFixed(1)}%</td>
                  <td>${g.avgWeight !== null ? g.avgWeight.toFixed(2) + ' กก.' : '-'}</td>
                  <td>${g.sdWeight !== null ? g.sdWeight.toFixed(2) : '-'}</td>
                  <td>${g.weightVals.length ? Math.min(...g.weightVals).toFixed(2) + ' กก.' : '-'}</td>
                  <td>${g.weightVals.length ? Math.max(...g.weightVals).toFixed(2) + ' กก.' : '-'}</td>
                  <td>${g.avgCircum !== null ? g.avgCircum.toFixed(2) + ' ซม.' : '-'}</td>
                  <td>${g.sdCircum !== null ? g.sdCircum.toFixed(2) : '-'}</td>
                  <td>${g.circumVals.length ? Math.min(...g.circumVals).toFixed(2) + ' ซม.' : '-'}</td>
                  <td>${g.circumVals.length ? Math.max(...g.circumVals).toFixed(2) + ' ซม.' : '-'}</td>
                </tr>
              `;
            }).join('');
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  el('statsModeContent').appendChild(tablePanel);
}

function exportSummaryCSV(stats) {
  const headers = ['จังหวัด', 'รอบ', 'ทะลาย', 'จำนวนบันทึก', 'จำนวนผลรวม', 'อัตราผลคุณภาพ', 'นน.เฉลี่ย', 'นน.SD', 'รอบวงเฉลี่ย', 'รอบวง SD'];
  const rows = buildSummaryCsvRows(stats, PROVINCES, 6, 2);
  exportCSV('coconut_summary', headers, rows);
}

function exportOutlierCSV(stats) {
  const headers = ['รอบ', 'จังหวัด', 'แปลง', 'ทะลาย', 'ผลคุณภาพ', 'ต่ำมาตรฐาน', 'เสียหาย', 'น้ำหนัก', 'รอบวง', 'เหตุผล'];
  const rows = stats.outliers.map((o) => [
    o.entry.round, o.provinceLabel, o.entry.plot, o.entry.bunch,
    o.entry.quality || 0, o.entry.below || 0, o.entry.damaged || 0,
    o.entry.weight ?? '', o.entry.circum ?? '',
    o.reasons.join('; '),
  ]);
  exportCSV('coconut_outliers', headers, rows);
}

function exportCSV(filename, headers, rows) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function fmtNum(value, unit) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(2)}${unit ? ' ' + unit : ''}`;
}

async function api(path, options = {}) {
  const init = {
    method: options.method || 'GET',
    headers: {},
  };
  if (options.body) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function setLoading(isLoading) {
  const btn = el('entryForm').querySelector('button[type="submit"]');
  const inputs = el('entryForm').querySelectorAll('input, select, textarea');
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
    inputs.forEach(inp => inp.disabled = true);
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    inputs.forEach(inp => inp.disabled = false);
  }
}

function renderEconomy() {
  if (!state.data) return;
  const provinces = activeProvinces();
  const pPremium = Number(el('pricePremium').value) || 0;
  const pBelow = Number(el('priceBelow').value) || 0;

  const allEntries = state.data.entries || [];
  let grandPremium = 0;
  let grandBelow = 0;
  let grandDamaged = 0;
  let grandRealized = 0;
  let grandLost = 0;

  const provData = provinces.map(prov => {
    const provEntries = allEntries.filter(e => e.province_code === prov.code);
    let premium = 0;
    let below = 0;
    let damaged = 0;
    provEntries.forEach(e => {
      premium += Number(e.quality) || 0;
      below += Number(e.below) || 0;
      damaged += Number(e.damaged) || 0;
    });

    const realized = (premium * pPremium) + (below * pBelow);
    const lost = damaged * pPremium;
    const potential = realized + lost;
    const lossRate = potential > 0 ? (lost / potential) * 100 : 0;

    grandPremium += premium;
    grandBelow += below;
    grandDamaged += damaged;
    grandRealized += realized;
    grandLost += lost;

    return {
      label: prov.label,
      code: prov.code,
      totalN: premium + below + damaged,
      premium,
      below,
      damaged,
      realized,
      lost,
      potential,
      lossRate
    };
  });

  const grandPotential = grandRealized + grandLost;
  const grandLossRate = grandPotential > 0 ? (grandLost / grandPotential) * 100 : 0;

  // Render Summary Cards
  el('econSummaryCards').innerHTML = `
    <div class="summary-card" style="border-left: 4px solid var(--primary); padding: 16px; background: rgba(255,255,255,0.85); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div class="card-value" style="color:var(--primary); font-size: 26px; font-weight: 800;">${grandRealized.toLocaleString()} ฿</div>
      <div class="card-label" style="font-weight:700; margin-top:6px; color:#2c3e50">มูลค่าเศรษฐกิจจริง</div>
      <div class="card-sub" style="font-size:12px; color:var(--muted); margin-top:6px; line-height: 1.5">
        ส่งออก: <strong>${grandPremium.toLocaleString()} ลูก</strong> (${(grandPremium * pPremium).toLocaleString()} ฿)<br>
        แปรรูป: <strong>${grandBelow.toLocaleString()} ลูก</strong> (${(grandBelow * pBelow).toLocaleString()} ฿)
      </div>
    </div>
    <div class="summary-card" style="border-left: 4px solid var(--red); padding: 16px; background: rgba(255,255,255,0.85); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div class="card-value rate-red" style="font-size: 26px; font-weight: 800;">${grandLost.toLocaleString()} ฿</div>
      <div class="card-label" style="font-weight:700; margin-top:6px; color:#2c3e50">มูลค่าการสูญเสียโอกาส</div>
      <div class="card-sub" style="font-size:12px; color:var(--muted); margin-top:6px; line-height: 1.5">
        เสียหายสะสม: <strong>${grandDamaged.toLocaleString()} ลูก</strong> (เกรดส่งออก)<br>
        สัดส่วนการสูญเสียทางการเงิน: <span class="rate-red" style="font-weight:700">${grandLossRate.toFixed(1)}%</span>
      </div>
    </div>
    <div class="summary-card" style="border-left: 4px solid var(--blue); padding: 16px; background: rgba(255,255,255,0.85); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div class="card-value" style="color:var(--blue); font-size: 26px; font-weight: 800;">${grandPotential.toLocaleString()} ฿</div>
      <div class="card-label" style="font-weight:700; margin-top:6px; color:#2c3e50">ศักยภาพรายได้รวมสูงสุด</div>
      <div class="card-sub" style="font-size:12px; color:var(--muted); margin-top:6px; line-height: 1.5">
        เป้าหมายสูงสุดหากไม่มีความเสียหาย<br>
        (ตามแผนขับเคลื่อนแปลงใหญ่มะพร้าว)
      </div>
    </div>
  `;

  // Render Table
  el('econTable').innerHTML = `
    <thead>
      <tr>
        <th style="font-weight:bold; color:#2c3e50">จังหวัด</th>
        <th style="font-weight:bold; text-align:right; color:#2c3e50">ผลผลิตรวม (ลูก)</th>
        <th style="font-weight:bold; text-align:right; color:#2c3e50">รายได้จริง (฿)</th>
        <th style="font-weight:bold; text-align:right; color:#2c3e50">สูญเสียโอกาส (฿)</th>
        <th style="font-weight:bold; text-align:right; color:#2c3e50">ศักยภาพรวม (฿)</th>
        <th style="font-weight:bold; text-align:center; color:#2c3e50">สัดส่วนสูญเสีย</th>
      </tr>
    </thead>
    <tbody>
      ${provData.map(d => `
        <tr>
          <td><strong>${d.label}</strong></td>
          <td style="text-align:right; font-weight:500">${d.totalN.toLocaleString()}</td>
          <td style="text-align:right; color:var(--primary); font-weight:700">${d.realized.toLocaleString()} ฿</td>
          <td style="text-align:right; color:var(--red); font-weight:700">${d.lost.toLocaleString()} ฿</td>
          <td style="text-align:right; color:var(--blue); font-weight:700">${d.potential.toLocaleString()} ฿</td>
          <td style="text-align:center">
            <span class="${d.lossRate > 15 ? 'badge-warn' : 'badge-success'}" style="padding:4px 10px; border-radius:12px; font-size:11px; font-weight:bold">
              ${d.lossRate.toFixed(1)}%
            </span>
          </td>
        </tr>
      `).join('')}
      <tr style="border-top: 2px solid var(--primary); font-weight: bold; background: rgba(226, 237, 231, 0.4)">
        <td>รวมทุกพื้นที่</td>
        <td style="text-align:right">${(grandPremium + grandBelow + grandDamaged).toLocaleString()}</td>
        <td style="text-align:right; color:var(--primary)">${grandRealized.toLocaleString()} ฿</td>
        <td style="text-align:right; color:var(--red)">${grandLost.toLocaleString()} ฿</td>
        <td style="text-align:right; color:var(--blue)">${grandPotential.toLocaleString()} ฿</td>
        <td style="text-align:center">
          <span style="font-size:13px; font-weight:bold; color:${grandLossRate > 15 ? 'var(--red)' : 'var(--primary)'}">
            ${grandLossRate.toFixed(1)}%
          </span>
        </td>
      </tr>
    </tbody>
  `;

  // Render Visual Chart
  const maxPotential = Math.max(...provData.map(d => d.potential), 1);
  el('econVisual').innerHTML = `
    <div class="comp-bar-chart" style="display:flex; flex-direction:column; gap:20px; padding: 10px 0;">
      ${provData.map((d, idx) => {
        const realizedWidth = (d.realized / maxPotential) * 100;
        const lostWidth = (d.lost / maxPotential) * 100;
        return `
          <div class="comp-bar-row" style="display: grid; grid-template-columns: 120px 1fr 110px; align-items: center; gap: 16px;">
            <strong style="color:#2c3e50; font-size: 13px">${d.label}</strong>
            <div style="display:flex; flex-direction:column; gap:8px">
              <!-- Realized Income Bar -->
              <div style="display:flex; align-items:center; gap:12px">
                <span style="font-size:10px; color:var(--muted); width:60px; shrink:0; text-align:right">รายได้จริง</span>
                <div style="flex:1; height:10px; background:#e2ede7; border-radius:6px; overflow:hidden">
                  <div style="height:100%; width:${realizedWidth}%; background:linear-gradient(90deg, #2ecc71, var(--primary)); border-radius:6px"></div>
                </div>
                <small style="font-size:11px; font-weight:700; width:90px; text-align:right; color:var(--primary)">${d.realized.toLocaleString()} ฿</small>
              </div>
              <!-- Lost Opportunity Bar -->
              <div style="display:flex; align-items:center; gap:12px">
                <span style="font-size:10px; color:var(--muted); width:60px; shrink:0; text-align:right">สูญเสียโอกาส</span>
                <div style="flex:1; height:10px; background:#fce8e6; border-radius:6px; overflow:hidden">
                  <div style="height:100%; width:${lostWidth}%; background:linear-gradient(90deg, #e74c3c, var(--red)); border-radius:6px"></div>
                </div>
                <small style="font-size:11px; font-weight:700; width:90px; text-align:right; color:var(--red)">${d.lost.toLocaleString()} ฿</small>
              </div>
            </div>
            <div style="text-align:right; border-left: 1px solid #eee; padding-left: 12px;">
              <div style="font-size: 10px; color: var(--muted); font-weight: bold;">ศักยภาพรวม</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--blue); margin-top:2px;">${d.potential.toLocaleString()} ฿</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
