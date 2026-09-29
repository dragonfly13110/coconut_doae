import re

with open('public/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import
if "from './challenge.js'" not in text:
    import_stmt = "import { initChallenge, showChalTab } from './challenge.js';\n"
    text = import_stmt + text

# 2. Add systemMode to state
old_state = '''const state = {
  user: null,
  data: null,
  activeRound: 1,
  dashboardView: 'cards',
};'''
new_state = '''const state = {
  user: null,
  data: null,
  activeRound: 1,
  dashboardView: 'cards',
  systemMode: localStorage.getItem('coconut_system_mode') || 'quality',
  challengeInitialized: false,
};'''
if old_state in text:
    text = text.replace(old_state, new_state, 1)

# 3. Add mode buttons in bindEvents
old_bind = '''  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });'''
new_bind = '''  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });

  el('btnModeQuality')?.addEventListener('click', () => switchSystemMode('quality'));
  el('btnModeChallenge')?.addEventListener('click', () => switchSystemMode('challenge'));'''
if old_bind in text:
    text = text.replace(old_bind, new_bind, 1)

# 4. Update showApp
old_show_app = '''function showApp() {
  el('loginView').hidden = true;
  el('appView').hidden = false;
  el('logoutBtn').hidden = false;
  el('userLine').textContent = `${state.user.province_label} | ${roleLabel(state.user.role)}`;

  const isAdmin = state.user.role === 'admin';
  el('provinceWrap').hidden = !isAdmin;
  if (!isAdmin) el('province').value = state.user.province_code;
}'''
new_show_app = '''function showApp() {
  el('loginView').hidden = true;
  if (el('modeNavBar')) el('modeNavBar').hidden = false;
  el('logoutBtn').hidden = false;
  el('userLine').textContent = `${state.user.province_label} | ${roleLabel(state.user.role)}`;

  const isAdmin = state.user.role === 'admin';
  el('provinceWrap').hidden = !isAdmin;
  if (!isAdmin) el('province').value = state.user.province_code;

  switchSystemMode(state.systemMode || 'quality');
}

function switchSystemMode(mode) {
  state.systemMode = mode;
  try { localStorage.setItem('coconut_system_mode', mode); } catch (e) {}
  const isQuality = mode === 'quality';

  el('btnModeQuality')?.classList.toggle('active', isQuality);
  el('btnModeChallenge')?.classList.toggle('active', !isQuality);

  el('appView').hidden = !isQuality;
  const chalView = el('appViewChallenge');
  if (chalView) {
    chalView.hidden = isQuality;
    if (!isQuality && state.user) {
      if (!state.challengeInitialized) {
        initChallenge(state.user);
        state.challengeInitialized = true;
      }
    }
  }
}'''
if old_show_app in text:
    text = text.replace(old_show_app, new_show_app, 1)

# 5. Update showLogin
old_show_login = '''function showLogin() {
  el('loginView').hidden = false;
  el('appView').hidden = true;
  el('logoutBtn').hidden = true;
  el('userLine').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
}'''
new_show_login = '''function showLogin() {
  el('loginView').hidden = false;
  el('appView').hidden = true;
  if (el('appViewChallenge')) el('appViewChallenge').hidden = true;
  if (el('modeNavBar')) el('modeNavBar').hidden = true;
  el('logoutBtn').hidden = true;
  el('userLine').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
}'''
if old_show_login in text:
    text = text.replace(old_show_login, new_show_login, 1)

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Updated public/app.js successfully')
