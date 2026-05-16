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
  renderCompletion();
}

function buildRoundButtons() {
  const wrap = el('roundButtons');
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
    const active = state.activeRound === 'all'
      ? button.dataset.round === 'all'
      : Number(button.dataset.round) === state.activeRound;
    button.classList.toggle('active', active);
  });
  el('provinceCards').hidden = false;
  el('dashboardVisual').hidden = false;
  document.querySelector('.table-wrap').hidden = false;
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
