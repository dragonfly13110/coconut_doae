import assert from 'node:assert/strict';
import test from 'node:test';
import { SYSTEM_ACCOUNTS, canUserEditDistrict } from '../src/user-accounts.js';
import { onRequest as logsOnRequest } from '../functions/api/logs.js';

test('SYSTEM_ACCOUNTS contains exactly 23 districts across 4 provinces, 4 province accounts, region, central and admin', () => {
  const districtAccounts = SYSTEM_ACCOUNTS.filter((a) => a.role === 'district');
  assert.equal(districtAccounts.length, 23);

  // Ratchaburi (70): 10 districts
  const rbDistricts = districtAccounts.filter((a) => a.province_code === 'ratchaburi');
  assert.equal(rbDistricts.length, 10);
  assert.deepEqual(rbDistricts.map((d) => d.district_code), [
    '7001', '7002', '7003', '7004', '7005', '7006', '7007', '7008', '7009', '7010',
  ]);

  // Nakhon Pathom (73): 7 districts
  const npDistricts = districtAccounts.filter((a) => a.province_code === 'nakhon_pathom');
  assert.equal(npDistricts.length, 7);
  assert.deepEqual(npDistricts.map((d) => d.district_code), [
    '7301', '7302', '7303', '7304', '7305', '7306', '7307',
  ]);

  // Samut Sakhon (74): 3 districts
  const skDistricts = districtAccounts.filter((a) => a.province_code === 'samut_sakhon');
  assert.equal(skDistricts.length, 3);
  assert.deepEqual(skDistricts.map((d) => d.district_code), ['7401', '7402', '7403']);

  // Samut Songkhram (75): 3 districts
  const ssDistricts = districtAccounts.filter((a) => a.province_code === 'samut_songkhram');
  assert.equal(ssDistricts.length, 3);
  assert.deepEqual(ssDistricts.map((d) => d.district_code), ['7501', '7502', '7503']);

  // Region, Central, Admin
  assert(SYSTEM_ACCOUNTS.some((a) => a.username === 'region2' && a.role === 'region'));
  assert(SYSTEM_ACCOUNTS.some((a) => a.username === 'doae_hq' && a.role === 'central'));
  assert(SYSTEM_ACCOUNTS.some((a) => a.username === 'admin' && a.role === 'admin'));
});

test('canUserEditDistrict enforces strict hierarchical permissions', () => {
  const districtOfficer7004 = {
    username: '7004',
    role: 'district',
    province_code: 'ratchaburi',
    district_code: '7004',
    district_name: 'ดำเนินสะดวก',
  };

  // 1. District officer CAN edit plots in their own district
  assert.equal(canUserEditDistrict(districtOfficer7004, 'ratchaburi', 'ดำเนินสะดวก'), true);
  assert.equal(canUserEditDistrict(districtOfficer7004, 'ratchaburi', 'อำเภอดำเนินสะดวก'), true);

  // 2. District officer CANNOT edit other districts in the same province
  assert.equal(canUserEditDistrict(districtOfficer7004, 'ratchaburi', 'เมืองราชบุรี'), false);
  assert.equal(canUserEditDistrict(districtOfficer7004, 'ratchaburi', 'บ้านโป่ง'), false);

  // 3. District officer CANNOT edit other provinces
  assert.equal(canUserEditDistrict(districtOfficer7004, 'nakhon_pathom', 'สามพราน'), false);

  // 4. Province officer CAN edit ANY district in their province, but NOT other provinces
  const provOfficer70 = { username: 'prov70', role: 'province', province_code: 'ratchaburi' };
  assert.equal(canUserEditDistrict(provOfficer70, 'ratchaburi', 'ดำเนินสะดวก'), true);
  assert.equal(canUserEditDistrict(provOfficer70, 'ratchaburi', 'เมืองราชบุรี'), true);
  assert.equal(canUserEditDistrict(provOfficer70, 'nakhon_pathom', 'สามพราน'), false);

  // 5. Region, Central, and Admin CAN edit ALL provinces and ALL districts
  const regionUser = { username: 'region2', role: 'region' };
  const centralUser = { username: 'doae_hq', role: 'central' };
  const adminUser = { username: 'admin', role: 'admin' };

  for (const superUser of [regionUser, centralUser, adminUser]) {
    assert.equal(canUserEditDistrict(superUser, 'ratchaburi', 'ดำเนินสะดวก'), true);
    assert.equal(canUserEditDistrict(superUser, 'nakhon_pathom', 'สามพราน'), true);
    assert.equal(canUserEditDistrict(superUser, 'samut_sakhon', 'บ้านแพ้ว'), true);
    assert.equal(canUserEditDistrict(superUser, 'samut_songkhram', 'อัมพวา'), true);
  }
});

