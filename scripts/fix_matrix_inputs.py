with open('public/challenge.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace matrix input HTML
old_input = '''          <input 
            type="number" 
            min="0" 
            max="100" 
            step="1"
            class="matrix-input ${val ? 'has-val' : ''}" 
            data-bunch="${b}" 
            data-month="${m}" 
            value="${val}" 
            placeholder="-"
            oninput="window.chalOnMatrixInput(this)"
          />'''

new_input = '''          <input 
            type="text" 
            inputmode="numeric"
            pattern="[0-9]*"
            class="matrix-input ${val ? 'has-val' : ''}" 
            data-bunch="${b}" 
            data-month="${m}" 
            value="${val}" 
            placeholder="-"
            autocomplete="off"
            onfocus="this.select()"
            oninput="window.chalOnMatrixInput(this)"
          />'''

if old_input in text:
    text = text.replace(old_input, new_input, 1)
    print('Replaced matrix input HTML')
else:
    # Try normalized / CRLF
    old_input_crlf = old_input.replace('\n', '\r\n')
    if old_input_crlf in text:
        text = text.replace(old_input_crlf, new_input.replace('\n', '\r\n'), 1)
        print('Replaced matrix input HTML with CRLF')
    else:
        print('Warning: old_input not found')

# 2. Update chalOnMatrixInput
old_fn = '''window.chalOnMatrixInput = (input) => {
  const bunch = Number(input.dataset.bunch);
  const month = Number(input.dataset.month);
  const val = Number(input.value) || 0;

  input.classList.toggle('has-val', val > 0);

  // Recalculate row sum (month)
  let rowSum = 0;
  document.querySelectorAll(`.matrix-input[data-month="${month}"]`).forEach((inp) => {
    rowSum += Number(inp.value) || 0;
  });
  const mSumEl = cel(`mSum_${month}`);
  if (mSumEl) mSumEl.textContent = rowSum > 0 ? rowSum.toLocaleString() : '-';

  // Recalculate col sum (bunch)
  let colSum = 0;
  document.querySelectorAll(`.matrix-input[data-bunch="${bunch}"]`).forEach((inp) => {
    colSum += Number(inp.value) || 0;
  });
  const bSumEl = cel(`bSum_${bunch}`);
  if (bSumEl) bSumEl.textContent = colSum > 0 ? colSum : '-';

  // Recalculate grand total
  let total = 0;
  document.querySelectorAll('.matrix-input').forEach((inp) => {
    total += Number(inp.value) || 0;
  });
  const grandEl = cel('chalMatrixGrandTotal');
  if (grandEl) grandEl.textContent = total.toLocaleString();

  // Update KPI card
  const treeTotalValEl = cel('chalTreeTotalVal');
  if (treeTotalValEl) treeTotalValEl.textContent = `${total.toLocaleString()} ผล/ปี`;
};'''

new_fn = '''window.chalOnMatrixInput = (input) => {
  input.value = input.value.replace(/[^0-9]/g, '');
  const val = Number(input.value) || 0;

  input.classList.toggle('has-val', val > 0);

  const bunch = Number(input.dataset.bunch);
  const month = Number(input.dataset.month);

  // Recalculate row sum (month)
  let rowSum = 0;
  document.querySelectorAll(`.matrix-input[data-month="${month}"]`).forEach((inp) => {
    rowSum += Number(inp.value) || 0;
  });
  const mSumEl = cel(`mSum_${month}`);
  if (mSumEl) mSumEl.textContent = rowSum > 0 ? rowSum.toLocaleString() : '-';

  // Recalculate col sum (bunch)
  let colSum = 0;
  document.querySelectorAll(`.matrix-input[data-bunch="${bunch}"]`).forEach((inp) => {
    colSum += Number(inp.value) || 0;
  });
  const bSumEl = cel(`bSum_${bunch}`);
  if (bSumEl) bSumEl.textContent = colSum > 0 ? colSum : '-';

  // Recalculate grand total and filled bunches
  let total = 0;
  let filledBunches = 0;
  for (let b = 1; b <= 20; b++) {
    let bTotal = 0;
    document.querySelectorAll(`.matrix-input[data-bunch="${b}"]`).forEach((inp) => {
      bTotal += Number(inp.value) || 0;
    });
    if (bTotal > 0) filledBunches++;
    total += bTotal;
  }

  const grandEl = cel('chalMatrixGrandTotal');
  if (grandEl) grandEl.textContent = total.toLocaleString();

  // Update KPI card
  const treeTotalValEl = cel('chalTreeTotalVal');
  if (treeTotalValEl) treeTotalValEl.textContent = `${total.toLocaleString()} ผล/ปี`;

  const avgBunchEl = cel('chalTreeAvgBunchVal');
  if (avgBunchEl) {
    avgBunchEl.textContent = total > 0 ? `${(total / 20).toFixed(1)} ผล/ทะลาย` : '-';
  }

  // Update estimated plot yield
  const plot = chalState.plots.find((p) => p.id === chalState.selectedPlotId);
  const treesPerRai = plot ? (plot.trees_per_rai || 35) : 35;
  const prodArea = plot ? (plot.productive_area_rai || 1) : 1;
  const estPlotTotal = Math.round(total * treesPerRai * prodArea);
  const plotEstEl = cel('chalPlotEstimatedYield');
  if (plotEstEl) {
    plotEstEl.textContent = `${estPlotTotal.toLocaleString()} ผล/แปลง/ปี`;
  }

  // Update monthly forecast chart
  updateLiveMonthlyChart();
};

function updateLiveMonthlyChart() {
  const monthlyTotals = [];
  for (let m = 1; m <= 12; m++) {
    let mSum = 0;
    document.querySelectorAll(`.matrix-input[data-month="${m}"]`).forEach((inp) => {
      mSum += Number(inp.value) || 0;
    });
    monthlyTotals.push(mSum);
  }
  const maxMonth = Math.max(...monthlyTotals, 1);
  const chartEl = cel('chalMonthlyBarChart');
  if (!chartEl) return;

  chartEl.innerHTML = monthlyTotals.map((val, idx) => {
    const pct = Math.round((val / maxMonth) * 100);
    return `
      <div class="mini-bar-col">
        <span class="mini-bar-val">${val > 0 ? val.toLocaleString() : ''}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="height: ${pct}%;"></div>
        </div>
        <span class="mini-bar-label">${MONTH_NAMES[idx]}</span>
      </div>
    `;
  }).join('');
}'''

if old_fn in text:
    text = text.replace(old_fn, new_fn, 1)
    print('Replaced chalOnMatrixInput')
else:
    old_fn_crlf = old_fn.replace('\n', '\r\n')
    if old_fn_crlf in text:
        text = text.replace(old_fn_crlf, new_fn.replace('\n', '\r\n'), 1)
        print('Replaced chalOnMatrixInput with CRLF')
    else:
        print('Warning: old_fn not found')

with open('public/challenge.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Updated challenge.js successfully')
