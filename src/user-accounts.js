// System Accounts and Role-Based Access Control (RBAC)
// 4 Provinces, 23 Districts (DOPA Codes), 1 Region, 1 Central DOAE, 1 Admin

export const SYSTEM_ACCOUNTS = [
  // --- 1. ผู้ดูแลระบบสูงสุด (System Admin) ---
  {
    username: 'admin',
    role: 'admin',
    province_code: 'all',
    province_label: 'ผู้ดูแลระบบหลัก (System Admin)',
    district_code: null,
    district_name: null,
    default_pin: 'passadmin',
    pin_hash: 'bd05984c0bcd2bae5941193fac7a8ea3de5667b912cd42edff1b579d019dd57c',
  },

  // --- 2. กรมส่งเสริมการเกษตร (ส่วนกลาง) ---
  {
    username: 'doae_hq',
    role: 'central',
    province_code: 'all',
    province_label: 'กรมส่งเสริมการเกษตร (ส่วนกลาง)',
    district_code: null,
    district_name: null,
    default_pin: 'passdoae',
    pin_hash: 'afc7f6b6aa588008365b146a7a1865424cf21cf821b74afd67e00787fc25cc27',
  },
  // Backward compatibility alias
  {
    username: 'doae',
    role: 'central',
    province_code: 'all',
    province_label: 'กรมส่งเสริมการเกษตร (ส่วนกลาง)',
    district_code: null,
    district_name: null,
    default_pin: '1234',
    pin_hash: 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67',
  },

  // --- 3. ระดับเขต: สสก.เขต 2 ราชบุรี (ภาคตะวันตก) ---
  {
    username: 'region2',
    role: 'region',
    province_code: 'all',
    province_label: 'สำนักงานส่งเสริมและพัฒนาการเกษตรที่ 2 (เขต 2 ราชบุรี)',
    district_code: null,
    district_name: null,
    default_pin: 'passreg2',
    pin_hash: 'e352956eb13435263589d92814828e707701153feb24bb8883fde513200f2de5',
  },

  // --- 4. ระดับจังหวัด (4 บัญชี) ---
  {
    username: 'prov70',
    role: 'province',
    province_code: 'ratchaburi',
    province_label: 'สำนักงานเกษตรจังหวัดราชบุรี',
    district_code: null,
    district_name: null,
    default_pin: 'pass70',
    pin_hash: '7ea7404b205497d63c9e7a4709303841b5b5cb433b584f7eef3dba7d95bbd519',
  },
  {
    username: 'ratchaburi',
    role: 'province',
    province_code: 'ratchaburi',
    province_label: 'สำนักงานเกษตรจังหวัดราชบุรี',
    district_code: null,
    district_name: null,
    default_pin: '1234',
    pin_hash: 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67',
  },

  {
    username: 'prov73',
    role: 'province',
    province_code: 'nakhon_pathom',
    province_label: 'สำนักงานเกษตรจังหวัดนครปฐม',
    district_code: null,
    district_name: null,
    default_pin: 'pass73',
    pin_hash: '965282c83c5210216064ad9a59d2fef4a0d3529d352fbe3f59251b5244edd26f',
  },
  {
    username: 'nakhon_pathom',
    role: 'province',
    province_code: 'nakhon_pathom',
    province_label: 'สำนักงานเกษตรจังหวัดนครปฐม',
    district_code: null,
    district_name: null,
    default_pin: '1234',
    pin_hash: 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67',
  },

  {
    username: 'prov74',
    role: 'province',
    province_code: 'samut_sakhon',
    province_label: 'สำนักงานเกษตรจังหวัดสมุทรสาคร',
    district_code: null,
    district_name: null,
    default_pin: 'pass74',
    pin_hash: '8fd1b49ec53f74c4dabf08c725af22f4d40820d59dd445f3c05c69c78e24beec',
  },
  {
    username: 'samut_sakhon',
    role: 'province',
    province_code: 'samut_sakhon',
    province_label: 'สำนักงานเกษตรจังหวัดสมุทรสาคร',
    district_code: null,
    district_name: null,
    default_pin: '1234',
    pin_hash: 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67',
  },

  {
    username: 'prov75',
    role: 'province',
    province_code: 'samut_songkhram',
    province_label: 'สำนักงานเกษตรจังหวัดสมุทรสงคราม',
    district_code: null,
    district_name: null,
    default_pin: 'pass75',
    pin_hash: 'd4d8a4d092971422a1442cb39b69331b2d2a85e7968293db6dd6d15992185dc6',
  },
  {
    username: 'samut_songkhram',
    role: 'province',
    province_code: 'samut_songkhram',
    province_label: 'สำนักงานเกษตรจังหวัดสมุทรสงคราม',
    district_code: null,
    district_name: null,
    default_pin: '1234',
    pin_hash: 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67',
  },

  // --- 5. ระดับอำเภอ: จังหวัดราชบุรี (รหัส 70) 10 อำเภอ ---
  { username: '7001', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7001', district_name: 'เมืองราชบุรี', default_pin: 'pass7001', pin_hash: '7dcad5a4baa5662e0a25502d446fc45b3e4e23744824835b08f9acfa728d202e' },
  { username: '7002', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7002', district_name: 'จอมบึง', default_pin: 'pass7002', pin_hash: 'bfe07ca823569b8ce969dad051a2f5b2f53072e4a21a111c67cf57cf0ae21041' },
  { username: '7003', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7003', district_name: 'สวนผึ้ง', default_pin: 'pass7003', pin_hash: 'df7b69127992087fe10cecd60491c25dd1fa75380e1e0bcae13de17a2d183f5e' },
  { username: '7004', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7004', district_name: 'ดำเนินสะดวก', default_pin: 'pass7004', pin_hash: '295f4494c718071021a7f1fbe4378858ca1ce4c40fd57e567e08c61b2257ecda' },
  { username: '7005', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7005', district_name: 'บ้านโป่ง', default_pin: 'pass7005', pin_hash: '53b76b0fc30425a8a1125e938cf4c262f0243d7e0b40a853df056eba16f3695c' },
  { username: '7006', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7006', district_name: 'บางแพ', default_pin: 'pass7006', pin_hash: '25546b520717fc62edb2e9e8103313d4800065506ec310950fe4f841c8cfcf4d' },
  { username: '7007', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7007', district_name: 'โพธาราม', default_pin: 'pass7007', pin_hash: '82e1b35abd8b3e5122e51e3c9354b9a3a4681593763e573702a9747b9fda0772' },
  { username: '7008', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7008', district_name: 'ปากท่อ', default_pin: 'pass7008', pin_hash: 'c93c9922571b2dc635cdc213f4e3db2d95a126eed657ff7b3aba15c7d4aac25a' },
  { username: '7009', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7009', district_name: 'วัดเพลง', default_pin: 'pass7009', pin_hash: '16c69b128857ff22a88a1f4df14b9bde46f6531847523598703e21b37c6cbc27' },
  { username: '7010', role: 'district', province_code: 'ratchaburi', province_label: 'ราชบุรี', district_code: '7010', district_name: 'บ้านคา', default_pin: 'pass7010', pin_hash: '72c064cb01b469bba8822bfe361623520c94259c79bc85fba00ef53b0fafa1b4' },

  // --- 6. ระดับอำเภอ: จังหวัดนครปฐม (รหัส 73) 7 อำเภอ ---
  { username: '7301', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7301', district_name: 'เมืองนครปฐม', default_pin: 'pass7301', pin_hash: '69fe084d6155457947c2904dd3b78f6471d70db638cd11a825863c9b232c3162' },
  { username: '7302', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7302', district_name: 'กำแพงแสน', default_pin: 'pass7302', pin_hash: '3262c625d4bdb0c4420b7db994648bfdf2ceb1e341fd941514673263cc4d5fc5' },
  { username: '7303', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7303', district_name: 'นครชัยศรี', default_pin: 'pass7303', pin_hash: '969b61734cc4b42b0e6533b19defa4c3ae9486c9e7378a7f4e154438c18a9cb8' },
  { username: '7304', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7304', district_name: 'ดอนตูม', default_pin: 'pass7304', pin_hash: '34b874b0afaa8506ffcc8356812e3da2069a4c4c168cb53bd720363f9c84c558' },
  { username: '7305', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7305', district_name: 'บางเลน', default_pin: 'pass7305', pin_hash: '6ab00b67222b8705680c09206ea1632c7e9e2299281cac3d23317fdea88d49c4' },
  { username: '7306', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7306', district_name: 'สามพราน', default_pin: 'pass7306', pin_hash: '9987eefeb68978c71592bc6794af53a94bb8ac1b8d3b5fb94277d560ecdc66de' },
  { username: '7307', role: 'district', province_code: 'nakhon_pathom', province_label: 'นครปฐม', district_code: '7307', district_name: 'พุทธมณฑล', default_pin: 'pass7307', pin_hash: '20d6d93954e80a92e2345c4db575ba362164a836ce8ecb5edcc99e9923532939' },

  // --- 7. ระดับอำเภอ: จังหวัดสมุทรสาคร (รหัส 74) 3 อำเภอ ---
  { username: '7401', role: 'district', province_code: 'samut_sakhon', province_label: 'สมุทรสาคร', district_code: '7401', district_name: 'เมืองสมุทรสาคร', default_pin: 'pass7401', pin_hash: 'a2077542d878a8080b37284421d90c68347257486400d665a69a6850efeffc82' },
  { username: '7402', role: 'district', province_code: 'samut_sakhon', province_label: 'สมุทรสาคร', district_code: '7402', district_name: 'กระทุ่มแบน', default_pin: 'pass7402', pin_hash: '864e6a7563048288f9c8d8dfb1f130fe82af741e5d34d5526fa2d41a57a4c5e0' },
  { username: '7403', role: 'district', province_code: 'samut_sakhon', province_label: 'สมุทรสาคร', district_code: '7403', district_name: 'บ้านแพ้ว', default_pin: 'pass7403', pin_hash: 'dface25e8d4ae131445ce7cc59bcea33e09eff3b64e4e99c15a531bc115f1915' },

  // --- 8. ระดับอำเภอ: จังหวัดสมุทรสงคราม (รหัส 75) 3 อำเภอ ---
  { username: '7501', role: 'district', province_code: 'samut_songkhram', province_label: 'สมุทรสงคราม', district_code: '7501', district_name: 'เมืองสมุทรสงคราม', default_pin: 'pass7501', pin_hash: 'd0c7a377617145af9f9e953abf3daecd101e57c3d9a12fd4824e7e47044270ce' },
  { username: '7502', role: 'district', province_code: 'samut_songkhram', province_label: 'สมุทรสงคราม', district_code: '7502', district_name: 'บางคนที', default_pin: 'pass7502', pin_hash: 'e35a0a7875ea88fecf3365e18a501671881d244dad11f99fc225e83f1611f8f4' },
  { username: '7503', role: 'district', province_code: 'samut_songkhram', province_label: 'สมุทรสงคราม', district_code: '7503', district_name: 'อัมพวา', default_pin: 'pass7503', pin_hash: '5d6d23174ad2dce7ac92b31c8bd91f0f784b04375dbf393748569e83950584f6' },
];

/**
 * Normalizes district names by removing prefixes like "อำเภอ", "อ." and extra spaces.
 */
export function normalizeDistrictName(name) {
  if (!name) return '';
  return String(name).replace(/^(อำเภอ|อ\.)\s*/, '').trim().toLowerCase();
}

/**
 * Checks whether a user has permission to EDIT/SAVE/DELETE a specific plot/district.
 *
 * Permission hierarchy:
 * 1. Admin, Central (DOAE HQ), Region: Can edit EVERYTHING (all provinces, all districts).
 * 2. Province: Can edit all districts in their own province.
 * 3. District: Can ONLY edit plots in their own assigned district.
 *
 * For VIEWING: All users can view/select all provinces and districts.
 */
export function canUserEditDistrict(user, targetProvinceCode, targetDistrictName) {
  if (!user) return false;
  const role = user.role;

  // Level 1: Full administrative/supervisory write access
  if (['admin', 'central', 'region'].includes(role) || user.username === 'admin' || user.username === 'doae_hq' || user.username === 'doae') {
    return true;
  }

  // Level 2: Province officer write access (matches province)
  if (role === 'province') {
    return user.province_code === targetProvinceCode;
  }

  // Level 3: District officer write access (matches both province AND district)
  if (role === 'district') {
    if (user.province_code !== targetProvinceCode) return false;
    const uDist = normalizeDistrictName(user.district_name);
    const tDist = normalizeDistrictName(targetDistrictName);
    // If user's district matches target district or either is empty during new plot creation within same district
    return uDist === tDist || (uDist && tDist.includes(uDist)) || (tDist && uDist.includes(tDist));
  }

  return false;
}

/**
 * Ensures system_audit_logs table exists and is indexed.
 */
export async function ensureSystemAuditDb(db) {
  if (!db || typeof db.prepare !== 'function') return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      target_label TEXT,
      province_code TEXT,
      province_label TEXT,
      district_name TEXT,
      user_id INTEGER,
      username TEXT NOT NULL,
      user_label TEXT,
      user_role TEXT,
      summary TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sys_audit_lookup
    ON system_audit_logs(target_type, created_at DESC)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sys_audit_user
    ON system_audit_logs(username, created_at DESC)
  `).run();
}

/**
 * Records a detailed audit log entry.
 */
export async function recordSystemAuditLog(db, {
  action,
  targetType,
  targetId = null,
  targetLabel = '',
  provinceCode = null,
  provinceLabel = '',
  districtName = null,
  user,
  summary = '',
  beforeData = null,
  afterData = null,
}) {
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await ensureSystemAuditDb(db);
    const stmt = db.prepare(`
      INSERT INTO system_audit_logs (
        action, target_type, target_id, target_label,
        province_code, province_label, district_name,
        user_id, username, user_label, user_role,
        summary, before_json, after_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      String(action || 'update'),
      String(targetType || 'unknown'),
      targetId !== null ? String(targetId) : null,
      String(targetLabel || ''),
      provinceCode ? String(provinceCode) : (user?.province_code || null),
      provinceLabel ? String(provinceLabel) : (user?.province_label || ''),
      districtName ? String(districtName) : (user?.district_name || null),
      user?.id ? Number(user.id) : null,
      String(user?.username || user?.province_code || 'system'),
      String(user?.province_label || user?.username || ''),
      String(user?.role || 'user'),
      String(summary || ''),
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
    ).run();
  } catch (err) {
    console.error('Failed to record system audit log:', err);
  }
}

