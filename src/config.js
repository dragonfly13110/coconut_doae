export const DATA_PROVINCES = [
  { code: 'nakhon_pathom', label: 'นครปฐม' },
  { code: 'ratchaburi', label: 'ราชบุรี' },
  { code: 'samut_sakhon', label: 'สมุทรสาคร' },
  { code: 'samut_songkhram', label: 'สมุทรสงคราม' },
];

export const LOGIN_ACCOUNTS = [
  { code: 'doae', label: 'กรมส่งเสริมการเกษตร', role: 'admin' },
  ...DATA_PROVINCES.map((province) => ({
    code: province.code,
    label: province.label,
    role: 'province',
  })),
];
