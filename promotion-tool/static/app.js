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
    invalidWooperMapping: "One or more mappings do not match a known Wooper SKU",
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
    invalidWooperMapping: "一个或多个映射与已知Wooper SKU不匹配",
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
  },
};

const GUIDE_STEPS = {
  en: [
  {
    title: "Choose the platform",
    summary: "Start each promotion run by selecting the marketplace.",
    points: [
      "The default commission rate is filled automatically and can be amended for the current run.",
      "For variable-rate platforms, download UK Product Commission Rate List from DingTalk and upload the complete workbook.",
      "The workbook keeps each variable-commission platform on its own tab.",
      "Enter a campaign name so the exported file is easy to identify.",
    ],
  },
  {
    title: "Import current offers",
    summary: "Upload the platform file before changing the nomination criteria.",
    points: [
      "The file must contain the platform SKU and current offer price.",
      "CSV, XLSX, and XLSM files are supported.",
      "If offer price is blank, the matching CA price is used automatically.",
      "A progress window remains visible while an offer or commission file is processed; use Cancel import to stop and keep the previous results.",
    ],
  },
  {
    title: "Review SKU matches",
    summary: "Only SKUs that cannot be matched automatically need attention.",
    points: [
      "Exact matches, the CA Price naming rule, and saved mappings are applied automatically.",
      "After each data refresh, the tool opens with any new unresolved CA SKUs that need attention.",
      "More than one CA SKU may map to the same Wooper SKU.",
      "CA SKUs ending in -ALL are parent SKUs and are automatically classified as Non-existing.",
      "Completed mappings and non-existing statuses are saved in Supabase and reused by future refreshes.",
      "Enter the correct Wooper SKU for a genuine mapping exception.",
      "Mark an old product as Non-existing SKU to exclude it from calculations and future prompts.",
    ],
  },
  {
    title: "Set nomination filters",
    summary: "Use Wooper product data to control which products may participate.",
    points: [
      "Filter by grade, main category, subcategory, brand, stock, and estimated selling months.",
      "Main category, subcategory, and brand allow multiple selections; an empty selection means all values.",
      "Use the first-arrival cutoff to exclude newer products.",
      "Minimum discount removes products that cannot support the required campaign discount.",
      "Collapse the Criteria panel when the settings are no longer needed; the results table expands and the panel can be reopened at any time.",
    ],
  },
  {
    title: "Review pricing rules",
    summary: "The discount is calculated from the grade-to-profit-margin matrix.",
    points: [
      "The workbook rates are loaded as defaults and can be amended for the current run.",
      "Choose CA price or offer price as the normal-price basis for the calculation.",
      "Suggested freight follows the SKU performance dashboard for the mapped Wooper SKU.",
      "WMS is 8% of the promotion selling price excluding VAT and is included in reverse pricing.",
      "Maximum discount caps the proposed reduction.",
      "Enable a discount interval to round suggested discounts down to steps such as 5%, 10%, and 15%.",
    ],
  },
  {
    title: "Approve and export",
    summary: "Review the decisions before creating the platform submission file.",
    points: [
      "Use Eligible, Excluded, and Warnings to focus the review.",
      "Return rates at or above 6% are highlighted red for review.",
      "A lifetime margin more than 5 points above promo margin is highlighted red for review.",
      "Hover or focus the information icons in the table headers to review the red-highlight rules.",
      "The header row stays visible while scrolling through long SKU lists.",
      "Select only the SKUs you want to nominate.",
      "Choose whether exported prices include VAT; the CSV header records the selection.",
    ],
  },
  ],
  zh: [
    {
      title: "选择平台",
      summary: "每次促销计算先选择对应的销售平台。",
      points: [
        "系统会自动填写默认佣金率，本次计算中可手动修改。",
        "对于浮动佣金率平台，请从DingTalk下载UK Product Commission Rate List并上传完整工作簿。",
        "工作簿中每个浮动佣金率平台分别保存在不同工作表。",
        "输入促销名称，便于识别导出的文件。",
      ],
    },
    {
      title: "导入当前售价",
      summary: "调整提名条件前，请先上传平台售价文件。",
      points: [
        "文件必须包含平台SKU和当前售价。",
        "支持CSV、XLSX和XLSM文件。",
        "如果当前售价为空，系统会自动使用匹配的CA價。",
        "处理售价或佣金率文件时会显示导入进度窗口；点击取消导入可停止处理并保留之前的结果。",
      ],
    },
    {
      title: "审核SKU映射",
      summary: "只有无法自动匹配的SKU才需要人工处理。",
      points: [
        "系统会自动应用完全匹配、CA命名规则和已保存的映射。",
        "如确实存在命名差异，请输入正确的Wooper SKU。",
        "旧商品可标记为已下架SKU，之后不会计算促销或再次提示映射。",
      ],
    },
    {
      title: "设置提名筛选",
      summary: "使用Wooper商品数据控制哪些商品可以参加促销。",
      points: [
        "可按等级、主类别、子类别、品牌、库存和预计可售月数筛选。",
        "使用首次到货日期截止条件排除新品。",
        "最低折扣会排除无法支持活动所需折扣的商品。",
        "不再需要调整设置时可收起筛选条件面板；结果表会展开，并可随时重新打开面板。",
      ],
    },
    {
      title: "审核定价规则",
      summary: "折扣根据等级与目标利润率矩阵计算。",
      points: [
        "工作簿中的利润率为默认值，本次计算中可手动修改。",
        "可选择CA價或当前售价作为促销计算基准。",
        "建议运费与SKU绩效看板中映射后的Wooper SKU保持一致。",
        "WMS为促销价不含VAT金额的8%，并计入反向定价。",
        "最大折扣限制系统建议的降价幅度。",
        "启用折扣间隔后，建议折扣会向下取整至5%、10%、15%等档位。",
      ],
    },
    {
      title: "审核并导出",
      summary: "生成平台提交文件前，请审核计算结果。",
      points: [
        "使用符合、排除和审核项筛选结果。",
        "退货率达到或超过6%时会以红色标记并需要审核。",
        "生命周期利润率比促销利润率高出超过5个百分点时会以红色标记并需要审核。",
        "只选择需要提名的SKU。",
        "选择导出价格是否含VAT；CSV表头会记录该选择。",
      ],
    },
  ],
};

GUIDE_STEPS.zh[3].points.splice(
  1,
  0,
  "\u4e3b\u7c7b\u522b\u3001\u5b50\u7c7b\u522b\u548c\u54c1\u724c\u53ef\u591a\u9009\uff1b\u672a\u9009\u62e9\u4efb\u4f55\u503c\u65f6\u8868\u793a\u5168\u90e8\u3002",
);
GUIDE_STEPS.zh[2].points.splice(
  1,
  0,
  "\u6bcf\u6b21\u6570\u636e\u5237\u65b0\u540e\uff0c\u5de5\u5177\u542f\u52a8\u65f6\u4f1a\u63d0\u793a\u65b0\u589e\u7684\u672a\u6620\u5c04CA SKU\u3002",
  "\u591a\u4e2aCA SKU\u53ef\u4ee5\u6620\u5c04\u5230\u540c\u4e00\u4e2aWooper SKU\u3002",
  "CA SKU\u4ee5-ALL\u7ed3\u5c3e\u65f6\u4e3a\u7236SKU\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u5c06\u5176\u6807\u8bb0\u4e3a\u4e0d\u5b58\u5728SKU\u3002",
  "\u5df2\u5b8c\u6210\u7684\u6620\u5c04\u548c\u5df2\u4e0b\u67b6\u72b6\u6001\u4fdd\u5b58\u5728Supabase\u4e2d\uff0c\u4ee5\u540e\u5237\u65b0\u65f6\u4f1a\u81ea\u52a8\u91cd\u7528\u3002",
);
GUIDE_STEPS.zh[5].points.splice(
  3,
  0,
  "\u5c06\u9f20\u6807\u79fb\u5230\u8868\u5934\u7684\u4fe1\u606f\u56fe\u6807\u4e0a\uff0c\u6216\u4f7f\u7528\u952e\u76d8\u805a\u7126\u56fe\u6807\uff0c\u53ef\u67e5\u770b\u7ea2\u8272\u9ad8\u4eae\u89c4\u5219\u3002",
  "\u6eda\u52a8\u67e5\u770b\u8f83\u957f\u7684SKU\u6e05\u5355\u65f6\uff0c\u8868\u5934\u4f1a\u4fdd\u6301\u53ef\u89c1\u3002",
);

const state = {
  rows: [],
  candidates: [],
  selected: new Set(),
  config: { defaultCommissions: {}, variableCommissionPlatforms: [], wooperSkus: [] },
  unresolved: [],
  caUnresolved: [],
  mappingRows: [],
  mappingScope: "platform",
  restoreFirstImportAfterMapping: false,
  commissionTableLoaded: false,
  commissionRows: [],
  commissionMissing: [],
  commissionFileName: "",
  filter: "all",
  search: "",
  source: "Workbook-verified sample data",
  requestId: 0,
  priceSource: "ca",
  inputPriceIncludesVat: true,
  exportPriceIncludesVat: true,
  guideStep: 0,
  restoreFirstImportAfterGuide: false,
  language: (() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
    } catch {
      return "en";
    }
  })(),
  sourceKind: "sample",
  sourceFile: "",
  sourceRows: 0,
  calculationStatus: { key: "ready", values: {} },
  importSequence: 0,
  importOperation: null,
  criteriaCollapsed: (() => {
    try {
      return localStorage.getItem(CRITERIA_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  })(),
};

const element = (id) => document.getElementById(id);

function t(key, values = {}) {
  const template = UI_TEXT[state.language]?.[key] ?? UI_TEXT.en[key] ?? key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function translateMessage(message) {
  if (state.language !== "zh") return message;
  const exact = {
    "Offer price unavailable; CA price used": "当前售价不可用；已使用CA價",
    "CA price unavailable; offer price used": "CA價不可用；已使用当前售价",
    "Commission rate needs confirmation": "佣金率需要确认",
    "Lifetime margin exceeds promo margin by more than 5 points": "生命周期利润率比促销利润率高出超过5个百分点",
    "Override discount leaves margin below target": "手动折扣导致利润率低于目标",
    "Rounding leaves margin slightly below target": "价格舍入导致利润率略低于目标",
    "Final discount leaves margin below target": "最终折扣导致利润率低于目标",
    "Grade below threshold": "等级低于筛选条件",
    "Stock below threshold": "库存低于筛选条件",
    "Saleable months below threshold": "可售月数低于筛选条件",
    "Available discount below minimum": "可用折扣低于最低要求",
    "Target margin requires a price increase": "达到目标利润率需要提高价格",
    "Outside selected categories": "不属于所选类别",
    "Outside selected main category": "不属于所选主类别",
    "Outside selected subcategory": "不属于所选子类别",
    "Outside selected brand": "不属于所选品牌",
    "First arrival is inside the excluded new-product period": "首次到货日期在新品排除范围内",
    "Price or margin settings make reverse pricing impossible": "当前价格或利润率设置无法进行反向定价",
  };
  if (exact[message]) return exact[message];
  const returnMatch = message.match(/^Return rate is at or above (.+) review threshold$/);
  if (returnMatch) return `退货率达到或超过${returnMatch[1]}审核阈值`;
  return message;
}

function setControlLabel(id, key) {
  const field = element(id)?.closest(".filter-field");
  if (field) {
    field.querySelector(":scope > .field-label").textContent = t(key);
    return;
  }
  const label = element(id)?.closest("label");
  const textNode = label
    ? [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
    : null;
  if (textNode) textNode.textContent = `${t(key)}\n`;
}

function setStaticText(selector, key) {
  const node = document.querySelector(selector);
  if (node) node.textContent = t(key);
}

function setCalculationStatus(key, values = {}) {
  state.calculationStatus = { key, values };
  element("calculationStatus").textContent = t(key, values);
}

function updateCriteriaToggle() {
  const key = state.criteriaCollapsed ? "showCriteria" : "hideCriteria";
  const button = element("criteriaToggle");
  button.title = t(key);
  button.setAttribute("aria-label", t(key));
  button.setAttribute("aria-expanded", String(!state.criteriaCollapsed));
  element("criteriaToggleIcon").textContent = state.criteriaCollapsed ? "+" : "\u2212";
}

function setCriteriaCollapsed(collapsed, { persist = true } = {}) {
  state.criteriaCollapsed = Boolean(collapsed);
  element("workspace").classList.toggle("criteria-collapsed", state.criteriaCollapsed);
  updateCriteriaToggle();
  if (persist) {
    try {
      localStorage.setItem(CRITERIA_STORAGE_KEY, String(state.criteriaCollapsed));
    } catch {
      // The panel still changes for the current session when storage is unavailable.
    }
  }
}

function captureImportSnapshot() {
  return structuredClone({
    rows: state.rows,
    candidates: state.candidates,
    selected: state.selected,
    unresolved: state.unresolved,
    mappingRows: state.mappingRows,
    mappingScope: state.mappingScope,
    commissionTableLoaded: state.commissionTableLoaded,
    commissionRows: state.commissionRows,
    commissionMissing: state.commissionMissing,
    commissionFileName: state.commissionFileName,
    sourceKind: state.sourceKind,
    sourceFile: state.sourceFile,
    sourceRows: state.sourceRows,
    calculationStatus: state.calculationStatus,
  });
}

function restoreImportSnapshot(snapshot) {
  Object.assign(state, snapshot);
  updateMappingButton();
  updateWooperFilters();
  updateCommissionRequirement();
  render();
}

function updateImportProgressText() {
  const operation = state.importOperation;
  if (!operation) return;
  setStaticText("#importProgressModal .eyebrow", "importInProgress");
  element("importProgressTitle").textContent = t(
    operation.kind === "commission" ? "loadingCommissionTable" : "loadingPlatformData",
  );
  element("importProgressMessage").textContent = t("importProgressMessage", {
    file: operation.fileName,
  });
  element("importProgressHelp").textContent = t("importProgressHelp");
  element("cancelImport").textContent = t("cancelImport");
}

function beginImportOperation(kind, file) {
  if (state.importOperation) {
    state.importOperation.controller.abort();
  }
  const operation = {
    id: ++state.importSequence,
    kind,
    fileName: file.name,
    controller: new AbortController(),
    snapshot: captureImportSnapshot(),
  };
  state.importOperation = operation;
  updateImportProgressText();
  element("importProgressModal").classList.add("visible");
  requestAnimationFrame(() => element("cancelImport").focus({ preventScroll: true }));
  return operation;
}

function importOperationIsActive(operation) {
  return state.importOperation?.id === operation.id && !operation.controller.signal.aborted;
}

function finishImportOperation(operation) {
  if (state.importOperation?.id !== operation.id) return;
  state.importOperation = null;
  element("importProgressModal").classList.remove("visible");
}

function cancelImportOperation() {
  const operation = state.importOperation;
  if (!operation) return;
  state.importOperation = null;
  operation.controller.abort();
  state.requestId += 1;
  element("importProgressModal").classList.remove("visible");
  restoreImportSnapshot(operation.snapshot);
  setCalculationStatus("importCancelled");
  showToast(t("importCancelled"));
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function number(value, digits = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "-";
}

function money(value) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-GB", { style: "currency", currency: "GBP" })
    : "-";
}

function percent(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${number(parsed * 100, digits)}%` : "-";
}

function showToast(message, type = "") {
  const toast = element("toast");
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function applyLanguage(language, { persist = true } = {}) {
  state.language = language === "zh" ? "zh" : "en";
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("appTitle");

  setStaticText(".brand-block h1", "appTitle");
  setStaticText(".brand-block p", "appSubtitle");
  document.querySelector(".environment").innerHTML = `<span></span>${t("localDemo")}`;
  element("languageButton").textContent = state.language === "zh" ? t("english") : t("chinese");
  element("languageButton").title = state.language === "zh" ? t("displayEnglish") : t("displayChinese");
  element("guideLanguageButton").textContent = state.language === "zh" ? t("english") : t("chinese");
  element("guideLanguageButton").title = state.language === "zh" ? t("displayEnglish") : t("displayChinese");
  element("helpButton").title = t("openGuide");
  element("helpButton").setAttribute("aria-label", t("openGuide"));
  element("loadSample").textContent = t("loadSample");
  element("importButton").textContent = t("importData");
  element("mappingButton").textContent = t("resolveMappings");
  element("commissionButton").textContent = t("commissionTable");
  element("exportButton").textContent = t("exportSelected");

  setStaticText(".panel-heading .eyebrow", "campaignSetup");
  setStaticText(".panel-heading h2", "criteria");
  element("resetCriteria").title = t("resetCriteria");
  element("resetCriteria").setAttribute("aria-label", t("resetCriteria"));
  updateCriteriaToggle();
  [
    ["platform", "platform"],
    ["campaignType", "campaignType"],
    ["campaignName", "campaignName"],
    ["minGrade", "minimumGrade"],
    ["minStock", "minimumStock"],
    ["minMonths", "minimumMonths"],
    ["minDiscount", "minimumDiscount"],
    ["maxReturnRate", "returnReviewThreshold"],
    ["mainCategory", "mainCategory"],
    ["subcategory", "subcategory"],
    ["brand", "brand"],
    ["firstArrivalCutoff", "excludeFirstArrivals"],
    ["maxDiscount", "maximumDiscount"],
    ["defaultCommission", "defaultCommission"],
    ["discountInterval", "discountInterval"],
  ].forEach(([id, key]) => setControlLabel(id, key));
  element("campaignType").options[0].textContent = t("themeEvent");
  element("campaignType").options[1].textContent = t("singleDeal");
  document.querySelectorAll(".section-label")[0].textContent = t("nominationFilters");
  document.querySelectorAll(".section-label")[1].textContent = t("pricingRules");
  document.querySelectorAll(".toggle-row > span")[0].textContent = t("roundPromoPrices");
  document.querySelectorAll(".toggle-row > span")[1].textContent = t("useDiscountInterval");
  document.querySelector(".margin-header span:first-child").textContent = t("minimumMarginByGrade");
  document.querySelector(".margin-header span:last-child").textContent = t("target");
  document.querySelectorAll(".margin-cell > span").forEach((node, index) => {
    node.textContent = `${t("grade")} ${index}`;
  });

  const summaryKeys = ["imported", "eligible", "selected", "averageDiscount", "projectedProfit"];
  document.querySelectorAll(".summary-strip > div > span").forEach((node, index) => {
    node.textContent = t(summaryKeys[index]);
  });
  element("searchInput").placeholder = t("searchPlaceholder");
  document.querySelector(".vat-controls").setAttribute("aria-label", t("vatPriceSettings"));
  const vatSettingKeys = ["calculateFrom", "importedPrice", "exportPrice"];
  document.querySelectorAll(".vat-setting > span").forEach((node, index) => {
    node.textContent = t(vatSettingKeys[index]);
  });
  document.querySelector(".price-source-option[data-price-source='ca']").textContent = t("caPrice");
  document.querySelector(".price-source-option[data-price-source='offer']").textContent = t("offerPrice");
  document.querySelectorAll(".vat-option[data-vat-value='included']").forEach((node) => {
    node.textContent = t("included");
  });
  document.querySelectorAll(".vat-option[data-vat-value='excluded']").forEach((node) => {
    node.textContent = t("excludedVat");
  });
  document.querySelector(".filter-group").setAttribute("aria-label", t("candidateFilter"));
  const filterKeys = ["all", "eligible", "excluded", "warnings"];
  document.querySelectorAll(".filter-button").forEach((node, index) => {
    node.textContent = t(filterKeys[index]);
  });
  element("selectAll").setAttribute("aria-label", t("selectAll"));

  document.querySelectorAll("th[data-header-key]").forEach((header) => {
    const key = header.dataset.headerKey;
    header.textContent = key === "SOH" ? "SOH" : t(key);
  });
  setPriceHeader("caPriceHeader", "caPrice", "included");
  setPriceHeader(
    "offerPriceHeader",
    "offerPrice",
    state.inputPriceIncludesVat ? "included" : "excluded",
  );
  setPriceHeader("normalPriceHeader", "priceUsed", "included");
  setPriceHeader(
    "promoPriceHeader",
    "promoPrice",
    state.exportPriceIncludesVat ? "included" : "excluded",
  );
  [
    {
      id: "promoMarginHeader",
      title: "promoMargin",
      meta: "proposed",
      note: "promoMarginHighlightNote",
    },
    {
      id: "lifetimeMarginHeader",
      title: "lifetimeMargin",
      meta: "afterReturns",
      note: "lifetimeMarginHighlightNote",
    },
    {
      id: "returnRateHeader",
      title: "returnRate",
      meta: "allPlatforms",
      note: "returnRateHighlightNote",
    },
  ].forEach(({ id, title, meta, note }) => {
    const header = element(id);
    header.querySelector(".header-title").textContent = t(title);
    header.querySelector(".header-meta").textContent = t(meta);
    const info = header.querySelector(".header-note");
    info.dataset.tooltip = t(note);
    info.setAttribute("aria-label", t(note));
  });

  setStaticText(".empty-state strong", "noCandidates");
  setStaticText(".empty-state span", "adjustFilters");
  setStaticText("#firstImportModal .eyebrow", "stepOne");
  setStaticText("#firstImportTitle", "importCurrentOffers");
  setStaticText("#firstImportModal p", "firstFileHelp");
  element("firstImportButton").textContent = t("importOfferFile");
  element("firstSampleButton").textContent = t("openWorkbookSample");
  updateMappingModalText();
  element("closeMappings").textContent = t("close");
  element("saveMappings").textContent = t("saveCompletedMappings");
  element("mappingSearch").placeholder = t("mappingSearchPlaceholder");
  setStaticText("#commissionMissingModal .eyebrow", "commissionReviewRequired");
  setStaticText("#commissionMissingTitle", "commissionRatesMissing");
  element("closeCommissionMissing").textContent = t("close");
  element("reuploadCommission").textContent = t("reuploadFile");
  element("applySuggestedCommissions").textContent = t("applyRates");
  updateImportProgressText();
  setStaticText("#guideModal .eyebrow", "userGuide");
  element("guideCloseIcon").title = t("close");
  element("guideCloseIcon").setAttribute("aria-label", t("close"));
  element("guidePrevious").textContent = t("previous");
  element("guideCloseButton").textContent = t("close");

  updateWooperFilters();
  updateCommissionRequirement();
  setCalculationStatus(state.calculationStatus.key, state.calculationStatus.values);
  if (element("mappingModal").classList.contains("visible")) openMappingModal();
  if (element("commissionMissingModal").classList.contains("visible")) openCommissionMissingModal();
  if (element("guideModal").classList.contains("visible")) renderGuide();
  render();

  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
    } catch {
      // Language still changes for the current session when storage is unavailable.
    }
  }
}

function renderGuide() {
  const steps = GUIDE_STEPS[state.language];
  const step = steps[state.guideStep];
  element("guideCounter").textContent = t("stepCounter", {
    current: state.guideStep + 1,
    total: steps.length,
  });
  element("guideTitle").textContent = step.title;
  element("guideSummary").textContent = step.summary;
  element("guidePoints").innerHTML = step.points
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");
  element("guideProgress").innerHTML = steps.map((_, index) => (
    `<span class="${index <= state.guideStep ? "active" : ""}"></span>`
  )).join("");
  element("guidePrevious").disabled = state.guideStep === 0;
  element("guideNext").textContent = state.guideStep === steps.length - 1
    ? t("finish")
    : t("next");
}

function openGuide() {
  state.guideStep = 0;
  state.restoreFirstImportAfterGuide = element("firstImportModal").classList.contains("visible");
  element("firstImportModal").classList.remove("visible");
  renderGuide();
  element("guideModal").classList.add("visible");
}

function closeGuide() {
  element("guideModal").classList.remove("visible");
  try {
    localStorage.setItem(GUIDE_STORAGE_KEY, "seen");
  } catch {
    // The guide remains available from Help when browser storage is unavailable.
  }
  if (state.restoreFirstImportAfterGuide && !state.rows.length) {
    element("firstImportModal").classList.add("visible");
  }
  state.restoreFirstImportAfterGuide = false;
  maybeOpenStartupMappings();
}

function showNextGuideStep() {
  if (state.guideStep === GUIDE_STEPS[state.language].length - 1) {
    closeGuide();
    return;
  }
  state.guideStep += 1;
  renderGuide();
}

function showPreviousGuideStep() {
  if (state.guideStep === 0) return;
  state.guideStep -= 1;
  renderGuide();
}

function setVatSetting(setting, value, { recalculate = true } = {}) {
  const included = value === "included";
  if (setting === "input") {
    state.inputPriceIncludesVat = included;
  } else {
    state.exportPriceIncludesVat = included;
  }
  document.querySelectorAll(`.vat-option[data-vat-setting="${setting}"]`).forEach((button) => {
    const active = button.dataset.vatValue === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setPriceHeader(
    "offerPriceHeader",
    "offerPrice",
    state.inputPriceIncludesVat ? "included" : "excluded",
  );
  setPriceHeader(
    "promoPriceHeader",
    "promoPrice",
    state.exportPriceIncludesVat ? "included" : "excluded",
  );
  if (recalculate && state.rows.length && !state.unresolved.length) {
    calculate();
  }
}

function setPriceHeader(id, labelKey, vatBasis) {
  element(id).innerHTML = `
    <span class="header-title">${escapeHtml(t(labelKey))}</span>
    <span class="header-meta">${escapeHtml(t(vatBasis === "included" ? "vatIncluded" : "vatExcluded"))}</span>
  `;
}

function setPriceSource(source, { recalculate = true } = {}) {
  state.priceSource = source === "offer" ? "offer" : "ca";
  document.querySelectorAll(".price-source-option").forEach((button) => {
    const active = button.dataset.priceSource === state.priceSource;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (recalculate && state.rows.length && !state.unresolved.length) {
    calculate();
  }
}

function buildMarginInputs() {
  element("marginGrid").innerHTML = Object.entries(DEFAULT_MARGINS)
    .map(([grade, margin]) => `
      <label class="margin-cell">
        <span>${t("grade")} ${grade}</span>
        <div class="input-suffix">
          <input class="grade-margin" data-grade="${grade}" type="number" min="-100" max="100" step="1" value="${margin}">
          <span>%</span>
        </div>
      </label>
    `)
    .join("");
}

function criteriaFromForm() {
  const gradeMargins = {};
  document.querySelectorAll(".grade-margin").forEach((input) => {
    gradeMargins[input.dataset.grade] = Number(input.value || 0) / 100;
  });
  return {
    platform: element("platform").value,
    campaign_name: element("campaignName").value.trim(),
    campaign_type: element("campaignType").value,
    min_grade: Number(element("minGrade").value || 0),
    min_stock: Number(element("minStock").value || 0),
    min_months: Number(element("minMonths").value || 0),
    min_discount: Number(element("minDiscount").value || 0) / 100,
    max_return_rate: Number(element("maxReturnRate").value || 6) / 100,
    categories: [],
    main_categories: selectedMultiValues("mainCategory"),
    subcategories: selectedMultiValues("subcategory"),
    brands: selectedMultiValues("brand"),
    exclude_first_arrival_on_or_after: element("firstArrivalCutoff").value,
    max_discount: Number(element("maxDiscount").value || 0) / 100,
    default_commission: Number(element("defaultCommission").value || 0) / 100,
    rounding: element("rounding").checked,
    use_discount_interval: element("discountIntervalEnabled").checked,
    discount_interval: Number(element("discountInterval").value || 0) / 100,
    wms_rate: 0.08,
    vat_rate: 0.20,
    price_source: state.priceSource,
    input_price_includes_vat: state.inputPriceIncludesVat,
    export_price_includes_vat: state.exportPriceIncludesVat,
    grade_margins: gradeMargins,
  };
}

function isVariableCommissionPlatform() {
  return state.config.variableCommissionPlatforms.includes(element("platform").value);
}

function updateCommissionRequirement() {
  const required = isVariableCommissionPlatform();
  element("commissionRequirement").hidden = !required || state.commissionTableLoaded;
  element("commissionButton").hidden = !required;
  element("commissionRequirementText").textContent = state.commissionMissing.length
    ? t("commissionRatesReview", { count: state.commissionMissing.length })
    : t("commissionListRequired");
}

async function setPlatformDefault() {
  const rate = state.config.defaultCommissions[element("platform").value];
  if (Number.isFinite(Number(rate))) {
    element("defaultCommission").value = (Number(rate) * 100).toFixed(1);
  }
  state.rows.forEach((row) => {
    row.commission = null;
    delete row.commission_source;
    row.commission_requires_review = isVariableCommissionPlatform();
  });
  state.commissionTableLoaded = false;
  state.commissionMissing = [];
  updateCommissionRequirement();
  if (
    isVariableCommissionPlatform()
    && state.commissionRows.length
    && state.rows.length
    && !state.unresolved.length
  ) {
    await applyCommissionRates();
    return;
  }
  calculate();
}

function selectedMultiValues(id) {
  return [...element(id).querySelectorAll(".multi-select-option input:checked")]
    .map((input) => input.value);
}

function updateMultiSelectSummary(id) {
  const control = element(id);
  const selected = selectedMultiValues(id);
  const summary = control.querySelector(".multi-select-value");
  if (!selected.length) {
    summary.textContent = control.dataset.placeholder;
  } else if (selected.length === 1) {
    summary.textContent = selected[0];
  } else {
    summary.textContent = t("selectedCount", { count: selected.length });
  }
  const clearButton = control.querySelector(".multi-select-clear");
  clearButton.hidden = !selected.length;
  clearButton.title = t("clearSelection");
  clearButton.setAttribute("aria-label", t("clearSelection"));
}

function populateMultiSelect(id, values, placeholder) {
  const control = element(id);
  const previous = new Set(selectedMultiValues(id));
  const options = [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
  control.dataset.placeholder = placeholder;
  control.querySelector(".multi-select-menu").innerHTML = `
    <div class="multi-select-menu-header">
      <button class="multi-select-clear" type="button" title="${escapeHtml(t("clearSelection"))}" aria-label="${escapeHtml(t("clearSelection"))}">&times;</button>
    </div>
    ${options.map((value) => `
      <label class="multi-select-option">
        <input type="checkbox" value="${escapeHtml(value)}"${previous.has(value) ? " checked" : ""}>
        <span>${escapeHtml(value)}</span>
      </label>
    `).join("")}
  `;
  updateMultiSelectSummary(id);
}

function updateWooperFilters() {
  populateMultiSelect("mainCategory", state.rows.map((row) => row.main_category), t("allMainCategories"));
  populateMultiSelect("subcategory", state.rows.map((row) => row.subcategory), t("allSubcategories"));
  populateMultiSelect("brand", state.rows.map((row) => row.brand), t("allBrands"));
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  state.config = config;
  element("platform").innerHTML = Object.keys(config.defaultCommissions)
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  element("platform").value = "Debenhams";
  element("wooperSkuList").innerHTML = config.wooperSkus
    .map((sku) => `<option value="${escapeHtml(sku)}"></option>`)
    .join("");
  state.caUnresolved = config.caUnresolved || [];
  updateMappingButton();
  setPlatformDefault();
}

async function calculate({ selectEligible = false, signal } = {}) {
  if (state.unresolved.length) {
    state.mappingScope = "platform";
    state.mappingRows = state.unresolved;
    openMappingModal();
    return;
  }
  const requestId = ++state.requestId;
  setCalculationStatus("calculating");
  try {
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: criteriaFromForm(), rows: state.rows }),
      signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Calculation failed");
    if (requestId !== state.requestId) return;
    state.candidates = payload.candidates;
    const eligibleSkus = new Set(state.candidates.filter((row) => row.eligible).map((row) => row.sku));
    state.selected = selectEligible
      ? eligibleSkus
      : new Set([...state.selected].filter((sku) => eligibleSkus.has(sku)));
    render();
    setCalculationStatus("rowsCalculated", { count: state.candidates.length });
  } catch (error) {
    if (isAbortError(error)) return;
    setCalculationStatus("calculationFailed");
    showToast(translateMessage(error.message), "error");
  }
}

function candidateMatches(row) {
  if (state.filter === "eligible" && !row.eligible) return false;
  if (state.filter === "excluded" && row.eligible) return false;
  if (state.filter === "warning" && !(row.warnings || []).length) return false;
  if (!state.search) return true;
  const haystack = [
    row.sku,
    row.platform_sku,
    row.subcategory,
    ...(row.reasons || []),
    ...(row.warnings || []),
    ...(row.reasons || []).map(translateMessage),
    ...(row.warnings || []).map(translateMessage),
  ].join(" ").toLowerCase();
  return haystack.includes(state.search);
}

function decisionCell(row) {
  if (!row.eligible) return `<span class="badge excluded">${t("excluded")}</span>`;
  if ((row.warnings || []).length) return `<span class="badge warning">${t("review")}</span>`;
  return `<span class="badge eligible">${t("eligible")}</span>`;
}

function renderRows() {
  const rows = state.candidates.filter(candidateMatches);
  element("candidateRows").innerHTML = rows.map((row) => {
    const messages = [...(row.reasons || []), ...(row.warnings || [])]
      .map(translateMessage);
    const selected = state.selected.has(row.sku);
    const suggestedClass = Number(row.suggested_discount) < 0 ? "negative" : "";
    return `
      <tr class="${selected ? "selected" : ""} ${row.eligible ? "" : "excluded"}">
        <td class="select-column">
          <input class="row-select" type="checkbox" data-sku="${escapeHtml(row.sku)}"
            ${selected ? "checked" : ""} ${row.eligible ? "" : "disabled"}
            aria-label="${escapeHtml(t("selectSku", { sku: row.sku }))}">
        </td>
        <td>
          <span class="sku-primary">${escapeHtml(row.sku)}</span>
          <span class="sku-secondary">${escapeHtml(row.platform_sku || "")}</span>
        </td>
        <td>${escapeHtml(row.subcategory || "-")}</td>
        <td class="number">${number(row.grade)}</td>
        <td class="number">${number(row.estimated_months, 1)}</td>
        <td class="number">${money(row.ca_price)}</td>
        <td class="number">${money(row.offer_price)}</td>
        <td class="number">${money(row.price_including_vat)}</td>
        <td class="number ${suggestedClass}">${percent(row.suggested_discount, 1)}</td>
        <td class="number">
          <div class="input-suffix">
            <input class="override-input" data-sku="${escapeHtml(row.sku)}" type="number"
              min="-100" max="100" step="1"
              value="${number(row.final_discount * 100, 1)}" aria-label="${escapeHtml(t("finalDiscountFor", { sku: row.sku }))}">
            <span>%</span>
          </div>
        </td>
        <td class="number">${money(row.promo_price)}</td>
        <td class="number ${Number(row.promo_margin) < 0 ? "negative" : ""} ${row.margin_gap_review ? "review-highlight margin-gap-review" : ""}">${percent(row.promo_margin, 1)}</td>
        <td class="number">${number(row.stock)}</td>
        <td class="number">${number(row.sold_qty)}</td>
        <td class="number ${Number(row.lifetime_profit_margin) < 0 ? "negative" : ""} ${row.margin_gap_review ? "review-highlight margin-gap-review" : ""}">${percent(row.lifetime_profit_margin, 1)}</td>
        <td class="number ${row.return_rate_review ? "review-highlight return-rate-review" : ""}">${percent(row.return_rate, 1)}</td>
        <td class="decision-cell">${decisionCell(row)}</td>
        <td class="reason-text">${escapeHtml(messages.join("; ") || t("allCriteriaPassed"))}</td>
      </tr>
    `;
  }).join("");
  element("emptyState").hidden = rows.length > 0;
}

function renderSummary() {
  const eligible = state.candidates.filter((row) => row.eligible);
  const selected = state.candidates.filter((row) => state.selected.has(row.sku));
  const averageDiscount = selected.length
    ? selected.reduce((sum, row) => sum + Number(row.final_discount || 0), 0) / selected.length
    : 0;
  const projectedProfit = selected.reduce((sum, row) => sum + Number(row.promo_profit || 0), 0);
  element("importedCount").textContent = number(state.candidates.length);
  element("eligibleCount").textContent = number(eligible.length);
  element("selectedCount").textContent = number(selected.length);
  element("averageDiscount").textContent = percent(averageDiscount, 1);
  element("projectedProfit").textContent = money(projectedProfit);
  element("sourceLabel").textContent = state.sourceKind === "sample"
    ? t("sampleSource")
    : t("mappedRowsSource", {
      file: state.sourceFile,
      count: state.sourceRows,
    });

  const visibleEligible = state.candidates.filter(candidateMatches).filter((row) => row.eligible);
  element("selectAll").checked = visibleEligible.length > 0
    && visibleEligible.every((row) => state.selected.has(row.sku));
  element("selectAll").indeterminate = visibleEligible.some((row) => state.selected.has(row.sku))
    && !element("selectAll").checked;
}

function render() {
  renderRows();
  renderSummary();
}

async function loadSample() {
  try {
    const response = await fetch("/api/sample");
    const payload = await response.json();
    state.rows = payload.rows;
    state.unresolved = [];
    state.mappingRows = [];
    updateMappingButton();
    state.commissionTableLoaded = true;
    state.commissionMissing = [];
    state.sourceKind = "sample";
    state.sourceFile = "";
    state.sourceRows = 0;
    updateWooperFilters();
    element("firstImportModal").classList.remove("visible");
    updateCommissionRequirement();
    await calculate({ selectEligible: true });
    showToast(t("workbookSampleLoaded"));
  } catch (error) {
    showToast(translateMessage(error.message), "error");
  }
}

async function importFile(file) {
  const operation = beginImportOperation("offers", file);
  setCalculationStatus("importing");
  try {
    const fileBody = await file.arrayBuffer();
    if (!importOperationIsActive(operation)) return;
    const response = await fetch("/api/import", {
      method: "POST",
      headers: {
        "X-Filename": file.name,
        "X-Platform": element("platform").value,
      },
      body: fileBody,
      signal: operation.controller.signal,
    });
    const payload = await response.json();
    if (!importOperationIsActive(operation)) return;
    if (!response.ok) throw new Error(payload.error || "Import failed");
    if (!payload.rows.length) throw new Error("No SKU rows matched the supported column names");
    state.rows = payload.rows;
    state.unresolved = payload.unresolved || [];
    state.mappingRows = state.unresolved;
    state.mappingScope = "platform";
    if (isVariableCommissionPlatform() && !state.commissionRows.length) {
      state.rows.forEach((row) => {
        row.commission_requires_review = true;
      });
    }
    updateMappingButton();
    state.sourceKind = "file";
    state.sourceFile = file.name;
    state.sourceRows = payload.rows.length;
    element("firstImportModal").classList.remove("visible");
    updateWooperFilters();
    if (state.unresolved.length) {
      openMappingModal();
      showToast(t("mappingsNeedReview", { count: state.unresolved.length }));
    } else if (isVariableCommissionPlatform() && state.commissionRows.length) {
      await applyCommissionRates({
        selectEligible: true,
        signal: operation.controller.signal,
      });
      if (!importOperationIsActive(operation)) return;
    } else {
      await calculate({
        selectEligible: true,
        signal: operation.controller.signal,
      });
      if (!importOperationIsActive(operation)) return;
      showToast(t("rowsImported", { count: payload.rows.length }));
    }
  } catch (error) {
    if (isAbortError(error)) return;
    setCalculationStatus("importFailed");
    showToast(translateMessage(error.message), "error");
  } finally {
    finishImportOperation(operation);
  }
}

function updateMappingButton() {
  element("mappingButton").hidden = !state.unresolved.length && !state.caUnresolved.length;
}

function updateMappingModalText() {
  const isCaMapping = state.mappingScope === "channeladvisor";
  setStaticText(
    "#mappingModal .eyebrow",
    isCaMapping ? "caSkuMappingRequired" : "skuMappingRequired",
  );
  setStaticText("#mappingTitle", isCaMapping ? "matchCaSkus" : "matchSkus");
  element("mappingSummary").textContent = t(
    isCaMapping ? "mappingSummaryCa" : "mappingSummaryPlatform",
    { count: state.mappingRows.length },
  );
}

function closeMappingModal() {
  element("mappingModal").classList.remove("visible");
  if (state.restoreFirstImportAfterMapping && !state.rows.length) {
    element("firstImportModal").classList.add("visible");
  }
  state.restoreFirstImportAfterMapping = false;
}

function maybeOpenStartupMappings() {
  if (!state.caUnresolved.length || element("guideModal").classList.contains("visible")) return;
  state.mappingScope = "channeladvisor";
  state.mappingRows = state.caUnresolved;
  openMappingModal();
}

function openMappingModal() {
  if (state.mappingScope === "platform" && state.unresolved.length) {
    state.mappingRows = state.unresolved;
  } else if (!state.unresolved.length && state.caUnresolved.length) {
    state.mappingScope = "channeladvisor";
    state.mappingRows = state.caUnresolved;
  }
  if (!state.mappingRows.length) return;
  updateMappingModalText();
  element("mappingSearch").value = "";
  element("mappingList").innerHTML = state.mappingRows.map((row) => {
    const title = row.title || row.brand || "";
    const price = row.ca_price == null ? "" : `CA ${money(row.ca_price)}`;
    const searchText = `${row.platform_sku || ""} ${title}`.toLowerCase();
    return `
    <div class="mapping-row" data-search="${escapeHtml(searchText)}">
      <div class="mapping-product">
        <strong>${escapeHtml(row.platform_sku)}</strong>
        ${title ? `<small title="${escapeHtml(title)}">${escapeHtml(title)}</small>` : ""}
        ${price ? `<small>${escapeHtml(price)}</small>` : ""}
      </div>
      <span>&rarr;</span>
      <input class="manual-mapping" data-platform-sku="${escapeHtml(row.platform_sku)}"
        list="wooperSkuList" value="${escapeHtml(row.suggested_sku || "")}"
        placeholder="Wooper SKU">
      <label class="non-existing-option">
        <input class="non-existing-sku" type="checkbox"
          data-platform-sku="${escapeHtml(row.platform_sku)}">
        <span>${t("nonExistingSku")}</span>
      </label>
    </div>
  `;
  }).join("");
  document.querySelectorAll(".non-existing-sku").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const mappingInput = checkbox.closest(".mapping-row").querySelector(".manual-mapping");
      mappingInput.disabled = checkbox.checked;
      if (checkbox.checked) mappingInput.value = "";
    });
  });
  state.restoreFirstImportAfterMapping = element("firstImportModal").classList.contains("visible");
  element("firstImportModal").classList.remove("visible");
  element("mappingModal").classList.add("visible");
}

async function saveMappings() {
  const mappings = [...document.querySelectorAll(".mapping-row")].map((row) => {
    const input = row.querySelector(".manual-mapping");
    const nonExisting = row.querySelector(".non-existing-sku").checked;
    return {
      platform_sku: input.dataset.platformSku,
      wooper_sku: input.value.trim(),
      non_existing: nonExisting,
    };
  }).filter((item) => item.non_existing || item.wooper_sku);
  if (!mappings.length) {
    showToast(t("enterOneMapping"), "error");
    return;
  }
  try {
    const response = await fetch("/api/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mappings,
        rows: state.rows,
        mapping_scope: state.mappingScope,
        platform: element("platform").value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save mappings");
    state.caUnresolved = payload.caUnresolved || [];
    if (state.mappingScope === "channeladvisor") {
      state.mappingRows = state.caUnresolved;
    } else {
      state.rows = payload.rows;
      state.unresolved = payload.unresolved || [];
      state.mappingRows = state.unresolved;
    }
    updateMappingButton();
    if (payload.invalidMappings?.length) {
      openMappingModal();
      showToast(t("invalidWooperMapping"), "error");
      return;
    }
    if (state.mappingRows.length) {
      openMappingModal();
    } else {
      closeMappingModal();
    }
    if (state.mappingScope === "channeladvisor") {
      showToast(t("mappingsSaved", { count: payload.savedCount || mappings.length }));
      return;
    }
    updateWooperFilters();
    if (isVariableCommissionPlatform() && state.commissionRows.length) {
      await applyCommissionRates({ selectEligible: true });
    } else {
      await calculate({ selectEligible: true });
    }
    const excludedCount = mappings.filter((item) => item.non_existing).length;
    const mappedCount = (payload.savedCount || mappings.length) - excludedCount;
    const messages = [];
    if (mappedCount) messages.push(t("mappingsSaved", { count: mappedCount }));
    if (excludedCount) messages.push(t("nonExistingExcluded", { count: excludedCount }));
    showToast(messages.join("; "));
  } catch (error) {
    showToast(translateMessage(error.message), "error");
  }
}

function commissionPlatformRows() {
  const platform = element("platform").value.trim().toLowerCase();
  return state.commissionRows.filter(
    (row) => String(row.platform || "").trim().toLowerCase() === platform,
  );
}

function commissionSuggestion(row, platformRows) {
  const category = String(row.subcategory || "").trim().toLowerCase();
  const categoryRates = [...new Set(
    platformRows
      .filter((item) => String(item.category || "").trim().toLowerCase() === category)
      .map((item) => Number(item.commission))
      .filter(Number.isFinite),
  )];
  if (category && categoryRates.length === 1) {
    return {
      rate: categoryRates[0],
      source_key: "suggestedCategory",
    };
  }
  return {
    rate: Number(element("defaultCommission").value || 0) / 100,
    source_key: "suggestedDefault",
  };
}

function openCommissionMissingModal() {
  const platform = element("platform").value;
  element("commissionMissingSummary").textContent = t("missingCommissionSummary", {
    count: state.commissionMissing.length,
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
    render();
  });
  element("candidateRows").addEventListener("change", (event) => {
    if (event.target.matches(".row-select")) {
      if (event.target.checked) state.selected.add(event.target.dataset.sku);
      else state.selected.delete(event.target.dataset.sku);
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
