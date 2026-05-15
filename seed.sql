-- ตัวอย่างการตั้งรหัสผ่านสำหรับทดสอบ (PIN: 1234)
-- นครปฐม
INSERT INTO users (province_code, province_label, pin_hash, role)
VALUES ('nakhon_pathom', 'นครปฐม', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province')
ON CONFLICT(province_code) DO UPDATE SET pin_hash = excluded.pin_hash;

-- ราชบุรี
INSERT INTO users (province_code, province_label, pin_hash, role)
VALUES ('ratchaburi', 'ราชบุรี', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province')
ON CONFLICT(province_code) DO UPDATE SET pin_hash = excluded.pin_hash;

-- สมุทรสาคร
INSERT INTO users (province_code, province_label, pin_hash, role)
VALUES ('samut_sakhon', 'สมุทรสาคร', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province')
ON CONFLICT(province_code) DO UPDATE SET pin_hash = excluded.pin_hash;

-- สมุทรสงคราม
INSERT INTO users (province_code, province_label, pin_hash, role)
VALUES ('samut_songkhram', 'สมุทรสงคราม', 'f7d5151bda88c2ba61d3519f89dd69874fef4e9f01935767f5815c7f217a1b67', 'province')
ON CONFLICT(province_code) DO UPDATE SET pin_hash = excluded.pin_hash;
