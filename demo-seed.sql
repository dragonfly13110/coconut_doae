-- Reset and populate the isolated demo database with synthetic records only.
DELETE FROM entry_photos;
DELETE FROM entry_audit_log;
DELETE FROM entries;
DELETE FROM yield_forecasts;
DELETE FROM harvest_cuts;
DELETE FROM farmer_plots;
DELETE FROM macro_district_stats;
DELETE FROM system_audit_logs;

WITH RECURSIVE
  rounds(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM rounds WHERE n < 6),
  plots(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM plots WHERE n < 10),
  bunches(n) AS (VALUES (1), (2)),
  provinces(code) AS (VALUES
    ('nakhon_pathom'), ('ratchaburi'), ('samut_sakhon'), ('samut_songkhram')
  )
INSERT OR REPLACE INTO entries (
  round, province_code, plot, bunch, quality, below, domestic, damaged,
  weight, circum, notes, recorded_at, recorded_by,
  price_standard, price_below, price_domestic, price_damaged
)
SELECT
  rounds.n,
  provinces.code,
  plots.n,
  bunches.n,
  10 + ((rounds.n + plots.n + bunches.n) % 8),
  5 + ((rounds.n + plots.n * 2 + bunches.n) % 6),
  3 + ((rounds.n * 2 + plots.n + bunches.n) % 5),
  1 + ((rounds.n + plots.n + bunches.n * 2) % 3),
  ROUND(1.7 + ((rounds.n + plots.n + bunches.n) % 6) * 0.05, 2),
  45 + ((rounds.n * 3 + plots.n * 2 + bunches.n) % 14),
  'ข้อมูลจำลองสำหรับสาธิต',
  datetime('2026-06-01', printf('+%d days', (rounds.n - 1) * 21 + plots.n)),
  NULL,
  25 + (plots.n % 4),
  20 + (plots.n % 3),
  16 + (plots.n % 2),
  5 + (plots.n % 2)
FROM rounds
CROSS JOIN plots
CROSS JOIN bunches
CROSS JOIN provinces;

INSERT INTO farmer_plots (
  province_code, farmer_no, plot_label, title, first_name, last_name, full_name,
  subdistrict, district, province_name, address, age, phone,
  total_area_rai, productive_area_rai, plant_age_years, trees_per_rai,
  coord_zone, coord_x, coord_y, production_standard, soil_series,
  production_cost_per_rai, avg_income_per_rai
) VALUES
  ('ratchaburi', 1, 'แปลงตัวอย่าง 1', '', 'เกษตรกรตัวอย่าง', 'ราชบุรี 01', 'เกษตรกรตัวอย่าง ราชบุรี 01', 'ดำเนินสะดวก', 'ดำเนินสะดวก', 'ราชบุรี', 'ข้อมูลจำลอง อำเภอดำเนินสะดวก จังหวัดราชบุรี', NULL, NULL, 15, 12, 7, 40, '47', 605420, 1492310, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 12500, 38000),
  ('ratchaburi', 2, 'แปลงตัวอย่าง 2', '', 'เกษตรกรตัวอย่าง', 'ราชบุรี 02', 'เกษตรกรตัวอย่าง ราชบุรี 02', 'บ้านโป่ง', 'บ้านโป่ง', 'ราชบุรี', 'ข้อมูลจำลอง อำเภอบ้านโป่ง จังหวัดราชบุรี', NULL, NULL, 12, 9, 8, 38, '47', 605800, 1492800, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 11800, 34500),
  ('ratchaburi', 3, 'แปลงตัวอย่าง 3', '', 'เกษตรกรตัวอย่าง', 'ราชบุรี 03', 'เกษตรกรตัวอย่าง ราชบุรี 03', 'เมืองราชบุรี', 'เมืองราชบุรี', 'ราชบุรี', 'ข้อมูลจำลอง อำเภอเมืองราชบุรี จังหวัดราชบุรี', NULL, NULL, 18, 14, 10, 42, '47', 604900, 1491800, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 13200, 42000),
  ('nakhon_pathom', 1, 'แปลงตัวอย่าง 1', '', 'เกษตรกรตัวอย่าง', 'นครปฐม 01', 'เกษตรกรตัวอย่าง นครปฐม 01', 'ศาลายา', 'พุทธมณฑล', 'นครปฐม', 'ข้อมูลจำลอง อำเภอพุทธมณฑล จังหวัดนครปฐม', NULL, NULL, 11, 8, 6, 40, '47', 632150, 1518420, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 12000, 36500),
  ('nakhon_pathom', 2, 'แปลงตัวอย่าง 2', '', 'เกษตรกรตัวอย่าง', 'นครปฐม 02', 'เกษตรกรตัวอย่าง นครปฐม 02', 'สามพราน', 'สามพราน', 'นครปฐม', 'ข้อมูลจำลอง อำเภอสามพราน จังหวัดนครปฐม', NULL, NULL, 14, 10, 9, 39, '47', 631700, 1517900, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 12800, 39000),
  ('nakhon_pathom', 3, 'แปลงตัวอย่าง 3', '', 'เกษตรกรตัวอย่าง', 'นครปฐม 03', 'เกษตรกรตัวอย่าง นครปฐม 03', 'นครชัยศรี', 'นครชัยศรี', 'นครปฐม', 'ข้อมูลจำลอง อำเภอนครชัยศรี จังหวัดนครปฐม', NULL, NULL, 10, 7, 5, 37, '47', 632800, 1518900, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 11500, 34000),
  ('samut_sakhon', 1, 'แปลงตัวอย่าง 1', '', 'เกษตรกรตัวอย่าง', 'สมุทรสาคร 01', 'เกษตรกรตัวอย่าง สมุทรสาคร 01', 'บ้านแพ้ว', 'บ้านแพ้ว', 'สมุทรสาคร', 'ข้อมูลจำลอง อำเภอบ้านแพ้ว จังหวัดสมุทรสาคร', NULL, NULL, 13, 10, 8, 41, '47', 633000, 1497000, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 12900, 40500),
  ('samut_sakhon', 2, 'แปลงตัวอย่าง 2', '', 'เกษตรกรตัวอย่าง', 'สมุทรสาคร 02', 'เกษตรกรตัวอย่าง สมุทรสาคร 02', 'กระทุ่มแบน', 'กระทุ่มแบน', 'สมุทรสาคร', 'ข้อมูลจำลอง อำเภอกระทุ่มแบน จังหวัดสมุทรสาคร', NULL, NULL, 9, 7, 7, 36, '47', 632500, 1497500, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 11000, 33000),
  ('samut_sakhon', 3, 'แปลงตัวอย่าง 3', '', 'เกษตรกรตัวอย่าง', 'สมุทรสาคร 03', 'เกษตรกรตัวอย่าง สมุทรสาคร 03', 'เมืองสมุทรสาคร', 'เมืองสมุทรสาคร', 'สมุทรสาคร', 'ข้อมูลจำลอง อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร', NULL, NULL, 16, 12, 11, 40, '47', 633500, 1496400, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 13500, 43000),
  ('samut_songkhram', 1, 'แปลงตัวอย่าง 1', '', 'เกษตรกรตัวอย่าง', 'สมุทรสงคราม 01', 'เกษตรกรตัวอย่าง สมุทรสงคราม 01', 'อัมพวา', 'อัมพวา', 'สมุทรสงคราม', 'ข้อมูลจำลอง อำเภออัมพวา จังหวัดสมุทรสงคราม', NULL, NULL, 12, 9, 8, 39, '47', 608000, 1483000, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 12200, 37000),
  ('samut_songkhram', 2, 'แปลงตัวอย่าง 2', '', 'เกษตรกรตัวอย่าง', 'สมุทรสงคราม 02', 'เกษตรกรตัวอย่าง สมุทรสงคราม 02', 'บางคนที', 'บางคนที', 'สมุทรสงคราม', 'ข้อมูลจำลอง อำเภอบางคนที จังหวัดสมุทรสงคราม', NULL, NULL, 10, 8, 6, 37, '47', 608500, 1483300, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 11700, 35000),
  ('samut_songkhram', 3, 'แปลงตัวอย่าง 3', '', 'เกษตรกรตัวอย่าง', 'สมุทรสงคราม 03', 'เกษตรกรตัวอย่าง สมุทรสงคราม 03', 'เมืองสมุทรสงคราม', 'เมืองสมุทรสงคราม', 'สมุทรสงคราม', 'ข้อมูลจำลอง อำเภอเมืองสมุทรสงคราม จังหวัดสมุทรสงคราม', NULL, NULL, 14, 11, 10, 42, '47', 607500, 1482500, 'ข้อมูลจำลอง', 'ชุดดินตัวอย่าง', 13100, 41500);

WITH RECURSIVE
  points(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM points WHERE n < 7),
  bunches(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM bunches WHERE n < 20),
  trees(tree_no, position) AS (VALUES (1, 'C'), (2, 'L'), (3, 'R'), (4, 'F'), (5, 'B'))
INSERT INTO yield_forecasts (
  plot_id, province_code, tree_no, tree_position, point_label, bunch_no,
  harvest_month, harvest_year, fruit_count
)
SELECT
  farmer_plots.id,
  farmer_plots.province_code,
  trees.tree_no,
  trees.position,
  'จุดที่ ' || points.n,
  bunches.n,
  ((bunches.n + trees.tree_no + points.n + farmer_plots.farmer_no - 2) % 12) + 1,
  2570,
  6 + ((farmer_plots.farmer_no * 3 + points.n + trees.tree_no * 2 + bunches.n) % 9)
FROM farmer_plots
CROSS JOIN points
CROSS JOIN trees
CROSS JOIN bunches;

WITH RECURSIVE cuts(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM cuts WHERE n < 6)
INSERT INTO harvest_cuts (
  plot_id, province_code, farmer_name, cut_round, cut_date, total_yield,
  yield_per_rai, trees_per_rai, yield_per_tree, price_per_fruit,
  twin_fruits, damaged_fruits, notes
)
SELECT
  farmer_plots.id,
  farmer_plots.province_code,
  farmer_plots.full_name,
  cuts.n,
  date('2026-01-01', printf('+%d days', (cuts.n - 1) * 21)),
  1400 + ((farmer_plots.id * 47 + cuts.n * 83) % 700),
  ROUND((1400 + ((farmer_plots.id * 47 + cuts.n * 83) % 700)) / farmer_plots.productive_area_rai, 1),
  farmer_plots.trees_per_rai,
  ROUND((1400 + ((farmer_plots.id * 47 + cuts.n * 83) % 700)) / (farmer_plots.productive_area_rai * farmer_plots.trees_per_rai), 1),
  ROUND(5.5 + ((farmer_plots.id + cuts.n) % 7) * 0.5, 2),
  20 + ((farmer_plots.id * 3 + cuts.n * 7) % 40),
  15 + ((farmer_plots.id * 5 + cuts.n * 11) % 45),
  'ข้อมูลจำลองสำหรับสาธิต'
FROM farmer_plots
CROSS JOIN cuts;

INSERT INTO macro_district_stats (
  region, province_code, province_name, district_name, year,
  standing_area_rai, productive_area_rai, total_yield_fruit,
  yield_per_productive_rai, is_total
) VALUES
  ('ภาคตะวันตก', 'ratchaburi', 'ราชบุรี', 'ดำเนินสะดวก', 2569, 28000, 22000, 55000000, 2500, 0),
  ('ภาคตะวันตก', 'ratchaburi', 'ราชบุรี', 'บ้านโป่ง', 2569, 23000, 17000, 36000000, 2117.6, 0),
  ('ภาคตะวันตก', 'ratchaburi', 'ราชบุรี', 'เมืองราชบุรี', 2569, 19000, 13000, 29000000, 2230.8, 0),
  ('ภาคตะวันตก', 'ratchaburi', 'ราชบุรี', 'รวมทั้งจังหวัด', 2569, 70000, 52000, 120000000, 2307.7, 1),
  ('ภาคตะวันตก', 'nakhon_pathom', 'นครปฐม', 'พุทธมณฑล', 2569, 5000, 4000, 9600000, 2400, 0),
  ('ภาคตะวันตก', 'nakhon_pathom', 'นครปฐม', 'สามพราน', 2569, 8000, 6000, 14400000, 2400, 0),
  ('ภาคตะวันตก', 'nakhon_pathom', 'นครปฐม', 'นครชัยศรี', 2569, 5000, 4000, 10000000, 2500, 0),
  ('ภาคตะวันตก', 'nakhon_pathom', 'นครปฐม', 'รวมทั้งจังหวัด', 2569, 18000, 14000, 34000000, 2428.6, 1),
  ('ภาคตะวันตก', 'samut_sakhon', 'สมุทรสาคร', 'บ้านแพ้ว', 2569, 8000, 7000, 18200000, 2600, 0),
  ('ภาคตะวันตก', 'samut_sakhon', 'สมุทรสาคร', 'กระทุ่มแบน', 2569, 6000, 5000, 13000000, 2600, 0),
  ('ภาคตะวันตก', 'samut_sakhon', 'สมุทรสาคร', 'เมืองสมุทรสาคร', 2569, 4000, 3000, 8400000, 2800, 0),
  ('ภาคตะวันตก', 'samut_sakhon', 'สมุทรสาคร', 'รวมทั้งจังหวัด', 2569, 18000, 15000, 39600000, 2640, 1),
  ('ภาคตะวันตก', 'samut_songkhram', 'สมุทรสงคราม', 'อัมพวา', 2569, 8000, 7000, 17500000, 2500, 0),
  ('ภาคตะวันตก', 'samut_songkhram', 'สมุทรสงคราม', 'บางคนที', 2569, 6000, 5000, 12000000, 2400, 0),
  ('ภาคตะวันตก', 'samut_songkhram', 'สมุทรสงคราม', 'เมืองสมุทรสงคราม', 2569, 4000, 3000, 7500000, 2500, 0),
  ('ภาคตะวันตก', 'samut_songkhram', 'สมุทรสงคราม', 'รวมทั้งจังหวัด', 2569, 18000, 15000, 37000000, 2466.7, 1),
  ('ภาคตะวันตก', 'western_region', 'ภาคตะวันตก', 'ภาพรวมภาคตะวันตก', 2569, 124000, 96000, 230600000, 2402.1, 1);
