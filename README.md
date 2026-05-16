# 🥥 COCONUT DOAE

ระบบติดตามและประเมินคุณภาพมะพร้าวน้ำหอม สำหรับ 4 จังหวัดเป้าหมาย ได้แก่

- นครปฐม
- ราชบุรี
- สมุทรสาคร
- สมุทรสงคราม

ระบบนี้พัฒนาเป็นเว็บแอปบน **Cloudflare Pages** และใช้ **Cloudflare D1** เป็นฐานข้อมูลหลัก

---

## ภาพรวมระบบ

ระบบใช้สำหรับบันทึกข้อมูลคุณภาพมะพร้าวน้ำหอมตามรอบการประเมิน โดยโครงสร้างข้อมูลหลักคือ

```text
6 รอบการประเมิน × 4 จังหวัด × 10 แปลง × 2 ทะลาย = 480 รายการข้อมูล
```

ข้อมูลที่บันทึกต่อ 1 รายการ ได้แก่

- รอบการประเมิน
- จังหวัด
- แปลงที่
- ทะลายที่
- จำนวนผลคุณภาพ
- จำนวนผลตกเกรด
- จำนวนผลเสียหาย
- น้ำหนักเฉลี่ย
- เส้นรอบวงเฉลี่ย
- หมายเหตุ
- วันเวลาที่บันทึก
- ผู้บันทึกข้อมูล

---

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Hosting | Cloudflare Pages |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 |
| Local/Deploy tool | Wrangler |
| Authentication | Province PIN + Session Cookie |

---

## โครงสร้างไฟล์สำคัญ

```text
coconut_doae/
├─ public/
│  ├─ index.html        # หน้าเว็บหลัก
│  ├─ app.js            # logic ฝั่ง frontend
│  └─ styles.css        # style ของระบบ
├─ functions/
│  └─ api/
│     ├─ login.js       # เข้าสู่ระบบด้วยจังหวัด + PIN
│     ├─ logout.js      # ออกจากระบบ
│     ├─ me.js          # ตรวจ session ปัจจุบัน
│     ├─ entry.js       # โหลด/บันทึกข้อมูลรายแปลง
│     └─ dashboard.js   # ดึงข้อมูลสรุป dashboard
├─ src/
│  ├─ auth.js           # hash PIN, session cookie, utility ด้าน auth
│  ├─ core.js           # config, validation, summary logic
│  └─ pages-api.js      # helper สำหรับ API response และ requireUser
├─ schema.sql           # โครงสร้างฐานข้อมูล D1
├─ seed.sql             # ข้อมูล user จังหวัดสำหรับทดสอบ
├─ wrangler.toml        # config Cloudflare Pages + D1
├─ package.json         # scripts สำหรับ dev/deploy
└─ README.md
```

---

## โครงสร้างฐานข้อมูล

ระบบใช้ตารางหลัก 3 ตาราง

| ตาราง | หน้าที่ |
|---|---|
| `users` | เก็บผู้ใช้ระดับจังหวัด, PIN hash และ role |
| `sessions` | เก็บ session หลัง login |
| `entries` | เก็บข้อมูลคุณภาพมะพร้าวรายรอบ/จังหวัด/แปลง/ทะลาย |

คีย์หลักของข้อมูลบันทึกคือ

```text
round + province_code + plot + bunch
```

หมายความว่า 1 จังหวัด ใน 1 รอบ 1 แปลง 1 ทะลาย จะมีข้อมูลได้ 1 ชุด หากบันทึกซ้ำ ระบบจะอัปเดตข้อมูลเดิมแทนการเพิ่มแถวใหม่

---

## การตั้งค่าระบบ

ค่าหลักของระบบอยู่ใน `src/core.js`

```javascript
export const CONFIG = {
  provinces: [
    { code: 'nakhon_pathom', label: 'Nakhon Pathom', pinLabel: 'NP' },
    { code: 'ratchaburi', label: 'Ratchaburi', pinLabel: 'RB' },
    { code: 'samut_sakhon', label: 'Samut Sakhon', pinLabel: 'SSK' },
    { code: 'samut_songkhram', label: 'Samut Songkhram', pinLabel: 'SSM' },
  ],
  maxPlots: 10,
  bunchesPerPlot: 2,
  totalRounds: 6,
  roundDays: 21,
  startDate: '2026-06-01',
};
```

ถ้าต้องการเปลี่ยนจำนวนรอบ จำนวนแปลง หรือวันที่เริ่มต้น ให้แก้จากส่วนนี้

---

## การติดตั้งเพื่อพัฒนาในเครื่อง

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. สร้างฐานข้อมูล D1

```bash
npx wrangler d1 create coconut_doae
```

จากนั้นนำ `database_id` ที่ได้ไปใส่ใน `wrangler.toml`

```toml
[[d1_databases]]
binding = "DB"
database_name = "coconut_doae"
database_id = "YOUR_DATABASE_ID"
```

### 3. สร้างตารางในฐานข้อมูล local

```bash
npx wrangler d1 execute coconut_doae --local --file=schema.sql
```

### 4. เพิ่ม user จังหวัดสำหรับทดสอบ

```bash
npx wrangler d1 execute coconut_doae --local --file=seed.sql
```

> ค่าใน `seed.sql` เป็นข้อมูลตั้งต้นสำหรับทดสอบเท่านั้น ควรเปลี่ยน PIN และ hash ใหม่ก่อนใช้งานจริง

### 5. รันระบบในเครื่อง

```bash
npm run dev
```

หรือรันตรงด้วยคำสั่ง

```bash
npx wrangler pages dev public --d1 DB=coconut_doae
```

---

## การ Deploy ขึ้น Cloudflare Pages

### 1. สร้างตารางใน D1 remote

```bash
npx wrangler d1 execute coconut_doae --remote --file=schema.sql
```

### 2. เพิ่ม user จังหวัดใน D1 remote

```bash
npx wrangler d1 execute coconut_doae --remote --file=seed.sql
```

### 3. Deploy ไปยัง Cloudflare Pages

```bash
npm run deploy
```

หรือรันตรงด้วยคำสั่ง

```bash
npx wrangler pages deploy public --project-name coconut-doae
```

---

## Environment Variables ที่ควรตั้งค่า

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `SESSION_SECRET` | ใช้เป็น secret สำหรับระบบ session/PIN hash fallback |
| `PIN_PEPPER` | ใช้เพิ่มความปลอดภัยในการ hash PIN |

ถ้าตั้งค่า `PIN_PEPPER` หรือ `SESSION_SECRET` แล้ว ต้องสร้าง `pin_hash` ใหม่ให้ตรงกับ secret ที่ใช้ ไม่เช่นนั้น PIN ใน `seed.sql` จะใช้เข้าสู่ระบบไม่ได้

---

## วิธีใช้งานระบบ

### 1. เข้าสู่ระบบ

เลือกจังหวัด แล้วกรอก PIN ของจังหวัดนั้น

หลัง login แล้ว ระบบจะจำ session ด้วย cookie แบบ `HttpOnly`, `Secure`, `SameSite=Lax`

### 2. บันทึกข้อมูล

ไปที่แท็บ **บันทึกข้อมูล** แล้วเลือก

1. รอบการประเมิน
2. จังหวัด
3. แปลงที่
4. ทะลายที่

จากนั้นกรอกข้อมูลจำนวนผลผลิต น้ำหนักเฉลี่ย เส้นรอบวงเฉลี่ย และหมายเหตุ แล้วกดบันทึก

### 3. ดู Dashboard

ไปที่แท็บ **แดชบอร์ด** ระบบจะแสดงข้อมูลสรุป เช่น

- ผลผลิตรวม
- อัตราคุณภาพ
- น้ำหนักเฉลี่ย
- เส้นรอบวงเฉลี่ย
- สรุปรายจังหวัด
- ตารางเปรียบเทียบจังหวัด
- จำนวนรายการที่บันทึกแล้วเทียบกับจำนวนรายการทั้งหมด

---

## API Routes

| Route | Method | หน้าที่ |
|---|---|---|
| `/api/login` | POST | เข้าสู่ระบบด้วยจังหวัดและ PIN |
| `/api/logout` | POST | ออกจากระบบ |
| `/api/me` | GET | ตรวจสอบผู้ใช้ปัจจุบัน |
| `/api/entry` | GET | โหลดข้อมูลรายการเดียว |
| `/api/entry` | POST | บันทึกหรืออัปเดตข้อมูลรายการเดียว |
| `/api/dashboard` | GET | โหลดข้อมูลสรุปสำหรับ dashboard |

---

## สิทธิ์การเข้าถึงข้อมูล

ระบบแยกสิทธิ์ตาม role ของผู้ใช้

| Role | สิทธิ์ |
|---|---|
| `province` | เห็นและบันทึกข้อมูลเฉพาะจังหวัดของตัวเอง |
| `admin` | เห็นข้อมูลทุกจังหวัด |

---

## หมายเหตุด้านความปลอดภัย

ก่อนใช้งานจริง ควรตรวจสอบรายการนี้

- เปลี่ยน PIN เริ่มต้นใน `seed.sql`
- ตั้งค่า `SESSION_SECRET`
- ตั้งค่า `PIN_PEPPER`
- ลบหรือปิดโค้ดสำหรับทดสอบที่ไม่ควรใช้บน production
- ตรวจสอบว่า D1 binding ใน Cloudflare Pages ชี้ฐานข้อมูลถูกตัว
- จำกัดสิทธิ์การเข้าถึง repo และ Cloudflare dashboard เฉพาะผู้ดูแลระบบ

---

## Troubleshooting

| ปัญหา | แนวทางแก้ |
|---|---|
| Login ไม่ได้ | ตรวจว่า seed user ถูกเพิ่มใน D1 แล้วหรือยัง |
| Login ไม่ได้หลังตั้ง `PIN_PEPPER` | ต้องสร้าง `pin_hash` ใหม่ให้ตรงกับ pepper |
| API ขึ้น unauthorized | session หมดอายุ หรือ cookie ไม่ถูกส่งไปกับ request |
| Dashboard ไม่มีข้อมูล | ยังไม่มีข้อมูลในตาราง `entries` หรือ user เห็นเฉพาะจังหวัดตัวเอง |
| Local dev หา DB ไม่เจอ | ตรวจคำสั่ง `--d1 DB=coconut_doae` และ `wrangler.toml` |
| Deploy แล้วข้อมูลไม่ตรง local | local D1 กับ remote D1 เป็นคนละฐาน ต้อง execute schema/seed แยกกัน |

---

## สถานะระบบ

ระบบปัจจุบันเป็นเว็บแอป Cloudflare Pages + D1 สำหรับบันทึกและติดตามข้อมูลคุณภาพมะพร้าวน้ำหอม 4 จังหวัด โดยไม่ใช้ Google Apps Script แล้ว
