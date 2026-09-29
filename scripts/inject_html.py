import os

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nav_bar = '''
  <div class="mode-navigation-bar" id="modeNavBar" hidden>
    <div class="mode-navigation-inner">
      <span class="mode-switch-title">เลือกโหมดการทำงาน:</span>
      <div class="mode-switcher-pill">
        <button type="button" id="btnModeQuality" class="mode-btn active" data-mode="quality">
          <span class="mode-icon">📊</span>
          <span class="mode-info">
            <span class="mode-name">โหมดติดตามคุณภาพ 6 รอบ</span>
            <span class="mode-desc">ประเมินคุณภาพ & ขนาด 4 เกรด (เดิม)</span>
          </span>
        </button>
        <button type="button" id="btnModeChallenge" class="mode-btn" data-mode="challenge">
          <span class="mode-icon">🌴</span>
          <span class="mode-info">
            <span class="mode-name">โหมดข้อมูลแปลงและการคาดการณ์ผลผลิต</span>
            <span class="mode-desc">ชุดข้อมูล Challenge (4 Sheet / สถิติ 2569)</span>
          </span>
          <span class="badge-new-mode">โหมดใหม่</span>
        </button>
      </div>
    </div>
  </div>
'''

challenge_workspace = '''
    <!-- CHALLENGE / NEW MODE WORKSPACE -->
    <section id="appViewChallenge" class="workspace" hidden>
      <nav class="tabs" aria-label="เมนูระบบข้อมูลแปลง">
        <button class="tab active" data-chal-tab="farmers">📋 ข้อมูลแปลง & เกษตรกร (Sheet 1)</button>
        <button class="tab" data-chal-tab="forecast">🎯 คาดการณ์ผลผลิต 20 ทะลาย (Sheet 2)</button>
        <button class="tab" data-chal-tab="harvest">🥥 ผลผลิตในรอบการตัด (Sheet 3)</button>
        <button class="tab" data-chal-tab="macro">🗺️ สถิติพื้นที่ & ผลผลิต 2569 (Sheet 4)</button>
        <button class="tab" data-chal-tab="dashboard">📈 ภาพรวม & วิเคราะห์</button>
        <button class="tab" data-chal-tab="io">📥 นำเข้า / ส่งออก Excel</button>
      </nav>

      <!-- Tab 1: Farmers & Plots (Sheet 1) -->
      <section id="chalTab_farmers" class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Sheet 1: ข้อมูลทั่วไป (เก็บ 1 ครั้ง)</p>
            <h2>ทะเบียนแปลงและข้อมูลเกษตรกร</h2>
          </div>
          <div class="dashboard-actions" style="display:flex; gap:10px;">
            <select id="chalProvFilter" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px;">
              <option value="all">ทุกจังหวัดเป้าหมาย</option>
              <option value="ratchaburi">ราชบุรี</option>
              <option value="nakhon_pathom">นครปฐม</option>
              <option value="samut_sakhon">สมุทรสาคร</option>
              <option value="samut_songkhram">สมุทรสงคราม</option>
            </select>
            <button id="chalBtnNewPlot" class="button primary">+ เพิ่มแปลงเกษตรกรใหม่</button>
          </div>
        </div>

        <div id="chalFarmerKpis" class="chal-kpi-grid"></div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px;">ลำดับ</th>
                <th>แปลง</th>
                <th>ชื่อ - สกุล เกษตรกร</th>
                <th>จังหวัด</th>
                <th class="text-right">พื้นที่ปลูก (ไร่)</th>
                <th class="text-right">ให้ผลผลิต (ไร่)</th>
                <th class="text-right">อายุพืช</th>
                <th class="text-right">ต้น/ไร่</th>
                <th>พิกัดแปลง (Zone / X / Y)</th>
                <th>มาตรฐาน / ชุดดิน</th>
                <th class="text-center" style="width: 140px;">จัดการ</th>
              </tr>
            </thead>
            <tbody id="chalFarmersTableBody">
              <tr><td colspan="11" class="text-center py-4 text-muted">กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab 2: Yield Forecast (Sheet 2) -->
      <section id="chalTab_forecast" class="panel" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">Sheet 2: คาดการณ์ผลผลิต</p>
            <h2>การคาดการณ์ผลผลิตรายต้น ทะลาย และเดือนที่เก็บเกี่ยว</h2>
          </div>
          <div class="dashboard-actions">
            <button id="chalBtnSaveForecast" class="button primary">💾 บันทึกข้อมูลคาดการณ์</button>
            <button id="chalBtnClearForecast" class="button ghost">ล้างตาราง</button>
          </div>
        </div>

        <!-- Plot and Tree Selectors -->
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-bottom:16px; background:#f9fbf9; padding:14px; border-radius:10px; border:1px solid #e1ebe5;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="chalForecastPlotSelect" style="font-weight:700; font-size:13px; color:var(--ink);">เลือกแปลงเกษตรกร:</label>
            <select id="chalForecastPlotSelect" style="padding:8px 12px; border-radius:6px; border:1px solid #ccc; font-weight:600; min-width:260px;"></select>
          </div>
        </div>

        <!-- 5 Trees Selector -->
        <div class="tree-tabs-bar" id="chalTreeTabs"></div>

        <!-- Summary KPIs for Selected Tree -->
        <div class="chal-kpi-grid" style="margin-bottom:16px;">
          <div class="kpi-card highlight">
            <div class="kpi-icon">🌴</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลผลิตคาดการณ์ต้นนี้ (ทั้งปี)</span>
              <strong class="kpi-val" id="chalTreeTotalVal">0 ผล/ปี</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🥥</div>
            <div class="kpi-body">
              <span class="kpi-title">เฉลี่ยต่อทะลาย (20 ทะลาย)</span>
              <strong class="kpi-val" id="chalTreeAvgBunchVal">-</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🚜</div>
            <div class="kpi-body">
              <span class="kpi-title">ประมาณการผลผลิตทั้งแปลง</span>
              <strong class="kpi-val" id="chalPlotEstimatedYield">0 ผล/แปลง/ปี</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📍</div>
            <div class="kpi-body">
              <span class="kpi-title">จุดตรวจที่บันทึกข้อมูลแล้ว</span>
              <strong class="kpi-val" id="chalActiveTreesVal">0 จาก 5 จุด</strong>
            </div>
          </div>
        </div>

        <!-- Forecast Matrix: 20 Bunches x 12 Months -->
        <div class="matrix-table-wrap" id="chalMatrixTableWrap">
          <p class="text-center py-4 text-muted">กำลังสร้างตารางเมทริกซ์ 20 ทะลาย...</p>
        </div>

        <!-- Monthly Forecast Distribution Bar Chart -->
        <div style="margin-top:20px;">
          <h4 style="font-size:14px; margin-bottom:8px; color:var(--primary-strong);">📊 แนวโน้มผลผลิตคาดการณ์รายเดือน (ลูก/เดือน):</h4>
          <div class="monthly-bar-chart" id="chalMonthlyBarChart"></div>
        </div>
      </section>

      <!-- Tab 3: Harvest Cuts (Sheet 3) -->
      <section id="chalTab_harvest" class="panel" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">Sheet 3: ผลผลิตในรอบการตัด</p>
            <h2>บันทึกข้อมูลผลผลิตรอบการตัดจริง</h2>
          </div>
        </div>

        <!-- Add Harvest Cut Form -->
        <form id="chalHarvestForm" class="panel" style="background:#f4faf6; border:1px solid #cce8d9; margin-bottom:24px; padding:18px;">
          <h3 style="font-size:15px; margin-bottom:14px; color:var(--primary-strong); display:flex; align-items:center; gap:8px;">
            📝 บันทึกข้อมูลรอบตัดใหม่
          </h3>
          <div class="form-grid-3">
            <label>
              แปลงเกษตรกร:
              <select id="chalHarvestPlotSelect" required style="padding:8px;"></select>
            </label>
            <label>
              รอบการตัดที่:
              <input id="chalCutRound" type="number" min="1" step="1" value="1" required style="padding:8px;" />
            </label>
            <label>
              วัน/เดือนที่ตัด:
              <input id="chalCutDate" type="date" required style="padding:8px;" />
            </label>
          </div>
          <div class="form-grid-3" style="margin-top:12px;">
            <label>
              ผลผลิตรวม (ผล):
              <input id="chalCutTotalYield" type="number" min="0" step="1" placeholder="เช่น 2400" required style="padding:8px; font-weight:bold;" />
            </label>
            <label>
              ผลผลิตเฉลี่ยต่อไร่ (ผล/ไร่):
              <input id="chalCutYieldPerRai" type="number" min="0" step="0.1" placeholder="คำนวณอัตโนมัติหรือกรอกเอง" style="padding:8px;" />
            </label>
            <label>
              ราคาผลผลิต (บาท/ผล):
              <input id="chalCutPrice" type="number" min="0" step="0.1" placeholder="เช่น 16.5" style="padding:8px;" />
            </label>
          </div>
          <div class="form-grid-3" style="margin-top:12px;">
            <label>
              ปริมาณผลควบ (ผล) (ประมาณการณ์):
              <input id="chalCutTwin" type="number" min="0" step="1" value="0" style="padding:8px;" />
            </label>
            <label>
              ผลเสีย (ผล) (ประมาณการณ์):
              <input id="chalCutDamaged" type="number" min="0" step="1" value="0" style="padding:8px;" />
            </label>
            <label>
              หมายเหตุ / ข้อสังเกต:
              <input id="chalCutNotes" type="text" placeholder="เช่น สภาพผลผลิต ความสมบูรณ์" style="padding:8px;" />
            </label>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <button type="submit" class="button primary" style="padding:10px 24px;">➕ บันทึกข้อมูลรอบตัด</button>
          </div>
        </form>

        <!-- KPI summary -->
        <div class="chal-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">✂️</div>
            <div class="kpi-body">
              <span class="kpi-title">รอบการตัดที่บันทึก</span>
              <strong class="kpi-val" id="chalHarvestCountVal">0 รอบ</strong>
            </div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-icon">🥥</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลผลิตรวมสะสม</span>
              <strong class="kpi-val" id="chalHarvestYieldVal">0 ผล</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-body">
              <span class="kpi-title">มูลค่าประมาณการ</span>
              <strong class="kpi-val" id="chalHarvestRevenueVal">-</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">⚠️</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลเสียสะสม (%)</span>
              <strong class="kpi-val" id="chalHarvestDamageVal">0 ผล (0%)</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">👥</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลควบสะสม (%)</span>
              <strong class="kpi-val" id="chalHarvestTwinVal">0 ผล (0%)</strong>
            </div>
          </div>
        </div>

        <!-- Harvest cuts table -->
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50px;">รอบ</th>
                <th>แปลง</th>
                <th>เกษตรกร</th>
                <th>วันที่ตัด</th>
                <th class="text-right">ผลผลิตรวม (ผล)</th>
                <th class="text-right">ผลผลิต/ไร่</th>
                <th class="text-right">ราคา (บาท/ผล)</th>
                <th class="text-right">ผลควบ (ผล)</th>
                <th class="text-right">ผลเสีย (ผล)</th>
                <th class="text-right">มูลค่ารวม (บาท)</th>
                <th class="text-center" style="width:60px;">ลบ</th>
              </tr>
            </thead>
            <tbody id="chalHarvestTableBody">
              <tr><td colspan="11" class="text-center py-4 text-muted">กำลังโหลดข้อมูลรอบการตัด...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab 4: Macro District Stats 2569 (Sheet 4) -->
      <section id="chalTab_macro" class="panel" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">Sheet 4: ข้อมูลพื้นที่ ผลผลิต 69</p>
            <h2>มะพร้าวอ่อน : เนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ รายอำเภอ ปี 2569</h2>
          </div>
          <div class="dashboard-actions">
            <select id="chalMacroProvSelect" style="padding:8px 12px; border-radius:8px; border:1px solid var(--line); font-size:13px;">
              <option value="all">ภาคตะวันตก (ทุกจังหวัด)</option>
              <option value="ratchaburi">ราชบุรี (10 อำเภอ)</option>
              <option value="nakhon_pathom">นครปฐม (7 อำเภอ)</option>
              <option value="samut_songkhram">สมุทรสงคราม (3 อำเภอ)</option>
              <option value="samut_sakhon">สมุทรสาคร (3 อำเภอ)</option>
            </select>
          </div>
        </div>

        <!-- Macro KPI Summary -->
        <div class="chal-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">🌱</div>
            <div class="kpi-body">
              <span class="kpi-title">เนื้อที่ยืนต้นรวม (ณ 1 ม.ค. 69)</span>
              <strong class="kpi-val" id="chalMacroStandingVal">238,578 ไร่</strong>
            </div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-icon">🌴</div>
            <div class="kpi-body">
              <span class="kpi-title">เนื้อที่ให้ผลรวม</span>
              <strong class="kpi-val" id="chalMacroProductiveVal">190,001 ไร่</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🥥</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลผลิตรวมทางการ</span>
              <strong class="kpi-val" id="chalMacroTotalYieldVal">464,978,826 ผล</strong>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📈</div>
            <div class="kpi-body">
              <span class="kpi-title">ผลผลิตเฉลี่ยต่อไร่</span>
              <strong class="kpi-val" id="chalMacroAvgYieldVal">2,382 ผล/ไร่</strong>
            </div>
          </div>
        </div>

        <!-- Benchmark Comparator Section -->
        <div style="background:#f8faf8; padding:18px; border-radius:12px; border:1px solid #d5e5dc; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-size:15px; margin:0; color:var(--primary-strong);">🎯 เปรียบเทียบผลผลิตแปลงเกษตรกร vs ค่าเฉลี่ยทางการระดับอำเภอ/จังหวัด 2569</h3>
              <p style="font-size:12px; color:var(--muted); margin-top:2px;">นำผลผลิตคาดการณ์หรือรอบตัดจริงมาเทียบกับสถิติ 2569 เพื่อวัดศักยภาพแปลง</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <label for="chalBenchmarkPlotSelect" style="font-size:13px; font-weight:bold;">เลือกแปลง:</label>
              <select id="chalBenchmarkPlotSelect" style="padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-weight:600;"></select>
            </div>
          </div>
          <div id="chalBenchmarkResult"></div>
        </div>

        <!-- 28 Districts Table -->
        <div class="macro-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ภาค / จังหวัด / อำเภอ</th>
                <th class="text-right">เนื้อที่ยืนต้น (ไร่)</th>
                <th class="text-right">เนื้อที่ให้ผล (ไร่)</th>
                <th class="text-right">ผลผลิต (ผล)</th>
                <th class="text-right">ผลผลิตต่อไร่ (ผล)</th>
                <th class="text-center" style="width:140px;">สัดส่วนเทียบเคียง</th>
              </tr>
            </thead>
            <tbody id="chalMacroTableBody">
              <tr><td colspan="6" class="text-center py-4 text-muted">กำลังโหลดข้อมูลสถิติ 2569...</td></tr>
            </tbody>
          </table>
        </div>
        <p style="font-size:11px; color:var(--muted); margin-top:8px;">
          * หมายเหตุ: ปี 2565 - 2568 เป็นข้อมูลผ่านคณะทำงานพัฒนาคุณภาพข้อมูลปริมาณการผลิตสินค้าเกษตรด้านพืช ภาคตะวันตก, ปี 2569 เป็นข้อมูลคาดการณ์ระดับจังหวัด ณ เดือนสิงหาคม 2569
        </p>
      </section>

      <!-- Tab 5: Analytics Dashboard -->
      <section id="chalTab_dashboard" class="panel" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">วิเคราะห์ภาพรวมระบบข้อมูลแปลง</p>
            <h2>แดชบอร์ดสรุปผลการผลิตและการคาดการณ์</h2>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div class="visual-panel">
            <h3>🏅 สัดส่วนมาตรฐานการผลิตของแปลงในระบบ</h3>
            <div id="chalStandardBreakdown" style="margin-top:14px; display:flex; flex-direction:column; gap:10px;"></div>
          </div>
          <div class="visual-panel">
            <h3>🌱 ข้อมูลจำแนกตามชุดดิน (Soil Series)</h3>
            <div style="padding:14px; background:#f9fbf9; border-radius:8px; font-size:13px; color:#444; line-height:1.6;">
              <p>• <strong>ชุดดินดำเนินสะดวก (Ds):</strong> พื้นที่ดินตะกอนน้ำพาริมแม่น้ำแม่กลอง เหมาะสมสูงมากสำหรับมะพร้าวน้ำหอม</p>
              <p>• <strong>ชุดดินกำแพงแสน (Ks):</strong> ดินร่วนเหนียวปนทราย ให้ผลผลิตสม่ำเสมอ ธาตุอาหารสมบูรณ์</p>
              <p>• <strong>ชุดดินบางกอก (Bk):</strong> ดินเหนียวที่ราบลุ่มชายฝั่งทะเล มีความชื้นสูงและแร่ธาตุอุดมสมบูรณ์</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 6: Excel Import / Export -->
      <section id="chalTab_io" class="panel" hidden>
        <div class="section-head">
          <div>
            <p class="eyebrow">การเชื่อมต่อและนำเข้าส่งออกข้อมูล</p>
            <h2>นำเข้า / ส่งออก Excel (ชุดข้อมูลมะพร้าวน้ำหอม 4 Sheet)</h2>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <!-- Export Box -->
          <div class="visual-panel" style="padding:24px;">
            <div style="font-size:32px; margin-bottom:8px;">📤</div>
            <h3 style="font-size:16px; margin-bottom:6px;">ส่งออกข้อมูล Excel ครบทั้ง 4 Sheet</h3>
            <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">
              ดาวน์โหลดไฟล์ Excel (.xls / XML Spreadsheet) โครงสร้างตรงตามไฟล์ต้นฉบับ 100% ประกอบด้วย 4 Sheet: ข้อมูลทั่วไป, คาดการณ์ผลผลิต 20 ทะลาย, รอบการตัด, และสถิติ 2569
            </p>
            <a href="/api/challenge/export" class="button primary" style="display:inline-flex; align-items:center; gap:8px; text-decoration:none;">
              📥 ดาวน์โหลดไฟล์ Excel (ชุดข้อมูลมะพร้าวน้ำหอม)
            </a>
          </div>

          <!-- Import Box -->
          <div class="visual-panel" style="padding:24px;">
            <div style="font-size:32px; margin-bottom:8px;">📥</div>
            <h3 style="font-size:16px; margin-bottom:6px;">นำเข้าไฟล์ Excel เข้าระบบ</h3>
            <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">
              เลือกไฟล์ <code>ชุดข้อมูบเข้าระบบมะพร้าวน้ำหอม.xlsx</code> เพื่อนำเข้าข้อมูลแปลง คาดการณ์ และรอบตัดเข้าสู่ฐานข้อมูล D1
            </p>
            <label class="dropzone-box" style="display:block;">
              <span style="font-size:24px; display:block; margin-bottom:4px;">📁</span>
              <strong style="font-size:14px; color:var(--primary);">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</strong>
              <small style="display:block; color:var(--muted); margin-top:4px;">รองรับไฟล์ .xlsx / .xls</small>
              <input type="file" id="chalExcelFileInput" accept=".xlsx,.xls" style="display:none;" />
            </label>
            <p id="chalImportStatus" class="status" style="margin-top:10px;"></p>
            <div style="margin-top:16px; border-top:1px dashed #d5e5dc; padding-top:12px;">
              <button id="chalBtnSeedReset" class="button ghost small" type="button">🔄 โหลดข้อมูลตัวอย่างและสถิติ 2569 เริ่มต้น</button>
            </div>
          </div>
        </div>
      </section>
    </section>

    <!-- Modal Form: Add / Edit Farmer Plot (Sheet 1) -->
    <div id="chalPlotModal" class="modal-backdrop" hidden>
      <div class="modal-box">
        <div class="modal-head">
          <h3 id="chalPlotModalTitle" style="margin:0; font-size:17px; color:var(--primary-strong);">➕ เพิ่มแปลงและเกษตรกรใหม่ (Sheet 1)</h3>
          <button type="button" class="btn-icon" onclick="document.getElementById('chalPlotModal').hidden=true" style="font-size:18px;">✕</button>
        </div>
        <form id="chalPlotForm">
          <input type="hidden" id="chalPlotId" />
          
          <div class="form-grid-3">
            <label>
              จังหวัด:
              <select id="chalPlotProvince" required style="padding:8px;">
                <option value="ratchaburi">ราชบุรี</option>
                <option value="nakhon_pathom">นครปฐม</option>
                <option value="samut_sakhon">สมุทรสาคร</option>
                <option value="samut_songkhram">สมุทรสงคราม</option>
              </select>
            </label>
            <label>
              ลำดับที่:
              <input id="chalPlotFarmerNo" type="number" min="1" step="1" placeholder="1" style="padding:8px;" />
            </label>
            <label>
              ชื่อ/หมายเลขแปลง:
              <input id="chalPlotLabel" type="text" placeholder="เช่น แปลงที่ 1" required style="padding:8px; font-weight:bold;" />
            </label>
          </div>

          <div class="form-grid-3" style="margin-top:14px;">
            <label>
              ชื่อ - สกุล เกษตรกร:
              <input id="chalPlotFullName" type="text" placeholder="ระบุชื่อ - สกุล" required style="padding:8px;" />
            </label>
            <label>
              อายุ (ปี):
              <input id="chalPlotAge" type="number" min="15" max="100" placeholder="เช่น 45" style="padding:8px;" />
            </label>
            <label>
              เบอร์โทรศัพท์:
              <input id="chalPlotPhone" type="tel" placeholder="08x-xxx-xxxx" style="padding:8px;" />
            </label>
          </div>

          <label style="margin-top:14px; display:block;">
            ที่อยู่:
            <input id="chalPlotAddress" type="text" placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ" style="padding:8px;" />
          </label>

          <div class="form-grid-2" style="margin-top:14px;">
            <label>
              พื้นที่ปลูกมะพร้าว (ไร่):
              <input id="chalPlotTotalArea" type="number" min="0" step="0.1" placeholder="0.0" style="padding:8px;" />
            </label>
            <label>
              พื้นที่ให้ผลผลิต (ไร่):
              <input id="chalPlotProductiveArea" type="number" min="0" step="0.1" placeholder="0.0" style="padding:8px; font-weight:bold; color:var(--primary);" />
            </label>
          </div>

          <div class="form-grid-2" style="margin-top:14px;">
            <label>
              อายุพืช (ปี):
              <input id="chalPlotPlantAge" type="number" min="0" step="0.1" placeholder="เช่น 7.5" style="padding:8px;" />
            </label>
            <label>
              จำนวนต้น/ไร่:
              <input id="chalPlotTreesPerRai" type="number" min="0" step="1" placeholder="เช่น 35" style="padding:8px;" />
            </label>
          </div>

          <div class="form-grid-3" style="margin-top:14px;">
            <label>
              พิกัด Zone:
              <input id="chalPlotCoordZone" type="text" value="47P" style="padding:8px;" />
            </label>
            <label>
              พิกัด X (UTM Easting):
              <input id="chalPlotCoordX" type="number" step="any" placeholder="เช่น 605420" style="padding:8px;" />
            </label>
            <label>
              พิกัด Y (UTM Northing):
              <input id="chalPlotCoordY" type="number" step="any" placeholder="เช่น 1492310" style="padding:8px;" />
            </label>
          </div>

          <div class="form-grid-2" style="margin-top:14px;">
            <label>
              มาตรฐานการผลิต:
              <input id="chalPlotStandard" type="text" placeholder="เช่น GAP, เกษตรอินทรีย์, GI" value="GAP" style="padding:8px;" />
            </label>
            <label>
              ชุดดิน (Soil Series):
              <input id="chalPlotSoilSeries" type="text" placeholder="เช่น ชุดดินดำเนินสะดวก (Ds)" style="padding:8px;" />
            </label>
          </div>

          <div class="modal-actions">
            <button id="chalBtnCancelPlot" type="button" class="button ghost">ยกเลิก</button>
            <button type="submit" class="button primary">💾 บันทึกข้อมูลแปลง</button>
          </div>
        </form>
      </div>
    </div>
'''

if 'id="modeNavBar"' not in content:
    content = content.replace('</header>', '</header>' + nav_bar, 1)

if 'id="appViewChallenge"' not in content:
    content = content.replace('</main>', challenge_workspace + '\n  </main>', 1)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated public/index.html successfully')
