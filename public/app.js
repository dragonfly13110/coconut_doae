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
  el('bunchRefreshBtn').addEventListener('click', loadDashboard);
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
  setStatus('entryStatus', 'กำลังบันทึกข้อมูล...', '');

  try {
    await api('/api/entry', {
      method: 'POST',
      body: {
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
      },
    });
    setStatus('entryStatus', 'บันทึกข้อมูลแล้ว', 'success');
    await loadDashboard();
    renderCompletion();
  } catch (error) {
    setStatus('entryStatus', error.message, 'error');
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
  const provinces = Object.fromEntries(PROVINCES.map((province) => [province.code, blankSummary()]));
  const overall = blankSummary();

  for (const round of state.data.rounds) {
    if (state.activeRound !== 'all' && round.round !== state.activeRound) continue;
    for (const province of PROVINCES) {
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
  el('provinceCards').innerHTML = PROVINCES.map((province) => {
    const data = provinces[province.code];
    const complete = data.maxRows > 0 ? Math.round((data.filled / data.maxRows) * 100) : 0;
    return `
      <article class="card">
        <h3>${province.label}<span class="${rateClass(data.qualityRate)}">${(data.qualityRate * 100).toFixed(0)}%</span></h3>
        <div class="rows">
          ${row('ผลรวม', data.totalFruits.toLocaleString())}
          ${row('ผลคุณภาพ', data.quality.toLocaleString())}
          ${row('ต่ำกว่ามาตรฐาน', data.below.toLocaleString())}
          ${row('เสียหาย', data.damaged.toLocaleString())}
          ${row('บันทึกแล้ว', `${data.filled}/${data.maxRows}`)}
        </div>
        <div class="progress" title="บันทึกแล้ว ${complete}%"><span style="width:${complete}%"></span></div>
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
  const maxTotal = Math.max(...PROVINCES.map((province) => provinces[province.code].totalFruits), 1);
  return `
    <section class="visual-panel">
      <h3>สัดส่วนข้อมูลรายจังหวัด</h3>
      <div class="bar-list">
        ${PROVINCES.map((province) => {
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
  const maxWeight = Math.max(...PROVINCES.map((province) => provinces[province.code].avgWeight || 0), 1);
  const maxCircum = Math.max(...PROVINCES.map((province) => provinces[province.code].avgCircum || 0), 1);
  return `
    <section class="visual-panel metric-compare-panel">
      <h3>เทียบขนาดผลเฉลี่ยรายจังหวัด</h3>
      <div class="metric-compare">
        ${PROVINCES.map((province) => {
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
      ${PROVINCES.map((province) => {
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
  const provinces = Object.fromEntries(PROVINCES.map((province) => [
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
  `;
}

function bunchProvinceBars(provinces, key, title, unit) {
  const maxValue = Math.max(...PROVINCES.map((province) => provinces[province.code].total[key] || 0), 1);
  return `
    <section class="visual-panel">
      <h3>${title} รายจังหวัด</h3>
      <div class="bunch-bar-list">
        ${PROVINCES.map((province) => {
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
      ${PROVINCES.flatMap((province) => [1, 2].map((bunch) => {
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
  el('bunchTab').hidden = tab !== 'bunch';
  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
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

function rateClass(rate) {
  if (rate >= 0.7) return 'rate-green';
  if (rate >= 0.5) return 'rate-yellow';
  return 'rate-red';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
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
