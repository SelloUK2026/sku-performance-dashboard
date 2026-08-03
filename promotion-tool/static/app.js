const DEFAULT_MARGINS = {
  0: 12,
  1: 25,
  2: 20,
  3: 15,
  4: 12,
  5: 8,
  6: 5,
  7: 3,
};

const GUIDE_STORAGE_KEY = "promotion-nomination-guide-v9";
const LANGUAGE_STORAGE_KEY = "promotion-nomination-language";
const CRITERIA_STORAGE_KEY = "promotion-nomination-criteria-collapsed";
const SKU_COLLATOR = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

const UI_TEXT = {
  en: {
    appTitle: "Promotion Nomination",
    appSubtitle: "Promotion calculation tool",
    localDemo: "Live data",
    chinese: "中文",
    english: "English",
    displayChinese: "Display in Simplified Chinese",
    displayEnglish: "Display in English",
    openGuide: "Open user guide",
    loadSample: "Load sample",
    importData: "Import data",
    resolveMappings: "Resolve mappings",
    commissionTable: "Commission table",
    exportSelected: "Export selected",
    campaignSetup: "Campaign setup",
    criteria: "Criteria",
    resetCriteria: "Reset criteria",
    hideCriteria: "Hide criteria",
    showCriteria: "Show criteria",
    platform: "Platform",
    campaignType: "Campaign type",
    themeEvent: "Theme event",
    singleDeal: "Single deal",
    campaignName: "Campaign name",
    commissionListRequired: "UK Product Commission Rate List required",
    commissionRatesReview: "{count} commission rates need review",
    uploadTable: "Upload table",
    nominationFilters: "Nomination filters",
    minimumGrade: "Minimum grade level",
    minimumStock: "Minimum stock",
    minimumMonths: "Minimum months",
    minimumDiscount: "Minimum discount",
    returnReviewThreshold: "Return review threshold",
    mainCategory: "Main category",
    allMainCategories: "All main categories",
    subcategory: "Subcategory",
    allSubcategories: "All subcategories",
    brand: "Brand",
    allBrands: "All brands",
    selectedCount: "{count} selected",
    clearSelection: "Clear selection",
    excludeFirstArrivals: "Exclude first arrivals on or after",
    pricingRules: "Pricing rules",
    maximumDiscount: "Maximum discount",
    defaultCommission: "Default commission",
    roundPromoPrices: "Round promotional prices",
    useDiscountInterval: "Use discount interval",
    discountInterval: "Discount interval",
    minimumMarginByGrade: "Minimum margin by grade",
    target: "Target",
    grade: "Grade",
    imported: "Imported",
    eligible: "Eligible",
    selected: "Selected",
    averageDiscount: "Average discount",
    projectedProfit: "Projected profit",
    searchPlaceholder: "Search SKU, category, or reason",
    vatPriceSettings: "VAT price settings",
    calculateFrom: "Calculate from",
    caPrice: "CA price",
    offerPrice: "Offer price",
    priceUsed: "Price used",
    importedPrice: "Imported price",
    exportPrice: "Export price",
    included: "Included",
    excludedVat: "Excluded",
    vatIncluded: "VAT included",
    vatExcluded: "VAT excluded",
    candidateFilter: "Candidate filter",
    all: "All",
    excluded: "Excluded",
    warnings: "Warnings",
    selectAll: "Select all eligible candidates",
    category: "Category",
    months: "Months",
    suggested: "Suggested",
    final: "Final",
    promoPrice: "Promo price",
    promoMargin: "Promo margin",
    proposed: "proposed",
    promoMarginHighlightNote: "Red text means Promo margin is negative. Promo margin and Lifetime margin are highlighted red when Lifetime margin exceeds Promo margin by more than 5 percentage points.",
    sold: "Sold",
    lifetimeMargin: "Lifetime margin",
    afterReturns: "after returns",
    lifetimeMarginHighlightNote: "Red text means Lifetime margin is negative. Promo margin and Lifetime margin are highlighted red when Lifetime margin exceeds Promo margin by more than 5 percentage points.",
    returnRate: "Return rate",
    allPlatforms: "all platforms",
    returnRateHighlightNote: "Return rate is highlighted red when it is at or above the Return review threshold set in Criteria (default 6%).",
    decision: "Decision",
    reason: "Reason",
    noCandidates: "No candidates match this view",
    adjustFilters: "Adjust the filters or import another data file.",
    sampleSource: "Workbook-verified sample data",
    ready: "Ready",
    calculating: "Calculating",
    rowsCalculated: "{count} rows calculated",
    calculationFailed: "Calculation failed",
    importing: "Importing",
    importFailed: "Import failed",
    importCancelled: "Import cancelled",
    importInProgress: "Import in progress",
    loadingPlatformData: "Loading platform data",
    loadingCommissionTable: "Loading commission table",
    importProgressMessage: "Reading and matching {file}. This can take a little while.",
    importProgressHelp: "Please keep this window open while the import is processed.",
    cancelImport: "Cancel import",
    mappedRowsSource: "{file} - {count} mapped rows",
    stepOne: "Step 1",
    importCurrentOffers: "Import current platform offers",
    firstFileHelp: "The first file contains the platform SKU and current offer price.",
    importOfferFile: "Import offer file",
    openWorkbookSample: "Open workbook sample",
    skuMappingRequired: "SKU mapping required",
    matchSkus: "Match platform SKUs to Wooper",
    caSkuMappingRequired: "CA SKU mapping required",
    matchCaSkus: "Match CA SKUs to Wooper",
    mappingSummaryCa: "{count} CA SKUs need a Wooper SKU mapping.",
    mappingSummaryPlatform: "{count} platform SKUs need a Wooper SKU mapping.",
    mappingSearchPlaceholder: "Search CA SKU or title",
    saveCompletedMappings: "Save completed mappings",
    enterOneMapping: "Enter at least one mapping or mark an SKU as non-existing",
    close: "Close",
    saveMappings: "Save completed mappings",
    nonExistingSku: "Non-existing SKU",
    commissionReviewRequired: "Commission review required",
    commissionRatesMissing: "Commission rates are missing",
    reuploadFile: "Re-upload file",
    applyRates: "Apply rates",
    commissionRate: "Commission rate",
    missingCommissionSummary: "{count} SKU(s) were not found for {platform}. Re-upload the latest UK Product Commission Rate List from DingTalk, or review and apply the suggested rates below.",
    suggestedCategory: "Suggested from matching category",
    suggestedDefault: "Suggested from platform default",
    userGuide: "User guide",
    stepCounter: "Step {current} of {total}",
    previous: "Previous",
    next: "Next",
    finish: "Finish",
    review: "Review",
    allCriteriaPassed: "All criteria passed",
    selectSku: "Select {sku}",
    finalDiscountFor: "Final discount for {sku}",
    workbookSampleLoaded: "Workbook sample loaded",
    mappingsNeedReview: "{count} SKU mappings need review",
    rowsImported: "{count} SKU rows imported",
    mapEverySku: "Enter at least one mapping or mark an SKU as non-existing",
    invalidWooperMapping: "Select a valid Wooper SKU from the list for every completed mapping",
    selectWooperSku: "Select a Wooper SKU",
    mappingsSaved: "{count} SKU mappings saved",
    nonExistingExcluded: "{count} non-existing SKUs excluded",
    fileLoadedRates: "{file} loaded with {count} {platform} rates",
    ratesAppliedMissing: "{applied} rates applied; {missing} need review",
    ratesApplied: "Commission rates applied to {count} SKUs",
    invalidCommission: "Enter a commission rate from 0% to 100% for every missing SKU",
    suggestedRatesApplied: "{count} suggested commission rate(s) applied",
    resolveCommissionBeforeExport: "Resolve every missing commission rate before export",
    uploadCommissionFirst: "Upload UK Product Commission Rate List from DingTalk first",
    selectEligibleSku: "Select at least one eligible SKU",
    selectedExported: "{count} selected SKUs exported",
    saveWorktable: "Save worktable",
    savedWorktables: "Saved worktables",
    recordTracking: "Record tracking",
    saveWorktableHelp: "Confirm the promotion details. Saved worktables are permanent read-only records.",
    promotionPlatform: "Promotion platform",
    eventName: "Event name",
    savePermanentRecord: "Save permanent record",
    cancel: "Cancel",
    candidates: "Candidates",
    sourceRows: "Source rows",
    worktableSaved: "Worktable saved as a permanent record",
    worktableSaveFailed: "Worktable could not be saved",
    saveRequiresRows: "Import and calculate at least one SKU before saving",
    platformMustMatch: "Promotion platform must match the current calculation",
    eventNameRequired: "Enter an event name",
    worktableArchive: "Saved worktables",
    searchEventName: "Search event name",
    creationDate: "Creation date",
    created: "Created",
    skus: "SKUs",
    view: "View",
    search: "Search",
    loadingSavedWorktables: "Loading saved worktables...",
    savedWorktableCount: "{count} saved worktable(s)",
    noSavedWorktables: "No saved worktables match these filters.",
    savedWorktableLoadFailed: "Saved worktables could not be loaded",
    viewingSavedRecord: "Viewing saved record: {platform} - {event}",
    readOnlyHistoricalRecord: "Created {date}. This historical record is read-only and will not recalculate.",
    returnToCurrent: "Return to current worktable",
    savedRecord: "Saved worktable",
    allPromotionPlatforms: "All platforms",
  },
  zh: {
    caSkuMappingRequired: "\u9700\u8981\u6620\u5c04CA SKU",
    matchCaSkus: "\u5c06CA SKU\u6620\u5c04\u5230Wooper SKU",
    mappingSummaryCa: "{count}\u4e2aCA SKU\u9700\u8981\u6620\u5c04\u5230Wooper SKU\u3002",
    mappingSummaryPlatform: "{count}\u4e2a\u5e73\u53f0SKU\u9700\u8981\u6620\u5c04\u5230Wooper SKU\u3002",
    mappingSearchPlaceholder: "\u641c\u7d22CA SKU\u6216\u6807\u9898",
    saveCompletedMappings: "\u4fdd\u5b58\u5df2\u5b8c\u6210\u7684\u6620\u5c04",
    enterOneMapping: "\u8bf7\u81f3\u5c11\u8f93\u5165\u4e00\u4e2a\u6620\u5c04\uff0c\u6216\u5c06SKU\u6807\u8bb0\u4e3a\u5df2\u4e0b\u67b6",
    selectedCount: "\u5df2\u9009 {count} \u9879",
    clearSelection: "\u6e05\u9664\u9009\u62e9",
    appTitle: "促销提名工具",
    appSubtitle: "促销计算工具",
    localDemo: "实时数据",
    chinese: "中文",
    english: "English",
    displayChinese: "显示简体中文",
    displayEnglish: "显示英文",
    openGuide: "打开用户指南",
    loadSample: "加载示例",
    importData: "导入数据",
    resolveMappings: "处理SKU映射",
    commissionTable: "佣金率表",
    exportSelected: "导出已选",
    campaignSetup: "促销设置",
    criteria: "筛选条件",
    resetCriteria: "重置筛选条件",
    hideCriteria: "隐藏筛选条件",
    showCriteria: "显示筛选条件",
    platform: "平台",
    campaignType: "促销类型",
    themeEvent: "主题活动",
    singleDeal: "单品促销",
    campaignName: "促销名称",
    commissionListRequired: "需要UK Product Commission Rate List",
    commissionRatesReview: "{count}个佣金率需要审核",
    uploadTable: "上传表格",
    nominationFilters: "提名筛选",
    minimumGrade: "最低等级",
    minimumStock: "最低库存",
    minimumMonths: "最低可售月数",
    minimumDiscount: "最低折扣",
    returnReviewThreshold: "退货率审核阈值",
    mainCategory: "主类别",
    allMainCategories: "所有主类别",
    subcategory: "子类别",
    allSubcategories: "所有子类别",
    brand: "品牌",
    allBrands: "所有品牌",
    excludeFirstArrivals: "排除首次到货日在此日期或之后的商品",
    pricingRules: "定价规则",
    maximumDiscount: "最大折扣",
    defaultCommission: "默认佣金率",
    roundPromoPrices: "对促销价进行舍入",
    useDiscountInterval: "使用折扣间隔",
    discountInterval: "折扣间隔",
    minimumMarginByGrade: "各等级最低利润率",
    target: "目标",
    grade: "等级",
    imported: "已导入",
    eligible: "符合",
    selected: "已选",
    averageDiscount: "平均折扣",
    projectedProfit: "预计利润",
    searchPlaceholder: "搜索SKU、类别或原因",
    vatPriceSettings: "VAT价格设置",
    calculateFrom: "计算基准",
    caPrice: "CA價",
    offerPrice: "当前售价",
    priceUsed: "计算价格",
    importedPrice: "导入价格",
    exportPrice: "导出价格",
    included: "含VAT",
    excludedVat: "不含VAT",
    vatIncluded: "含VAT",
    vatExcluded: "不含VAT",
    candidateFilter: "候选商品筛选",
    all: "全部",
    excluded: "排除",
    warnings: "审核项",
    selectAll: "选择所有符合条件的候选商品",
    category: "类别",
    months: "月数",
    suggested: "建议折扣",
    final: "最终折扣",
    promoPrice: "促销价",
    promoMargin: "促销利润率",
    proposed: "建议值",
    promoMarginHighlightNote: "促销利润率为负数时显示红色文字。当生命周期利润率比促销利润率高出超过5个百分点时，促销利润率和生命周期利润率均以红色高亮。",
    sold: "销量",
    lifetimeMargin: "生命周期利润率",
    afterReturns: "计入退货后",
    lifetimeMarginHighlightNote: "生命周期利润率为负数时显示红色文字。当生命周期利润率比促销利润率高出超过5个百分点时，促销利润率和生命周期利润率均以红色高亮。",
    returnRate: "退货率",
    allPlatforms: "所有平台",
    returnRateHighlightNote: "当退货率达到或超过筛选条件中的退货率审核阈值（默认6%）时，以红色高亮。",
    decision: "结果",
    reason: "原因",
    noCandidates: "当前视图没有候选商品",
    adjustFilters: "请调整筛选条件或导入其他数据文件。",
    sampleSource: "已核对工作簿的示例数据",
    ready: "就绪",
    calculating: "正在计算",
    rowsCalculated: "已计算{count}行",
    calculationFailed: "计算失败",
    importing: "正在导入",
    importFailed: "导入失败",
    importCancelled: "已取消导入",
    importInProgress: "正在导入",
    loadingPlatformData: "正在加载平台数据",
    loadingCommissionTable: "正在加载佣金率表",
    importProgressMessage: "正在读取并匹配{file}，可能需要一点时间。",
    importProgressHelp: "导入处理期间，请保持此窗口打开。",
    cancelImport: "取消导入",
    mappedRowsSource: "{file} - 已映射{count}行",
    stepOne: "步骤1",
    importCurrentOffers: "导入当前平台售价",
    firstFileHelp: "第一个文件必须包含平台SKU和当前售价。",
    importOfferFile: "导入售价文件",
    openWorkbookSample: "打开工作簿示例",
    skuMappingRequired: "需要SKU映射",
    matchSkus: "将平台SKU映射至Wooper",
    close: "关闭",
    saveMappings: "保存映射",
    nonExistingSku: "已下架SKU",
    commissionReviewRequired: "需要审核佣金率",
    commissionRatesMissing: "缺少佣金率",
    reuploadFile: "重新上传文件",
    applyRates: "应用佣金率",
    commissionRate: "佣金率",
    missingCommissionSummary: "{platform}有{count}个SKU未找到佣金率。请重新上传DingTalk中的最新UK Product Commission Rate List，或审核并应用以下建议佣金率。",
    suggestedCategory: "根据匹配类别建议",
    suggestedDefault: "根据平台默认佣金率建议",
    userGuide: "用户指南",
    stepCounter: "第{current}步，共{total}步",
    previous: "上一步",
    next: "下一步",
    finish: "完成",
    review: "待审核",
    allCriteriaPassed: "所有条件均符合",
    selectSku: "选择{sku}",
    finalDiscountFor: "{sku}的最终折扣",
    workbookSampleLoaded: "工作簿示例已加载",
    mappingsNeedReview: "{count}个SKU映射需要审核",
    rowsImported: "已导入{count}行SKU",
    mapEverySku: "请映射每个SKU或将其标记为已下架",
    invalidWooperMapping: "每个已完成的映射必须从列表中选择有效的Wooper SKU",
    selectWooperSku: "选择Wooper SKU",
    mappingsSaved: "已保存{count}个SKU映射",
    nonExistingExcluded: "已排除{count}个已下架SKU",
    fileLoadedRates: "{file}已加载{count}个{platform}佣金率",
    ratesAppliedMissing: "已应用{applied}个佣金率；{missing}个需要审核",
    ratesApplied: "已为{count}个SKU应用佣金率",
    invalidCommission: "请为每个缺少佣金率的SKU输入0%至100%的佣金率",
    suggestedRatesApplied: "已应用{count}个建议佣金率",
    resolveCommissionBeforeExport: "导出前请处理所有缺少的佣金率",
    uploadCommissionFirst: "请先上传DingTalk中的UK Product Commission Rate List",
    selectEligibleSku: "请至少选择一个符合条件的SKU",
    selectedExported: "已导出{count}个选定SKU",
    saveWorktable: "\u4fdd\u5b58\u5de5\u4f5c\u8868",
    savedWorktables: "\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868",
    recordTracking: "\u8bb0\u5f55\u8ffd\u8e2a",
    saveWorktableHelp: "\u8bf7\u786e\u8ba4\u4fc3\u9500\u8be6\u7ec6\u4fe1\u606f\u3002\u5df2\u4fdd\u5b58\u7684\u5de5\u4f5c\u8868\u662f\u6c38\u4e45\u7684\u53ea\u8bfb\u8bb0\u5f55\u3002",
    promotionPlatform: "\u4fc3\u9500\u5e73\u53f0",
    eventName: "\u6d3b\u52a8\u540d\u79f0",
    savePermanentRecord: "\u4fdd\u5b58\u6c38\u4e45\u8bb0\u5f55",
    cancel: "\u53d6\u6d88",
    candidates: "\u5019\u9009SKU",
    sourceRows: "\u6e90\u6570\u636e\u884c",
    worktableSaved: "\u5de5\u4f5c\u8868\u5df2\u4fdd\u5b58\u4e3a\u6c38\u4e45\u8bb0\u5f55",
    worktableSaveFailed: "\u65e0\u6cd5\u4fdd\u5b58\u5de5\u4f5c\u8868",
    saveRequiresRows: "\u8bf7\u5148\u5bfc\u5165\u5e76\u8ba1\u7b97\u81f3\u5c11\u4e00\u4e2aSKU",
    platformMustMatch: "\u4fc3\u9500\u5e73\u53f0\u5fc5\u987b\u4e0e\u5f53\u524d\u8ba1\u7b97\u4e00\u81f4",
    eventNameRequired: "\u8bf7\u8f93\u5165\u6d3b\u52a8\u540d\u79f0",
    worktableArchive: "\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868",
    searchEventName: "\u641c\u7d22\u6d3b\u52a8\u540d\u79f0",
    creationDate: "\u521b\u5efa\u65e5\u671f",
    created: "\u521b\u5efa\u65f6\u95f4",
    skus: "SKU\u6570\u91cf",
    view: "\u67e5\u770b",
    search: "\u641c\u7d22",
    loadingSavedWorktables: "\u6b63\u5728\u52a0\u8f7d\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868...",
    savedWorktableCount: "{count}\u4e2a\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868",
    noSavedWorktables: "\u6ca1\u6709\u7b26\u5408\u7b5b\u9009\u6761\u4ef6\u7684\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868\u3002",
    savedWorktableLoadFailed: "\u65e0\u6cd5\u52a0\u8f7d\u5df2\u4fdd\u5b58\u5de5\u4f5c\u8868",
    viewingSavedRecord: "\u6b63\u5728\u67e5\u770b\u5df2\u4fdd\u5b58\u8bb0\u5f55\uff1a{platform} - {event}",
    readOnlyHistoricalRecord: "\u521b\u5efa\u4e8e{date}\u3002\u6b64\u5386\u53f2\u8bb0\u5f55\u4e3a\u5…18012 tokens truncated….commissionMissing.length,
    platform,
  });
  element("commissionMissingList").innerHTML = state.commissionMissing.map((item) => `
    <div class="commission-missing-row">
      <strong>${escapeHtml(item.sku)}</strong>
      <label>${t("commissionRate")}
        <div class="input-suffix">
          <input class="missing-commission-rate" type="number" min="0" max="100" step="0.1"
            data-sku="${escapeHtml(item.sku)}" value="${number(item.suggested_rate * 100, 1)}">
          <span>%</span>
        </div>
      </label>
      <span class="commission-suggestion-source">${escapeHtml(t(item.source_key))}</span>
    </div>
  `).join("");
  element("commissionMissingModal").classList.add("visible");
}

async function applyCommissionRates({
  selectEligible = false,
  promptMissing = true,
  signal,
} = {}) {
  const platformRows = commissionPlatformRows();
  const bySku = new Map(
    platformRows.map((row) => [String(row.sku || "").trim().toUpperCase(), Number(row.commission)]),
  );
  state.commissionMissing = [];
  let applied = 0;
  state.rows.forEach((row) => {
    row.commission = null;
    delete row.commission_source;
    row.commission_requires_review = false;
    const sku = String(row.sku || "").trim().toUpperCase();
    const rate = bySku.get(sku);
    if (Number.isFinite(rate)) {
      row.commission = rate;
      row.commission_source = "UK Product Commission Rate List";
      applied += 1;
      return;
    }
    if (sku) {
      const suggestion = commissionSuggestion(row, platformRows);
      row.commission_requires_review = true;
      state.commissionMissing.push({
        sku,
        suggested_rate: suggestion.rate,
        source_key: suggestion.source_key,
      });
    }
  });
  state.commissionTableLoaded = (
    state.rows.length > 0
    && applied === state.rows.length
    && state.commissionMissing.length === 0
  );
  updateCommissionRequirement();
  await calculate({ selectEligible, signal });
  if (signal?.aborted) return applied;
  if (state.commissionMissing.length && promptMissing) {
    openCommissionMissingModal();
  } else {
    element("commissionMissingModal").classList.remove("visible");
  }
  return applied;
}

async function importCommissionTable(file) {
  const operation = beginImportOperation("commission", file);
  setCalculationStatus("importing");
  try {
    const fileBody = await file.arrayBuffer();
    if (!importOperationIsActive(operation)) return;
    const response = await fetch("/api/import-commissions", {
      method: "POST",
      headers: { "X-Filename": file.name },
      body: fileBody,
      signal: operation.controller.signal,
    });
    const payload = await response.json();
    if (!importOperationIsActive(operation)) return;
    if (!response.ok) throw new Error(payload.error || "Commission import failed");
    state.commissionRows = payload.rows;
    state.commissionFileName = file.name;
    const platformRows = commissionPlatformRows();
    if (!platformRows.length) {
      state.commissionTableLoaded = false;
      state.commissionMissing = [];
      updateCommissionRequirement();
      throw new Error(
        `${file.name} does not contain a ${element("platform").value} commission tab`,
      );
    }
    if (!state.rows.length || state.unresolved.length) {
      state.commissionTableLoaded = true;
      updateCommissionRequirement();
      showToast(
        t("fileLoadedRates", {
          file: file.name,
          count: platformRows.length,
          platform: element("platform").value,
        }),
      );
      setCalculationStatus(
        operation.snapshot.calculationStatus.key,
        operation.snapshot.calculationStatus.values,
      );
      return;
    }
    const applied = await applyCommissionRates({ signal: operation.controller.signal });
    if (!importOperationIsActive(operation)) return;
    if (state.commissionMissing.length) {
      showToast(
        t("ratesAppliedMissing", {
          applied,
          missing: state.commissionMissing.length,
        }),
        "error",
      );
    } else {
      showToast(t("ratesApplied", { count: applied }));
    }
  } catch (error) {
    if (isAbortError(error)) return;
    setCalculationStatus("importFailed");
    showToast(translateMessage(error.message), "error");
  } finally {
    finishImportOperation(operation);
  }
}

async function applySuggestedCommissions() {
  const inputs = [...document.querySelectorAll(".missing-commission-rate")];
  const values = inputs.map((input) => ({
    sku: input.dataset.sku,
    rate: Number(input.value) / 100,
  }));
  if (values.some((item) => !Number.isFinite(item.rate) || item.rate < 0 || item.rate > 1)) {
    showToast(t("invalidCommission"), "error");
    return;
  }
  const bySku = new Map(values.map((item) => [item.sku, item.rate]));
  state.rows.forEach((row) => {
    const rate = bySku.get(String(row.sku || "").trim().toUpperCase());
    if (Number.isFinite(rate)) {
      row.commission = rate;
      row.commission_source = "User-confirmed suggested rate";
      row.commission_requires_review = false;
    }
  });
  state.commissionMissing = [];
  state.commissionTableLoaded = state.rows.every(
    (row) => Number.isFinite(Number(row.commission)),
  );
  element("commissionMissingModal").classList.remove("visible");
  updateCommissionRequirement();
  await calculate();
  showToast(t("suggestedRatesApplied", { count: values.length }));
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportSelected() {
  const criteria = criteriaFromForm();
  const inputVatLabel = criteria.input_price_includes_vat
    ? "VAT Included"
    : "VAT Excluded";
  const exportVatLabel = criteria.export_price_includes_vat
    ? "VAT Included"
    : "VAT Excluded";
  const rows = state.candidates.filter((row) => state.selected.has(row.sku));
  if (isVariableCommissionPlatform() && !state.commissionTableLoaded) {
    showToast(
      state.commissionMissing.length
        ? t("resolveCommissionBeforeExport")
        : t("uploadCommissionFirst"),
      "error",
    );
    return;
  }
  if (!rows.length) {
    showToast(t("selectEligibleSku"), "error");
    return;
  }
  const headers = [
    "Platform",
    "Campaign",
    "Platform SKU",
    "Product ID",
    "SKU",
    "CA Price - Normal Price (VAT Included)",
    `Offer Price (${inputVatLabel})`,
    "Calculation Price Source",
    "Price Used (VAT Included)",
    "Final Discount",
    `Promotion Price (${exportVatLabel})`,
    "Promotion Margin",
    "Lifetime Profit Margin (After Returns)",
    "Return Rate (All Platforms)",
    "Approval",
    "Remark",
  ];
  const body = rows.map((row) => [
    criteria.platform,
    criteria.campaign_name,
    row.platform_sku,
    row.product_id,
    row.sku,
    row.ca_price == null ? "" : Number(row.ca_price).toFixed(2),
    row.offer_price == null ? "" : Number(row.offer_price).toFixed(2),
    row.calculation_price_source === "ca" ? "CA Price" : "Offer Price",
    Number(row.price_including_vat || 0).toFixed(2),
    `${(Number(row.final_discount || 0) * 100).toFixed(1)}%`,
    Number(row.promo_price || 0).toFixed(2),
    `${(Number(row.promo_margin || 0) * 100).toFixed(2)}%`,
    row.lifetime_profit_margin == null
      ? ""
      : `${(Number(row.lifetime_profit_margin) * 100).toFixed(2)}%`,
    row.return_rate == null
      ? ""
      : `${(Number(row.return_rate) * 100).toFixed(2)}%`,
    "",
    (row.warnings || []).join("; "),
  ]);
  const csv = "\ufeff" + [headers, ...body].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const slug = criteria.campaign_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "promotion";
  link.href = URL.createObjectURL(blob);
  link.download = `${criteria.platform}-${slug}-nomination.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(t("selectedExported", { count: rows.length }));
}

function resetCriteria() {
  element("minGrade").value = 0;
  element("minStock").value = 1;
  element("minMonths").value = 0;
  element("minDiscount").value = 5;
  element("maxReturnRate").value = 6;
  document.querySelectorAll(".multi-select-option input").forEach((input) => {
    input.checked = false;
  });
  ["mainCategory", "subcategory", "brand"].forEach(updateMultiSelectSummary);
  element("firstArrivalCutoff").value = "";
  element("maxDiscount").value = 25;
  element("defaultCommission").value = 26.4;
  element("rounding").checked = true;
  element("discountIntervalEnabled").checked = false;
  element("discountInterval").value = 5;
  element("discountInterval").disabled = true;
  setPriceSource("ca", { recalculate: false });
  setVatSetting("input", "included", { recalculate: false });
  setVatSetting("export", "included", { recalculate: false });
  document.querySelectorAll(".grade-margin").forEach((input) => {
    input.value = DEFAULT_MARGINS[input.dataset.grade];
  });
  calculate({ selectEligible: true });
}

let formTimer;
function scheduleCalculation() {
  clearTimeout(formTimer);
  formTimer = setTimeout(() => calculate(), 180);
}

function bindEvents() {
  const toggleLanguage = () => {
    applyLanguage(state.language === "en" ? "zh" : "en");
  };
  element("languageButton").addEventListener("click", toggleLanguage);
  element("guideLanguageButton").addEventListener("click", toggleLanguage);
  element("helpButton").addEventListener("click", openGuide);
  element("saveWorktableButton").addEventListener("click", openSaveWorktableModal);
  element("savedWorktablesButton").addEventListener("click", openSavedWorktablesModal);
  element("cancelSaveWorktable").addEventListener("click", closeSaveWorktableModal);
  element("confirmSaveWorktable").addEventListener("click", saveWorktable);
  element("closeSavedWorktables").addEventListener("click", closeSavedWorktablesModal);
  element("closeSavedWorktablesIcon").addEventListener("click", closeSavedWorktablesModal);
  element("searchSavedWorktables").addEventListener("click", loadSavedWorktables);
  element("returnToDraft").addEventListener("click", returnToDraft);
  element("savedWorktableRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-worktable-id]");
    if (button) viewSavedWorktable(button.dataset.worktableId);
  });
  element("guideCloseIcon").addEventListener("click", closeGuide);
  element("guideCloseButton").addEventListener("click", closeGuide);
  element("guidePrevious").addEventListener("click", showPreviousGuideStep);
  element("guideNext").addEventListener("click", showNextGuideStep);
  document.querySelectorAll(".price-source-option").forEach((button) => {
    button.addEventListener("click", () => {
      setPriceSource(button.dataset.priceSource);
    });
  });
  document.querySelectorAll(".vat-option").forEach((button) => {
    button.addEventListener("click", () => {
      setVatSetting(button.dataset.vatSetting, button.dataset.vatValue);
    });
  });
  element("loadSample").addEventListener("click", loadSample);
  element("criteriaToggle").addEventListener("click", () => {
    setCriteriaCollapsed(!state.criteriaCollapsed);
  });
  element("importButton").addEventListener("click", () => element("fileInput").click());
  element("firstImportButton").addEventListener("click", () => element("fileInput").click());
  element("firstSampleButton").addEventListener("click", loadSample);
  element("cancelImport").addEventListener("click", cancelImportOperation);
  element("fileInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importFile(file);
    event.target.value = "";
  });
  element("exportButton").addEventListener("click", exportSelected);
  element("saveMappings").addEventListener("click", saveMappings);
  element("closeMappings").addEventListener("click", closeMappingModal);
  element("mappingButton").addEventListener("click", openMappingModal);
  element("mappingSearch").addEventListener("input", (event) => {
    const search = event.target.value.trim().toLowerCase();
    document.querySelectorAll("#mappingList .mapping-row").forEach((row) => {
      row.hidden = Boolean(search) && !row.dataset.search.includes(search);
    });
  });
  element("platform").addEventListener("change", setPlatformDefault);
  element("commissionButton").addEventListener("click", () => element("commissionFileInput").click());
  element("commissionRequirementButton").addEventListener("click", () => element("commissionFileInput").click());
  element("reuploadCommission").addEventListener("click", () => element("commissionFileInput").click());
  element("closeCommissionMissing").addEventListener("click", () => {
    element("commissionMissingModal").classList.remove("visible");
  });
  element("applySuggestedCommissions").addEventListener("click", applySuggestedCommissions);
  element("commissionFileInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importCommissionTable(file);
    event.target.value = "";
  });
  element("resetCriteria").addEventListener("click", resetCriteria);
  element("discountIntervalEnabled").addEventListener("change", () => {
    element("discountInterval").disabled = !element("discountIntervalEnabled").checked;
  });
  element("criteriaForm").addEventListener("input", scheduleCalculation);
  element("criteriaForm").addEventListener("change", (event) => {
    const control = event.target.closest(".multi-select");
    if (control) updateMultiSelectSummary(control.id);
    scheduleCalculation();
  });
  document.querySelectorAll(".multi-select-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      const control = button.closest(".multi-select");
      const willOpen = !control.classList.contains("open");
      document.querySelectorAll(".multi-select.open").forEach((item) => {
        item.classList.remove("open");
        item.querySelector(".multi-select-trigger").setAttribute("aria-expanded", "false");
        item.querySelector(".multi-select-menu").hidden = true;
      });
      control.classList.toggle("open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      control.querySelector(".multi-select-menu").hidden = !willOpen;
    });
  });
  element("criteriaForm").addEventListener("click", (event) => {
    const clearButton = event.target.closest(".multi-select-clear");
    if (!clearButton) return;
    const control = clearButton.closest(".multi-select");
    control.querySelectorAll(".multi-select-option input").forEach((input) => {
      input.checked = false;
    });
    updateMultiSelectSummary(control.id);
    scheduleCalculation();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".multi-select")) return;
    document.querySelectorAll(".multi-select.open").forEach((control) => {
      control.classList.remove("open");
      control.querySelector(".multi-select-trigger").setAttribute("aria-expanded", "false");
      control.querySelector(".multi-select-menu").hidden = true;
    });
  });

  element("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  element("selectAll").addEventListener("change", (event) => {
    state.candidates.filter(candidateMatches).filter((row) => row.eligible).forEach((row) => {
      if (event.target.checked) state.selected.add(row.sku);
      else state.selected.delete(row.sku);
    });
    markDirty();
    render();
  });
  element("candidateRows").addEventListener("change", (event) => {
    if (event.target.matches(".row-select")) {
      if (event.target.checked) state.selected.add(event.target.dataset.sku);
      else state.selected.delete(event.target.dataset.sku);
      markDirty();
      render();
    }
    if (event.target.matches(".override-input")) {
      const row = state.rows.find((item) => item.sku === event.target.dataset.sku);
      if (row) {
        row.override_discount = Number(event.target.value || 0) / 100;
        calculate();
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && element("importProgressModal").classList.contains("visible")) {
      cancelImportOperation();
      return;
    }
    if (event.key === "Escape" && element("saveWorktableModal").classList.contains("visible")) {
      closeSaveWorktableModal();
    }
    if (event.key === "Escape" && element("savedWorktablesModal").classList.contains("visible")) {
      closeSavedWorktablesModal();
    }
    if (event.key === "Escape") {
      document.querySelectorAll(".multi-select.open").forEach((control) => {
        control.classList.remove("open");
        control.querySelector(".multi-select-trigger").setAttribute("aria-expanded", "false");
        control.querySelector(".multi-select-menu").hidden = true;
      });
    }
    if (event.key === "Escape" && element("guideModal").classList.contains("visible")) {
      closeGuide();
    }
    if (
      event.key === "Escape"
      && element("commissionMissingModal").classList.contains("visible")
    ) {
      element("commissionMissingModal").classList.remove("visible");
    }
    if (
      event.key === "Escape"
      && element("mappingModal").classList.contains("visible")
    ) {
      closeMappingModal();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty || state.savedRecord) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

buildMarginInputs();
bindEvents();
setCriteriaCollapsed(state.criteriaCollapsed, { persist: false });
applyLanguage(state.language, { persist: false });
loadConfig()
  .then(() => {
    let guideSeen = false;
    try {
      guideSeen = localStorage.getItem(GUIDE_STORAGE_KEY) === "seen";
    } catch {
      guideSeen = false;
    }
    if (!guideSeen) openGuide();
    else maybeOpenStartupMappings();
  })
  .catch((error) => showToast(translateMessage(error.message), "error"));
