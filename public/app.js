const PROVINCES = [
  { code: 'nakhon_pathom', label: 'Nakhon Pathom' },
  { code: 'ratchaburi', label: 'Ratchaburi' },
  { code: 'samut_sakhon', label: 'Samut Sakhon' },
  { code: 'samut_songkhram', label: 'Samut Songkhram' },
];

const state = {
  user: null,
  data: null,
  activeRound: 1,
};

const el = (id) => document.getElementById(id);

init();

async function init() {
  fillSelect(el('loginProvince'), PROVINCES, 'code', 'label');
  fillSelect(el('province'), PROVINCES, 'code', 'label');
  fillNumberSelect(el('round'), 1, 6, 'Round ');
  fillNumberSelect(el('plot'), 1, 10, 'Plot ');
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
  setStatus('loginStatus', 'Checking...', '');
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
  } catch (error) {
    setStatus('loginStatus', error.message, 'error');
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
  } catch {
    showLogin();
  }
}

async function loadEntry() {
  if (!state.user) return;
  setStatus('entryStatus', 'Loading...', '');
  const provinceCode = provinceForRequest();
  const params = new URLSearchParams({
    round: el('round').value,
    province_code: provinceCode,
    plot: el('plot').value,
    bunch: el('bunch').value,
  });

  try {
    const { entry } = await api(`/api/entry?${params}`);
    setEntry(entry || {});
    setStatus('entryStatus', entry ? 'Loaded' : 'No saved entry yet', '');
  } catch (error) {
    setStatus('entryStatus', error.message, 'error');
  }
}

async function saveEntry(event) {
  event.preventDefault();
  setStatus('entryStatus', 'Saving...', '');

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
    setStatus('entryStatus', 'Saved', 'success');
    await loadDashboard();
  } catch (error) {
    setStatus('entryStatus', error.message, 'error');
  }
}

async function loadDashboard() {
  if (!state.user) return;
  state.data = await api('/api/dashboard');
  buildRoundButtons();
  renderDashboard();
}

function buildRoundButtons() {
  const wrap = el('roundButtons');
  wrap.innerHTML = '';
  const all = document.createElement('button');
  all.textContent = 'All rounds';
  all.dataset.round = 'all';
  wrap.append(all);

  for (const round of state.data.roundDates) {
    const button = document.createElement('button');
    button.textContent = `${round.label} ${round.start} - ${round.end}`;
    button.dataset.round = String(round.number);
    wrap.append(button);
  }

  wrap.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeRound = button.dataset.round === 'all' ? 'all' : Number(button.dataset.round);
      renderDashboard();
    });
  });
}

function renderDashboard() {
  const agg = aggregate();
  renderOverall(agg.overall);
  renderCards(agg.provinces);
  renderTable(agg.provinces);
  el('roundButtons').querySelectorAll('button').forEach((button) => {
    const active = state.activeRound === 'all'
      ? button.dataset.round === 'all'
      : Number(button.dataset.round) === state.activeRound;
    button.classList.toggle('active', active);
  });
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
    metric('Total fruits', overall.totalFruits.toLocaleString()),
    metric('Quality rate', `${(overall.qualityRate * 100).toFixed(1)}%`, rateClass(overall.qualityRate)),
    metric('Avg weight', overall.avgWeight === null ? '--' : overall.avgWeight.toFixed(2)),
    metric('Avg circumference', overall.avgCircum === null ? '--' : overall.avgCircum.toFixed(2)),
  ].join('');
}

function renderCards(provinces) {
  el('provinceCards').innerHTML = PROVINCES.map((province) => {
    const data = provinces[province.code];
    return `
      <article class="card">
        <h3>${province.label}<span class="${rateClass(data.qualityRate)}">${(data.qualityRate * 100).toFixed(0)}%</span></h3>
        <div class="rows">
          ${row('Total', data.totalFruits.toLocaleString())}
          ${row('Quality', data.quality.toLocaleString())}
          ${row('Below', data.below.toLocaleString())}
          ${row('Damaged', data.damaged.toLocaleString())}
          ${row('Recorded', `${data.filled}/${data.maxRows}`)}
        </div>
      </article>
    `;
  }).join('');
}

function renderTable(provinces) {
  el('compareTable').innerHTML = `
    <thead>
      <tr><th>Province</th><th>Total</th><th>Quality</th><th>Below</th><th>Damaged</th><th>Rate</th><th>Recorded</th></tr>
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
  el('userLine').textContent = `${state.user.province_label} (${state.user.role})`;

  const isAdmin = state.user.role === 'admin';
  el('provinceWrap').hidden = !isAdmin;
  if (!isAdmin) el('province').value = state.user.province_code;
}

function showLogin() {
  el('loginView').hidden = false;
  el('appView').hidden = true;
  el('logoutBtn').hidden = true;
  el('userLine').textContent = 'Not signed in';
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
