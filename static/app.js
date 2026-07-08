const state = {
  selectedSku: "",
  platformPeriods: ["recent", "year", "lifetime"],
  platformRanges: [],
  currentData: null,
  initialPriceTest: null,
  imageUrls: [],
  imageIndex: 0,
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
  platformGrid: document.querySelector("#platformGrid"),
  priceInput: document.querySelector("#priceInput"),
  cogsInput: document.querySelector("#cogsInput"),
  freightInput: document.querySelector("#freightInput"),
  commissionInput: document.querySelector("#commissionInput"),
  resetPrice: document.querySelector("#resetPrice"),
  testProfit: document.querySelector("#testProfit"),
  testMargin: document.querySelector("#testMargin"),
  priceHistoryRows: document.querySelector("#priceHistoryRows"),
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

function percentInput(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return (Number(value) * 100).toFixed(2);
}

function parsePercentInput(value) {
  const numeric = Number(value || 0);
  return numeric > 1 ? numeric / 100 : numeric;
}

async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error((payload && payload.error) || text.slice(0, 180) || "Request failed");
  }
  return payload;
}

async function loadSkus(query = "") {
  const payload = await getJson(`/api/skus?q=${encodeURIComponent(query)}`);
  const previousSku = state.selectedSku;
  elements.skuSelect.innerHTML = payload.items.map((item) => (
    `<option value="${escapeHtml(item.sku)}">${escapeHtml(item.sku)}</option>`
  )).join("");
  const skus = payload.items.map((item) => item.sku);
  if (previousSku && skus.includes(previousSku)) {
    elements.skuSelect.value = previousSku;
  }
  if (query.trim() && payload.items.length === 1 && payload.items[0].sku !== previousSku) {
    elements.skuSelect.value = payload.items[0].sku;
    await loadSku(payload.items[0].sku);
    return;
  }
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
  state.imageUrls = (snapshot.imageUrls && snapshot.imageUrls.length ? snapshot.imageUrls : [snapshot.imageUrl]).filter(Boolean);
  state.imageIndex = 0;
  showProductImage();
  elements.skuCode.textContent = snapshot.sku || "";
  elements.productTitle.textContent = snapshot.title || snapshot.sku || "SKU";
  elements.productMeta.textContent = [snapshot.brand, snapshot.category, snapshot.subcategory].filter(Boolean).join(" · ");

  const kpis = [
    ["Grade Level", snapshot.grade],
    ["Est. Months To Sell", number(snapshot.estimatedMonthsToSell, 2)],
    ["Daily Avg Sales", number(snapshot.dailyAverageSales, 2)],
    ["SOH", number(snapshot.stockOnHand, 0)],
    ["COGS", currency(snapshot.cogs)],
  ];
  elements.kpiGrid.innerHTML = kpis.map(([label, value]) => (
    `<article class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "-"))}</strong></article>`
  )).join("") + `<article class="kpi-card arrival-card">
    <span>Arrival Dates</span>
    <div class="arrival-lines">
      <div><em>First</em><strong>${escapeHtml(String(snapshot.firstArrival || "-"))}</strong></div>
      <div><em>Latest</em><strong>${escapeHtml(String(snapshot.lastArrival || "-"))}</strong></div>
    </div>
  </article>`;

  fillPriceForm(payload.priceTest);
  state.platformRanges = state.platformPeriods.map((periodKey) => dateRangeFromPeriod(payload.periods[periodKey]));
  renderPlatformPanels();
  renderPriceHistory(payload.priceHistory);
  drawMonthChart(payload.monthlyTrend);
}

function showProductImage() {
  const url = state.imageUrls[state.imageIndex];
  if (!url) {
    elements.productImage.removeAttribute("src");
    elements.productImage.style.display = "none";
    return;
  }
  elements.productImage.style.display = "block";
  elements.productImage.src = encodeURI(url);
}

function renderPlatformPanels() {
  const titles = ["Platform Performance 1", "Platform Performance 2", "Platform Performance 3"];
  elements.platformGrid.innerHTML = state.platformPeriods.map((periodKey, index) => {
    const range = state.platformRanges[index] || dateRangeFromPeriod(state.currentData.periods[periodKey]);
    const rows = filterSalesRows(range.start, range.end);
    const platforms = aggregateClientSales(rows);
    return `<div class="panel platform-panel" data-panel="${index}">
      <div class="panel-head">
        <h3>${titles[index]}</h3>
        <div class="tabs">
          ${periodButton(index, "recent", "Recent", periodKey)}
          ${periodButton(index, "year", "Year", periodKey)}
          ${periodButton(index, "lifetime", "Lifetime", periodKey)}
        </div>
      </div>
      <div class="date-range">
        <label>Start <input type="date" data-panel="${index}" data-date-role="start" value="${escapeHtml(range.start)}"></label>
        <label>End <input type="date" data-panel="${index}" data-date-role="end" value="${escapeHtml(range.end)}"></label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Qty</th>
              <th>Sales</th>
              <th>Selling Fee</th>
              <th>Ads Fee</th>
              <th>Ads %</th>
              <th>Return</th>
              <th>Profit</th>
              <th>PM</th>
              <th>Unit Price</th>
            </tr>
          </thead>
          <tbody>${platformRows(platforms)}</tbody>
        </table>
      </div>
    </div>`;
  }).join("");
}

function dateRangeFromPeriod(period) {
  if (!period || !period.label) return { start: "", end: "" };
  if (period.label === "Lifetime") {
    const dates = (state.currentData.salesRows || []).map((row) => row.date).filter(Boolean).sort();
    return { start: dates[0] || "", end: dates[dates.length - 1] || "" };
  }
  if (/^\d{4}$/.test(period.label)) {
    return { start: `${period.label}-01-01`, end: `${period.label}-12-31` };
  }
  const parts = period.label.split(" to ");
  return { start: parts[0] || "", end: parts[1] || "" };
}

function filterSalesRows(start, end) {
  return (state.currentData.salesRows || []).filter((row) => {
    if (!row.date) return false;
    return (!start || row.date >= start) && (!end || row.date <= end);
  });
}

function aggregateClientSales(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const platform = row.platform || "-";
    if (!grouped.has(platform)) {
      grouped.set(platform, {
        "platform name": platform,
        sku_qty: 0,
        sales_amt: 0,
        selling_fee: 0,
        ads_fee: 0,
        resend_amt: 0,
        refund_amt: 0,
        profit_incl_rn: 0,
      });
    }
    const item = grouped.get(platform);
    item.sku_qty += Number(row.sku_qty || 0);
    item.sales_amt += Number(row.sales_amt || 0);
    item.selling_fee += Number(row.selling_fee || 0);
    item.ads_fee += Number(row.ads_fee || 0);
    item.resend_amt += Number(row.resend_amt || 0);
    item.refund_amt += Number(row.refund_amt || 0);
    item.profit_incl_rn += Number(row.profit_incl_rn || 0);
  });
  const records = [...grouped.values()].sort((a, b) => b.sales_amt - a.sales_amt);
  const total = {
    "platform name": "Grand Total",
    sku_qty: records.reduce((sum, item) => sum + item.sku_qty, 0),
    sales_amt: records.reduce((sum, item) => sum + item.sales_amt, 0),
    selling_fee: records.reduce((sum, item) => sum + item.selling_fee, 0),
    ads_fee: records.reduce((sum, item) => sum + item.ads_fee, 0),
    resend_amt: records.reduce((sum, item) => sum + item.resend_amt, 0),
    refund_amt: records.reduce((sum, item) => sum + item.refund_amt, 0),
    profit_incl_rn: records.reduce((sum, item) => sum + item.profit_incl_rn, 0),
  };
  [...records, total].forEach((item) => {
    item.selling_fee_pct = item.sales_amt ? item.selling_fee / item.sales_amt : null;
    item.ads_fee_pct = item.sales_amt ? item.ads_fee / item.sales_amt : null;
    item.return_pct = item.sales_amt ? (item.refund_amt + item.resend_amt) / item.sales_amt : null;
    item.profit_margin = item.sales_amt ? item.profit_incl_rn / item.sales_amt : null;
    item.unit_price = item.sku_qty ? item.sales_amt / item.sku_qty * 1.2 : null;
  });
  return records.length ? [...records, total] : [];
}

function periodButton(index, key, label, activeKey) {
  return `<button data-panel="${index}" data-period="${key}" class="${key === activeKey ? "active" : ""}">${label}</button>`;
}

function platformRows(rows) {
  return rows.map((row) => {
    const isTotal = row["platform name"] === "Grand Total";
    return `<tr class="${isTotal ? "total-row" : ""}">
      <td>${escapeHtml(row["platform name"] || "-")}</td>
      <td>${number(row.sku_qty)}</td>
      <td>${currency(row.sales_amt)}</td>
      <td>${percent(row.selling_fee_pct)}</td>
      <td>${currency(row.ads_fee)}</td>
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
  elements.commissionInput.value = percentInput(priceTest.sellingCostRate);
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
    sellingCostRate: parsePercentInput(elements.commissionInput.value || "25"),
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

function renderPriceHistory(points) {
  if (!points || !points.length) {
    elements.priceHistoryRows.innerHTML = `<tr><td colspan="3">No price history</td></tr>`;
    return;
  }
  const descending = [...points].reverse();
  elements.priceHistoryRows.innerHTML = descending.map((point, index) => {
    const previous = descending[index + 1];
    const priceClass = valueChangeClass(point.price, previous && previous.price, true);
    const stockClass = valueChangeClass(point.stock, previous && previous.stock, false);
    return `<tr>
      <td>${escapeHtml(String(point.label || "-"))}</td>
      <td class="${stockClass}">${number(point.stock)}</td>
      <td class="${priceClass}">${currency(point.price)}</td>
    </tr>`;
  }).join("");
}

function valueChangeClass(current, previous, redWhenDown) {
  if (current === null || current === undefined || previous === null || previous === undefined) return "";
  const now = Number(current);
  const before = Number(previous);
  if (Number.isNaN(now) || Number.isNaN(before) || now === before) return "";
  if (now > before) return "good";
  return redWhenDown ? "bad" : "";
}

function drawMonthChart(points) {
  if (!points || !points.length) {
    drawEmptyChart(elements.monthChart, "No monthly sales");
    return;
  }
  const canvas = elements.monthChart;
  const ctx = setupChart(canvas);
  const rect = canvas.getBoundingClientRect();
  const area = { left: 48, top: 26, right: rect.width - 24, bottom: rect.height - 46 };
  const ordered = [...points].slice(-12);
  const maxQty = Math.max(...ordered.map((row) => Number(row.qty || 0)), 1);
  const pmValues = ordered.map((row) => Number(row.profitMargin || 0) * 100);
  const minPm = Math.min(...pmValues, 0);
  const maxPm = Math.max(...pmValues, 1);
  const pmSpan = maxPm - minPm || 1;
  const step = (area.right - area.left) / Math.max(ordered.length, 1);
  const barWidth = Math.max(14, step * 0.48);

  ctx.strokeStyle = "#dde3ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.bottom);
  ctx.lineTo(area.right, area.bottom);
  ctx.stroke();

  ctx.fillStyle = "#0f766e";
  ordered.forEach((row, index) => {
    const x = area.left + index * step + (step - barWidth) / 2;
    const height = (Number(row.qty || 0) / maxQty) * (area.bottom - area.top);
    const y = area.bottom - height;
    ctx.fillRect(x, y, barWidth, height);
    ctx.fillStyle = "#17202a";
    ctx.textAlign = "center";
    ctx.fillText(number(row.qty), x + barWidth / 2, Math.max(area.top + 10, y - 5));
    ctx.fillStyle = "#0f766e";
  });

  ctx.strokeStyle = "#7c3aed";
  ctx.fillStyle = "#7c3aed";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const pointsOnLine = ordered.map((row, index) => {
    const x = area.left + index * step + step / 2;
    const pm = Number(row.profitMargin || 0) * 100;
    const y = area.bottom - ((pm - minPm) / pmSpan) * (area.bottom - area.top);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    return { x, y, pm };
  });
  ctx.stroke();
  pointsOnLine.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillText(`${point.pm.toFixed(1)}%`, point.x, point.y - 8);
  });

  ctx.fillStyle = "#697386";
  ordered.forEach((row, index) => {
    const x = area.left + index * step + step / 2;
    ctx.save();
    ctx.translate(x, area.bottom + 18);
    ctx.rotate(-0.25);
    ctx.textAlign = "center";
    ctx.fillText(String(row.month || "").slice(2), 0, 0);
    ctx.restore();
  });

  drawLegend(ctx, area.left, 12, [["Qty", "#0f766e"], ["PM", "#7c3aed"]]);
}

function setupChart(canvas) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.font = "12px Segoe UI, Arial";
  return ctx;
}

function drawLegend(ctx, x, y, items) {
  let offset = 0;
  items.forEach(([label, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + offset, y, 10, 10);
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText(label, x + offset + 14, y + 9);
    offset += 70;
  });
}

function drawEmptyChart(canvas, text) {
  const ctx = setupChart(canvas);
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = "#697386";
  ctx.textAlign = "center";
  ctx.fillText(text, rect.width / 2, rect.height / 2);
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

elements.skuSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && elements.skuSelect.value) {
    event.preventDefault();
    loadSku(elements.skuSelect.value);
  }
});

elements.skuSelect.addEventListener("change", () => loadSku(elements.skuSelect.value));

elements.productImage.addEventListener("error", () => {
  state.imageIndex += 1;
  showProductImage();
});

elements.platformGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-period][data-panel]");
  if (!button) return;
  state.platformPeriods[Number(button.dataset.panel)] = button.dataset.period;
  state.platformRanges[Number(button.dataset.panel)] = dateRangeFromPeriod(state.currentData.periods[button.dataset.period]);
  renderPlatformPanels();
});

elements.platformGrid.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='date'][data-panel]");
  if (!input) return;
  const index = Number(input.dataset.panel);
  const role = input.dataset.dateRole;
  state.platformRanges[index] = state.platformRanges[index] || { start: "", end: "" };
  state.platformRanges[index][role] = input.value;
  renderPlatformPanels();
});

[elements.priceInput, elements.cogsInput, elements.freightInput, elements.commissionInput].forEach((input) => {
  input.addEventListener("input", () => updatePriceTest());
});

elements.resetPrice.addEventListener("click", () => fillPriceForm(state.initialPriceTest));

loadSkus().catch((error) => {
  elements.metaLine.textContent = error.message;
});

window.addEventListener("resize", () => {
  if (state.currentData) drawMonthChart(state.currentData.monthlyTrend);
});
