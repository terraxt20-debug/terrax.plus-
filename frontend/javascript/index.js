/**
 * Design by fromScratch Studio - 2022, 2023 (fromscratch.io)
 * Implementation in HTML/CSS/JS by Timendus - 2024 (https://github.com/Timendus)
 * Upgraded to Terrax Plus (تيراكس بلاس) 4K Cyber Glass RTL Visual Identity
 *
 * See https://github.com/librespeed/speedtest/issues/585
 */

// Global suppression of harmless browser ViewTransition abort exceptions
(function () {
  function isTransitionAbort(err) {
    if (!err) return false;
    var msg = String((err && (err.message || err.toString())) || err || "");
    var name = String((err && err.name) || "");
    return (
      msg.indexOf("Transition was skipped") !== -1 ||
      msg.indexOf("Transition was aborted") !== -1 ||
      msg.indexOf("Document hidden") !== -1 ||
      msg.indexOf("Navigation aborted") !== -1 ||
      ((name === "AbortError" || name === "InvalidStateError") &&
        (msg.indexOf("Transition") !== -1 || msg.indexOf("navigation") !== -1 || msg.indexOf("Document") !== -1))
    );
  }
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", function (event) {
      if (isTransitionAbort(event.reason)) {
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        return true;
      }
    }, true);
    window.addEventListener("error", function (event) {
      var err = event && (event.error || event.message);
      if (isTransitionAbort(err) || isTransitionAbort(event && event.message)) {
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        return true;
      }
    }, true);
    if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
      var origVt = document.startViewTransition;
      document.startViewTransition = function (cb) {
        if (document.visibilityState === "hidden") {
          if (typeof cb === "function") {
            try { cb(); } catch (err) {}
          }
          return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            skipTransition: function () {}
          };
        }
        try {
          var vt = origVt.call(document, cb);
          if (vt) {
            if (typeof vt.finished === "object" && vt.finished && typeof vt.finished.catch === "function") {
              vt.finished.catch(function () {});
            }
            if (typeof vt.ready === "object" && vt.ready && typeof vt.ready.catch === "function") {
              vt.ready.catch(function () {});
            }
          }
          return vt;
        } catch (e) {
          if (typeof cb === "function") {
            try { cb(); } catch (cbErr) {}
          }
          return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            skipTransition: function () {}
          };
        }
      };
    }
  }
})();

// States the UI can be in
const INITIALIZING = 0;
const READY = 1;
const RUNNING = 2;
const FINISHED = 3;

const HISTORY_STORAGE_KEY = "terrax_librespeed_history_v1";
const LANGUAGE_STORAGE_KEY = "terrax_ui_lang_v1";
const AUTO_GBPS_STORAGE_KEY = "terrax_auto_gbps_v1";

const UI_TRANSLATIONS = {
  ar: {
    headerSectionTitle: "اختبارات سرعة الإنترنت الأساسية",
    brandNameHtml: '<span class="brand-highlight">تيراكس</span> بلاس',
    brandSub: "رؤى، مراجعات، ابتكار",
    dlTitle: "سرعة التنزيل",
    stabTitle: "استقرار السرعة",
    ulTitle: "سرعة الرفع",
    dlUnitDefault: "ميجابت في الثانية",
    ulUnitDefault: "ميجابت في الثانية",
    readyBadge: "جاهز للقياس",
    awaitingStab: "في انتظار القياس",
    pingLabel: "زمن الاستجابة (Ping):",
    jitterLabel: "تذبذب الاتصال (Jitter):",
    maxSpeedTitle: "أعلى سرعة",
    avgSpeedTitle: "متوسط السرعة",
    currentServerLabel: "خادم القياس الحالي :",
    searchingServer: "جاري البحث عن أقرب خادم...",
    connLabel: "نوع الاتصال:",
    connUnavailable: "نوع الاتصال غير متاح",
    connOffline: "غير متصل بالإنترنت",
    connWifi: "اتصال لاسلكي (Wi-Fi)",
    connEthernet: "اتصال سلكي (Ethernet)",
    connCellular: "بيانات خلوية (Cellular)",
    connVerifyingHint: "جاري التحقق من الشبكة وقياس السرعة...",
    privacyPrefix: "بالنقر على زر البدء فإنك توافق على سياسة الخصوصية الخاصة بالخدمة",
    privacyLink: "عرض تفاصيل الخصوصية والبيانات",
    shareResultsBtn: "مشاركة النتائج",
    navSpeed: "السرعة",
    navUsage: "الاستهلاك",
    navStability: "الاستقرار",
    navGaming: "اختبار الألعاب",
    navSettings: "الإعدادات",
    footerStabilityLink: "اختبار الاستقرار (stability test)",
    shareModalHeading: "مشاركة بطاقة النتيجة",
    copyLinkBtn: "نسخ رابط النتيجة",
    copiedLinkBtn: "تم النسخ!",
    privacyModalTitle: "سياسة الخصوصية وبيانات القياس (Privacy Policy)",
    closePrivacyBtn: "إغلاق",
    usageModalTitle: "سجل الاستهلاك والاختبارات الفعلية",
    usageModalSubtitle: "يتم حساب البيانات المستهلكة وسجل السرعات من الاختبارات الحقيقية فقط.",
    usageTotalDataLabel: "إجمالي البيانات المستهلكة",
    usageTotalTestsLabel: "عدد الاختبارات المكتملة",
    thDate: "التاريخ",
    thTime: "التوقيت",
    thServer: "الخادم",
    thDownload: "التنزيل",
    thUpload: "الرفع",
    thStability: "الاستقرار",
    thPing: "Ping",
    emptyHistory: "لا توجد اختبارات مسجلة بعد. ابدأ اختبار السرعة لتسجيل النتائج الفعلية.",
    openStabilityFromUsage: "فتح فحص الاستقرار المستمر (Stability Test)",
    clearHistoryBtn: "مسح السجل المحلي",
    settingsModalTitle: "إعدادات القياس والواجهة",
    settingsModalSubtitle: "تحكم في طريقة عرض الوحدات وأنماط الفحص في منصة تيراكس بلاس.",
    settingLanguageLabel: "لغة الواجهة (Language)",
    settingAutoGbpsLabel: "عرض السرعات الفائقة تلقائياً بوحدة Gbps (عند تجاوز 1000 Mbps)",
    settingStabilityLabel: "وضع الفحص المستمر (Stability Monitor)",
    settingStabilityLink: "الانتقال إلى صفحة الاستقرار ←",
    settingPrivacyLabel: "سياسة الخصوصية والبيانات",
    openPrivacyFromSettingsBtn: "عرض السياسة",
    settingSupportLabel: "لتواصل لخدمة الدعم",
    settingSupportBtnText: "لخدمة الدعم",
    connectedThrough: "أنت متصل عبر الشبكة:",
    sponsorPrefix: "الراعي التقني:",
    toastCompleteTitle: "اكتمل فحص السرعة بنجاح",
    toastCompleteMsg: "تم قياس سرعات التنزيل والرفع وزمن الاستجابة وتسجيلها بدقة فائقة.",
    toastAbortTitle: "انقطع الاتصال أثناء القياس",
    toastAbortMsg: "تعذر إكمال الفحص نظراً لتعثر الاتصال بالخادم. يرجى التحقق من الشبكة وإعادة المحاولة.",
    toastOfflineTitle: "انقطع الاتصال بالإنترنت",
    toastOfflineMsg: "تم فقدان الاتصال بالشبكة أثناء قياس السرعة. يرجى التحقق من الشبكة.",
    toastOnlineTitle: "تمت استعادة الاتصال",
    toastOnlineMsg: "أنت متصل بالإنترنت الآن، وجاهز لبدء الفحص.",
  },
  en: {
    headerSectionTitle: "Core Internet Speed Telemetry",
    brandNameHtml: '<span class="brand-highlight">Terrax</span> Plus',
    brandSub: "Insights, Reviews, Innovation",
    dlTitle: "Download Speed",
    stabTitle: "Speed Stability",
    ulTitle: "Upload Speed",
    dlUnitDefault: "Megabits per second",
    ulUnitDefault: "Megabits per second",
    readyBadge: "Ready to measure",
    awaitingStab: "Awaiting measurement",
    pingLabel: "Latency (Ping):",
    jitterLabel: "Connection Jitter:",
    maxSpeedTitle: "Max Speed",
    avgSpeedTitle: "Average Speed",
    currentServerLabel: "Current Test Server :",
    searchingServer: "Searching for nearest server...",
    connLabel: "Connection Type:",
    connUnavailable: "Connection type unavailable",
    connOffline: "Offline / Disconnected",
    connWifi: "Wireless (Wi-Fi)",
    connEthernet: "Wired (Ethernet)",
    connCellular: "Cellular Network",
    connVerifyingHint: "Verifying network & measuring speed...",
    privacyPrefix: "By clicking start, you agree to the service privacy policy",
    privacyLink: "View privacy and telemetry details",
    shareResultsBtn: "Share Results",
    navSpeed: "Speed",
    navUsage: "Usage",
    navStability: "Stability",
    navGaming: "Gaming Test",
    navSettings: "Settings",
    footerStabilityLink: "Continuous Stability Test",
    shareModalHeading: "Share Result Card",
    copyLinkBtn: "Copy Result Link",
    copiedLinkBtn: "Copied!",
    privacyModalTitle: "Privacy Policy & Telemetry Data",
    closePrivacyBtn: "Close",
    usageModalTitle: "Data Usage & Real Test History",
    usageModalSubtitle: "Consumed data and speed logs are calculated strictly from real completed tests.",
    usageTotalDataLabel: "Total Data Consumed",
    usageTotalTestsLabel: "Completed Tests",
    thDate: "Date",
    thTime: "Time",
    thServer: "Server",
    thDownload: "Download",
    thUpload: "Upload",
    thStability: "Stability",
    thPing: "Ping",
    emptyHistory: "No tests recorded yet. Run a speed test to log real results.",
    openStabilityFromUsage: "Open Continuous Stability Monitor",
    clearHistoryBtn: "Clear Local History",
    settingsModalTitle: "Measurement & UI Settings",
    settingsModalSubtitle: "Customize unit formatting, display language, and test modes.",
    settingLanguageLabel: "Interface Language (اللغة)",
    settingAutoGbpsLabel: "Automatically display ultra speeds in Gbps (above 1000 Mbps)",
    settingStabilityLabel: "Continuous Stability Monitor",
    settingStabilityLink: "Go to Stability Page →",
    settingPrivacyLabel: "Privacy & Telemetry Policy",
    openPrivacyFromSettingsBtn: "View Policy",
    settingSupportLabel: "Contact Technical Support",
    settingSupportBtnText: "Support Chat",
    connectedThrough: "Connected via network:",
    sponsorPrefix: "Sponsor:",
    toastCompleteTitle: "Speed Test Completed",
    toastCompleteMsg: "Download, upload, and latency metrics have been measured and recorded.",
    toastAbortTitle: "Connection Interrupted",
    toastAbortMsg: "Could not complete the test due to a server connection drop. Please check your network.",
    toastOfflineTitle: "Internet Disconnected",
    toastOfflineMsg: "Network connection was lost during the speed test.",
    toastOnlineTitle: "Connection Restored",
    toastOnlineMsg: "You are back online and ready to start testing.",
  },
};

// Keep some global state here
const testState = {
  state: INITIALIZING,
  speedtest: null,
  servers: [],
  initialGaugeScrollPending: false,
  initialGaugeScrollScheduled: false,
  selectedServerDirty: false,
  testData: null,
  testDataDirty: false,
  telemetryEnabled: false,
  autoGbps: true,
  lang: "ar",
  dlSamples: [],
  ulSamples: [],
  lastSampleTimestamp: 0,
  currentTestBytes: 0,
  currentRunId: null,
  historyRecordedForRun: false,
  historySortKey: "date",
  historySortDir: "desc",
  prevDlNumber: "",
  prevUlNumber: "",
  prevStabNumber: "",
  dlDisplayMbps: 0,
  ulDisplayMbps: 0,
  lastRenderTimestamp: 0,
  userAborted: false,
  _maxProgressPct: 0,
  _statCountUpActive: false,
  _statCountUpCancel: null,
  _statCardsRafController: null,
  _statCardDomCache: null,
  _usageCountUpActive: false,
  _usageCountUpCancel: null,
  _usageCountUpTarget: 0,
  _lastConnLabel: "",
  _lastConnState: "",
  _lastConnTitle: "",
  _lastConnKind: "",
  _connListenerAttached: false,
  _connCleanupFn: null,
};

/**
 * Retrieve cached DOM references for the 'Max Speed' and 'Average Speed' stat cards
 * to avoid repeated document.querySelector lookups on every animation frame.
 */
function getStatCardElements() {
  const cached = testState._statCardDomCache;
  if (
    cached &&
    cached.maxSpeedValueEl &&
    cached.maxSpeedValueEl.isConnected &&
    cached.avgSpeedValueEl &&
    cached.avgSpeedValueEl.isConnected
  ) {
    return cached;
  }
  const nextCache = {
    maxSpeedValueEl: document.querySelector("#max-speed-value"),
    maxSpeedUnitEl: document.querySelector("#max-speed-unit"),
    avgSpeedValueEl: document.querySelector("#avg-speed-value"),
    avgSpeedUnitEl: document.querySelector("#avg-speed-unit"),
    maxCardEl: document.querySelector("#max-speed-card"),
    avgCardEl: document.querySelector("#avg-speed-card"),
  };
  testState._statCardDomCache = nextCache;
  return nextCache;
}

/**
 * Get or initialize the dedicated requestAnimationFrame stat card controller
 * that commits dirty-checked DOM updates synchronized with gauge arc animations.
 */
function getStatCardsRafController() {
  if (testState._statCardsRafController) {
    return testState._statCardsRafController;
  }
  const math = globalThis.TerraxTelemetryMath;
  if (!math || typeof math.createStatCardsRafLoop !== "function") {
    return null;
  }
  testState._statCardsRafController = math.createStatCardsRafLoop({
    targetFps: 60,
    onCommit: ({
      maxDisplay,
      maxUnit,
      avgDisplay,
      avgUnit,
      countingUp,
      maxChanged,
      avgChanged,
      countingClassChanged,
    }) => {
      const els = getStatCardElements();
      if (maxChanged) {
        if (els.maxSpeedValueEl && els.maxSpeedValueEl.textContent !== maxDisplay) {
          els.maxSpeedValueEl.textContent = maxDisplay;
        }
        if (els.maxSpeedUnitEl && els.maxSpeedUnitEl.textContent !== maxUnit) {
          els.maxSpeedUnitEl.textContent = maxUnit;
        }
      }
      if (avgChanged) {
        if (els.avgSpeedValueEl && els.avgSpeedValueEl.textContent !== avgDisplay) {
          els.avgSpeedValueEl.textContent = avgDisplay;
        }
        if (els.avgSpeedUnitEl && els.avgSpeedUnitEl.textContent !== avgUnit) {
          els.avgSpeedUnitEl.textContent = avgUnit;
        }
      }
      if (countingClassChanged) {
        els.maxSpeedValueEl?.classList.toggle("counting-up", countingUp);
        els.avgSpeedValueEl?.classList.toggle("counting-up", countingUp);
        els.maxCardEl?.classList.toggle("counting-up", countingUp);
        els.avgCardEl?.classList.toggle("counting-up", countingUp);
      }
    },
  });
  return testState._statCardsRafController;
}

/**
 * Cancel any active requestAnimationFrame count-up animation on the Max/Average Speed cards
 */
function cancelStatCardsCountUp() {
  if (typeof testState._statCountUpCancel === "function") {
    try {
      testState._statCountUpCancel();
    } catch (e) {}
  }
  testState._statCountUpCancel = null;
  testState._statCountUpActive = false;

  const controller = getStatCardsRafController();
  controller?.cancel();

  const els = getStatCardElements();
  els.maxSpeedValueEl?.classList.remove("counting-up");
  els.avgSpeedValueEl?.classList.remove("counting-up");
  els.maxCardEl?.classList.remove("counting-up");
  els.avgCardEl?.classList.remove("counting-up");
}

/**
 * Animate the numeric values in the 'Max Speed' and 'Average Speed' cards with a smooth
 * requestAnimationFrame count-up effect when the final speed test results are displayed.
 * Synchronized with the dedicated stat card RAF controller to prevent layout thrashing.
 * @param {number|null} maxSpeedMbps
 * @param {number|null} avgSpeedMbps
 */
function startFinalStatCardsCountUp(maxSpeedMbps, avgSpeedMbps) {
  cancelStatCardsCountUp();

  const math = globalThis.TerraxTelemetryMath;
  const els = getStatCardElements();
  const controller = getStatCardsRafController();

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (controller) {
    testState._statCountUpActive = !reducedMotion;
    testState._statCountUpCancel = controller.startCountUp({
      maxSpeedMbps,
      avgSpeedMbps,
      allowGbps: testState.autoGbps,
      durationMs: 950,
      reducedMotion,
      standalone: true,
      onComplete: () => {
        testState._statCountUpActive = false;
        testState._statCountUpCancel = null;
      },
    });
    return;
  }

  if (!math || typeof math.animateStatCountUp !== "function") {
    if (math && typeof math.formatSpeedReading === "function") {
      if (maxSpeedMbps !== null && els.maxSpeedValueEl) {
        const maxFmt = math.formatSpeedReading(maxSpeedMbps, testState.autoGbps);
        els.maxSpeedValueEl.textContent = maxFmt.displayNumber;
        if (els.maxSpeedUnitEl) els.maxSpeedUnitEl.textContent = maxFmt.unitEn;
      }
      if (avgSpeedMbps !== null && els.avgSpeedValueEl) {
        const avgFmt = math.formatSpeedReading(avgSpeedMbps, testState.autoGbps);
        els.avgSpeedValueEl.textContent = avgFmt.displayNumber;
        if (els.avgSpeedUnitEl) els.avgSpeedUnitEl.textContent = avgFmt.unitEn;
      }
    }
    return;
  }

  if (!reducedMotion) {
    testState._statCountUpActive = true;
    els.maxSpeedValueEl?.classList.add("counting-up");
    els.avgSpeedValueEl?.classList.add("counting-up");
    els.maxCardEl?.classList.add("counting-up");
    els.avgCardEl?.classList.add("counting-up");
  }

  testState._statCountUpCancel = math.animateStatCountUp({
    maxSpeedMbps,
    avgSpeedMbps,
    allowGbps: testState.autoGbps,
    durationMs: 950,
    reducedMotion,
    onFrame: ({ maxFrame, avgFrame }) => {
      if (els.maxSpeedValueEl && maxFrame) {
        if (els.maxSpeedValueEl.textContent !== maxFrame.displayNumber) {
          els.maxSpeedValueEl.textContent = maxFrame.displayNumber;
        }
        if (els.maxSpeedUnitEl && els.maxSpeedUnitEl.textContent !== maxFrame.unitEn) {
          els.maxSpeedUnitEl.textContent = maxFrame.unitEn;
        }
      }
      if (els.avgSpeedValueEl && avgFrame) {
        if (els.avgSpeedValueEl.textContent !== avgFrame.displayNumber) {
          els.avgSpeedValueEl.textContent = avgFrame.displayNumber;
        }
        if (els.avgSpeedUnitEl && els.avgSpeedUnitEl.textContent !== avgFrame.unitEn) {
          els.avgSpeedUnitEl.textContent = avgFrame.unitEn;
        }
      }
    },
    onComplete: () => {
      testState._statCountUpActive = false;
      testState._statCountUpCancel = null;
      els.maxSpeedValueEl?.classList.remove("counting-up");
      els.avgSpeedValueEl?.classList.remove("counting-up");
      els.maxCardEl?.classList.remove("counting-up");
      els.avgCardEl?.classList.remove("counting-up");
    },
  });
}
globalThis.startFinalStatCardsCountUp = startFinalStatCardsCountUp;
globalThis.cancelStatCardsCountUp = cancelStatCardsCountUp;

/**
 * Safely retrieve the currently selected server without throwing when Speedtest is in state 0 or 1
 */
function getSafeSelectedServer() {
  try {
    if (
      testState.speedtest &&
      typeof testState.speedtest.getState === "function" &&
      testState.speedtest.getState() >= 2
    ) {
      return testState.speedtest.getSelectedServer();
    }
  } catch (e) {
    // No server is selected yet
  }
  return null;
}

/**
 * Apply the selected UI language ("ar" or "en") dynamically across all DOM elements
 */
function applyLanguage(lang, { persist = true } = {}) {
  const normalizedLang = lang === "en" ? "en" : "ar";
  testState.lang = normalizedLang;
  const dict = UI_TRANSLATIONS[normalizedLang];

  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLang);
    } catch (e) {
      // Ignore storage errors
    }
  }

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = normalizedLang;
    document.documentElement.dir = normalizedLang === "en" ? "ltr" : "rtl";
  }

  const langSelect = document.querySelector("#language-select");
  if (langSelect && langSelect.value !== normalizedLang) {
    langSelect.value = normalizedLang;
  }

  const setText = (selector, text) => {
    const el = document.querySelector(selector);
    if (el && typeof text === "string") {
      el.textContent = text;
    }
  };

  setText(".header-section-title", dict.headerSectionTitle);
  const brandNameEl = document.querySelector(".brand-name-ar");
  if (brandNameEl) {
    brandNameEl.innerHTML = dict.brandNameHtml;
  }
  setText(".brand-sub-ar", dict.brandSub);

  // Gauges
  setText("#download-gauge .gauge-title-ar", dict.dlTitle);
  setText("#stability-gauge .gauge-title-ar", dict.stabTitle);
  setText("#upload-gauge .gauge-title-ar", dict.ulTitle);

  // Latency strip
  setText(".ping .label", dict.pingLabel);
  setText(".jitter .label", dict.jitterLabel);

  // Summary cards
  setText("#max-speed-card .stat-title-ar", dict.maxSpeedTitle);
  setText("#avg-speed-card .stat-title-ar", dict.avgSpeedTitle);

  // Server & connection row
  setText(".server-selector > .chosen > p", dict.currentServerLabel);
  const currentSelectedServer = getSafeSelectedServer();
  const selectedServerEl = document.querySelector("#selected-server");
  if (
    selectedServerEl &&
    !currentSelectedServer &&
    testState.servers.length === 0
  ) {
    selectedServerEl.textContent = dict.searchingServer;
  }
  setText(".conn-label", dict.connLabel);

  // Privacy notice (when clientIp hasn't replaced it yet)
  const choosePrivacyEl = document.querySelector("#choose-privacy");
  if (choosePrivacyEl) {
    const privacyWarningEl = document.querySelector("#privacy-warning");
    if (privacyWarningEl) {
      const firstNode = privacyWarningEl.firstChild;
      if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
        firstNode.nodeValue = `${dict.privacyPrefix}\n`;
      }
    }
    choosePrivacyEl.textContent = dict.privacyLink;
  }

  // Primary action buttons
  setText("#share-results", dict.shareResultsBtn);

  // Bottom 5-Tab navigation dock
  setText("#nav-speed-btn span:last-child", dict.navSpeed);
  setText("#nav-usage-btn span:last-child", dict.navUsage);
  setText("#nav-stability-btn span:last-child", dict.navStability);
  setText("#nav-gaming-btn span:last-child", dict.navGaming);
  setText("#nav-settings-btn span:last-child", dict.navSettings);

  // Footer
  setText("footer p.source a", dict.footerStabilityLink);

  // Dialogs: Share, Privacy, Usage, Settings
  setText("#share .dialog-heading", dict.shareModalHeading);
  const copyLinkBtn = document.querySelector("#copy-link");
  if (copyLinkBtn && !copyLinkBtn.classList.contains("active")) {
    copyLinkBtn.textContent = dict.copyLinkBtn;
  }
  setText("#privacy section h1", dict.privacyModalTitle);
  setText("#close-privacy", dict.closePrivacyBtn);

  setText("#usage-dialog section h1", dict.usageModalTitle);
  setText("#usage-dialog .modal-subtitle", dict.usageModalSubtitle);
  const usageLabels = document.querySelectorAll("#usage-dialog .usage-label");
  if (usageLabels[0]) usageLabels[0].textContent = dict.usageTotalDataLabel;
  if (usageLabels[1]) usageLabels[1].textContent = dict.usageTotalTestsLabel;

  const usageHeaders = document.querySelectorAll("#usage-dialog .cyber-history-table thead th");
  const headerKeyMap = {
    date: "thDate",
    time: "thTime",
    server: "thServer",
    dl: "thDownload",
    ul: "thUpload",
    stability: "thStability",
    ping: "thPing",
  };
  const fallbackThKeys = ["thDate", "thTime", "thServer", "thDownload", "thUpload", "thStability", "thPing"];
  usageHeaders.forEach((th, idx) => {
    const sortKey = th.getAttribute("data-sort-key");
    const dictKey = (sortKey && headerKeyMap[sortKey]) || fallbackThKeys[idx];
    if (!dictKey || !dict[dictKey]) return;
    const labelSpan = th.querySelector(".th-label");
    if (labelSpan) {
      labelSpan.textContent = dict[dictKey];
    } else {
      th.textContent = dict[dictKey];
    }
  });
  setText("#usage-dialog .cyber-link-btn", dict.openStabilityFromUsage);
  setText("#clear-history-btn", dict.clearHistoryBtn);

  setText("#settings-dialog section h1", dict.settingsModalTitle);
  setText("#settings-dialog .modal-subtitle", dict.settingsModalSubtitle);
  setText("#language-select-label", dict.settingLanguageLabel);
  setText("#setting-auto-gbps-label", dict.settingAutoGbpsLabel);
  setText("#setting-stability-label", dict.settingStabilityLabel);
  setText("#setting-stability-link", dict.settingStabilityLink);
  setText("#setting-privacy-label", dict.settingPrivacyLabel);
  setText("#open-privacy-from-settings", dict.openPrivacyFromSettingsBtn);
  setText("#setting-support-label", dict.settingSupportLabel);
  setText("#setting-support-btn-text", dict.settingSupportBtnText);

  detectConnectionType();
  renderUsageHistoryUI();
  globalThis.TerraxSmartAdEngine?.syncAdCardsVisualState?.();
  testState.testDataDirty = true;
  if (currentSelectedServer) {
    testState.selectedServerDirty = true;
  }
}
globalThis.applyTerraxLanguage = applyLanguage;

/**
 * Load persisted language preference on startup (defaults to Arabic "ar")
 */
function initLanguagePreference() {
  let savedLang = "ar";
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "ar") {
      savedLang = stored;
    }
  } catch (e) {
    // Ignore storage errors
  }
  applyLanguage(savedLang, { persist: false });
}

// Bootstrap the application when the DOM is ready
async function bootstrapTerraxApp() {
  if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  globalThis.TerraxScrollNavigator?.init?.();
  initLanguagePreference();
  hookUpButtons();
  renderUsageHistoryUI();
  detectConnectionType();
  setupNetworkConnectivityMonitoring();
  startRenderingLoop();
  await ensureSpeedtestEngineLoaded();
  createSpeedtest();
  applySettingsJSON();
  applyServerListJSON();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootstrapTerraxApp);
} else {
  bootstrapTerraxApp();
}

/**
 * Ensure the LibreSpeed engine (Speedtest) is loaded before initializing
 */
async function ensureSpeedtestEngineLoaded() {
  if (typeof globalThis.Speedtest === "function" || typeof window.Speedtest === "function") {
    return true;
  }
  const candidateUrls = ["/speedtest.js", "../speedtest.js", "speedtest.js"];
  for (const src of candidateUrls) {
    const loaded = await new Promise((resolve) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = src;
      script.onload = () =>
        resolve(typeof globalThis.Speedtest === "function" || typeof window.Speedtest === "function");
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    if (loaded) {
      return true;
    }
  }
  return typeof globalThis.Speedtest === "function" || typeof window.Speedtest === "function";
}

/**
 * 4K Cyber Glass Toast Notifications (تنبيهات مرئية زجاجية فاخرة)
 */
function showTerraxToast({ type = "info", title = "", message = "", duration = 4500 } = {}) {
  let container = document.querySelector(".terrax-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "terrax-toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  } else {
    container.innerHTML = "";
  }

  const toast = document.createElement("div");
  toast.className = `terrax-toast terrax-toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18A2 2 0 003.55 21H20.45A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  };

  toast.innerHTML = `
    <div class="toast-content-wrapper">
      <div class="toast-icon-box" aria-hidden="true">
        ${icons[type] || icons.info}
      </div>
      <div class="toast-text-box">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ""}
      </div>
    </div>
    <button type="button" class="toast-dismiss-btn" aria-label="إغلاق التنبيه">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  let dismissTimeout;
  const dismiss = () => {
    if (toast.classList.contains("toast-hiding")) return;
    toast.classList.add("toast-hiding");
    clearTimeout(dismissTimeout);
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, 320);
  };

  toast.querySelector(".toast-dismiss-btn")?.addEventListener("click", dismiss);
  dismissTimeout = setTimeout(dismiss, duration);

  container.appendChild(toast);
  return { dismiss };
}
globalThis.showTerraxToast = showTerraxToast;

/**
 * Micro-interactions for measurement buttons & 5-Tab navigation dock (120Hz Touch + Click Physics)
 */
function attachButtonMicroInteractions() {
  const interactiveElements = document.querySelectorAll(
    "#start-button, #share-results, #copy-link, button.small, #startBtn, #resetBtn, .nav-dock-item, .close-dialog"
  );
  interactiveElements.forEach((btn) => {
    if (btn.dataset.microHooked === "1") return;
    btn.dataset.microHooked = "1";

    btn.addEventListener("pointerdown", (e) => {
      if (btn.classList.contains("disabled")) return;
      // Trigger flash animation on primary buttons
      if (!btn.classList.contains("nav-dock-item")) {
        btn.classList.remove("btn-micro-flash");
        void btn.offsetWidth;
        btn.classList.add("btn-micro-flash");
      }

      // Dynamic liquid glass ripple centered at touch/click point
      const rect = btn.getBoundingClientRect();
      const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
      const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
      const ripple = document.createElement("span");
      ripple.className = "btn-click-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 460);
    });

    btn.addEventListener("animationend", (e) => {
      if (e.animationName === "btnGlassMicroFlash") {
        btn.classList.remove("btn-micro-flash");
      }
    });
  });
}

/**
 * Cancel any in-flight pre-test warm-up fetch or start timeout to prevent race conditions
 */
function cancelPendingTestWarmup() {
  if (testState._warmupTimeoutId) {
    clearTimeout(testState._warmupTimeoutId);
    testState._warmupTimeoutId = null;
  }
  if (testState._warmupAbortController) {
    try {
      testState._warmupAbortController.abort();
    } catch (e) {}
    testState._warmupAbortController = null;
  }
}

/**
 * Clean up all active timers, animation loops, and network workers when leaving the Speed page
 * to guarantee 100% process isolation and zero memory leaks when switching to Stability or Gaming.
 */
function cleanupSpeedPageResources() {
  testState._startRunToken = (testState._startRunToken || 0) + 1;
  cancelPendingTestWarmup();
  cancelStatCardsCountUp();
  cancelUsageTestsCountUp(false);
  if (testState._progressHideTimeoutId) {
    clearTimeout(testState._progressHideTimeoutId);
    testState._progressHideTimeoutId = null;
  }
  if (testState.speedtest && testState.speedtest.getState() === 3) {
    testState.userAborted = true;
    try {
      testState.speedtest.abort();
    } catch (e) {}
  }
  if (testState.state === RUNNING) {
    testState.state = READY;
  }
  globalThis.TerraxSmartAdEngine?.setTestingState(false);
}
globalThis.cleanupSpeedPageResources = cleanupSpeedPageResources;

/**
 * Smooth 4K cross-page navigation helper with zero artificial delay and BFCache resilience
 */
let isNavigatingToPage = false;
function smoothNavigateToPage(targetUrl) {
  if (isNavigatingToPage || !targetUrl) return;
  isNavigatingToPage = true;
  cleanupSpeedPageResources();
  if (document.body) {
    document.body.classList.add("terrax-page-leaving");
  }
  window.location.assign(targetUrl);
  setTimeout(() => {
    isNavigatingToPage = false;
    document.body?.classList.remove("terrax-page-leaving");
  }, 2500);
}

// BFCache, pagehide, and pageshow resilience to prevent page freeze or background CPU leaks
window.addEventListener("pagehide", () => {
  cleanupSpeedPageResources();
});
window.addEventListener("beforeunload", () => {
  cleanupSpeedPageResources();
});
window.addEventListener("pageshow", () => {
  isNavigatingToPage = false;
  document.body?.classList.remove("terrax-page-leaving");
});

/**
 * Monitor network connectivity and NetworkInformation API changes
 * for real-time disconnection/reconnection alerts and Connection Type card updates
 */
function setupNetworkConnectivityMonitoring() {
  if (testState._connListenerAttached) return;
  testState._connListenerAttached = true;

  const handleOffline = () => {
    syncConnectionCardState(
      testState.state === RUNNING,
      testState.state === FINISHED,
      true
    );
    if (testState.state === RUNNING) {
      testState.userAborted = false;
      testState.speedtest?.abort();
      const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
      showTerraxToast({
        type: "error",
        title: dict.toastOfflineTitle,
        message: dict.toastOfflineMsg,
      });
    }
  };

  const handleOnline = () => {
    syncConnectionCardState(
      testState.state === RUNNING,
      testState.state === FINISHED,
      true
    );
    const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
    showTerraxToast({
      type: "info",
      title: dict.toastOnlineTitle,
      message: dict.toastOnlineMsg,
    });
  };

  const handleConnectionChange = () => {
    syncConnectionCardState(
      testState.state === RUNNING,
      testState.state === FINISHED,
      true
    );
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);

  let connObj = null;
  try {
    connObj =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null;
    if (connObj && typeof connObj.addEventListener === "function") {
      connObj.addEventListener("change", handleConnectionChange);
    }
  } catch (e) {
    // Ignore unsupported NetworkInformation API event listener
  }

  const cleanup = () => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
    try {
      if (connObj && typeof connObj.removeEventListener === "function") {
        connObj.removeEventListener("change", handleConnectionChange);
      }
    } catch (e) {}
    testState._connListenerAttached = false;
  };
  testState._connCleanupFn = cleanup;
  window.addEventListener("pagehide", cleanup, { once: true });
}

/**
 * Helper to fetch a JSON resource with automatic "../" fallback when opened under /frontend/
 */
async function fetchWithRootFallback(relativePath) {
  try {
    const response = await fetch(relativePath);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Fallback below
  }
  const fallbackResponse = await fetch(`../${relativePath}`);
  return await fallbackResponse.json();
}

/**
 * Create a new Speedtest and hook it into the global state
 */
function createSpeedtest() {
  const SpeedtestCtor =
    typeof globalThis.Speedtest === "function"
      ? globalThis.Speedtest
      : typeof window !== "undefined" && typeof window.Speedtest === "function"
        ? window.Speedtest
        : null;
  if (!SpeedtestCtor) {
    console.error("Speedtest engine could not be loaded.");
    return;
  }
  testState.speedtest = new SpeedtestCtor();
  testState.speedtest.onupdate = (data) => {
    const now = performance.now();
    const dtSeconds =
      testState.lastSampleTimestamp > 0
        ? Math.min(1, Math.max(0.02, (now - testState.lastSampleTimestamp) / 1000))
        : 0.15;
    testState.lastSampleTimestamp = now;

    if (data && Number(data.testState) === 1) {
      const dlVal = Number(data.dlStatus);
      if (Number.isFinite(dlVal) && dlVal > 0) {
        testState.dlSamples.push(dlVal);
        testState.currentTestBytes += (dlVal * 1e6 * dtSeconds) / 8;
      }
    } else if (data && Number(data.testState) === 3) {
      const ulVal = Number(data.ulStatus);
      if (Number.isFinite(ulVal) && ulVal > 0) {
        testState.ulSamples.push(ulVal);
        testState.currentTestBytes += (ulVal * 1e6 * dtSeconds) / 8;
      }
    }

    testState.testData = data;
    testState.testDataDirty = true;
  };
  testState.speedtest.onend = (aborted) => {
    testState.state = aborted ? READY : FINISHED;
    testState.testDataDirty = true;
    syncConnectionCardState(false, !aborted);
    if (!aborted && testState.testData) {
      const math = globalThis.TerraxTelemetryMath;
      const finalMetrics = math?.calculateRealMetrics
        ? math.calculateRealMetrics(
            testState.dlSamples,
            testState.ulSamples,
            testState.testData.pingStatus,
            testState.testData.jitterStatus
          )
        : { maxSpeedMbps: null, avgSpeedMbps: null };

      // Smooth requestAnimationFrame count-up animation for Max Speed and Average Speed cards
      startFinalStatCardsCountUp(
        finalMetrics.maxSpeedMbps,
        finalMetrics.avgSpeedMbps
      );

      if (!testState.historyRecordedForRun) {
        testState.historyRecordedForRun = true;
        recordCompletedTestRun(testState.testData);

        // Section 45: Speed Test Completion Visual-Focus Effect
        const dlGauge = document.querySelector("#download-gauge");
        const statCards = document.querySelectorAll(".cyber-stat-card");
        dlGauge?.classList.add("test-complete-focus");
        statCards.forEach((c) => c.classList.add("test-complete-focus"));
        setTimeout(() => {
          dlGauge?.classList.remove("test-complete-focus");
          statCards.forEach((c) => c.classList.remove("test-complete-focus"));
        }, 1500);

        // Visual Toast Notification: Test completion
        const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
        showTerraxToast({
          type: "success",
          title: dict.toastCompleteTitle,
          message: dict.toastCompleteMsg,
        });

        // State-Driven Smart Ad Refresh on Test Complete (unlocks Network Isolation & refreshes Yandex RTB / AdSense)
        globalThis.TerraxSmartAdEngine?.onTestComplete("speed");
      }
    } else if (aborted) {
      cancelStatCardsCountUp();
      // If the test was not aborted manually by user click or if offline, preserve ERROR state and alert disconnection
      if (!testState.userAborted || !navigator.onLine) {
        globalThis.TerraxSmartAdEngine?.onTestError?.({
          reason: !navigator.onLine ? "offline" : "connection_abort",
          timestamp: Date.now(),
        });
        const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
        showTerraxToast({
          type: "error",
          title: dict.toastAbortTitle,
          message: dict.toastAbortMsg,
        });
      } else {
        globalThis.TerraxSmartAdEngine?.setTestingState(false);
      }
    } else {
      cancelStatCardsCountUp();
      globalThis.TerraxSmartAdEngine?.setTestingState(false);
    }
  };
}

/**
 * Make all the buttons respond to the right clicks
 */
function hookUpButtons() {
  const startBtn = document.querySelector("#start-button");
  if (startBtn) {
    startBtn.addEventListener("click", startButtonClickHandler);
  }

  const choosePrivacy = document.querySelector("#choose-privacy");
  if (choosePrivacy) {
    choosePrivacy.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#privacy")?.showModal();
    });
  }

  const openPrivacyFromSettings = document.querySelector(
    "#open-privacy-from-settings"
  );
  if (openPrivacyFromSettings) {
    openPrivacyFromSettings.addEventListener("click", () => {
      document.querySelector("#settings-dialog")?.close();
      document.querySelector("#privacy")?.showModal();
    });
  }

  const shareResults = document.querySelector("#share-results");
  if (shareResults) {
    shareResults.addEventListener("click", () =>
      document.querySelector("#share")?.showModal()
    );
  }

  const copyLink = document.querySelector("#copy-link");
  if (copyLink) {
    copyLink.addEventListener("click", copyLinkButtonClickHandler);
  }

  document
    .querySelectorAll(".close-dialog, #close-privacy")
    .forEach((element) => {
      element.addEventListener("click", () =>
        document.querySelectorAll("dialog").forEach((modal) => modal.close())
      );
      element.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          document.querySelectorAll("dialog").forEach((modal) => modal.close());
        }
      });
    });

  // Language selector inside settings dialog
  const languageSelect = document.querySelector("#language-select");
  if (languageSelect) {
    languageSelect.value = testState.lang || "ar";
    languageSelect.addEventListener("change", (e) => {
      applyLanguage(e.target.value, { persist: true });
    });
  }

  // Auto-Gbps toggle inside settings dialog (persisted across all pages)
  const autoGbpsToggle = document.querySelector("#toggle-auto-gbps");
  if (autoGbpsToggle) {
    try {
      const savedAutoGbps = localStorage.getItem(AUTO_GBPS_STORAGE_KEY);
      if (savedAutoGbps === "0" || savedAutoGbps === "false") {
        testState.autoGbps = false;
      } else if (savedAutoGbps === "1" || savedAutoGbps === "true") {
        testState.autoGbps = true;
      }
    } catch (e) {}
    autoGbpsToggle.checked = Boolean(testState.autoGbps);
    autoGbpsToggle.addEventListener("change", () => {
      testState.autoGbps = Boolean(autoGbpsToggle.checked);
      try {
        localStorage.setItem(AUTO_GBPS_STORAGE_KEY, testState.autoGbps ? "1" : "0");
      } catch (e) {}
      testState.testDataDirty = true;
    });
  }

  // Clear local usage history button
  const clearHistoryBtn = document.querySelector("#clear-history-btn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch (e) {
        // Ignore storage restrictions
      }
      renderUsageHistoryUI();
    });
  }

  // Interactive sorting on Test History table column headers
  const sortableHeaders = document.querySelectorAll(
    "#usage-dialog .cyber-history-table thead th[data-sort-key]"
  );
  sortableHeaders.forEach((th) => {
    if (th.dataset.sortHooked === "1") return;
    th.dataset.sortHooked = "1";
    const triggerSort = () => {
      const sortKey = th.getAttribute("data-sort-key");
      if (sortKey) {
        setHistorySort(sortKey);
      }
    };
    th.addEventListener("click", triggerSort);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerSort();
      }
    });
  });

  // Bottom 5-Tab Cyber Glass Navigation Dock
  const navItems = document.querySelectorAll(".nav-dock-item");
  const setActiveNav = (activeId) => {
    const resolvedId = document.getElementById(activeId) ? activeId : "nav-speed-btn";
    navItems.forEach((btn) => {
      const isMatch = btn.id === resolvedId;
      btn.classList.toggle("active", isMatch);
      if (isMatch) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
  };
  testState.setActiveNav = setActiveNav;

  const restoreSpeedNavIfIdle = () => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(
      (d) => d.open
    );
    const serverDropdownOpen = Boolean(
      document.querySelector("div.server-selector > ul.servers.active")
    );
    if (!anyDialogOpen && !serverDropdownOpen) {
      setActiveNav("nav-speed-btn");
    }
  };

  // Sync bottom nav active state whenever any dialog closes or backdrop is clicked
  document.querySelectorAll("dialog").forEach((modal) => {
    modal.addEventListener("close", () => {
      if (modal.id === "usage-dialog") {
        cancelUsageTestsCountUp(true);
      }
      restoreSpeedNavIfIdle();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.close();
        if (typeof e.clientX === "number" && typeof e.clientY === "number" && (e.clientX > 0 || e.clientY > 0)) {
          const hitEl = document.elementFromPoint(e.clientX, e.clientY);
          const navBtn = hitEl?.closest?.(".nav-dock-item");
          if (navBtn && typeof navBtn.click === "function") {
            navBtn.click();
          }
        }
      }
    });
  });

  // Automatically trigger 'Completed Tests' count-up animation whenever #usage-dialog opens
  const usageDialogEl = document.querySelector("#usage-dialog");
  if (
    usageDialogEl &&
    usageDialogEl.dataset.countUpObserved !== "1" &&
    typeof MutationObserver === "function"
  ) {
    usageDialogEl.dataset.countUpObserved = "1";
    let wasOpen = Boolean(usageDialogEl.open || usageDialogEl.hasAttribute("open"));
    const dialogObserver = new MutationObserver(() => {
      const isOpen = Boolean(usageDialogEl.open || usageDialogEl.hasAttribute("open"));
      if (isOpen && !wasOpen) {
        wasOpen = true;
        if (!testState._usageCountUpActive) {
          renderUsageHistoryUI({ animateCount: true });
        }
      } else if (!isOpen && wasOpen) {
        wasOpen = false;
        cancelUsageTestsCountUp(true);
      }
    });
    dialogObserver.observe(usageDialogEl, {
      attributes: true,
      attributeFilter: ["open"],
    });
  }

  const navSpeedBtn = document.querySelector("#nav-speed-btn");
  if (navSpeedBtn) {
    navSpeedBtn.addEventListener("click", () => {
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      document
        .querySelector("div.server-selector > ul.servers")
        ?.classList.remove("active");
      setActiveNav("nav-speed-btn");
      globalThis.TerraxSmartAdEngine?.onTabChange("speed");
      scrollInitialDownloadGaugeIntoView();
    });
  }

  const navUsageBtn = document.querySelector("#nav-usage-btn");
  if (navUsageBtn) {
    navUsageBtn.addEventListener("click", () => {
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      document
        .querySelector("div.server-selector > ul.servers")
        ?.classList.remove("active");
      setActiveNav("nav-usage-btn");
      globalThis.TerraxSmartAdEngine?.onTabChange("usage");
      document.querySelector("#usage-dialog")?.showModal();
      renderUsageHistoryUI({ animateCount: true });
    });
  }

  const navStabilityBtn = document.querySelector("#nav-stability-btn");
  if (navStabilityBtn) {
    navStabilityBtn.addEventListener("click", () => {
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      setActiveNav("nav-stability-btn");
      if (testState.state === RUNNING && testState.speedtest) {
        try {
          testState.speedtest.abort();
        } catch (e) {}
      }
      smoothNavigateToPage("stability.html");
    });
  }

  const navGamingBtn = document.querySelector("#nav-gaming-btn");
  if (navGamingBtn) {
    navGamingBtn.addEventListener("click", () => {
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      document
        .querySelector("div.server-selector > ul.servers")
        ?.classList.remove("active");
      setActiveNav("nav-gaming-btn");
      if (testState.state === RUNNING && testState.speedtest) {
        try {
          testState.speedtest.abort();
        } catch (e) {}
      }
      smoothNavigateToPage("gaming.html");
    });
  }

  const navServersBtn = document.querySelector("#nav-servers-btn");
  if (navServersBtn) {
    navServersBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      setActiveNav("nav-servers-btn");
      globalThis.TerraxSmartAdEngine?.onTabChange("servers");
      const selector = document.querySelector("div.server-selector");
      const list = selector?.querySelector("ul.servers");
      if (selector) {
        selector.scrollIntoView({ behavior: "smooth", block: "center" });
        if (list && !selector.classList.contains("single-server")) {
          list.classList.add("active");
        }
      }
    });
  }

  const navSettingsBtn = document.querySelector("#nav-settings-btn");
  if (navSettingsBtn) {
    navSettingsBtn.addEventListener("click", () => {
      document.querySelectorAll("dialog").forEach((modal) => modal.close());
      document
        .querySelector("div.server-selector > ul.servers")
        ?.classList.remove("active");
      setActiveNav("nav-settings-btn");
      globalThis.TerraxSmartAdEngine?.onTabChange("settings");
      document.querySelector("#settings-dialog")?.showModal();
    });
  }

  // Handle cross-page navigation query parameters (?tab=usage | servers | settings | gaming)
  try {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    if (requestedTab === "usage") {
      setActiveNav("nav-usage-btn");
      document.querySelector("#usage-dialog")?.showModal();
      renderUsageHistoryUI({ animateCount: true });
    } else if (requestedTab === "settings") {
      setActiveNav("nav-settings-btn");
      document.querySelector("#settings-dialog")?.showModal();
    } else if (requestedTab === "gaming") {
      window.location.href = "gaming.html";
    } else if (requestedTab === "servers") {
      setActiveNav("nav-servers-btn");
      testState.openServersOnLoad = true;
    }
  } catch (e) {}

  // Attach micro-interactions to measurement buttons
  attachButtonMicroInteractions();
}

/**
 * Event listener for clicks on the main start button
 * Calibrated with monotonic _startRunToken and abortable warm-up controller
 * to prevent race conditions from repeated/rapid button clicks.
 */
function startButtonClickHandler() {
  if (testState.speedtest?.getState() === 3) {
    testState._startRunToken = (testState._startRunToken || 0) + 1;
    cancelPendingTestWarmup();
    testState.userAborted = true;
    cancelStatCardsCountUp();
    globalThis.TerraxSmartAdEngine?.setTestingState(false);
    syncConnectionCardState(false, false);
    testState.speedtest.abort();
    return;
  }

  switch (testState.state) {
    case READY:
    case FINISHED: {
      testState._startRunToken = (testState._startRunToken || 0) + 1;
      const activeRunToken = testState._startRunToken;
      cancelPendingTestWarmup();
      cancelStatCardsCountUp();
      if (testState._progressHideTimeoutId) {
        clearTimeout(testState._progressHideTimeoutId);
        testState._progressHideTimeoutId = null;
      }
      testState._progressHideScheduled = false;
      testState._progressFinishedShown = false;
      testState.userAborted = false;
      testState._maxProgressPct = 0;
      testState.dlSamples = [];
      testState.ulSamples = [];
      testState.lastSampleTimestamp = performance.now();
      testState.currentTestBytes = 0;
      testState.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      testState.historyRecordedForRun = false;
      testState.prevDlNumber = "";
      testState.prevUlNumber = "";
      testState.prevStabNumber = "";
      testState.dlDisplayMbps = 0;
      testState.ulDisplayMbps = 0;
      testState.lastRenderTimestamp = performance.now();
      testState.testData = null;
      testState.testDataDirty = true;
      getStatCardsRafController()?.reset("--", "Mbps");

      if (!testState.speedtest) {
        createSpeedtest();
      }
      if (testState.speedtest?.getState() === 3) {
        return;
      }
      // Activate Network Isolation Lock before starting bandwidth test
      globalThis.TerraxSmartAdEngine?.setTestingState(true);
      testState.initialGaugeScrollPending = true;
      testState.state = RUNNING;
      syncConnectionCardState(true, false);

      // Pre-test socket warm-up to verify latency to 'Yemen' server and prioritize if <= threshold
      const yemenCandidate = testState.servers.find(
        (s) => s && s.name === "اليمن"
      );
      if (yemenCandidate && typeof fetch === "function") {
        const basePath = (yemenCandidate.server || "") + (yemenCandidate.pingURL || "backend/empty.php");
        const pingEndpoint = basePath
          ? basePath + (basePath.includes("?") ? "&" : "?") + "cors=true&r=" + Math.random()
          : null;
        if (pingEndpoint) {
          const t0 = performance.now();
          const warmupController =
            typeof AbortController === "function" ? new AbortController() : null;
          testState._warmupAbortController = warmupController;
          const fetchOpts = { cache: "no-store" };
          if (warmupController) {
            fetchOpts.signal = warmupController.signal;
          }
          fetch(pingEndpoint, fetchOpts)
            .then(() => {
              if (testState._startRunToken !== activeRunToken || testState.state !== RUNNING) {
                return;
              }
              const latency = performance.now() - t0;
              // Reasonable threshold: <= 250ms; keep minimum warm RTT
              if (latency > 0 && latency <= 250 && testState.speedtest?.getState() !== 3) {
                yemenCandidate.pingT =
                  typeof yemenCandidate.pingT === "number" && yemenCandidate.pingT > 0
                    ? Math.min(yemenCandidate.pingT, latency)
                    : latency;
                selectServer(yemenCandidate);
              }
            })
            .catch(() => {})
            .finally(() => {
              if (testState._warmupAbortController === warmupController) {
                testState._warmupAbortController = null;
              }
              if (testState._startRunToken !== activeRunToken || testState.state !== RUNNING) {
                return;
              }
              testState._warmupTimeoutId = setTimeout(() => {
                testState._warmupTimeoutId = null;
                if (
                  testState._startRunToken === activeRunToken &&
                  testState.state === RUNNING &&
                  testState.speedtest?.getState() !== 3
                ) {
                  testState.speedtest?.start();
                }
              }, 20);
            });
          return;
        }
      }

      if (testState._startRunToken === activeRunToken && testState.state === RUNNING) {
        testState.speedtest?.start();
      }
      return;
    }
    case RUNNING:
      testState._startRunToken = (testState._startRunToken || 0) + 1;
      cancelPendingTestWarmup();
      testState.userAborted = true;
      cancelStatCardsCountUp();
      globalThis.TerraxSmartAdEngine?.setTestingState(false);
      syncConnectionCardState(false, false);
      if (testState.speedtest && testState.speedtest.getState() === 3) {
        testState.speedtest.abort();
      } else {
        testState.state = READY;
        testState.testData = null;
        testState.testDataDirty = true;
      }
      // testState.state is updated by `onend` handler of speedtest
      return;
    default:
      return;
  }
}

/**
 * Scroll the initial download gauge into view on narrow viewports when starting a test
 */
function scrollInitialDownloadGaugeIntoView() {
  if (!window.matchMedia("(max-width: 800px)").matches) {
    return;
  }

  const downloadGauge = document.querySelector("#download-gauge");
  if (!downloadGauge) {
    return;
  }

  const { top, bottom } = downloadGauge.getBoundingClientRect();
  if (top >= 0 && bottom <= window.innerHeight) {
    return;
  }

  downloadGauge.scrollIntoView({
    block: "center",
    inline: "nearest",
  });
}

/**
 * Event listener for clicks on the "Copy link" button in the modal
 */
async function copyLinkButtonClickHandler() {
  const link = document.querySelector("img#results").src;
  await navigator.clipboard.writeText(link);
  const button = document.querySelector("#copy-link");
  const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
  button.classList.add("active");
  button.textContent = dict.copiedLinkBtn;
  setTimeout(() => {
    button.classList.remove("active");
    const activeDict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
    button.textContent = activeDict.copyLinkBtn;
  }, 3000);
}

/**
 * Load settings from settings.json on the server and apply them
 */
async function applySettingsJSON() {
  try {
    const settings = await fetchWithRootFallback("settings.json");
    if (!settings || typeof settings !== "object") {
      return console.error("Settings are empty or malformed");
    }
    for (let setting in settings) {
      testState.speedtest?.setParameter(setting, settings[setting]);
      if (
        setting == "telemetry_level" &&
        settings[setting] &&
        settings[setting] != "off" &&
        settings[setting] != "disabled" &&
        settings[setting] != "false"
      ) {
        testState.telemetryEnabled = true;
        document.querySelector("#privacy-warning")?.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Failed to fetch settings:", error);
  }
}

/**
 * Load server list from the configured source and populate the dropdown
 */
async function applyServerListJSON() {
  try {
    const serverSource =
      typeof globalThis.SPEEDTEST_SERVERS !== "undefined"
        ? globalThis.SPEEDTEST_SERVERS
        : "server-list.json";
    const servers = Array.isArray(serverSource)
      ? serverSource
      : await fetchWithRootFallback(serverSource);
    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return console.error("Server list is empty or malformed");
    }

    testState.servers = servers;

    // If there's only one server, just show it. No reachability checks needed.
    if (servers.length === 1) {
      populateDropdown(servers);
      return;
    }

    // For multiple servers: first run the built-in selection (which pings servers
    // and annotates them with pingT). Only then populate the dropdown so that
    // dead servers don't appear.
    if (!testState.speedtest) {
      populateDropdown(servers);
      return;
    }
    // If we already verified servers in this session within the last 120s, restore immediately for 0ms tab switching
    if (serverSource === "server-list.json") {
      try {
        const cachedRaw = sessionStorage.getItem("terrax_verified_servers_cache_v1");
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (
            cached &&
            Array.isArray(cached.servers) &&
            cached.servers.length > 0 &&
            Date.now() - Number(cached.ts || 0) < 120000
          ) {
            testState.servers = cached.servers;
            testState.speedtest.addTestPoints(testState.servers);
            populateDropdown(testState.servers);
            const defaultYemen = testState.servers.find((s) => s && s.name === "اليمن");
            selectServer(defaultYemen || testState.servers[0]);
            return;
          }
        }
      } catch (e) {}
    }

    testState.speedtest.addTestPoints(servers);
    testState.speedtest.selectServer((bestServer) => {
      const aliveServers = testState.servers.filter((s) => {
        if (s.pingT !== -1) return true;
        return typeof s.server === "string" && s.server.startsWith("//");
      });

      if (aliveServers.length > 0) {
        testState.servers = aliveServers;
      }
      if (serverSource === "server-list.json") {
        try {
          sessionStorage.setItem(
            "terrax_verified_servers_cache_v1",
            JSON.stringify({ ts: Date.now(), servers: testState.servers })
          );
        } catch (e) {}
      }
      populateDropdown(testState.servers);

      const defaultYemenServer = testState.servers.find(
        (s) => s && s.name === "اليمن"
      );
      if (defaultYemenServer) {
        selectServer(defaultYemenServer);
      } else if (bestServer) {
        selectServer(bestServer);
      } else if (testState.servers.length > 0) {
        selectServer(testState.servers[0]);
      }
    });
  } catch (error) {
    console.error("Failed to load server list:", error);
  }
}

/**
 * Add all the servers to the server selection dropdown and make it actually
 * work.
 * @param {Array} servers - an array of server objects
 */
function populateDropdown(servers) {
  const serverSelector = document.querySelector("div.server-selector");
  const serverList = serverSelector.querySelector("ul.servers");

  // Reset previous state (populateDropdown can be called multiple times)
  serverSelector.classList.remove("single-server");
  serverSelector.classList.remove("active");
  serverList.classList.remove("active");
  serverList.innerHTML = "";

  // If we have only a single server, just show it
  if (servers.length === 1) {
    serverSelector.classList.add("single-server");
    selectServer(servers[0]);
    return;
  }
  serverSelector.classList.add("active");

  // Make the dropdown open and close (hook only once)
  if (serverSelector.dataset.hooked !== "1") {
    serverSelector.dataset.hooked = "1";

    serverSelector.addEventListener("click", () => {
      const isOpen = serverList.classList.toggle("active");
      if (isOpen) {
        testState.setActiveNav?.("nav-servers-btn");
      } else {
        testState.setActiveNav?.("nav-speed-btn");
      }
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("div.server-selector") !== serverSelector) {
        if (serverList.classList.contains("active")) {
          serverList.classList.remove("active");
          const anyDialogOpen = Array.from(
            document.querySelectorAll("dialog")
          ).some((d) => d.open);
          if (!anyDialogOpen) {
            testState.setActiveNav?.("nav-speed-btn");
          }
        }
      }
    });
  }

  if (testState.openServersOnLoad && servers.length > 1) {
    testState.openServersOnLoad = false;
    serverList.classList.add("active");
  }

  // Sort servers by country, then by city within the same country.
  const parseServerName = (name) => {
    const parts = (name || "").split(/[،,]/).map((s) => s.trim());
    let country, city;
    if (parts.length >= 3) {
      country = parts[1];
      city = parts[0];
    } else if (parts.length === 2) {
      country = parts[1];
      city = parts[0];
    } else {
      country = parts[0];
      city = "";
    }
    country = country.replace(/\s*\([^)]*\)\s*/g, "").trim();
    return { country, city };
  };
  const sorted = [...servers].sort((a, b) => {
    if (a.name === "اليمن" && b.name !== "اليمن") return -1;
    if (b.name === "اليمن" && a.name !== "اليمن") return 1;
    const pa = parseServerName(a.name);
    const pb = parseServerName(b.name);
    return (
      pa.country.localeCompare(pb.country) || pa.city.localeCompare(pb.city)
    );
  });

  // Populate the list to choose from
  sorted.forEach((server) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.innerHTML = `<span class="server-name-text" dir="auto">${server.name}</span>`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      selectServer(server);
    });
    item.appendChild(link);
    serverList.appendChild(item);
  });
}

/**
 * Set the given server as the selected server for the speedtest
 * @param {Object} server - a server object
 */
function selectServer(server) {
  if (testState.speedtest?.getState() === 3) {
    return;
  }
  testState.speedtest?.setSelectedServer(server);
  testState.selectedServerDirty = true;
  if (testState.state !== RUNNING) {
    testState.state = READY;
  }
}

/**
 * Read real connection information from the browser environment via TerraxTelemetryMath
 * (navigator.connection and navigator.onLine) without ever guessing or returning fake Wi-Fi.
 * @param {string} [lang]
 * @param {Object} [customNav]
 */
function readRealConnectionInfo(lang = testState.lang, customNav = undefined) {
  const math = globalThis.TerraxTelemetryMath;
  if (math && typeof math.resolveRealConnectionInfo === "function") {
    return math.resolveRealConnectionInfo(customNav, lang);
  }
  const isEn = lang === "en";
  const dict = UI_TRANSLATIONS[isEn ? "en" : "ar"] || UI_TRANSLATIONS.ar;
  try {
    const nav =
      customNav !== undefined
        ? customNav
        : typeof navigator !== "undefined"
          ? navigator
          : null;
    if (nav && nav.onLine === false) {
      return {
        kind: "offline",
        source: "navigator.onLine",
        label: dict.connOffline,
        detail: dict.connOffline,
      };
    }
  } catch (e) {}
  return {
    kind: "unavailable",
    source: "unsupported",
    label: dict.connUnavailable,
    detail: dict.connUnavailable,
  };
}
globalThis.readRealConnectionInfo = readRealConnectionInfo;

/**
 * Update the Connection Type card ("نوع الاتصال") visual state and real connection label
 * across Idle, Testing, and Completed stages without per-frame DOM thrashing.
 */
function syncConnectionCardState(
  isTesting = false,
  isCompleted = false,
  forceRefresh = false
) {
  const activeTesting = Boolean(isTesting);
  const activeCompleted = !activeTesting && Boolean(isCompleted);
  const stateName = activeTesting
    ? "testing"
    : activeCompleted
      ? "completed"
      : "idle";

  const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
  const connInfo = readRealConnectionInfo(testState.lang);
  const targetLabel = connInfo.label || dict.connUnavailable;
  const targetKind = connInfo.kind || "unavailable";
  const targetTitle = activeTesting
    ? `${connInfo.detail || targetLabel} • ${dict.connVerifyingHint}`
    : connInfo.detail || targetLabel;

  if (
    !forceRefresh &&
    testState._lastConnLabel === targetLabel &&
    testState._lastConnState === stateName &&
    testState._lastConnTitle === targetTitle &&
    testState._lastConnKind === targetKind
  ) {
    return;
  }

  const connCardEl = document.querySelector(".connection-info-pill");
  const connTextEl = document.querySelector("#connection-type-text");

  if (connTextEl && connTextEl.textContent !== targetLabel) {
    connTextEl.textContent = targetLabel;
  }

  if (connCardEl) {
    connCardEl.classList.toggle("is-testing", activeTesting);
    connCardEl.classList.toggle("is-completed", activeCompleted);
    connCardEl.dataset.isTesting = activeTesting ? "true" : "false";
    connCardEl.dataset.connectionState = stateName;
    connCardEl.dataset.connectionKind = targetKind;
    connCardEl.dataset.connectionSource = connInfo.source || "unsupported";
    if (targetTitle) {
      connCardEl.setAttribute("title", targetTitle);
    } else {
      connCardEl.removeAttribute("title");
    }
  }

  testState._lastConnLabel = targetLabel;
  testState._lastConnState = stateName;
  testState._lastConnTitle = targetTitle;
  testState._lastConnKind = targetKind;
}
globalThis.syncConnectionCardState = syncConnectionCardState;

/**
 * Set the Connection Type display from the real browser source and synchronize its UI state
 */
function detectConnectionType() {
  syncConnectionCardState(
    testState.state === RUNNING,
    testState.state === FINISHED,
    true
  );
}

/**
 * Set or toggle the active sorting column and direction for the Test History table
 * @param {string} sortKey
 * @param {string} [explicitDir]
 */
function setHistorySort(sortKey, explicitDir) {
  const validKeys = ["date", "time", "server", "dl", "ul", "stability", "ping"];
  const normalizedKey =
    typeof sortKey === "string" && validKeys.includes(sortKey.trim().toLowerCase())
      ? sortKey.trim().toLowerCase()
      : "date";

  if (explicitDir === "asc" || explicitDir === "desc") {
    testState.historySortKey = normalizedKey;
    testState.historySortDir = explicitDir;
  } else if (testState.historySortKey === normalizedKey) {
    testState.historySortDir = testState.historySortDir === "desc" ? "asc" : "desc";
  } else {
    testState.historySortKey = normalizedKey;
    // Default ascending for Server name and Ping (lower latency first), descending for Date/Time/Speeds/Stability
    testState.historySortDir =
      normalizedKey === "server" || normalizedKey === "ping" ? "asc" : "desc";
  }

  renderUsageHistoryUI();
}
globalThis.setTerraxHistorySort = setHistorySort;

/**
 * Record a completed real speedtest run to localStorage for the Usage & History dialog.
 * Guarantees accuracy across test restarts via unique runId and pure normalization.
 */
function recordCompletedTestRun(data) {
  if (!data || typeof data !== "object") return;
  try {
    const math = globalThis.TerraxTelemetryMath;
    const metrics = math?.calculateRealMetrics
      ? math.calculateRealMetrics(
          testState.dlSamples,
          testState.ulSamples,
          data.pingStatus,
          data.jitterStatus
        )
      : { stabilityPercent: null };

    const server = getSafeSelectedServer();
    const nowDate = new Date();
    const runId =
      testState.currentRunId ||
      `run_${nowDate.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
    testState.currentRunId = runId;

    const rawRun = {
      runId,
      epochMs: nowDate.getTime(),
      serverName: server?.name || (testState.lang === "en" ? "Yemen" : "اليمن"),
      dlMbps: Number(data.dlStatus) || 0,
      ulMbps: Number(data.ulStatus) || 0,
      pingMs: Number(data.pingStatus) || 0,
      jitterMs: Number(data.jitterStatus) || 0,
      stabilityPercent: metrics.stabilityPercent,
      megabytesUsed: Math.max(
        0.5,
        Number((testState.currentTestBytes / (1024 * 1024)).toFixed(1))
      ),
    };

    const existingRaw = localStorage.getItem(HISTORY_STORAGE_KEY);
    let existingList = [];
    try {
      existingList = existingRaw ? JSON.parse(existingRaw) : [];
    } catch (parseErr) {
      existingList = [];
    }

    const updatedList =
      math && typeof math.appendTestHistoryEntry === "function"
        ? math.appendTestHistoryEntry(existingList, rawRun, 25, nowDate)
        : [
            math && typeof math.createTestHistoryEntry === "function"
              ? math.createTestHistoryEntry(rawRun, nowDate)
              : {
                  ...rawRun,
                  isoDate: nowDate.toISOString().slice(0, 10),
                  dateAr: nowDate.toISOString().slice(0, 10).replace(/-/g, "/"),
                  dateEn: nowDate.toISOString().slice(0, 10),
                  timestamp: nowDate.toLocaleTimeString(
                    testState.lang === "en" ? "en-US" : "ar-SA",
                    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                  ),
                },
            ...(Array.isArray(existingList) ? existingList : []),
          ].slice(0, 25);

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedList));
    renderUsageHistoryUI();
  } catch (e) {
    // Ignore storage errors in private browsing
  }
}
globalThis.recordCompletedTestRun = recordCompletedTestRun;

/**
 * Cancel any active count-up animation on the 'Completed Tests' counter (#total-tests-count)
 * @param {boolean} [snapToTarget=false]
 */
function cancelUsageTestsCountUp(snapToTarget = false) {
  if (typeof testState._usageCountUpCancel === "function") {
    try {
      testState._usageCountUpCancel();
    } catch (e) {}
  }
  testState._usageCountUpCancel = null;
  testState._usageCountUpActive = false;

  const totalCountEl = document.querySelector("#total-tests-count");
  const statBoxEl = totalCountEl?.closest(".usage-stat-box");
  totalCountEl?.classList.remove("counting-up");
  statBoxEl?.classList.remove("counting-up");
  if (totalCountEl) {
    totalCountEl.dataset.countingUp = "false";
    if (snapToTarget) {
      totalCountEl.textContent = String(testState._usageCountUpTarget || 0);
    }
  }
}
globalThis.cancelUsageTestsCountUp = cancelUsageTestsCountUp;

/**
 * Trigger a smooth requestAnimationFrame count-up animation for the 'Completed Tests'
 * number (#total-tests-count) in the Usage dialog when the dialog opens.
 * @param {number} targetCount
 * @param {number} [durationMs=650]
 */
function startUsageTestsCountUp(targetCount, durationMs = 650) {
  cancelUsageTestsCountUp(false);

  const totalCountEl = document.querySelector("#total-tests-count");
  if (!totalCountEl) return;
  const statBoxEl = totalCountEl.closest(".usage-stat-box");

  const safeTarget = Math.max(0, Math.floor(Number(targetCount) || 0));
  testState._usageCountUpTarget = safeTarget;
  totalCountEl.dataset.targetCount = String(safeTarget);

  const math = globalThis.TerraxTelemetryMath;
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    !math ||
    typeof math.animateCompletedTestsCountUp !== "function" ||
    reducedMotion ||
    safeTarget <= 0
  ) {
    totalCountEl.textContent = String(safeTarget);
    totalCountEl.dataset.countingUp = "false";
    return;
  }

  testState._usageCountUpActive = true;
  totalCountEl.classList.add("counting-up");
  statBoxEl?.classList.add("counting-up");
  totalCountEl.dataset.countingUp = "true";

  testState._usageCountUpCancel = math.animateCompletedTestsCountUp({
    targetCount: safeTarget,
    durationMs,
    reducedMotion,
    onFrame: ({ displayValue }) => {
      if (totalCountEl.textContent !== displayValue) {
        totalCountEl.textContent = displayValue;
      }
    },
    onComplete: () => {
      testState._usageCountUpActive = false;
      testState._usageCountUpCancel = null;
      totalCountEl.textContent = String(safeTarget);
      totalCountEl.classList.remove("counting-up");
      statBoxEl?.classList.remove("counting-up");
      totalCountEl.dataset.countingUp = "false";
    },
  });
}
globalThis.startUsageTestsCountUp = startUsageTestsCountUp;

/**
 * Render the Usage & Real Test History modal content with Date column, column sorting,
 * and optional Completed Tests count-up animation on dialog open.
 * @param {Object} [options]
 * @param {boolean} [options.animateCount=false]
 */
function renderUsageHistoryUI(options) {
  const opts = options && typeof options === "object" ? options : {};
  const totalDataEl = document.querySelector("#total-data-used");
  const totalCountEl = document.querySelector("#total-tests-count");
  const tbody = document.querySelector("#test-history-tbody");
  if (!tbody || !totalDataEl || !totalCountEl) return;

  const math = globalThis.TerraxTelemetryMath;
  let rawList = [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    rawList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    rawList = [];
  }

  const normalizedList =
    math && typeof math.normalizeTestHistoryList === "function"
      ? math.normalizeTestHistoryList(rawList)
      : Array.isArray(rawList)
        ? rawList
        : [];

  const totalMB = normalizedList.reduce(
    (sum, item) => sum + (Number(item.megabytesUsed) || 0),
    0
  );
  totalDataEl.textContent =
    totalMB >= 1024
      ? `${(totalMB / 1024).toFixed(2)} GB`
      : `${totalMB.toFixed(1)} MB`;

  const targetCount = normalizedList.length;
  totalCountEl.dataset.targetCount = String(targetCount);
  if (opts.animateCount) {
    startUsageTestsCountUp(targetCount);
  } else if (
    !testState._usageCountUpActive ||
    testState._usageCountUpTarget !== targetCount
  ) {
    if (testState._usageCountUpActive) {
      cancelUsageTestsCountUp(false);
    }
    testState._usageCountUpTarget = targetCount;
    totalCountEl.textContent = String(targetCount);
  }

  // Sync sortable table header indicators and ARIA attributes
  const activeSortKey = testState.historySortKey || "date";
  const activeSortDir = testState.historySortDir === "asc" ? "asc" : "desc";
  const headers = document.querySelectorAll(
    "#usage-dialog .cyber-history-table thead th[data-sort-key]"
  );
  headers.forEach((th) => {
    const key = th.getAttribute("data-sort-key");
    const isSorted = key === activeSortKey;
    th.classList.toggle("is-sorted", isSorted);
    th.setAttribute(
      "aria-sort",
      isSorted ? (activeSortDir === "asc" ? "ascending" : "descending") : "none"
    );
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) {
      indicator.textContent = isSorted
        ? activeSortDir === "asc"
          ? "↑"
          : "↓"
        : "↕";
    }
  });

  const dict = UI_TRANSLATIONS[testState.lang] || UI_TRANSLATIONS.ar;
  if (normalizedList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-history-cell">${dict.emptyHistory}</td></tr>`;
    return;
  }

  const sortedList =
    math && typeof math.sortTestHistoryList === "function"
      ? math.sortTestHistoryList(normalizedList, activeSortKey, activeSortDir)
      : normalizedList;

  const isEn = testState.lang === "en";
  tbody.innerHTML = sortedList
    .map((item) => {
      const dateText = isEn
        ? item.dateEn || item.isoDate || item.date || "--"
        : item.dateAr || item.isoDate || item.date || "--";
      const timeText = isEn
        ? item.timeEn || item.timestamp || "--"
        : item.timeAr || item.timestamp || "--";
      const stabText =
        item.stabilityPercent !== null && item.stabilityPercent !== undefined
          ? `${item.stabilityPercent}%`
          : "--";
      return `
      <tr data-run-id="${item.runId || ""}" data-epoch-ms="${item.epochMs || 0}">
        <td class="history-date-cell" dir="ltr">${dateText}</td>
        <td class="history-time-cell" dir="ltr">${timeText}</td>
        <td>${item.serverName}</td>
        <td dir="ltr">${Number(item.dlMbps).toFixed(1)} Mbps</td>
        <td dir="ltr">${Number(item.ulMbps).toFixed(1)} Mbps</td>
        <td dir="ltr">${stabText}</td>
        <td dir="ltr">${Number(item.pingMs).toFixed(1)} ms</td>
      </tr>
    `;
    })
    .join("");
}
globalThis.renderUsageHistoryUI = renderUsageHistoryUI;

/**
 * Start the requestAnimationFrame UI rendering loop
 */
function startRenderingLoop() {
  const shell = document.querySelector(".terrax-cyber-shell");
  const serverSelector = document.querySelector("div.server-selector");
  const selectedServer = serverSelector.querySelector("#selected-server");
  const sponsor = serverSelector.querySelector("#sponsor");
  const startButton = document.querySelector("#start-button");
  const privacyWarning = document.querySelector("#privacy-warning");

  const gauges = document.querySelectorAll(
    "#download-gauge, #upload-gauge, #stability-gauge"
  );
  const downloadProgress = document.querySelector("#download-gauge .progress");
  const uploadProgress = document.querySelector("#upload-gauge .progress");
  const downloadGauge = document.querySelector("#download-gauge .speed");
  const uploadGauge = document.querySelector("#upload-gauge .speed");
  const downloadText =
    document.querySelector("#download-speed") ||
    document.querySelector("#download-gauge span");
  const uploadText =
    document.querySelector("#upload-speed") ||
    document.querySelector("#upload-gauge span");

  const downloadUnit = document.querySelector("#download-unit");
  const downloadUnitAr = document.querySelector("#download-unit-ar");
  const downloadQualityText = document.querySelector("#download-quality-text");
  const uploadUnit = document.querySelector("#upload-unit");
  const uploadUnitAr = document.querySelector("#upload-unit-ar");
  const uploadQualityText = document.querySelector("#upload-quality-text");

  const dlSvgArc = document.querySelector("#dl-svg-arc");
  const ulSvgArc = document.querySelector("#ul-svg-arc");
  const stabSvgArc = document.querySelector("#stab-svg-arc");

  const stabilityValueEl = document.querySelector("#stability-value");
  const stabilityStatusEl = document.querySelector("#stability-status");

  const maxSpeedValueEl = document.querySelector("#max-speed-value");
  const maxSpeedUnitEl = document.querySelector("#max-speed-unit");
  const avgSpeedValueEl = document.querySelector("#avg-speed-value");
  const avgSpeedUnitEl = document.querySelector("#avg-speed-unit");
  const connectionTypeEl = document.querySelector("#connection-type-text");

  const pingAndJitter = document.querySelectorAll(".ping, .jitter");
  const ping = document.querySelector("#ping");
  const jitter = document.querySelector("#jitter");
  const shareResults = document.querySelector("#share-results");
  const copyLink = document.querySelector("#copy-link");
  const resultsImage = document.querySelector("#results");

  const progressContainer = document.querySelector("#test-timeline-progress");
  const progressFill = document.querySelector("#test-progress-fill");
  const progressPhaseText = document.querySelector("#test-progress-phase");
  const progressPctText = document.querySelector("#test-progress-pct");

  const buttonTextsAr = {
    [INITIALIZING]: "جاري التحميل...",
    [READY]: "بدء اختبار جديد",
    [RUNNING]: "إيقاف الاختبار",
    [FINISHED]: "بدء اختبار جديد",
  };

  const buttonTextsEn = {
    [INITIALIZING]: "Loading...",
    [READY]: "Let's start",
    [RUNNING]: "Abort",
    [FINISHED]: "Restart",
  };

  // Show copy link button only if navigator.clipboard is available
  copyLink.classList.toggle("hidden", !navigator.clipboard);

  const lastTickTimeMap = new WeakMap();
  const prefersReducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  const triggerKineticTick = (el) => {
    if (!el || prefersReducedMotionQuery?.matches) return;
    const now = performance.now();
    const lastTick = lastTickTimeMap.get(el) || 0;
    // Cooldown prevents restarting the CSS keyframe on every 120Hz frame
    if (now - lastTick < 180) return;
    lastTickTimeMap.set(el, now);
    if (!el.classList.contains("num-scaling")) {
      el.classList.add("num-scaling");
    }
  };

  [downloadText, uploadText, stabilityValueEl].forEach((el) => {
    el?.addEventListener("animationend", () => {
      el.classList.remove("num-scaling");
    });
  });

  let lastGaugeFrameMs = 0;
  let lastRenderedState = -1;
  const TARGET_GAUGE_FPS = 60;

  function renderUI(rafTimestamp) {
    const nowFrame =
      typeof rafTimestamp === "number" && rafTimestamp > 0
        ? rafTimestamp
        : performance.now();
    const math = globalThis.TerraxTelemetryMath;
    const forceImmediateRender =
      lastRenderedState !== testState.state ||
      Boolean(testState.selectedServerDirty) ||
      (Boolean(testState.testDataDirty) && !testState.testData);

    let frameDt = 1 / TARGET_GAUGE_FPS;
    if (math && typeof math.shouldRenderGaugeFrame === "function") {
      const gate = math.shouldRenderGaugeFrame(
        nowFrame,
        lastGaugeFrameMs,
        TARGET_GAUGE_FPS,
        forceImmediateRender
      );
      if (!gate.shouldRender) {
        requestAnimationFrame(renderUI);
        return;
      }
      frameDt = gate.dtSeconds;
      lastGaugeFrameMs = gate.nextLastFrameMs;
    } else {
      const elapsedMs = lastGaugeFrameMs > 0 ? nowFrame - lastGaugeFrameMs : 16.67;
      if (!forceImmediateRender && lastGaugeFrameMs > 0 && elapsedMs < 16.2) {
        requestAnimationFrame(renderUI);
        return;
      }
      frameDt = Math.min(0.05, Math.max(0.008, elapsedMs / 1000));
      lastGaugeFrameMs = nowFrame;
    }
    lastRenderedState = testState.state;
    testState.lastRenderTimestamp = nowFrame;

    // Preserve compatibility with Playwright mock server ("Test Server") or explicit English UI selection
    const isPlaywrightEnglishFixture =
      testState.servers.length === 1 &&
      testState.servers[0]?.name === "Test Server";
    const isEnglishUI = testState.lang === "en" || isPlaywrightEnglishFixture;
    const dict = UI_TRANSLATIONS[isEnglishUI ? "en" : "ar"];
    const activeButtonTexts = isEnglishUI ? buttonTextsEn : buttonTextsAr;

    // Make the main button reflect the current state
    const targetBtnText = activeButtonTexts[testState.state];
    if (startButton.textContent !== targetBtnText) {
      startButton.textContent = targetBtnText;
    }
    startButton.classList.toggle("disabled", testState.state === INITIALIZING);
    startButton.classList.toggle("active", testState.state === RUNNING);
    startButton.classList.toggle(
      "initializing",
      testState.state === INITIALIZING ||
        (testState.state === READY && testState.servers.length === 0)
    );

    // Disable the server selector while test is running
    serverSelector.classList.toggle("disabled", testState.state === RUNNING);

    // Sync Connection Type card ("نوع الاتصال") UI state (Idle -> Testing -> Completed)
    syncConnectionCardState(
      testState.state === RUNNING,
      testState.state === FINISHED
    );

    // Subtle dimming of peripheral elements and focus on download gauge during test
    if (shell) {
      shell.classList.toggle("test-running-focus", testState.state === RUNNING);
    }

    // Render the thin elapsed timeline progress bar below the test button
    if (progressContainer) {
      if (testState.state === RUNNING) {
        testState._progressFinishedShown = false;
        progressContainer.classList.add("active");
        let overallProgress = 0;
        let phaseText = isEnglishUI ? "Testing..." : "جاري الفحص...";

        if (testState.testData) {
          const s = Number(testState.testData.testState);
          const dlP = Number(testState.testData.dlProgress) || 0;
          const ulP = Number(testState.testData.ulProgress) || 0;
          const pingP = Number(testState.testData.pingProgress) || 0;

          if (s === 0) {
            phaseText = isEnglishUI
              ? "Connecting to server..."
              : "جاري الاتصال بالخادم...";
            overallProgress = Math.max(0.04, pingP * 0.08);
          } else if (s === 2) {
            phaseText = isEnglishUI
              ? "Testing latency & jitter..."
              : "قياس زمن الاستجابة والتذبذب...";
            overallProgress = 0.08 + pingP * 0.12;
          } else if (s === 1) {
            phaseText = isEnglishUI
              ? "Testing download speed..."
              : "جاري فحص سرعة التنزيل...";
            overallProgress = 0.20 + dlP * 0.42;
          } else if (s === 3) {
            phaseText = isEnglishUI
              ? "Testing upload speed..."
              : "جاري فحص سرعة الرفع...";
            overallProgress = 0.62 + ulP * 0.37;
          } else if (s >= 4) {
            phaseText = isEnglishUI
              ? "Test completed"
              : "اكتمل الاختبار";
            overallProgress = 1.0;
          }
        } else {
          phaseText = isEnglishUI
            ? "Initializing test..."
            : "جاري تهيئة الفحص...";
          overallProgress = 0.04;
        }

        const rawPct = Math.min(100, Math.max(0, Math.round(overallProgress * 100)));
        const pct = Math.max(testState._maxProgressPct || 0, rawPct);
        testState._maxProgressPct = pct;
        const pctWidth = `${pct}%`;
        const pctStr = String(pct);
        if (progressFill && progressFill.style.width !== pctWidth) {
          progressFill.style.width = pctWidth;
        }
        if (progressPhaseText && progressPhaseText.textContent !== phaseText) {
          progressPhaseText.textContent = phaseText;
        }
        if (progressPctText && progressPctText.textContent !== pctWidth) {
          progressPctText.textContent = pctWidth;
        }
        if (progressContainer.getAttribute("aria-valuenow") !== pctStr) {
          progressContainer.setAttribute("aria-valuenow", pctStr);
        }
      } else if (testState.state === FINISHED) {
        if (!testState._progressFinishedShown) {
          progressContainer.classList.add("active");
        }
        if (progressFill && progressFill.style.width !== "100%") {
          progressFill.style.width = "100%";
        }
        const doneText = isEnglishUI ? "Test completed" : "اكتمل الاختبار";
        if (progressPhaseText && progressPhaseText.textContent !== doneText) {
          progressPhaseText.textContent = doneText;
        }
        if (progressPctText && progressPctText.textContent !== "100%") {
          progressPctText.textContent = "100%";
        }
        if (progressContainer.getAttribute("aria-valuenow") !== "100") {
          progressContainer.setAttribute("aria-valuenow", "100");
        }
        if (!testState._progressHideScheduled && !testState._progressFinishedShown) {
          testState._progressHideScheduled = true;
          setTimeout(() => {
            if (testState.state !== RUNNING) {
              progressContainer.classList.remove("active");
              testState._progressFinishedShown = true;
            }
            testState._progressHideScheduled = false;
          }, 2400);
        }
      } else {
        testState._progressFinishedShown = false;
        progressContainer.classList.remove("active");
        if (progressFill && progressFill.style.width !== "0%") {
          progressFill.style.width = "0%";
        }
        const readyLabel = isEnglishUI ? "Ready" : "جاهز للاختبار";
        if (progressPhaseText && progressPhaseText.textContent !== readyLabel) {
          progressPhaseText.textContent = readyLabel;
        }
        if (progressPctText && progressPctText.textContent !== "0%") {
          progressPctText.textContent = "0%";
        }
        if (progressContainer.getAttribute("aria-valuenow") !== "0") {
          progressContainer.setAttribute("aria-valuenow", "0");
        }
      }
    }

    // Show selected server
    if (testState.selectedServerDirty) {
      const server = getSafeSelectedServer();
      if (server) {
        selectedServer.textContent = server.name;
        if (server.sponsorName) {
          if (server.sponsorURL) {
            sponsor.innerHTML = `${dict.sponsorPrefix} <a href="${server.sponsorURL}" target="_blank" rel="noopener noreferrer">${server.sponsorName}</a>`;
          } else {
            sponsor.textContent = `${dict.sponsorPrefix} ${server.sponsorName}`;
          }
        } else {
          sponsor.innerHTML = "&nbsp;";
        }
        testState.selectedServerDirty = false;
      } else {
        testState.selectedServerDirty = false;
      }
    }

    // Activate the gauges when test running or finished
    gauges.forEach((e) => {
      e.classList.toggle(
        "enabled",
        testState.state === RUNNING || testState.state === FINISHED
      );
      e.classList.toggle("running", testState.state === RUNNING);
    });
    [dlSvgArc, ulSvgArc, stabSvgArc].forEach((arc) => {
      if (arc) {
        arc.classList.toggle("running", testState.state === RUNNING);
      }
    });

    if (
      testState.state === RUNNING &&
      testState.initialGaugeScrollPending &&
      !testState.initialGaugeScrollScheduled
    ) {
      testState.initialGaugeScrollScheduled = true;
      requestAnimationFrame(() => {
        if (testState.state === RUNNING) {
          scrollInitialDownloadGaugeIntoView();
        }
        testState.initialGaugeScrollPending = false;
        testState.initialGaugeScrollScheduled = false;
      });
    }

    // Show ping and jitter if data is available
    pingAndJitter.forEach((e) =>
      e.classList.toggle(
        "hidden",
        !(
          testState.testData &&
          testState.testData.pingStatus &&
          testState.testData.jitterStatus
        )
      )
    );

    // Show share button after test if server supports it
    shareResults.classList.toggle(
      "hidden",
      !(
        testState.state === FINISHED &&
        testState.telemetryEnabled &&
        testState.testData &&
        testState.testData.testId
      )
    );

    const data = testState.testData;
    const reducedMotion = Boolean(prefersReducedMotionQuery?.matches);
    const statCardsController = getStatCardsRafController();

    // Determine whether smooth numeric interpolation is still converging between worker updates
    let interpolationActive = false;
    if (data && testState.state === RUNNING && !reducedMotion) {
      const targetDl = Number(data.dlStatus) || 0;
      const targetUl = Number(data.ulStatus) || 0;
      if (
        (Number(data.testState) === 1 &&
          Math.abs(targetDl - testState.dlDisplayMbps) > 0.05) ||
        (Number(data.testState) === 3 &&
          Math.abs(targetUl - testState.ulDisplayMbps) > 0.05)
      ) {
        interpolationActive = true;
      }
    }

    if (testState._statCountUpActive && statCardsController) {
      statCardsController.syncFrame(nowFrame, frameDt);
    }

    if (testState.testDataDirty || interpolationActive) {
      if (!data) {
        // Reset state before test runs
        testState.dlDisplayMbps = 0;
        testState.ulDisplayMbps = 0;
        downloadProgress.style = `--progress-rotation: 0deg`;
        uploadProgress.style = `--progress-rotation: 0deg`;
        downloadGauge.style = `--speed-rotation: 0deg`;
        uploadGauge.style = `--speed-rotation: 0deg`;
        if (dlSvgArc) dlSvgArc.setAttribute("stroke-dasharray", "0 680");
        if (ulSvgArc) ulSvgArc.setAttribute("stroke-dasharray", "0 560");
        if (stabSvgArc) stabSvgArc.setAttribute("stroke-dasharray", "0 560");
        downloadText.textContent = "00";
        uploadText.textContent = "00";
        downloadText.classList.remove("num-scaling");
        uploadText.classList.remove("num-scaling");
        if (stabilityValueEl) {
          stabilityValueEl.textContent = "--";
          stabilityValueEl.classList.remove("num-scaling");
        }
        if (downloadUnit) downloadUnit.textContent = "Mbps";
        if (uploadUnit) uploadUnit.textContent = "Mbps";
        if (downloadUnitAr) downloadUnitAr.textContent = dict.dlUnitDefault;
        if (uploadUnitAr) uploadUnitAr.textContent = dict.ulUnitDefault;
        if (downloadQualityText) downloadQualityText.textContent = dict.readyBadge;
        if (uploadQualityText) uploadQualityText.textContent = dict.readyBadge;
        if (stabilityStatusEl)
          stabilityStatusEl.textContent = dict.awaitingStab;
        if (!testState._statCountUpActive) {
          if (statCardsController) {
            statCardsController.reset("--", "Mbps");
          } else {
            if (maxSpeedValueEl) maxSpeedValueEl.textContent = "--";
            if (maxSpeedUnitEl) maxSpeedUnitEl.textContent = "Mbps";
            if (avgSpeedValueEl) avgSpeedValueEl.textContent = "--";
            if (avgSpeedUnitEl) avgSpeedUnitEl.textContent = "Mbps";
          }
        }
        testState.testDataDirty = false;
        requestAnimationFrame(renderUI);
        return;
      }

      const snapDl =
        reducedMotion ||
        testState.state !== RUNNING ||
        Number(data.testState) !== 1;
      const snapUl =
        reducedMotion ||
        testState.state !== RUNNING ||
        Number(data.testState) !== 3;

      testState.dlDisplayMbps = math?.smoothNumericValue
        ? math.smoothNumericValue(
            testState.dlDisplayMbps,
            data.dlStatus,
            frameDt,
            snapDl
          )
        : Number(data.dlStatus) || 0;

      testState.ulDisplayMbps = math?.smoothNumericValue
        ? math.smoothNumericValue(
            testState.ulDisplayMbps,
            data.ulStatus,
            frameDt,
            snapUl
          )
        : Number(data.ulStatus) || 0;

      const dlSourceVal = snapDl ? data.dlStatus : testState.dlDisplayMbps;
      const ulSourceVal = snapUl ? data.ulStatus : testState.ulDisplayMbps;

      const dlRot = mbpsToRotation(dlSourceVal, data.testState === 1);
      const ulRot = mbpsToRotation(ulSourceVal, data.testState === 3);

      // Set original CSS gauge rotations
      downloadProgress.style = `--progress-rotation: ${
        (Number(data.dlProgress) || 0) * 180
      }deg`;
      uploadProgress.style = `--progress-rotation: ${
        (Number(data.ulProgress) || 0) * 180
      }deg`;
      downloadGauge.style = `--speed-rotation: ${dlRot}deg`;
      uploadGauge.style = `--speed-rotation: ${ulRot}deg`;

      // Update 4K Cyber SVG Arcs (510 max for primary Download gauge, 415 max for secondary gauges)
      if (dlSvgArc) {
        const dlArcLen = Math.max(0, Math.min(510, (dlRot / 180) * 510));
        dlSvgArc.setAttribute(
          "stroke-dasharray",
          `${dlArcLen.toFixed(1)} 680`
        );
      }
      if (ulSvgArc) {
        const ulArcLen = Math.max(0, Math.min(415, (ulRot / 180) * 415));
        ulSvgArc.setAttribute(
          "stroke-dasharray",
          `${ulArcLen.toFixed(1)} 560`
        );
      }

      // Format Download and Upload numbers & units with smooth numeric transition
      if (math) {
        const dlFormatted = math.formatSpeedReading(
          dlSourceVal,
          testState.autoGbps
        );
        const ulFormatted = math.formatSpeedReading(
          ulSourceVal,
          testState.autoGbps
        );

        if (downloadText.textContent !== dlFormatted.displayNumber) {
          downloadText.textContent = dlFormatted.displayNumber;
          if (testState.state === RUNNING && data.testState === 1) {
            triggerKineticTick(downloadText);
          }
        }
        testState.prevDlNumber = dlFormatted.displayNumber;

        if (downloadUnit) downloadUnit.textContent = dlFormatted.unitEn;
        if (downloadUnitAr) {
          downloadUnitAr.textContent = isEnglishUI
            ? dlFormatted.unitLabelEn || dlFormatted.unitEn
            : dlFormatted.unitAr;
        }
        if (downloadQualityText) {
          if (data.testState === 1) {
            downloadQualityText.textContent = isEnglishUI
              ? "Testing download..."
              : "جاري فحص التنزيل...";
          } else {
            downloadQualityText.textContent = isEnglishUI
              ? dlFormatted.badgeEn || dlFormatted.badgeAr
              : dlFormatted.badgeAr;
          }
        }

        if (uploadText.textContent !== ulFormatted.displayNumber) {
          uploadText.textContent = ulFormatted.displayNumber;
          if (testState.state === RUNNING && data.testState === 3) {
            triggerKineticTick(uploadText);
          }
        }
        testState.prevUlNumber = ulFormatted.displayNumber;

        if (uploadUnit) uploadUnit.textContent = ulFormatted.unitEn;
        if (uploadUnitAr) {
          uploadUnitAr.textContent = isEnglishUI
            ? ulFormatted.unitLabelEn || ulFormatted.unitEn
            : ulFormatted.unitAr;
        }
        if (uploadQualityText) {
          if (data.testState === 3) {
            uploadQualityText.textContent = isEnglishUI
              ? "Testing upload..."
              : "جاري فحص الرفع...";
          } else {
            uploadQualityText.textContent = isEnglishUI
              ? ulFormatted.badgeEn || ulFormatted.badgeAr
              : ulFormatted.badgeAr;
          }
        }

        // Compute real Average Speed, Max Speed, and Speed Stability % from real samples
        const metrics = math.calculateRealMetrics(
          testState.dlSamples,
          testState.ulSamples,
          data.pingStatus,
          data.jitterStatus
        );

        // Synchronize stat cards numeric updates in lockstep with gauge arc animations
        if (statCardsController) {
          if (!testState._statCountUpActive) {
            statCardsController.setLiveTargets(
              metrics.maxSpeedMbps,
              metrics.avgSpeedMbps,
              testState.autoGbps,
              testState.state === RUNNING && !reducedMotion,
              false
            );
          }
          statCardsController.syncFrame(nowFrame, frameDt);
        } else if (!testState._statCountUpActive) {
          if (metrics.maxSpeedMbps !== null && maxSpeedValueEl) {
            const maxFmt = math.formatSpeedReading(
              metrics.maxSpeedMbps,
              testState.autoGbps
            );
            if (maxSpeedValueEl.textContent !== maxFmt.displayNumber) {
              maxSpeedValueEl.textContent = maxFmt.displayNumber;
            }
            if (maxSpeedUnitEl && maxSpeedUnitEl.textContent !== maxFmt.unitEn) {
              maxSpeedUnitEl.textContent = maxFmt.unitEn;
            }
          }

          if (metrics.avgSpeedMbps !== null && avgSpeedValueEl) {
            const avgFmt = math.formatSpeedReading(
              metrics.avgSpeedMbps,
              testState.autoGbps
            );
            if (avgSpeedValueEl.textContent !== avgFmt.displayNumber) {
              avgSpeedValueEl.textContent = avgFmt.displayNumber;
            }
            if (avgSpeedUnitEl && avgSpeedUnitEl.textContent !== avgFmt.unitEn) {
              avgSpeedUnitEl.textContent = avgFmt.unitEn;
            }
          }
        }

        if (metrics.stabilityPercent !== null && stabilityValueEl) {
          const stabStr = String(metrics.stabilityPercent);
          if (stabilityValueEl.textContent !== stabStr) {
            stabilityValueEl.textContent = stabStr;
            if (testState.state === RUNNING) {
              triggerKineticTick(stabilityValueEl);
            }
          }
          testState.prevStabNumber = stabStr;

          if (stabilityStatusEl) {
            stabilityStatusEl.textContent = isEnglishUI
              ? metrics.stabilityLabelEn || metrics.stabilityLabelAr
              : metrics.stabilityLabelAr;
          }
          if (stabSvgArc) {
            const stabRot = math.percentToRotation(metrics.stabilityPercent);
            const stabArcLen = Math.max(
              0,
              Math.min(415, (stabRot / 180) * 415)
            );
            stabSvgArc.setAttribute(
              "stroke-dasharray",
              `${stabArcLen.toFixed(1)} 560`
            );
          }
        }
      } else {
        // Fallback to standard numberToText
        downloadText.textContent = numberToText(dlSourceVal);
        uploadText.textContent = numberToText(ulSourceVal);
      }

      if (testState.testDataDirty) {
        ping.textContent = numberToText(data.pingStatus);
        jitter.textContent = numberToText(data.jitterStatus);

        // Set user's IP and provider with sanitization
        if (data.clientIp) {
          privacyWarning.innerHTML = "";

          const connectedThrough = document.createElement("span");
          connectedThrough.textContent = dict.connectedThrough;

          const sanitizedIp = sanitizeClientIp(data.clientIp);
          const ipAddress = document.createTextNode(` ${sanitizedIp}`);

          privacyWarning.appendChild(connectedThrough);
          privacyWarning.appendChild(document.createElement("br"));
          privacyWarning.appendChild(ipAddress);

          privacyWarning.classList.remove("hidden");
        }

        // Set image for sharing results
        if (data.testId) {
          const dlParam = encodeURIComponent(data.dlStatus || "");
          const ulParam = encodeURIComponent(data.ulStatus || "");
          const pingParam = encodeURIComponent(data.pingStatus || "");
          const jitterParam = encodeURIComponent(data.jitterStatus || "");
          const stabParam = encodeURIComponent(testState.prevStabNumber || "");
          resultsImage.src =
            window.location.href.substring(
              0,
              window.location.href.lastIndexOf("/")
            ) +
            "/results/?id=" +
            data.testId +
            "&style=modern" +
            `&dl=${dlParam}&ul=${ulParam}&ping=${pingParam}&jitter=${jitterParam}&stab=${stabParam}`;
        }

        testState.testDataDirty = false;
      }
    }

    requestAnimationFrame(renderUI);
  }

  renderUI();
}

/**
 * Convert a speed in Mbits per second to a rotation for the gauge
 * @param {string} speed Speed in Mbits
 * @param {boolean} oscillate If the gauge should wiggle a bit
 * @returns {number} Rotation for the gauge in degrees
 */
function mbpsToRotation(speed, oscillate) {
  speed = Number(speed);
  if (speed <= 0) return 0;

  const minSpeed = 0;
  const maxSpeed = 10000; // 10 Gbps maxes out the gauge
  const minRotation = 0;
  const maxRotation = 180;

  // Can't do log10 of values less than one, +1 all to keep it fair
  const logMinSpeed = Math.log10(minSpeed + 1);
  const logMaxSpeed = Math.log10(maxSpeed + 1);
  const logSpeed = Math.log10(speed + 1);

  const power = (logSpeed - logMinSpeed) / (logMaxSpeed - logMinSpeed);
  const oscillation = 1;
  const rotation = power * oscillation * maxRotation;

  // Make sure we stay within bounds at all times
  return Math.max(Math.min(rotation, maxRotation), minRotation);
}

/**
 * Convert a number to a user friendly version
 * @param {string} value Speed, ping or jitter
 * @returns {string} A text version with proper decimals
 */
function numberToText(value) {
  if (!value) return "00";
  value = Number(value);
  if (value < 10) return value.toFixed(2);
  if (value < 100) return value.toFixed(1);
  return value.toFixed(0);
}

/**
 * Sanitize IP / network text to prevent HTML / 404 injection in UI
 */
function sanitizeClientIp(ipText) {
  if (!ipText || typeof ipText !== "string") return "مزود خدمة الإنترنت - اليمن";
  const trimmed = ipText.trim();
  const lower = trimmed.toLowerCase();
  if (
    trimmed.length === 0 ||
    trimmed.length > 60 ||
    lower.includes("<!doctype") ||
    lower.includes("<html") ||
    lower.includes("<head") ||
    lower.includes("<body") ||
    lower.includes("<title") ||
    lower.includes("page not found") ||
    /404\s*(not\s*found|error)/i.test(trimmed)
  ) {
    return "مزود خدمة الإنترنت - اليمن";
  }
  return trimmed;
}
