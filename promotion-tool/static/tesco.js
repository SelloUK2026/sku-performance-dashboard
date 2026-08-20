const state = {
  candidates: [], catalogue: new Map(), catalogueByWooper: new Map(), categories: [], selected: new Set(),
  assignments: new Map(), conflicts: {}, offers: [], events: [], level1: [], dirty: false,
  candidateFile: "", catalogueFile: "",
  language: localStorage.getItem("tescoLanguage") === "zh-CN" ? "zh-CN" : "en",
};

const translations = {
  en: {
    pageTitle: "Tesco Promotion Selection", pageSubtitle: "Second-stage nomination",
    checkingOffers: "Checking Offer SKU data", capturedOffers: "{count} latest Offer SKUs captured",
    offersRequired: "Latest Tesco Offer SKU import required", openGuide: "Open user guide",
    promotionCalculation: "Promotion calculation", generateForm: "Generate nomination form",
    eventSetup: "Event setup", tescoEvent: "Tesco event", filesLoaded: "{count} of 2 files loaded",
    eventName: "Event name", eventNamePlaceholder: "e.g. August Bank Holiday",
    promotionStart: "Promotion start", promotionEnd: "Promotion end", sellerName: "Seller name",
    totalSkuLimit: "Total SKU limit", noOverallLimit: "No overall limit",
    importWorktable: "Import approved worktable", importCatalogue: "Import Tesco Catalogue",
    worktableNotLoaded: "Approved worktable not loaded", catalogueNotLoaded: "Tesco Catalogue not loaded",
    eventRules: "Event rules", allowedCategories: "Allowed event categories", addCategory: "Add category",
    categoryHelp: "Enter the groups Tesco specifies for this event. Limits apply to selected SKUs in each group.",
    productSelection: "Product selection", approvedCandidates: "Approved candidates", selected: "selected",
    searchPlaceholder: "Search SKU, title, brand, or category", importToBegin: "Import the approved worktable and latest Tesco Catalogue to begin.",
    product: "Product", grade: "Grade", estimated: "Est.", monthsToSell: "months to sell", discount: "Discount",
    eventCategory: "Event category", level1: "Level 1", was: "WAS", caPrice: "CA price", now: "Now",
    promoPrice: "Promo price", nominationStock: "Nomination stock", status: "Status",
    noCandidates: "No approved candidates loaded.", overlapRecord: "Overlap record", savedEvents: "Saved Tesco events",
    tescoGuide: "Tesco user guide", secondStageSelection: "Second-stage selection", close: "Close",
    guideStep1: "Export the Tesco promotion worktable, enter Yes in column T for candidates, then import it here.",
    guideStep2: "Upload the latest Tesco Catalogue for the event. The latest Offer SKU file is already captured when Tesco data is first imported in the calculation tool.",
    guideStep3: "Enter the event dates, Tesco-defined categories and limits. Assign an event category and fixed Level 1 group to each selected SKU.",
    guideStep4: "A Tesco SKU used in an overlapping saved event is blocked. Another Tesco SKU for the same Wooper product remains available.",
    guideStep5: "Generate the form only when the quota and required fields pass. The saved snapshot becomes the overlap record for future events.",
    categoryFromBrief: "Category from Tesco event brief", maximumSkus: "Maximum SKUs", noLimit: "No limit",
    removeCategory: "Remove category", categoryCount: "{count} selected / {limit} limit · {remaining} remaining",
    categoryCountNoLimit: "{count} selected · no limit", loading: "Loading...", fileLoaded: "{file} loaded",
    worktableLoaded: "{file}: {count} approved rows", catalogueLoaded: "{file}: {count} product rows{matches}",
    matchedRows: "; {matched} of {total} approved SKUs matched", requestFailed: "Request failed",
    selectCategory: "Select category", selectLevel1: "Select Level 1", alternativeListing: "Alternative listing available: {sku}",
    ready: "Ready", blocked: "Blocked: {events}", catalogueMissing: "Catalogue data missing",
    catalogueMatch: "Catalogue match required", brandUnavailable: "Brand unavailable", noImage: "No image",
    imageUnavailable: "Image unavailable", selectSku: "Select {sku}", importBoth: "Import both required files.",
    enterEvent: "Enter the event name and promotion dates.", endAfterStart: "The promotion end date must be after the start date.",
    selectCandidate: "Select at least one candidate.", totalExceeded: "Total limit exceeded by {count} SKU(s).",
    categoryExceeded: "{category} exceeds its limit by {count}.", assignFields: "Assign event category and Level 1 for {sku}.",
    overlapsEvent: "{sku} overlaps a saved event.", missingPrice: "{sku} is missing WAS or promotion price.",
    totalQuota: "{count} / {limit} total limit", noTotalLimit: "No total limit",
    readyToGenerate: "Ready to generate the Tesco nomination form and save this event record.",
    historyDates: "{start} to {end}", historySkus: "{count} Tesco SKUs", savedOn: "Saved {date}", remove: "Remove",
    noSavedEvents: "No saved Tesco nomination records yet.", confirmRemove: "Remove the saved event “{name}”? This will stop it being used for overlap checks.",
    eventRemoved: "{name} removed", generating: "Generating...", generationFailed: "Could not generate nomination form",
    generated: "Nomination form generated and event record saved", selectAll: "Select all visible eligible rows",
  },
  "zh-CN": {
    pageTitle: "Tesco促销选品", pageSubtitle: "第二阶段提名", checkingOffers: "正在检查Offer SKU数据",
    capturedOffers: "已保存最新的{count}个Offer SKU", offersRequired: "需要导入最新Tesco Offer SKU",
    openGuide: "打开用户指南", promotionCalculation: "促销计算", generateForm: "生成提名表",
    eventSetup: "活动设置", tescoEvent: "Tesco活动", filesLoaded: "已导入{count}/2个文件",
    eventName: "活动名称", eventNamePlaceholder: "例如：八月银行假日", promotionStart: "促销开始日期",
    promotionEnd: "促销结束日期", sellerName: "卖家名称", totalSkuLimit: "SKU总数上限",
    noOverallLimit: "不设总数上限", importWorktable: "导入已批准工作表", importCatalogue: "导入Tesco目录",
    worktableNotLoaded: "尚未导入已批准工作表", catalogueNotLoaded: "尚未导入Tesco目录",
    eventRules: "活动规则", allowedCategories: "允许的活动类别", addCategory: "添加类别",
    categoryHelp: "输入Tesco为本次活动指定的类别。每个类别的上限适用于已选SKU。",
    productSelection: "产品选择", approvedCandidates: "已批准候选产品", selected: "已选",
    searchPlaceholder: "搜索SKU、标题、品牌或类别", importToBegin: "请先导入已批准工作表及最新Tesco目录。",
    product: "产品", grade: "等级", estimated: "预计", monthsToSell: "售完月数", discount: "折扣",
    eventCategory: "活动类别", level1: "一级类别", was: "原价", caPrice: "CA價", now: "现价",
    promoPrice: "促销价", nominationStock: "提名库存", status: "状态", noCandidates: "尚未导入已批准候选产品。",
    overlapRecord: "重叠记录", savedEvents: "已保存的Tesco活动", tescoGuide: "Tesco用户指南",
    secondStageSelection: "第二阶段选品", close: "关闭",
    guideStep1: "导出Tesco促销工作表，在候选产品的T列填入Yes，然后在此导入。",
    guideStep2: "导入本次活动最新的Tesco目录。首次在促销计算工具导入Tesco数据时，系统已保存最新Offer SKU文件。",
    guideStep3: "输入活动日期、Tesco指定的类别及上限，并为每个已选SKU指定活动类别和固定的一级类别。",
    guideStep4: "如相同Tesco SKU已用于日期重叠的已保存活动，系统会阻止选择；同一Wooper产品的其他Tesco SKU仍可使用。",
    guideStep5: "所有数量限制及必填资料通过检查后才可生成表格。保存的快照会用于检查未来活动的日期重叠。",
    categoryFromBrief: "Tesco活动简报中的类别", maximumSkus: "SKU数量上限", noLimit: "不设上限",
    removeCategory: "删除类别", categoryCount: "已选{count} / 上限{limit} · 剩余{remaining}",
    categoryCountNoLimit: "已选{count} · 不设上限", loading: "正在导入...", fileLoaded: "已导入{file}",
    worktableLoaded: "{file}：{count}行已批准产品", catalogueLoaded: "{file}：{count}行产品{matches}",
    matchedRows: "；已匹配{matched}/{total}个已批准SKU", requestFailed: "请求失败",
    selectCategory: "选择类别", selectLevel1: "选择一级类别", alternativeListing: "可使用其他刊登SKU：{sku}",
    ready: "可选", blocked: "已阻止：{events}", catalogueMissing: "缺少目录资料",
    catalogueMatch: "需要匹配目录", brandUnavailable: "无品牌资料", noImage: "无图片",
    imageUnavailable: "图片无法显示", selectSku: "选择{sku}", importBoth: "请导入两个必需文件。",
    enterEvent: "请输入活动名称及促销日期。", endAfterStart: "促销结束日期必须晚于开始日期。",
    selectCandidate: "请至少选择一个候选产品。", totalExceeded: "SKU总数超出上限{count}个。",
    categoryExceeded: "{category}超出上限{count}个。", assignFields: "请为{sku}指定活动类别和一级类别。",
    overlapsEvent: "{sku}与已保存活动日期重叠。", missingPrice: "{sku}缺少原价或促销价。",
    totalQuota: "已选{count} / 总上限{limit}", noTotalLimit: "不设总数上限",
    readyToGenerate: "资料检查完成，可以生成Tesco提名表并保存本次活动记录。",
    historyDates: "{start}至{end}", historySkus: "{count}个Tesco SKU", savedOn: "保存于{date}", remove: "删除",
    noSavedEvents: "尚未保存Tesco提名记录。", confirmRemove: "删除已保存活动“{name}”？删除后将不再用于日期重叠检查。",
    eventRemoved: "已删除{name}", generating: "正在生成...", generationFailed: "无法生成提名表",
    generated: "提名表已生成，活动记录已保存", selectAll: "选择所有可见的合资格产品",
  },
};

const byId = (id) => document.getElementById(id);
const t = (key, values = {}) => {
  let value = translations[state.language]?.[key] || translations.en[key] || key;
  Object.entries(values).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, replacement); });
  return value;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);
const money = (value) => Number.isFinite(Number(value)) ? `£${Number(value).toFixed(2)}` : "-";
const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "-";

function toast(message, type = "") {
  const node = byId("toast"); node.textContent = message; node.className = `toast visible ${type}`;
  window.setTimeout(() => node.classList.remove("visible"), 3500);
}

function markDirty() { state.dirty = true; }

async function fetchJson(url, options) {
  const response = await fetch(url, options); const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || t("requestFailed")); return payload;
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });
  byId("languageButton").textContent = state.language === "en" ? "中文" : "English";
  renderCategories(); updateFileStatuses(); renderRows(); renderHistory(); loadStatus().catch((error) => toast(error.message, "error"));
}

async function loadStatus() {
  const payload = await fetchJson("/api/tesco/status");
  state.events = payload.events || []; state.level1 = payload.level1 || [];
  byId("offerStatus").textContent = payload.offerCount
    ? t("capturedOffers", { count: payload.offerCount.toLocaleString() })
    : t("offersRequired");
  renderHistory();
}

function addCategory(name = "", limit = "") {
  state.categories.push({ id: crypto.randomUUID(), name, limit }); renderCategories(); markDirty();
}

function renderCategories() {
  byId("categoryList").innerHTML = state.categories.map((category) => `
    <div class="category-row" data-id="${category.id}">
      <label>${t("eventCategory")}<input class="category-name" value="${escapeHtml(category.name)}" placeholder="${escapeHtml(t("categoryFromBrief"))}"></label>
      <label>${t("maximumSkus")}<input class="category-limit" type="number" min="1" value="${escapeHtml(category.limit)}" placeholder="${escapeHtml(t("noLimit"))}"></label>
      <div class="category-count" aria-live="polite">${t("categoryCountNoLimit", { count: 0 })}</div>
      <button class="category-remove" type="button" title="${escapeHtml(t("removeCategory"))}" aria-label="${escapeHtml(t("removeCategory"))}">×</button>
    </div>`).join("");
  document.querySelectorAll(".category-row").forEach((row) => {
    const item = state.categories.find((category) => category.id === row.dataset.id);
    row.querySelector(".category-name").addEventListener("input", (event) => { item.name = event.target.value; renderRows(); markDirty(); });
    row.querySelector(".category-limit").addEventListener("input", (event) => { item.limit = event.target.value; validate(); markDirty(); });
    row.querySelector(".category-remove").addEventListener("click", () => {
      state.categories = state.categories.filter((category) => category.id !== item.id); renderCategories(); renderRows();
    });
  });
  updateCategoryCounts();
}

function updateCategoryCounts() {
  const selected = selectedRows();
  document.querySelectorAll(".category-row").forEach((row) => {
    const category = state.categories.find((item) => item.id === row.dataset.id);
    if (!category) return;
    const count = selected.filter((item) => (state.assignments.get(item.tesco_sku) || {}).event_category === category.name).length;
    const limit = Number(category.limit || 0);
    const counter = row.querySelector(".category-count");
    counter.textContent = limit
      ? t("categoryCount", { count, limit, remaining: Math.max(limit - count, 0) })
      : t("categoryCountNoLimit", { count });
    counter.classList.toggle("over-limit", Boolean(limit && count > limit));
  });
}

async function importFile(file, kind) {
  const url = kind === "candidates" ? "/api/tesco/import-candidates" : "/api/tesco/import-catalogue";
  const button = byId(kind === "candidates" ? "candidateButton" : "catalogueButton");
  button.disabled = true; button.textContent = t("loading");
  try {
    const payload = await fetchJson(url, { method: "POST", headers: { "X-Filename": file.name }, body: await file.arrayBuffer() });
    if (kind === "candidates") {
      state.candidates = payload.candidates; state.selected.clear(); state.assignments.clear();
      state.candidateFile = file.name;
    } else {
      state.catalogue = new Map(payload.catalogue.map((row) => [row.tesco_sku, row]));
      state.catalogueByWooper = new Map();
      payload.catalogue.forEach((row) => {
        if (row.wooper_sku && !state.catalogueByWooper.has(row.wooper_sku)) {
          state.catalogueByWooper.set(row.wooper_sku, row);
        }
      });
      state.catalogueFile = file.name;
    }
    updateFileStatuses(); markDirty(); await checkOverlap(); renderRows(); toast(t("fileLoaded", { file: file.name }));
  } catch (error) { toast(error.message, "error"); }
  finally {
    button.disabled = false; button.textContent = kind === "candidates" ? t("importWorktable") : t("importCatalogue");
  }
}

function catalogueFor(row) {
  return state.catalogue.get(row.tesco_sku)
    || state.catalogueByWooper.get(row.wooper_sku)
    || null;
}

function updateFileStatuses() {
  if (state.candidateFile) {
    byId("candidateStatus").textContent = t("worktableLoaded", { file: state.candidateFile, count: state.candidates.length.toLocaleString() });
    byId("candidateStatus").className = "loaded";
  }
  if (state.catalogueFile) {
    const matched = state.candidates.filter((row) => catalogueFor(row)).length;
    const matchText = state.candidates.length ? t("matchedRows", { matched: matched.toLocaleString(), total: state.candidates.length.toLocaleString() }) : "";
    byId("catalogueStatus").textContent = t("catalogueLoaded", { file: state.catalogueFile, count: state.catalogue.size.toLocaleString(), matches: matchText });
    byId("catalogueStatus").className = state.candidates.length && matched < state.candidates.length ? "warning" : "loaded";
  }
}

async function checkOverlap() {
  const start = byId("startDate").value, end = byId("endDate").value;
  if (!start || !end) { state.conflicts = {}; validate(); return; }
  try {
    const payload = await fetchJson("/api/tesco/check-overlap", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: start, end_date: end }),
    });
    state.conflicts = payload.conflicts || {}; state.offers = payload.offers || [];
    Object.keys(state.conflicts).forEach((sku) => state.selected.delete(sku)); renderRows();
  } catch (error) { toast(error.message, "error"); }
}

function categoryOptions(selected) {
  return `<option value="">${t("selectCategory")}</option>` + state.categories
    .filter((item) => item.name.trim()).map((item) => `<option ${item.name === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}
function levelOptions(selected) {
  return `<option value="">${t("selectLevel1")}</option>` + state.level1.map((item) => `<option ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function alternativeListing(row) {
  if (!state.conflicts[row.tesco_sku] || !row.wooper_sku) return "";
  const alternative = state.offers.find((offer) => offer.wooper_sku === row.wooper_sku && offer.tesco_sku !== row.tesco_sku && !state.conflicts[offer.tesco_sku]);
  return alternative ? t("alternativeListing", { sku: alternative.tesco_sku }) : "";
}

function renderRows() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const visible = [...state.candidates].sort((left, right) => left.tesco_sku.localeCompare(right.tesco_sku, undefined, { sensitivity: "base" })).filter((row) => {
    const catalogue = catalogueFor(row) || {};
    return `${row.tesco_sku} ${row.wooper_sku} ${catalogue.title || ""} ${catalogue.brand || ""} ${catalogue.category_path || ""}`.toLowerCase().includes(query);
  });
  byId("emptyState").hidden = Boolean(visible.length);
  byId("candidateRows").innerHTML = visible.map((row) => {
    const catalogue = catalogueFor(row) || {};
    const assignment = state.assignments.get(row.tesco_sku) || { event_category: "", level_1: "" };
    const conflictNames = state.conflicts[row.tesco_sku] || [];
    const missingCatalogue = !catalogueFor(row);
    const alternative = alternativeListing(row);
    let status = t("ready"), statusClass = "";
    if (conflictNames.length) { status = t("blocked", { events: conflictNames.join(", ") }); statusClass = "blocked"; }
    else if (missingCatalogue) { status = t("catalogueMissing"); statusClass = "warning"; }
    return `<tr data-sku="${escapeHtml(row.tesco_sku)}" class="${conflictNames.length ? "blocked" : ""}">
      <td><input class="row-check" type="checkbox" ${state.selected.has(row.tesco_sku) ? "checked" : ""} ${conflictNames.length || missingCatalogue ? "disabled" : ""} aria-label="${escapeHtml(t("selectSku", { sku: row.tesco_sku }))}"></td>
      <td><div class="product-cell">${catalogue.image_url ? `<img src="${escapeHtml(catalogue.image_url)}" alt="" loading="lazy">` : `<span class="image-placeholder">${t("noImage")}</span>`}<div class="product-copy"><strong title="${escapeHtml(catalogue.title || t("catalogueMatch"))}">${escapeHtml(catalogue.title || t("catalogueMatch"))}</strong><small>${escapeHtml(catalogue.brand || t("brandUnavailable"))}</small><small title="${escapeHtml(catalogue.category_path || "")}">${escapeHtml(catalogue.category_path || "")}</small></div></div></td>
      <td class="sku-cell"><strong>${escapeHtml(row.tesco_sku)}</strong><small>${escapeHtml(row.wooper_sku)}</small>${alternative ? `<small>${escapeHtml(alternative)}</small>` : ""}</td>
      <td>${row.grade == null ? "-" : Number(row.grade).toFixed(0)}</td>
      <td>${row.months == null ? "-" : Number(row.months).toFixed(1)}</td>
      <td>${percent(row.discount)}</td>
      <td><select class="row-select event-category">${categoryOptions(assignment.event_category)}</select></td>
      <td><select class="row-select level-one">${levelOptions(assignment.level_1)}</select></td>
      <td>${money(row.ca_price)}</td><td>${money(row.promo_price)}</td><td>${Number(row.soh || 0).toFixed(0)}</td><td>${(Number(row.soh || 0) + 100).toFixed(0)}</td>
      <td><span class="status-pill ${statusClass}" title="${escapeHtml(status)}">${escapeHtml(status)}</span></td>
    </tr>`;
  }).join("");
  document.querySelectorAll("#candidateRows tr").forEach((tableRow) => {
    const sku = tableRow.dataset.sku;
    tableRow.querySelector(".row-check").addEventListener("change", (event) => { event.target.checked ? state.selected.add(sku) : state.selected.delete(sku); markDirty(); validate(); });
    tableRow.querySelector(".event-category").addEventListener("change", (event) => { const item = state.assignments.get(sku) || {}; item.event_category = event.target.value; state.assignments.set(sku, item); markDirty(); validate(); });
    tableRow.querySelector(".level-one").addEventListener("change", (event) => { const item = state.assignments.get(sku) || {}; item.level_1 = event.target.value; state.assignments.set(sku, item); markDirty(); validate(); });
  });
  document.querySelectorAll(".product-cell img").forEach((image) => image.addEventListener("error", () => {
    const placeholder = document.createElement("span");
    placeholder.className = "image-placeholder"; placeholder.textContent = t("imageUnavailable");
    image.replaceWith(placeholder);
  }, { once: true }));
  byId("selectAll").checked = visible.length > 0 && visible.every((row) => state.selected.has(row.tesco_sku) || state.conflicts[row.tesco_sku] || !catalogueFor(row));
  const loadedFiles = (state.candidates.length ? 1 : 0) + (state.catalogue.size ? 1 : 0);
  byId("setupProgress").textContent = t("filesLoaded", { count: loadedFiles });
  validate();
}

function selectedRows() { return state.candidates.filter((row) => state.selected.has(row.tesco_sku)); }

function validate() {
  const rows = selectedRows(), errors = [];
  const totalLimit = Number(byId("totalLimit").value || 0);
  if (!state.candidates.length || !state.catalogue.size) errors.push(t("importBoth"));
  if (!byId("eventName").value.trim() || !byId("startDate").value || !byId("endDate").value) errors.push(t("enterEvent"));
  if (byId("startDate").value && byId("endDate").value && byId("startDate").value > byId("endDate").value) errors.push(t("endAfterStart"));
  if (!rows.length) errors.push(t("selectCandidate"));
  if (totalLimit && rows.length > totalLimit) errors.push(t("totalExceeded", { count: rows.length - totalLimit }));
  state.categories.forEach((category) => {
    const count = rows.filter((row) => (state.assignments.get(row.tesco_sku) || {}).event_category === category.name).length;
    const limit = Number(category.limit || 0); if (limit && count > limit) errors.push(t("categoryExceeded", { category: category.name, count: count - limit }));
  });
  rows.forEach((row) => {
    const assignment = state.assignments.get(row.tesco_sku) || {};
    if (!assignment.event_category || !assignment.level_1) errors.push(t("assignFields", { sku: row.tesco_sku }));
    if (state.conflicts[row.tesco_sku]) errors.push(t("overlapsEvent", { sku: row.tesco_sku }));
    if (!row.ca_price || !row.promo_price) errors.push(t("missingPrice", { sku: row.tesco_sku }));
  });
  byId("selectedCount").textContent = rows.length;
  updateCategoryCounts();
  byId("quotaStatus").textContent = totalLimit ? t("totalQuota", { count: rows.length, limit: totalLimit }) : t("noTotalLimit");
  byId("validationBanner").textContent = errors[0] || t("readyToGenerate");
  byId("validationBanner").className = `validation-banner visible ${errors.length ? "error" : ""}`;
  byId("exportButton").disabled = Boolean(errors.length); return errors;
}

function renderHistory() {
  byId("historyList").innerHTML = state.events.length ? [...state.events].reverse().map((event) => `
    <div class="history-row"><strong>${escapeHtml(event.event_name)}</strong><span>${escapeHtml(t("historyDates", { start: event.start_date, end: event.end_date }))}</span><span>${escapeHtml(t("historySkus", { count: (event.rows || []).length }))}</span><span>${escapeHtml(t("savedOn", { date: (event.created_at || "").slice(0, 10) }))}</span><button class="history-remove" data-event-id="${escapeHtml(event.id)}" type="button">${t("remove")}</button></div>`).join("") : `<div class="history-empty">${t("noSavedEvents")}</div>`;
  document.querySelectorAll(".history-remove").forEach((button) => button.addEventListener("click", () => removeSavedEvent(button.dataset.eventId)));
}

async function removeSavedEvent(eventId) {
  const event = state.events.find((item) => String(item.id) === eventId);
  if (!event || !window.confirm(t("confirmRemove", { name: event.event_name }))) return;
  try {
    await fetchJson(`/api/tesco/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
    state.events = state.events.filter((item) => String(item.id) !== eventId);
    renderHistory(); await checkOverlap(); toast(t("eventRemoved", { name: event.event_name }));
  } catch (error) { toast(error.message, "error"); }
}

async function generateNomination() {
  if (validate().length) return;
  const rows = selectedRows().map((row) => ({ ...(catalogueFor(row) || {}), ...row, ...(state.assignments.get(row.tesco_sku) || {}) }));
  byId("exportButton").disabled = true; byId("exportButton").textContent = t("generating");
  try {
    const response = await fetch("/api/tesco/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      event_name: byId("eventName").value.trim(), start_date: byId("startDate").value, end_date: byId("endDate").value,
      seller_name: byId("sellerName").value.trim(), total_limit: byId("totalLimit").value,
      candidate_file: state.candidateFile, catalogue_file: state.catalogueFile,
      category_limits: state.categories.map((item) => ({ name: item.name.trim(), limit: item.limit })), rows,
    }) });
    if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || t("generationFailed")); }
    const blob = await response.blob(), disposition = response.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "tesco-nomination.xlsx";
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
    state.dirty = false; await loadStatus(); await checkOverlap(); toast(t("generated"));
  } catch (error) { toast(error.message, "error"); }
  finally { byId("exportButton").textContent = t("generateForm"); validate(); }
}

byId("candidateButton").addEventListener("click", () => byId("candidateInput").click());
byId("catalogueButton").addEventListener("click", () => byId("catalogueInput").click());
byId("candidateInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "candidates"));
byId("catalogueInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "catalogue"));
byId("addCategoryButton").addEventListener("click", () => addCategory());
byId("searchInput").addEventListener("input", renderRows);
["eventName", "sellerName", "totalLimit"].forEach((id) => byId(id).addEventListener("input", () => { markDirty(); validate(); }));
["startDate", "endDate"].forEach((id) => byId(id).addEventListener("change", () => { markDirty(); checkOverlap(); }));
byId("selectAll").addEventListener("change", (event) => {
  state.candidates.forEach((row) => { if (!state.conflicts[row.tesco_sku] && catalogueFor(row)) event.target.checked ? state.selected.add(row.tesco_sku) : state.selected.delete(row.tesco_sku); });
  markDirty(); renderRows();
});
byId("exportButton").addEventListener("click", generateNomination);
byId("languageButton").addEventListener("click", () => {
  state.language = state.language === "en" ? "zh-CN" : "en";
  localStorage.setItem("tescoLanguage", state.language);
  applyLanguage();
});
byId("helpButton").addEventListener("click", () => byId("guideModal").classList.add("visible"));
byId("closeGuide").addEventListener("click", () => byId("guideModal").classList.remove("visible"));
window.addEventListener("beforeunload", (event) => { if (state.dirty && (state.candidates.length || state.selected.size)) { event.preventDefault(); event.returnValue = ""; } });

addCategory(); applyLanguage();
