const state = {
  selectedSku: "",
  selectedPeriod: "recent",
  currentData: null,
  initialPriceTest: null,
};

const elements = {
  metaLine: document.querySelector("#metaLine"),
  skuSearch: document.querySelector("#skuSearch"),
  skuSelect: document.querySelector("#skuSelect"),
  productImage: document.querySelector("#productImage"),
  skuCode: document.querySelector("#skuCode"),
  productTitle: document.querySelector("#productTitle"),
  productMeta: document.querySelector("#productMeta"),
  kpiGrid: document.querySelector("#kpiGrid"),
  periodTabs: document.querySelector("#periodTabs"),
  periodLabel: document.querySelector("#periodLabel"),
  platformRows: document.querySelector("#platformRows"),
  priceInput: document.querySelector("#priceInput"),
  cogsInput: document.querySelector("#cogsInput"),
  freightInput: document.querySelector("#freightInput"),
  resetPrice: document.querySelector("#resetPrice"),
  testProfit: document.querySelector("#testProfit"),
  testMargin: document.querySelector("#testMargin"),
  priceChart: document.querySelector("#priceChart"),
  monthChart: document.querySelector("#monthChart"),
};

function currency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value);
}

function number(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function percent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function loadSkus(query = "") {
  const payload = await getJson(`/api/skus?q=${encodeURIComponent(query)}`);
  elements.skuSelect.innerHTML = payload.items.map((item) => (
    `<option value="${escapeHtml(item.sku)}">${escapeHtml(item.label)}</option>`
  )).join("");
  if (!state.selectedSku && payload.items.length) {
    state.selectedSku = payload.items[0].sku;
    elements.skuSelect.value = state.selectedSku;
    await loadSku(state.selectedSku);
  }
}

async function loadSku(sku) {
  if (!sku) return;
  state.selectedSku = sku;
  const payload = await getJson(`/api/sku?sku=${encodeURIComponent(sku)}`);
  state.currentData = payload;
  state.initialPriceTest = { ...payload.priceTest };
  renderDashboard(payload);
}

function renderDashboard(payload) {
  const { snapshot, meta } = payload;
  elements.metaLine.textContent = `Last update ${meta.lastUpdate || "-"} · ${meta.skuCount} SKUs · ${meta.salesRows.toLocaleString("en-GB")} sales rows`;
  elements.productImage.src = snapshot.imageUrl || "";
  elements.productImage.style.display = snapshot.imageUrl ? "block" : "none";
  elements.skuCode.textContent = snapshot.sku || "";
  elements.productTitle.textContent = snapshot.title || snapshot.sku || "SKU";
  elements.productMeta.textContent = [snapshot.brand, snapshot.category, snapshot.subcategory].filter(Boolean).join(" · ");

  const lifetime = payload.periods.lifetime.summary;
  const kpis = [
    ["Grade Level", snapshot.grade],
    ["Est. Months To Sell", number(snapshot.estimatedMonthsToSell, 2)],
    ["Daily Avg Sales", number(snapshot.dailyAverageSales, 2)],
    ["SOH", number(snapshot.stockOnHand, 0)],
    ["COGS", currency(snapshot.cogs)],
    ["Last Arrival", snapshot.lastArrival || "-"],
    ["First Arrival", snapshot.firstArrival || "-"],
    ["Lifetime Qty", number(lifetime.qty, 0)],
    ["Lifetime Sales", currency(lifetime.sales)],
    ["Lifetime Profit", currency(lifetime.profit)],
    ["Lifetime PM", percent(lifetime.profitMargin)],
    ["Avg Unit Price", currency(lifetime.unitPrice)],
  ];
  elements.kpiGrid.innerHTML = kpis.map(([label, value]) => (
    `<article class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "-"))}</strong></article>`
  )).join("");

  fillPriceForm(payload.priceTest);
  renderPeriod();
  drawPriceChart(payload.priceHistory);
  drawMonthChart(payload.monthlyTrend);
}

function renderPeriod() {
  const period = state.currentData.periods[state.selectedPeriod];
  elements.periodLabel.textContent = period.label;
  elements.platformRows.innerHTML = period.platforms.map((row) => {
    const isTotal = row["platform name"] === "Grand Total";
    return `<tr class="${isTotal ? "total-row" : ""}">
      <td>${escapeHtml(row["platform name"] || "-")}</td>
      <td>${number(row.sku_qty)}</td>
      <td>${currency(row.sales_amt)}</td>
      <td>${percent(row.selling_fee_pct)}</td>
      <td>${percent(row.ads_fee_pct)}</td>
      <td>${percent(row.return_pct)}</td>
      <td class="${row.profit_incl_rn < 0 ? "bad" : "good"}">${currency(row.profit_incl_rn)}</td>
      <td class="${row.profit_margin < 0 ? "bad" : "good"}">${percent(row.profit_margin)}</td>
      <td>${currency(row.unit_price)}</td>
    </tr>`;
  }).join("");
}

function fillPriceForm(priceTest) {
  elements.priceInput.value = fixedInput(priceTest.price);
  elements.cogsInput.value = fixedInput(priceTest.cogs);
  elements.freightInput.value = fixedInput(priceTest.freight);
  renderPriceTest(priceTest);
}

function fixedInput(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? "" : Number(value).toFixed(2);
}

async function updatePriceTest() {
  const params = new URLSearchParams({
    price: elements.priceInput.value || "0",
    cogs: elements.cogsInput.value || "0",
    freight: elements.freightInput.value || "0",
  });
  const payload = await getJson(`/api/price-test?${params}`);
  renderPriceTest(payload);
}

function renderPriceTest(payload) {
  elements.testProfit.textContent = currency(payload.profit);
  elements.testProfit.className = payload.profit < 0 ? "bad" : "good";
  elements.testMargin.textContent = percent(payload.margin);
  elements.testMargin.className = payload.margin < 0 ? "bad" : "good";
}

function drawPriceChart(points) {
  const canvas = elements.priceChart;
  const ctx = canvas.getContext("2d");
  setupCanvas(canvas, ctx);
  drawAxes(ctx, canvas);
  if (!points || !points.length) {
    drawEmpty(ctx, canvas, "No price history");
    return;
  }
  const labels = points.map((p) => p.label);
  const stock = points.map((p) => Number(p.stock || 0));
  const price = points.map((p) => Number(p.price || 0));
  drawLine(ctx, canvas, stock, "#0f766e", 0.18);
  drawLine(ctx, canvas, price, "#b45309", 0.72);
  drawChartLabels(ctx, canvas, labels);
  drawLegend(ctx, [["Stock", "#0f766e"], ["Price", "#b45309"]]);
}

function drawMonthChart(points) {
  const canvas = elements.monthChart;
  const ctx = canvas.getContext("2d");
  setupCanvas(canvas, ctx);
  drawAxes(ctx, canvas);
  if (!points || !points.length) {
    drawEmpty(ctx, canvas, "No monthly sales");
    return;
  }
  const labels = points.map((p) => p.month);
  const qty = points.map((p) => Number(p.qty || 0));
  const margin = points.map((p) => Number(p.profitMargin || 0) * 100);
  drawBars(ctx, canvas, qty, "#0f766e");
  drawLine(ctx, canvas, margin, "#7c3aed", 0.72);
  drawChartLabels(ctx, canvas, labels);
  drawLegend(ctx, [["Qty", "#0f766e"], ["PM %", "#7c3aed"]]);
}

function setupCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = canvas.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.font = "12px Segoe UI, Arial";
}

function chartArea(canvas) {
  const rect = canvas.getBoundingClientRect();
  return { left: 42, top: 18, right: rect.width - 16, bottom: rect.height - 34, width: rect.width - 58, height: rect.height - 52 };
}

function drawAxes(ctx, canvas) {
  const area = chartArea(canvas);
  ctx.strokeStyle = "#dde3ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.bottom);
  ctx.lineTo(area.right, area.bottom);
  ctx.stroke();
}

function drawLine(ctx, canvas, values, color, scaleOffset = 0) {
  const area = chartArea(canvas);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = area.left + (index / Math.max(values.length - 1, 1)) * area.width;
    const y = area.bottom - ((value - min) / span) * area.height * 0.82 - area.height * scaleOffset;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBars(ctx, canvas, values, color) {
  const area = chartArea(canvas);
  const max = Math.max(...values, 1);
  const barWidth = Math.max(5, area.width / Math.max(values.length, 1) - 6);
  ctx.fillStyle = color;
  values.forEach((value, index) => {
    const x = area.left + index * (area.width / Math.max(values.length, 1)) + 3;
    const height = (value / max) * area.height * 0.82;
    ctx.fillRect(x, area.bottom - height, barWidth, height);
  });
}

function drawChartLabels(ctx, canvas, labels) {
  const area = chartArea(canvas);
  ctx.fillStyle = "#697386";
  const step = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((label, index) => {
    if (index % step !== 0 && index !== labels.length - 1) return;
    const x = area.left + (index / Math.max(labels.length - 1, 1)) * area.width;
    ctx.save();
    ctx.translate(x, area.bottom + 16);
    ctx.rotate(-0.35);
    ctx.fillText(String(label).slice(0, 10), 0, 0);
    ctx.restore();
  });
}

function drawLegend(ctx, items) {
  let x = 48;
  items.forEach(([label, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, 4, 10, 10);
    ctx.fillStyle = "#475569";
    ctx.fillText(label, x + 14, 13);
    x += 80;
  });
}

function drawEmpty(ctx, canvas, text) {
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = "#697386";
  ctx.fillText(text, rect.width / 2 - 42, rect.height / 2);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

let searchTimer;
elements.skuSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadSkus(elements.skuSearch.value), 250);
});

elements.skuSelect.addEventListener("change", () => loadSku(elements.skuSelect.value));

elements.periodTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-period]");
  if (!button) return;
  state.selectedPeriod = button.dataset.period;
  document.querySelectorAll("#periodTabs button").forEach((item) => item.classList.toggle("active", item === button));
  renderPeriod();
});

[elements.priceInput, elements.cogsInput, elements.freightInput].forEach((input) => {
  input.addEventListener("input", () => updatePriceTest());
});

elements.resetPrice.addEventListener("click", () => fillPriceForm(state.initialPriceTest));

window.addEventListener("resize", () => {
  if (!state.currentData) return;
  drawPriceChart(state.currentData.priceHistory);
  drawMonthChart(state.currentData.monthlyTrend);
});

loadSkus().catch((error) => {
  elements.metaLine.textContent = error.message;
});
