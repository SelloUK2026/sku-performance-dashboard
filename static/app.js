const state = {
  selectedSku: "",
  platformPeriods: ["recent", "year", "lifetime"],
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
  monthRows: document.querySelector("#monthRows"),
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
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function loadSkus(query = "") {
  const payload = await getJson(`/api/skus?q=${encodeURIComponent(query)}`);
  elements.skuSelect.innerHTML = payload.items.map((item) => (
    `<option value="${escapeHtml(item.sku)}">${escapeHtml(item.sku)}</option>`
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
  state.imageUrls = (snapshot.imageUrls && snapshot.imageUrls.length ? snapshot.imageUrls : [snapshot.imageUrl]).filter(Boolean);
  state.imageIndex = 0;
  showProductImage();
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
  renderPlatformPanels();
  renderPriceHistory(payload.priceHistory);
  renderMonthRows(payload.monthlyTrend);
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
    const period = state.currentData.periods[periodKey];
    return `<div class="panel platform-panel" data-panel="${index}">
      <div class="panel-head">
        <h3>${titles[index]}</h3>
        <div class="tabs">
          ${periodButton(index, "recent", "Recent", periodKey)}
          ${periodButton(index, "year", "Year", periodKey)}
          ${periodButton(index, "lifetime", "Lifetime", periodKey)}
        </div>
      </div>
      <p class="subtle">${escapeHtml(period.label)}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Qty</th>
              <th>Sales</th>
              <th>Selling Fee</th>
              <th>Ads</th>
              <th>Return</th>
              <th>Profit</th>
              <th>PM</th>
              <th>Unit Price</th>
            </tr>
          </thead>
          <tbody>${platformRows(period.platforms)}</tbody>
        </table>
      </div>
    </div>`;
  }).join("");
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

function renderMonthRows(points) {
  if (!points || !points.length) {
    elements.monthRows.innerHTML = `<tr><td colspan="5">No monthly sales</td></tr>`;
    return;
  }
  elements.monthRows.innerHTML = [...points].reverse().map((row) => (
    `<tr>
      <td>${escapeHtml(String(row.month || "-"))}</td>
      <td>${number(row.qty)}</td>
      <td>${currency(row.sales)}</td>
      <td class="${row.profit < 0 ? "bad" : "good"}">${currency(row.profit)}</td>
      <td class="${row.profitMargin < 0 ? "bad" : "good"}">${percent(row.profitMargin)}</td>
    </tr>`
  )).join("");
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

elements.productImage.addEventListener("error", () => {
  state.imageIndex += 1;
  showProductImage();
});

elements.platformGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-period][data-panel]");
  if (!button) return;
  state.platformPeriods[Number(button.dataset.panel)] = button.dataset.period;
  renderPlatformPanels();
});

[elements.priceInput, elements.cogsInput, elements.freightInput, elements.commissionInput].forEach((input) => {
  input.addEventListener("input", () => updatePriceTest());
});

elements.resetPrice.addEventListener("click", () => fillPriceForm(state.initialPriceTest));

loadSkus().catch((error) => {
  elements.metaLine.textContent = error.message;
});
