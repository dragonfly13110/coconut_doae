-- Template สำหรับเพิ่มบัญชีส่วนกลาง
-- เปลี่ยน <PIN_HASH> เป็น hash ที่สร้างจาก scripts/hash-pin.mjs ก่อนนำไปรันจริง

INSERT INTO users (province_code, province_label, pin_hash, role)
VALUES ('doae', 'กรมส่งเสริมการเกษตร', '<PIN_HASH>', 'admin')
ON CONFLICT(province_code) DO UPDATE SET
  province_label = excluded.province_label,
  pin_hash = excluded.pin_hash,
  role = excluded.role;
