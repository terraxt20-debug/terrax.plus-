/**
 * Terrax Plus (تيراكس بلاس) — Central Automatic Ad Management Engine
 * (Yandex Advertising Network RTB + Automatic Embedded Ad Source Loader)
 * with Native 4K Glassmorphic Integration, Zero-Click Automatic Rendering & Network Isolation Lock.
 *
 * Core Engineering Guarantees:
 * 1. Automatic Zero-Click Initialization & Inline Display:
 *    - Automatically initializes and loads ads immediately when any page or tab opens
 *      without requiring any user button click or manual interaction.
 *    - Prevents popup windows, new tabs, or page reloads.
 * 2. Network Isolation Lock (Zero-Interference):
 *    - Strictly forbids loading or refreshing any network ad resource while a Speed Test or Gaming Test
 *      is active (isTesting === true), ensuring zero bandwidth consumption and 100% accurate Ping/Jitter/Speed readings.
 * 3. Slot Deduplication, Lifecycle Cleanup & Re-initialization:
 *    - Maps each ad slot (speed-main, gaming-main, stability-main, usage-main, servers-main, settings-main)
 *      to its dedicated block ID and creative state without duplicate initialization.
 *    - Cleans up timers, observers, and in-flight frames on pagehide/beforeunload and re-initializes on pageshow.
 * 4. Loading, Slow-Network Timeout (2000ms), and Offline/No-Ad Graceful Handling:
 *    - Displays a clean loading state before ad readiness without fake placeholders.
 *    - Preserves exact container geometry (min-height: 95px) for Zero-CLS.
 */
(function (root) {
  "use strict";

  var ADSTERRA_SMARTLINK_URL =
    "#terrax-adsense-verified";
  var YANDEX_FALLBACK_TIMEOUT_MS = 2000;
  var AUTO_AD_ROTATION_INTERVAL_MS = 30000;

  var DEFAULT_BLOCK_IDS = {
    "speed-main": "R-A-TERREX-SPEED-1",
    "stability-main": "R-A-TERREX-STAB-1",
    "gaming-main": "R-A-TERREX-GAME-1",
    "usage-main": "R-A-TERREX-USAGE-1",
    "servers-main": "R-A-TERREX-SERVERS-1",
    "settings-main": "R-A-TERREX-SETTINGS-1"
  };

  var SLOT_CREATIVE_OFFSETS = {
    "speed-main": 0,
    "gaming-main": 1,
    "stability-main": 2,
    "usage-main": 1,
    "servers-main": 2,
    "settings-main": 0
  };

  var SPONSOR_FALLBACK_ITEMS = [
    {
      badgeAr: "إعلان مدعوم • AD",
      badgeEn: "Sponsored Ad • AD",
      titleAr:
        "Terrax Cloud DNS & Fiber Optimizer — استجابة أسرع للألعاب والبث 4K",
      titleEn:
        "Terrax Cloud DNS & Fiber Optimizer — Ultra-Low Latency for 4K & Gaming",
      subAr:
        "توجيه ذكي للحزم عبر مسارات الألياف المباشرة لتقليل الـ Ping والـ Jitter واستقرار البث",
      subEn:
        "Smart packet routing over direct fiber backbones to minimize Ping, Jitter, and packet loss",
      href: ADSTERRA_SMARTLINK_URL
    },
    {
      badgeAr: "إعلان تلقائي • AD",
      badgeEn: "Auto Ad • AD",
      titleAr:
        "Terrax IXP High-Precision Telemetry — خوادم قياس معتمدة بدقة 10 Gbps",
      titleEn:
        "Terrax IXP High-Precision Telemetry — Certified 10 Gbps Measurement Nodes",
      subAr:
        "قياس نقي 100% مع عزل شبكي كامل أثناء الفحص لضمان أعلى مصداقية وسرعة فائقة",
      subEn:
        "100% pure measurement with full network isolation during active tests for maximum accuracy",
      href: ADSTERRA_SMARTLINK_URL
    },
    {
      badgeAr: "إعلان مدعوم • AD",
      badgeEn: "Sponsored Ad • AD",
      titleAr:
        "Terrax Pro Gaming Route — مسارات شبكية مخصصة لتقليل زمن الاستجابة",
      titleEn:
        "Terrax Pro Gaming Route — Dedicated Low-Ping Routing for Competitive Play",
      subAr:
        "استقرار فائق في ألعاب التصويب التنافسية والبث المباشر بدون تقطيع أو فقدان حزم",
      subEn:
        "Ultra-stable connection for competitive FPS and 4K live streaming with zero packet drop",
      href: ADSTERRA_SMARTLINK_URL
    }
  ];

  var CONSENT_STORAGE_KEY = "terrax_adsense_consent_v1";
  var DEFAULT_ADSENSE_SLOTS = {
    "speed-main": "",
    "speed-results": "",
    "stability-main": "",
    "gaming-main": "",
    "usage-main": "",
    "servers-main": "",
    "settings-main": "",
    "multiplex-main": "",
    "infeed-main": ""
  };

  var EEA_UK_CH_TIMEZONES = [
    "europe/",
    "atlantic/reykjavik",
    "atlantic/canary",
    "atlantic/faroe",
    "atlantic/madeira",
    "atlantic/azores"
  ];

  var autoRotationTimer = null;
  var dialogObserver = null;
  var viewportAdObserver = null;
  var VIEWPORT_OBSERVER_ROOT_MARGIN = "120px 0px";
  var VIEWPORT_OBSERVER_THRESHOLD = 0;
  var lifecycleBound = false;

  var engineState = {
    isTesting: false,
    testEngineState: "READY",
    lastTestError: null,
    pendingAdLoadAfterTest: false,
    initialized: false,
    refreshCount: 0,
    lastRefreshReason: "init",
    lastRefreshTimestamp: 0,
    stability30sTriggered: false,
    stability60sTriggered: false,
    smartlinkUrl: ADSTERRA_SMARTLINK_URL,
    fallbackTimeoutMs: YANDEX_FALLBACK_TIMEOUT_MS,
    blockIds: Object.assign({}, DEFAULT_BLOCK_IDS),
    activeSlots: {},
    adsensePublisherId: "",
    adsenseAutoAdsEnabled: false,
    adsenseCmpEnabled: true,
    adsenseScriptLoaded: false,
    adsenseSlots: Object.assign({}, DEFAULT_ADSENSE_SLOTS),
    consentMode: "unset",
    regulatedRegionDetected: false,
    cmpCertifiedDetected: false
  };

  /**
   * Validate whether a publisherId is a real, non-placeholder Google AdSense Publisher ID
   * Format: "ca-pub-XXXXXXXXXXXXXXXX" or "pub-XXXXXXXXXXXXXXXX" (16 digits, not all repeating or sequential placeholder)
   */
  function isValidAdSensePublisherId(publisherId) {
    if (!publisherId || typeof publisherId !== "string") return false;
    var trimmed = publisherId.trim();
    var match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
    if (!match) return false;
    var digits = match[1];
    if (/^(\d)\1{15}$/.test(digits) || digits === "1234567890123456") {
      return false;
    }
    return true;
  }

  /**
   * Normalize a valid publisher ID to "ca-pub-XXXXXXXXXXXXXXXX"
   */
  function normalizeAdSenseClientId(publisherId) {
    if (!isValidAdSensePublisherId(publisherId)) return "";
    var trimmed = String(publisherId).trim();
    var match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
    return match ? "ca-pub-" + match[1] : "";
  }

  /**
   * Validate whether a slotId is a real Google AdSense numeric Ad Slot ID (8-12 digits, not all zeros or 1234567890)
   */
  function isValidAdSenseSlotId(slotId) {
    if (!slotId || typeof slotId !== "string") return false;
    var trimmed = slotId.trim();
    if (!/^\d{8,12}$/.test(trimmed)) return false;
    if (/^0+$/.test(trimmed) || trimmed === "1234567890") return false;
    return true;
  }

  /**
   * Detect whether the user is likely in the EEA, UK, or Switzerland (CH)
   * where explicit GDPR/ePrivacy consent or a Google-certified CMP is required.
   */
  function detectRegulatedPrivacyRegion() {
    try {
      if (typeof root !== "undefined" && root.TERREX_FORCE_REGULATED_REGION !== undefined) {
        return Boolean(root.TERREX_FORCE_REGULATED_REGION);
      }
      if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
        var tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
        for (var i = 0; i < EEA_UK_CH_TIMEZONES.length; i++) {
          if (tz.indexOf(EEA_UK_CH_TIMEZONES[i]) === 0) {
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  /**
   * Detect whether a Google-certified CMP (IAB TCF v2.2 __tcfapi or Google Funding Choices googlefc) is active
   */
  function detectCertifiedCmpPresent() {
    if (typeof root === "undefined") return false;
    return Boolean(
      typeof root.__tcfapi === "function" ||
        (root.googlefc && typeof root.googlefc.callbackQueue === "object")
    );
  }

  /**
   * Synchronize Google Consent Mode v2 and adsbygoogle privacy flags with current user choice.
   * Never fabricates consent or bypasses user privacy choices.
   */
  function syncGoogleConsentSignals() {
    if (typeof root === "undefined") return;
    root.dataLayer = root.dataLayer || [];
    root.adsbygoogle = root.adsbygoogle || [];

    var mode = engineState.consentMode || "unset";
    var isRegulated = Boolean(engineState.regulatedRegionDetected);
    var adStorage = "denied";
    var adUserData = "denied";
    var adPersonalization = "denied";
    var analyticsStorage = "denied";

    if (mode === "personalized") {
      adStorage = "granted";
      adUserData = "granted";
      adPersonalization = "granted";
      analyticsStorage = "granted";
      root.adsbygoogle.pauseAdRequests = 0;
      root.adsbygoogle.requestNonPersonalizedAds = 0;
    } else if (mode === "non_personalized") {
      adStorage = "granted";
      adUserData = "denied";
      adPersonalization = "denied";
      analyticsStorage = "granted";
      root.adsbygoogle.pauseAdRequests = 0;
      root.adsbygoogle.requestNonPersonalizedAds = 1;
    } else if (mode === "rejected") {
      adStorage = "denied";
      adUserData = "denied";
      adPersonalization = "denied";
      analyticsStorage = "denied";
      root.adsbygoogle.pauseAdRequests = 1;
      root.adsbygoogle.requestNonPersonalizedAds = 1;
    } else {
      // "unset": In EEA/UK/CH without explicit user consent, default to non-personalized / restricted until choice
      if (isRegulated) {
        adStorage = "denied";
        adUserData = "denied";
        adPersonalization = "denied";
        analyticsStorage = "denied";
        root.adsbygoogle.requestNonPersonalizedAds = 1;
      } else {
        adStorage = "granted";
        adUserData = "granted";
        adPersonalization = "denied";
        analyticsStorage = "granted";
        root.adsbygoogle.requestNonPersonalizedAds = 0;
      }
      root.adsbygoogle.pauseAdRequests = engineState.isTesting ? 1 : 0;
    }

    var consentPayload = {
      ad_storage: adStorage,
      ad_user_data: adUserData,
      ad_personalization: adPersonalization,
      analytics_storage: analyticsStorage
    };

    try {
      root.dataLayer.push(["consent", mode === "unset" ? "default" : "update", consentPayload]);
    } catch (e) {}

    // Listen to IAB TCF v2.2 CMP updates if a Google-certified CMP is present
    if (typeof root.__tcfapi === "function" && !root._terraxTcfListenerBound) {
      root._terraxTcfListenerBound = true;
      try {
        root.__tcfapi("addEventListener", 2, function (tcData, success) {
          if (success && tcData && (tcData.eventStatus === "tcloaded" || tcData.eventStatus === "useractioncomplete")) {
            engineState.cmpCertifiedDetected = true;
            var purpose1 = tcData.purpose && tcData.purpose.consents && tcData.purpose.consents[1];
            if (purpose1 === false) {
              root.adsbygoogle = root.adsbygoogle || [];
              root.adsbygoogle.requestNonPersonalizedAds = 1;
            }
          }
        });
      } catch (e) {}
    }
  }

  /**
   * Load persisted user consent preference from localStorage (never fabricates consent)
   */
  function loadConsentPreferences() {
    engineState.regulatedRegionDetected = detectRegulatedPrivacyRegion();
    engineState.cmpCertifiedDetected = detectCertifiedCmpPresent();
    var savedChoice = "unset";
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (
            parsed &&
            (parsed.mode === "personalized" ||
              parsed.mode === "non_personalized" ||
              parsed.mode === "rejected")
          ) {
            savedChoice = parsed.mode;
          }
        }
      }
    } catch (e) {}
    engineState.consentMode = savedChoice;
    syncGoogleConsentSignals();
    syncConsentUiControls();
    return engineState.consentMode;
  }

  /**
   * Save user's explicit consent choice ("personalized" | "non_personalized" | "rejected" | "unset")
   */
  function setConsentChoice(choiceMode) {
    var validModes = ["personalized", "non_personalized", "rejected", "unset"];
    var normalized = validModes.indexOf(choiceMode) !== -1 ? choiceMode : "non_personalized";
    engineState.consentMode = normalized;
    try {
      if (typeof localStorage !== "undefined") {
        if (normalized === "unset") {
          localStorage.removeItem(CONSENT_STORAGE_KEY);
        } else {
          localStorage.setItem(
            CONSENT_STORAGE_KEY,
            JSON.stringify({
              mode: normalized,
              updatedAt: new Date().toISOString()
            })
          );
        }
      }
    } catch (e) {}
    syncGoogleConsentSignals();
    syncConsentUiControls();
    if (!engineState.isTesting && normalized !== "rejected") {
      refreshAllSlots("consent-updated:" + normalized);
    } else {
      syncAdCardsVisualState();
    }
    return getConsentState();
  }

  /**
   * Check whether ad loading is permitted under current privacy & consent settings
   */
  function canLoadAdsUnderConsent() {
    if (engineState.consentMode === "rejected") {
      return false;
    }
    return true;
  }

  /**
   * Return structured snapshot of current CMP / Consent state
   */
  function getConsentState() {
    return {
      mode: engineState.consentMode,
      canLoadAds: canLoadAdsUnderConsent(),
      nonPersonalizedOnly:
        engineState.consentMode === "non_personalized" ||
        (engineState.consentMode === "unset" && engineState.regulatedRegionDetected),
      regulatedRegionDetected: Boolean(engineState.regulatedRegionDetected),
      cmpCertifiedDetected: detectCertifiedCmpPresent() || Boolean(engineState.cmpCertifiedDetected)
    };
  }

  /**
   * Update consent preference buttons & status badge inside #privacy dialog if present
   */
  function syncConsentUiControls() {
    if (typeof document === "undefined") return;
    var statusBadge = document.getElementById("consent-current-status-badge");
    var lang = getCurrentLang();
    var mode = engineState.consentMode;

    if (statusBadge) {
      var labelAr = "الوضع الافتراضي الآمن (إعلانات متوافقة مع الخصوصية)";
      var labelEn = "Default Safe Mode (Privacy-Compliant Ads)";
      if (mode === "personalized") {
        labelAr = "مفعّل: الإعلانات المخصصة (Personalized Ads)";
        labelEn = "Active: Personalized Ads";
      } else if (mode === "non_personalized") {
        labelAr = "مفعّل: إعلانات غير مخصصة فقط (Non-Personalized Ads - EEA/UK/CH)";
        labelEn = "Active: Non-Personalized Ads Only (EEA/UK/CH)";
      } else if (mode === "rejected") {
        labelAr = "مفعّل: إيقاف طلبات إعلانات الطرف الثالث (Opt-Out)";
        labelEn = "Active: Third-Party Ad Requests Paused (Opt-Out)";
      }
      statusBadge.textContent = lang === "en" ? labelEn : labelAr;
      statusBadge.setAttribute("data-consent-mode", mode);
    }

    var btnMap = [
      { id: "consent-accept-all-btn", mode: "personalized" },
      { id: "consent-npa-only-btn", mode: "non_personalized" },
      { id: "consent-reject-ads-btn", mode: "rejected" }
    ];
    for (var i = 0; i < btnMap.length; i++) {
      var btn = document.getElementById(btnMap[i].id);
      if (btn) {
        var isSelected = mode === btnMap[i].mode;
        btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
        btn.classList.toggle("active-consent-choice", isSelected);
      }
    }
  }

  /**
   * Bind click handlers for the privacy & consent preference controls inside #privacy and #settings-dialog
   */
  function bindConsentUiControls() {
    if (typeof document === "undefined") return;
    var acceptBtn = document.getElementById("consent-accept-all-btn");
    if (acceptBtn && !acceptBtn._terraxConsentBound) {
      acceptBtn._terraxConsentBound = true;
      acceptBtn.addEventListener("click", function () {
        setConsentChoice("personalized");
      });
    }
    var npaBtn = document.getElementById("consent-npa-only-btn");
    if (npaBtn && !npaBtn._terraxConsentBound) {
      npaBtn._terraxConsentBound = true;
      npaBtn.addEventListener("click", function () {
        setConsentChoice("non_personalized");
      });
    }
    var rejectBtn = document.getElementById("consent-reject-ads-btn");
    if (rejectBtn && !rejectBtn._terraxConsentBound) {
      rejectBtn._terraxConsentBound = true;
      rejectBtn.addEventListener("click", function () {
        setConsentChoice("rejected");
      });
    }
    var manageBtn = document.getElementById("open-consent-preferences-btn");
    if (manageBtn && !manageBtn._terraxConsentBound) {
      manageBtn._terraxConsentBound = true;
      manageBtn.addEventListener("click", function () {
        // If Google Funding Choices CMP is loaded, open its revocation dialog; otherwise open #privacy modal
        if (
          typeof root !== "undefined" &&
          root.googlefc &&
          typeof root.googlefc.showRevocationMessage === "function"
        ) {
          root.googlefc.showRevocationMessage();
          return;
        }
        var settingsModal = document.getElementById("settings-dialog");
        if (settingsModal && typeof settingsModal.close === "function") {
          settingsModal.close();
        }
        var privacyModal = document.getElementById("privacy");
        if (privacyModal && typeof privacyModal.showModal === "function") {
          privacyModal.showModal();
        }
      });
    }
    syncConsentUiControls();
  }

  var TerraxConsentManager = {
    CONSENT_STORAGE_KEY: CONSENT_STORAGE_KEY,
    loadConsentPreferences: loadConsentPreferences,
    setConsentChoice: setConsentChoice,
    getConsentState: getConsentState,
    canLoadAds: canLoadAdsUnderConsent,
    detectRegulatedPrivacyRegion: detectRegulatedPrivacyRegion,
    detectCertifiedCmpPresent: detectCertifiedCmpPresent,
    syncConsentUiControls: syncConsentUiControls,
    bindConsentUiControls: bindConsentUiControls
  };

  /**
   * Configure Google AdSense publisher ID, Auto Ads, and slot IDs dynamically or from DOM/window config.
   * Strictly rejects fake/placeholder publisher IDs and slot IDs.
   */
  function configureAdSense(customConfig) {
    var cfg = customConfig || (typeof root !== "undefined" && root.TERREX_ADSENSE_CONFIG) || {};
    var candidatePubId = cfg.publisherId || cfg.PUBLISHER_ID || "";
    var ampAutoAdsDetected = false;

    if (!candidatePubId && typeof document !== "undefined") {
      var metaEl = document.querySelector('meta[name="google-adsense-account"]');
      if (metaEl) {
        candidatePubId = metaEl.getAttribute("content") || "";
      }
      var ampAutoAdsEl = document.querySelector('amp-auto-ads[type="adsense"]');
      if (ampAutoAdsEl) {
        ampAutoAdsDetected = true;
        if (!candidatePubId) {
          candidatePubId = ampAutoAdsEl.getAttribute("data-ad-client") || "";
        }
      }
    }

    var validClientId = normalizeAdSenseClientId(candidatePubId);
    engineState.adsensePublisherId = validClientId;
    engineState.adsenseAutoAdsEnabled = Boolean(
      cfg.autoAdsEnabled || cfg.AUTO_ADS_ENABLED || (ampAutoAdsDetected && validClientId)
    );
    if (cfg.cmpEnabled !== undefined || cfg.CMP_ENABLED !== undefined) {
      engineState.adsenseCmpEnabled = Boolean(
        cfg.cmpEnabled !== undefined ? cfg.cmpEnabled : cfg.CMP_ENABLED
      );
    }

    var incomingSlots = cfg.slots || cfg.SLOTS || {};
    var domSlotFallback = "";
    if (!customConfig && typeof document !== "undefined") {
      var domInsEl = document.querySelector("ins.adsbygoogle[data-ad-slot]");
      if (domInsEl) {
        var candidateDomSlot = String(domInsEl.getAttribute("data-ad-slot") || "").trim();
        if (isValidAdSenseSlotId(candidateDomSlot)) {
          domSlotFallback = candidateDomSlot;
        }
      }
    }
    var nextSlots = Object.assign({}, DEFAULT_ADSENSE_SLOTS, engineState.adsenseSlots);
    if (domSlotFallback) {
      for (var dKey in nextSlots) {
        if (Object.prototype.hasOwnProperty.call(nextSlots, dKey) && !nextSlots[dKey]) {
          nextSlots[dKey] = domSlotFallback;
        }
      }
    }
    for (var key in incomingSlots) {
      if (Object.prototype.hasOwnProperty.call(incomingSlots, key)) {
        var rawSlot = String(incomingSlots[key] || "").trim();
        nextSlots[key] = isValidAdSenseSlotId(rawSlot) ? rawSlot : "";
      }
    }
    engineState.adsenseSlots = nextSlots;

    if (validClientId && typeof document !== "undefined") {
      ensureGoogleAdSenseVerificationMeta(validClientId);
      if (engineState.adsenseAutoAdsEnabled && !engineState.isTesting && canLoadAdsUnderConsent()) {
        ensureGoogleAdSenseScriptLoaded(validClientId);
      }
    }

    return {
      publisherId: engineState.adsensePublisherId,
      autoAdsEnabled: engineState.adsenseAutoAdsEnabled,
      cmpEnabled: engineState.adsenseCmpEnabled,
      slots: Object.assign({}, engineState.adsenseSlots)
    };
  }

  /**
   * Ensure official <meta name="google-adsense-account" content="ca-pub-..."> exists in <head>
   * ONLY when a real, validated publisher ID is configured.
   */
  function ensureGoogleAdSenseVerificationMeta(clientId) {
    var validClient = normalizeAdSenseClientId(clientId || engineState.adsensePublisherId);
    if (!validClient || typeof document === "undefined" || !document.head) {
      return false;
    }
    var existingMeta = document.querySelector('meta[name="google-adsense-account"]');
    if (!existingMeta) {
      existingMeta = document.createElement("meta");
      existingMeta.setAttribute("name", "google-adsense-account");
      document.head.appendChild(existingMeta);
    }
    existingMeta.setAttribute("content", validClient);
    return true;
  }

  /**
   * Load the official Google AdSense script asynchronously in <head> once and only once.
   * Respects Smart Ad Lock (never loads during RUNNING state), offline state, and user consent.
   */
  function ensureGoogleAdSenseScriptLoaded(clientId) {
    var validClient = normalizeAdSenseClientId(clientId || engineState.adsensePublisherId);
    if (!validClient || typeof document === "undefined") return false;
    if (engineState.isTesting || isBrowserOffline() || !canLoadAdsUnderConsent()) {
      return false;
    }

    ensureGoogleAdSenseVerificationMeta(validClient);
    syncGoogleConsentSignals();

    var existingScripts = document.querySelectorAll(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (
      existingScripts.length > 0 ||
      document.getElementById("terrax-adsense-sdk-runtime")
    ) {
      engineState.adsenseScriptLoaded = true;
      return true;
    }

    var s = document.createElement("script");
    s.id = "terrax-adsense-sdk-runtime";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(validClient);
    s.onload = function () {
      engineState.adsenseScriptLoaded = true;
    };
    s.onerror = function () {
      engineState.adsenseScriptLoaded = false;
    };
    (document.head || document.documentElement).appendChild(s);
    engineState.adsenseScriptLoaded = true;
    return true;
  }

  /**
   * Check whether an element or its ancestors are inside a closed <dialog> or hidden wrapper,
   * or have 0 available width in a live browser layout.
   */
  function hasMeasurableAdSlotWidth(el) {
    if (!el || typeof document === "undefined") return false;
    try {
      if (typeof el.closest === "function") {
        if (el.closest("dialog:not([open]), .hidden, [hidden]")) {
          return false;
        }
      }
      var hasBrowserLayout =
        typeof root !== "undefined" &&
        typeof root.innerWidth === "number" &&
        root.innerWidth > 0 &&
        document.documentElement &&
        document.documentElement.clientWidth > 0;
      if (!hasBrowserLayout) {
        return true;
      }
      var w = Number(el.offsetWidth || el.clientWidth || 0);
      if (!w && el.parentElement) {
        w = Number(el.parentElement.offsetWidth || el.parentElement.clientWidth || 0);
      }
      if (!w && typeof el.getBoundingClientRect === "function") {
        w = Number(el.getBoundingClientRect().width || 0);
      }
      return w >= 120;
    } catch (e) {
      return true;
    }
  }

  /**
   * Mount and initialize an official Google AdSense <ins class="adsbygoogle"> unit inside a card
   * when both a valid Publisher ID and a valid Slot ID are configured.
   * Strictly prevents duplicate .push({}) calls on the same <ins> element and guards against availableWidth=0.
   */
  function mountOrPushAdSenseUnit(card, slotKey) {
    if (!card || typeof document === "undefined") return false;
    if (engineState.isTesting || isBrowserOffline() || !canLoadAdsUnderConsent()) {
      return false;
    }

    var existingCardIns = card.querySelector("ins.adsbygoogle");
    var clientId = normalizeAdSenseClientId(
      card.getAttribute("data-adsense-client") ||
        (existingCardIns && existingCardIns.getAttribute("data-ad-client")) ||
        engineState.adsensePublisherId
    );
    var slotId = String(
      card.getAttribute("data-adsense-slot") ||
        (existingCardIns && existingCardIns.getAttribute("data-ad-slot")) ||
        engineState.adsenseSlots[slotKey] ||
        ""
    ).trim();

    if (!isValidAdSensePublisherId(clientId) || !isValidAdSenseSlotId(slotId)) {
      return false;
    }

    var bodyEl =
      card.querySelector(".terrax-yan-body") ||
      card.querySelector(".terrax-smart-ad-body") ||
      card;
    var insEl = existingCardIns;
    var adsenseMount = bodyEl.querySelector(".terrax-adsense-mount") || bodyEl;

    if (
      insEl &&
      insEl.getAttribute("data-ad-client") === clientId &&
      insEl.getAttribute("data-ad-slot") === slotId
    ) {
      if (insEl.getAttribute("data-adsbygoogle-status") === "reserved") {
        if (hasMeasurableAdSlotWidth(insEl) || hasMeasurableAdSlotWidth(card)) {
          insEl.removeAttribute("data-adsbygoogle-status");
          insEl.removeAttribute("data-terrax-pushed");
        } else {
          return false;
        }
      }
      var statusAttr = insEl.getAttribute("data-adsbygoogle-status");
      if (
        insEl.getAttribute("data-terrax-pushed") === "true" ||
        (statusAttr && statusAttr !== "reserved")
      ) {
        insEl.setAttribute("data-terrax-pushed", "true");
        card.setAttribute("data-adsense-active", "true");
        card.setAttribute("data-adsense-client", clientId);
        card.setAttribute("data-adsense-slot", slotId);
      } else {
        if (!hasMeasurableAdSlotWidth(insEl) && !hasMeasurableAdSlotWidth(card)) {
          insEl.setAttribute("data-adsbygoogle-status", "reserved");
          return false;
        }
        ensureGoogleAdSenseScriptLoaded(clientId);
        try {
          if (typeof root !== "undefined") {
            root.adsbygoogle = root.adsbygoogle || [];
            insEl.setAttribute("data-terrax-pushed", "true");
            root.adsbygoogle.push({});
            card.setAttribute("data-adsense-active", "true");
            card.setAttribute("data-adsense-client", clientId);
            card.setAttribute("data-adsense-slot", slotId);
          }
        } catch (err) {
          card.setAttribute("data-adsense-active", "fallback");
          return false;
        }
      }
    } else {
      if (!bodyEl.querySelector(".terrax-adsense-mount")) {
        adsenseMount = document.createElement("div");
        adsenseMount.className = "terrax-adsense-mount";
        adsenseMount.style.cssText =
          "width:100%;min-height:90px;display:block;overflow:hidden;";
        bodyEl.insertBefore(adsenseMount, bodyEl.firstChild);
      }
      adsenseMount.innerHTML = "";
      insEl = document.createElement("ins");
      insEl.className = "adsbygoogle";
      insEl.style.display = "block";
      insEl.style.width = "100%";
      insEl.setAttribute("data-ad-client", clientId);
      insEl.setAttribute("data-ad-slot", slotId);

      var requestedFormat =
        card.getAttribute("data-adsense-format") ||
        (existingCardIns && existingCardIns.getAttribute("data-ad-format")) ||
        "auto";
      var requestedLayoutKey =
        card.getAttribute("data-adsense-layout-key") ||
        (existingCardIns && existingCardIns.getAttribute("data-ad-layout-key")) ||
        "";
      insEl.setAttribute("data-ad-format", requestedFormat);
      if (requestedLayoutKey) {
        insEl.setAttribute("data-ad-layout-key", requestedLayoutKey);
      }
      if (requestedFormat !== "autorelaxed" && requestedFormat !== "fluid") {
        insEl.setAttribute("data-full-width-responsive", "true");
      }

      adsenseMount.appendChild(insEl);
      if (!hasMeasurableAdSlotWidth(insEl) && !hasMeasurableAdSlotWidth(card)) {
        insEl.setAttribute("data-adsbygoogle-status", "reserved");
        return false;
      }
      ensureGoogleAdSenseScriptLoaded(clientId);

      try {
        if (typeof root !== "undefined") {
          root.adsbygoogle = root.adsbygoogle || [];
          insEl.setAttribute("data-terrax-pushed", "true");
          root.adsbygoogle.push({});
          card.setAttribute("data-adsense-active", "true");
          card.setAttribute("data-adsense-client", clientId);
          card.setAttribute("data-adsense-slot", slotId);
        }
      } catch (err) {
        card.setAttribute("data-adsense-active", "fallback");
        return false;
      }
    }

    // Observe data-ad-status ("filled" vs "unfilled") to handle unavailable inventory with Zero-CLS
    if (typeof MutationObserver === "function" && !insEl._terraxStatusObserved) {
      insEl._terraxStatusObserved = true;
      var statusObserver = new MutationObserver(function () {
        var adStatus = insEl.getAttribute("data-ad-status");
        if (adStatus === "unfilled") {
          card.setAttribute("data-adsense-status", "unfilled");
          card.setAttribute("data-ad-status", "unfilled");
          card.setAttribute("data-ad-filled", "false");
          card.classList.remove("ad-filled");
          activateSmartlinkFallback(card, "adsense-unfilled");
        } else if (adStatus === "filled") {
          adsenseMount.style.display = "block";
          card.setAttribute("data-adsense-status", "filled");
          card.setAttribute("data-ad-status", "filled");
          card.setAttribute("data-ad-filled", "true");
          card.classList.add("ad-filled");
          var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card");
          if (fallbackEl) fallbackEl.style.display = "none";
          updateCardStatusIndicator(card, "ready");
        }
      });
      statusObserver.observe(insEl, {
        attributes: true,
        attributeFilter: ["data-ad-status", "data-adsbygoogle-status"]
      });
    }

    return true;
  }

  /**
   * Ensure window.yaContextCb asynchronous queue exists
   */
  function ensureYandexQueue() {
    if (typeof root !== "undefined") {
      root.yaContextCb = root.yaContextCb || [];
    }
  }

  /**
   * Detect current UI language ("ar" or "en")
   */
  function getCurrentLang() {
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        if (document.documentElement.lang === "en") return "en";
      }
      if (typeof localStorage !== "undefined") {
        var saved = localStorage.getItem("terrax_ui_lang_v1");
        if (saved === "en") return "en";
      }
    } catch (e) {}
    return "ar";
  }

  /**
   * Check whether browser is currently offline
   */
  function isBrowserOffline() {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Discover all Smart Ad containers in the current DOM
   */
  function getAdCards() {
    if (typeof document === "undefined") return [];
    var smartCards = Array.prototype.slice.call(
      document.querySelectorAll("[data-terrax-smart-ad], [data-terrax-placement], .terrax-adsense-container")
    );
    var yanCards = Array.prototype.slice.call(
      document.querySelectorAll("[data-terrax-yan-slot]")
    );
    var list = [];
    var seen = [];
    for (var i = 0; i < smartCards.length; i++) {
      if (seen.indexOf(smartCards[i]) === -1) {
        seen.push(smartCards[i]);
        list.push(smartCards[i]);
      }
    }
    for (var j = 0; j < yanCards.length; j++) {
      if (seen.indexOf(yanCards[j]) === -1) {
        seen.push(yanCards[j]);
        list.push(yanCards[j]);
      }
    }
    return list;
  }

  /**
   * Validate whether a blockId is a valid configured Yandex RTB block identifier
   */
  function isValidConfiguredBlockId(blockId) {
    if (!blockId || typeof blockId !== "string") return false;
    return /^R-A-[A-Z0-9-]+$/i.test(blockId.trim());
  }

  /**
   * Prevent popup / new-window navigation on ad elements so ads display inline automatically
   * without requiring clicks or opening external popup windows.
   */
  function bindZeroPopupGuard(el) {
    if (!el || el._terraxZeroPopupBound) return;
    el._terraxZeroPopupBound = true;
    el.removeAttribute("target");
    el.addEventListener("click", function (e) {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      if (e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }
      return false;
    });
  }

  /**
   * Ensure all auxiliary sponsor links on the page (e.g. #gamingSponsorTag, #gamingBoosterCard, .usage-booster-banner)
   * also operate in automatic inline mode without opening popup windows on click.
   */
  function bindPageAuxiliaryAdElements() {
    if (typeof document === "undefined") return;
    var selectors = [
      ".terrax-yan-sponsor-fallback",
      "#gamingSponsorTag",
      "#gamingBoosterCard",
      ".usage-booster-banner"
    ];
    var nodes = document.querySelectorAll(selectors.join(","));
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      bindZeroPopupGuard(node);
      // Remove any legacy manual click CTA inside usage-booster-banner
      var manualCtas = node.querySelectorAll(".terrax-manual-click-cta, .terrax-yan-sponsor-cta");
      for (var j = 0; j < manualCtas.length; j++) {
        if (manualCtas[j] && manualCtas[j].parentNode) {
          manualCtas[j].parentNode.removeChild(manualCtas[j]);
        }
      }
    }
  }

  /**
   * Ensure automatic ad banner elements and status indicator exist inside a card
   * without any manual click button.
   */
  function ensureSmartlinkDomInCard(card) {
    if (!card || typeof document === "undefined") return null;

    card.setAttribute("data-smartlink-url", ADSTERRA_SMARTLINK_URL);
    card.setAttribute("data-auto-ad", "true");

    // Remove any legacy manual partner link or manual CTA button
    var legacyHeaderLinks = card.querySelectorAll(".terrax-yan-direct-partner-link");
    for (var k = 0; k < legacyHeaderLinks.length; k++) {
      if (legacyHeaderLinks[k] && legacyHeaderLinks[k].parentNode) {
        legacyHeaderLinks[k].parentNode.removeChild(legacyHeaderLinks[k]);
      }
    }

    // Ensure header has an automatic status indicator for loading/ready feedback (kept hidden per clean ad-space design)
    var headerEl = card.querySelector(".terrax-yan-header, .terrax-smart-ad-header");
    if (headerEl) {
      headerEl.hidden = true;
      headerEl.setAttribute("aria-hidden", "true");
      headerEl.style.display = "none";
      var actionsEl = headerEl.querySelector(".terrax-yan-header-actions");
      if (!actionsEl) {
        actionsEl = document.createElement("div");
        actionsEl.className = "terrax-yan-header-actions";
        var existingBadge = headerEl.querySelector(".terrax-yan-isolation-badge");
        if (existingBadge) {
          actionsEl.appendChild(existingBadge);
        }
        headerEl.appendChild(actionsEl);
      }
      var statusEl = actionsEl.querySelector(".terrax-yan-status-indicator, .terrax-ad-status-pill");
      if (!statusEl) {
        statusEl = document.createElement("span");
        statusEl.className = "terrax-yan-status-indicator";
        statusEl.setAttribute("aria-live", "polite");
        statusEl.hidden = true;
        statusEl.style.display = "none";
        actionsEl.insertBefore(statusEl, actionsEl.firstChild);
      } else {
        statusEl.textContent = "";
        statusEl.hidden = true;
        statusEl.style.display = "none";
      }
    }

    var bodyEl = card.querySelector(".terrax-yan-body, .terrax-smart-ad-body") || card;
    if (!bodyEl) return null;

    var mountEl = bodyEl.querySelector(".terrax-yan-rtb-mount, .terrax-adsense-mount");
    if (!mountEl && card.classList.contains("terrax-yan-card")) {
      mountEl = document.createElement("div");
      mountEl.className = "terrax-yan-rtb-mount";
      bodyEl.insertBefore(mountEl, bodyEl.firstChild);
    }

    var fallbackEl = bodyEl.querySelector(".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card");
    if (!fallbackEl) {
      fallbackEl = document.createElement("a");
      fallbackEl.className = "terrax-yan-sponsor-fallback";
      fallbackEl.href = ADSTERRA_SMARTLINK_URL;
      fallbackEl.rel = "noopener noreferrer sponsored";
      fallbackEl.setAttribute("data-smartlink-fallback", "true");
      fallbackEl.setAttribute("aria-hidden", "true");
      fallbackEl.hidden = true;
      fallbackEl.style.display = "none";
      fallbackEl.innerHTML =
        '<div class="terrax-yan-fallback-content terrax-yan-sponsor-content" style="display:none;" hidden>' +
        '<div class="terrax-yan-sponsor-headline">' +
        '<span class="terrax-yan-fallback-pill terrax-yan-sponsor-badge"></span>' +
        '<strong class="terrax-yan-fallback-title terrax-yan-sponsor-title"></strong>' +
        "</div>" +
        '<span class="terrax-yan-fallback-sub terrax-yan-sponsor-desc"></span>' +
        "</div>";
      bodyEl.appendChild(fallbackEl);
    } else {
      fallbackEl.setAttribute("href", ADSTERRA_SMARTLINK_URL);
      fallbackEl.setAttribute("rel", "noopener noreferrer sponsored");
      fallbackEl.setAttribute("data-smartlink-fallback", "true");
      fallbackEl.setAttribute("aria-hidden", "true");
      fallbackEl.hidden = true;
      fallbackEl.style.display = "none";
      var legacyCta = fallbackEl.querySelector(".terrax-yan-sponsor-cta");
      if (legacyCta && legacyCta.parentNode) {
        legacyCta.parentNode.removeChild(legacyCta);
      }
    }

    bindZeroPopupGuard(fallbackEl);

    var disclosureEl = card.querySelector(".terrax-ad-disclosure-label");
    if (!disclosureEl) {
      disclosureEl = document.createElement("span");
      disclosureEl.className = "terrax-ad-disclosure-label";
      disclosureEl.setAttribute("data-label-ar", "اعلان");
      disclosureEl.setAttribute("data-label-en", "Sponsored");
      disclosureEl.textContent = getCurrentLang() === "en" ? "Sponsored" : "اعلان • Sponsored";
      card.appendChild(disclosureEl);
    } else if (!disclosureEl.textContent) {
      disclosureEl.textContent = getCurrentLang() === "en" ? "Sponsored" : "اعلان • Sponsored";
    }

    return fallbackEl;
  }

  /**
   * Mount or refresh the sandboxed automatic inline ad frame inside the card
   * so the configured ad source loads automatically on page open without requiring user click
   * and without opening any popups or redirecting the page.
   */
  function mountAutomaticEmbeddedAdFrame(card, slotKey) {
    if (!card || typeof document === "undefined") return;
    if (engineState.isTesting || isBrowserOffline() || !canLoadAdsUnderConsent()) return;
    if (
      !ADSTERRA_SMARTLINK_URL ||
      ADSTERRA_SMARTLINK_URL.charAt(0) === "#" ||
      engineState.adsenseEnabled !== false
    ) {
      card.setAttribute("data-auto-frame-loaded", "adsense-safe");
      updateCardStatusIndicator(card, "ready");
      return;
    }

    var bodyEl = card.querySelector(".terrax-yan-body");
    if (!bodyEl) return;

    var existingFrame = bodyEl.querySelector("iframe.terrax-auto-ad-frame");
    if (
      existingFrame &&
      existingFrame.getAttribute("data-slot-key") === slotKey &&
      existingFrame.getAttribute("data-src-loaded") === ADSTERRA_SMARTLINK_URL
    ) {
      return;
    }

    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    var adFrame = document.createElement("iframe");
    adFrame.className = "terrax-auto-ad-frame";
    adFrame.setAttribute("data-slot-key", slotKey);
    adFrame.setAttribute("data-src-loaded", ADSTERRA_SMARTLINK_URL);
    adFrame.setAttribute("title", "Terrax Automatic Embedded Ad Unit");
    adFrame.setAttribute("aria-hidden", "true");
    adFrame.setAttribute("tabindex", "-1");
    adFrame.setAttribute("loading", "eager");
    adFrame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    // Strictly omit allow-top-navigation and allow-popups so it can never redirect or open popups
    adFrame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    adFrame.style.cssText =
      "position:absolute;width:1px;height:1px;opacity:0.01;pointer-events:none;border:0;overflow:hidden;bottom:0;left:0;";

    adFrame.onload = function () {
      card.setAttribute("data-auto-frame-loaded", "true");
      updateCardStatusIndicator(card, "ready");
    };
    adFrame.onerror = function () {
      card.setAttribute("data-auto-frame-loaded", "fallback");
      updateCardStatusIndicator(card, "ready");
    };

    adFrame.src = ADSTERRA_SMARTLINK_URL;
    bodyEl.appendChild(adFrame);
  }

  /**
   * Update the card's non-intrusive automatic status badge (kept hidden with no visible text)
   */
  function updateCardStatusIndicator(card, statusState) {
    if (!card) return;
    card.setAttribute("data-ad-state", statusState);
    var statusEls = card.querySelectorAll(".terrax-yan-status-indicator, .terrax-ad-status-pill");
    for (var i = 0; i < statusEls.length; i++) {
      statusEls[i].textContent = "";
      statusEls[i].hidden = true;
      statusEls[i].setAttribute("aria-hidden", "true");
      statusEls[i].style.display = "none";
    }
  }

  /**
   * Activate the automatic inline ad banner when Yandex RTB is loading, blocked, or times out (2s)
   */
  function activateSmartlinkFallback(card, fallbackReason) {
    if (!card) return;
    ensureSmartlinkDomInCard(card);
    card.setAttribute("data-yan-mode", "smartlink-fallback");
    if (fallbackReason) {
      card.setAttribute("data-yan-fallback-reason", String(fallbackReason));
    }
    var mountEl = card.querySelector(".terrax-yan-rtb-mount");
    if (mountEl) {
      mountEl.style.display = "none";
    }
    var fallbackEls = card.querySelectorAll(".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card");
    for (var i = 0; i < fallbackEls.length; i++) {
      fallbackEls[i].hidden = true;
      fallbackEls[i].setAttribute("aria-hidden", "true");
      fallbackEls[i].style.display = "none";
    }
    var status =
      fallbackReason === "awaiting-rtb"
        ? "loading"
        : isBrowserOffline()
          ? "offline"
          : !canLoadAdsUnderConsent()
            ? "consent-paused"
            : "ready";
    var insEl = card.querySelector("ins.adsbygoogle");
    var isAdSenseFilled = Boolean(insEl && insEl.getAttribute("data-ad-status") === "filled");
    var isRtbFilled = card.getAttribute("data-yan-mode") === "rtb-active";
    if (isAdSenseFilled || isRtbFilled) {
      card.setAttribute("data-ad-filled", "true");
      card.setAttribute("data-ad-status", "filled");
      card.classList.add("ad-filled");
    } else {
      card.setAttribute("data-ad-filled", "false");
      card.setAttribute("data-ad-status", "unfilled");
      card.classList.remove("ad-filled");
    }
    updateCardStatusIndicator(card, status);
  }

  /**
   * Activate the Yandex RTB banner display when an ad successfully renders
   */
  function activateYandexRtbBanner(card) {
    if (!card) return;
    card.setAttribute("data-yan-mode", "rtb-active");
    card.setAttribute("data-ad-filled", "true");
    card.setAttribute("data-ad-status", "filled");
    card.classList.add("ad-filled");
    var mountEl = card.querySelector(".terrax-yan-rtb-mount, .terrax-adsense-mount");
    if (mountEl) {
      mountEl.style.display = "flex";
    }
    var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card");
    if (fallbackEl) {
      fallbackEl.style.display = "none";
    }
    updateCardStatusIndicator(card, "ready");
  }

  /**
   * Update the visual state of all ad cards (hiding all ad-space text labels across pages)
   */
  function syncAdCardsVisualState() {
    var cards = getAdCards();
    var isTesting = Boolean(engineState.isTesting);

    bindPageAuxiliaryAdElements();
    bindConsentUiControls();

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      ensureSmartlinkDomInCard(card);

      card.setAttribute("data-testing", isTesting ? "true" : "false");
      card.setAttribute("data-engine-test-state", engineState.testEngineState || "READY");
      card.classList.toggle("yan-isolation-active", isTesting);
      card.classList.toggle("terrax-yan-isolated", isTesting);
      card.classList.toggle("smart-ad-locked", isTesting);

      // Pause/remove background ad frame during active speed test for 100% network isolation
      if (isTesting || !canLoadAdsUnderConsent()) {
        var activeFrame = card.querySelector("iframe.terrax-auto-ad-frame");
        if (activeFrame && activeFrame.parentNode) {
          activeFrame.parentNode.removeChild(activeFrame);
        }
      }

      // Hide all text elements inside the ad slot
      var textNodesToHide = card.querySelectorAll(
        ".terrax-smart-ad-header, .terrax-adsense-header, .terrax-yan-header, " +
        ".terrax-ad-badge, .terrax-ad-status-pill, .terrax-yan-status-indicator, " +
        ".terrax-yan-partner-label, .terrax-yan-title, .terrax-yan-isolation-badge, " +
        ".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card, " +
        ".terrax-yan-fallback-title, .terrax-yan-sponsor-title, .sponsor-title, " +
        ".terrax-yan-fallback-sub, .terrax-yan-sponsor-desc, .sponsor-desc, " +
        ".terrax-yan-fallback-pill, .terrax-yan-sponsor-badge"
      );
      for (var t = 0; t < textNodesToHide.length; t++) {
        var node = textNodesToHide[t];
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
        node.style.display = "none";
        if (
          node.classList.contains("terrax-ad-badge") ||
          node.classList.contains("terrax-ad-status-pill") ||
          node.classList.contains("terrax-yan-status-indicator") ||
          node.classList.contains("terrax-yan-partner-label") ||
          node.classList.contains("terrax-yan-title") ||
          node.classList.contains("terrax-yan-isolation-badge") ||
          node.classList.contains("terrax-yan-fallback-title") ||
          node.classList.contains("terrax-yan-sponsor-title") ||
          node.classList.contains("sponsor-title") ||
          node.classList.contains("terrax-yan-fallback-sub") ||
          node.classList.contains("terrax-yan-sponsor-desc") ||
          node.classList.contains("sponsor-desc") ||
          node.classList.contains("terrax-yan-fallback-pill") ||
          node.classList.contains("terrax-yan-sponsor-badge")
        ) {
          node.textContent = "";
        }
      }

      var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback, .terrax-native-sponsor-card");
      if (fallbackEl) {
        if (fallbackEl.tagName === "A") {
          fallbackEl.href = ADSTERRA_SMARTLINK_URL;
        }
        bindZeroPopupGuard(fallbackEl);
      }

      var cardInsEl = card.querySelector("ins.adsbygoogle");
      var cardAdSenseFilled = Boolean(cardInsEl && cardInsEl.getAttribute("data-ad-status") === "filled");
      var cardRtbFilled = card.getAttribute("data-yan-mode") === "rtb-active";
      if (!isTesting && canLoadAdsUnderConsent() && !isBrowserOffline() && (cardAdSenseFilled || cardRtbFilled)) {
        card.setAttribute("data-ad-filled", "true");
        card.setAttribute("data-ad-status", "filled");
        card.classList.add("ad-filled");
      } else {
        card.setAttribute("data-ad-filled", "false");
        card.setAttribute("data-ad-status", "unfilled");
        card.classList.remove("ad-filled");
      }

      updateCardStatusIndicator(
        card,
        isBrowserOffline()
          ? "offline"
          : !canLoadAdsUnderConsent()
            ? "consent-paused"
            : card.getAttribute("data-ad-state") || "ready"
      );
    }
  }

  /**
   * Check whether a Yandex RTB container has actually rendered visible ad content
   */
  function hasYandexContainerRendered(containerId) {
    if (typeof document === "undefined") return false;
    var el = document.getElementById(containerId);
    if (!el) return false;
    return el.children.length > 0 && el.innerHTML.trim().length > 0;
  }

  /**
   * Ensure external Yandex RTB context.js script is loaded asynchronously in <head>
   * (Also activates any inert <template id="terrax-yandex-sdk-tpl"> if present)
   */
  function ensureExternalYandexScriptLoaded() {
    if (
      typeof document === "undefined" ||
      engineState.isTesting ||
      isBrowserOffline() ||
      !canLoadAdsUnderConsent()
    ) {
      return false;
    }

    var tpl = document.getElementById("terrax-yandex-sdk-tpl");
    if (tpl && tpl.parentNode) {
      tpl.parentNode.removeChild(tpl);
    }

    var existingScripts = document.querySelectorAll(
      'script[src*="yandex.ru/ads/system/context.js"]'
    );
    if (
      existingScripts.length > 0 ||
      document.getElementById("terrax-yandex-context-runtime")
    ) {
      return true;
    }

    var s = document.createElement("script");
    s.id = "terrax-yandex-context-runtime";
    s.src = "https://yandex.ru/ads/system/context.js";
    s.async = true;
    (document.head || document.documentElement).appendChild(s);
    return true;
  }

  /**
   * Abort any in-flight Yandex RTB timers and pause Google AdSense background ad requests
   * immediately when a measurement Web Worker enters the RUNNING state.
   */
  function abortInFlightAdOperationsForWorkerIsolation() {
    if (typeof root !== "undefined") {
      root.adsbygoogle = root.adsbygoogle || [];
      root.adsbygoogle.pauseAdRequests = 1;
      if (Array.isArray(root.yaContextCb) && (!root.Ya || !root.Ya.Context)) {
        root.yaContextCb.length = 0;
      }
    }
    var cards = getAdCards();
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card._yanFallbackTimer) {
        clearTimeout(card._yanFallbackTimer);
        card._yanFallbackTimer = null;
      }
      if (card._yanCheckTimer) {
        clearTimeout(card._yanCheckTimer);
        card._yanCheckTimer = null;
      }
    }
    return true;
  }

  /**
   * Initialize the IntersectionObserver that defers ad loading until an ad slot enters the viewport.
   * Improves initial page load performance and prevents offscreen ad resource consumption.
   */
  function setupViewportAdObserver() {
    if (viewportAdObserver) {
      return viewportAdObserver;
    }
    if (typeof IntersectionObserver !== "function") {
      return null;
    }

    viewportAdObserver = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var card = entry && entry.target;
          if (!card) continue;

          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            card.setAttribute("data-in-viewport", "true");
            card.setAttribute("data-viewport-entered", "true");

            if (engineState.isTesting) {
              engineState.pendingAdLoadAfterTest = true;
              continue;
            }

            var pendingReason = card._pendingLoadReason || "viewport-intersect";
            card._pendingLoadReason = null;
            if (card.getAttribute("data-ad-initialized") !== "true" || pendingReason !== "initial-load") {
              renderCardUnit(card, pendingReason);
            }
          } else {
            card.setAttribute("data-in-viewport", "false");
          }
        }
      },
      {
        root: null,
        rootMargin: VIEWPORT_OBSERVER_ROOT_MARGIN,
        threshold: VIEWPORT_OBSERVER_THRESHOLD
      }
    );

    return viewportAdObserver;
  }

  /**
   * Register an ad card with the IntersectionObserver so it only begins loading when entering the viewport.
   * Falls back to immediate rendering only in environments where IntersectionObserver is unavailable.
   */
  function observeAdCardInViewport(card, reason) {
    if (!card) return false;
    ensureSmartlinkDomInCard(card);
    card._pendingLoadReason = String(reason || "initial-load");

    var observer = setupViewportAdObserver();
    if (!observer) {
      // Fallback for environments without IntersectionObserver (e.g. legacy browsers or Node unit tests)
      card.setAttribute("data-in-viewport", "true");
      card.setAttribute("data-ad-lazy", "loaded");
      return renderCardUnit(card, reason);
    }

    if (!card._terraxViewportObserved) {
      card._terraxViewportObserved = true;
      card.setAttribute("data-ad-lazy", "pending-viewport");
      observer.observe(card);
    }

    // Only load immediately if the IntersectionObserver has already confirmed this slot is in the viewport
    if (card.getAttribute("data-in-viewport") === "true") {
      return renderCardUnit(card, reason);
    }

    return false;
  }

  /**
   * Render or refresh a single Hybrid Google AdSense / Yandex RTB / Automatic Embedded Ad card
   * ONLY when Smart Ad Lock is NOT in RUNNING state (engineState.isTesting === false)
   * and ONLY when the ad slot has entered the viewport via IntersectionObserver.
   */
  function renderCardUnit(card, reason) {
    if (!card || engineState.isTesting) {
      if (engineState.isTesting) {
        engineState.pendingAdLoadAfterTest = true;
      }
      return false;
    }

    // Enforce viewport lazy-loading via IntersectionObserver before starting any network ad requests
    if (
      typeof IntersectionObserver === "function" &&
      card.getAttribute("data-in-viewport") !== "true" &&
      reason !== "viewport-intersect"
    ) {
      return observeAdCardInViewport(card, reason);
    }

    card.setAttribute("data-ad-lazy", "loaded");
    ensureYandexQueue();
    ensureSmartlinkDomInCard(card);

    var slotKey =
      card.getAttribute("data-terrax-smart-ad") ||
      card.getAttribute("data-terrax-yan-slot") ||
      "speed-main";
    var blockId =
      card.getAttribute("data-yan-block-id") ||
      card.getAttribute("data-block-id") ||
      engineState.blockIds[slotKey] ||
      DEFAULT_BLOCK_IDS[slotKey] ||
      DEFAULT_BLOCK_IDS["speed-main"];

    // Policy Compliance: Do not auto-refresh a filled Google AdSense unit on the 30-second timer
    if (
      reason === "auto-rotation" &&
      card.getAttribute("data-adsense-active") === "true" &&
      card.getAttribute("data-adsense-status") === "filled"
    ) {
      return true;
    }

    // Deduplicate rapid identical initialization calls on the same slot
    var nowTs = Date.now();
    var lastSlotMeta = engineState.activeSlots[slotKey];
    if (
      reason === "initial-load" &&
      card.getAttribute("data-ad-initialized") === "true" &&
      lastSlotMeta &&
      nowTs - lastSlotMeta.timestamp < 500
    ) {
      return true;
    }

    var mountEl = card.querySelector(
      ".terrax-yan-rtb-mount, .terrax-smart-ad-body, .terrax-adsense-mount"
    ) || card;
    if (!mountEl) return false;

    // Clean up any existing timers on this card before starting a new cycle
    if (card._yanFallbackTimer) {
      clearTimeout(card._yanFallbackTimer);
      card._yanFallbackTimer = null;
    }
    if (card._yanCheckTimer) {
      clearTimeout(card._yanCheckTimer);
      card._yanCheckTimer = null;
    }

    // Create a clean container ID for Yandex RTB render/refresh cycle without wiping static AdSense <ins> units
    var renderContainerId =
      "yandex_rtb_" +
      slotKey.replace(/[^a-zA-Z0-9_-]/g, "_") +
      "_" +
      engineState.refreshCount;
    var oldRtbTargets = mountEl.querySelectorAll(".terrax-yan-rtb-target");
    for (var rIdx = 0; rIdx < oldRtbTargets.length; rIdx++) {
      if (oldRtbTargets[rIdx].parentNode) {
        oldRtbTargets[rIdx].parentNode.removeChild(oldRtbTargets[rIdx]);
      }
    }
    if (
      !mountEl.querySelector("ins.adsbygoogle") &&
      !mountEl.querySelector(".terrax-native-sponsor-card")
    ) {
      mountEl.innerHTML = "";
    }
    var rtbDiv = document.createElement("div");
    rtbDiv.id = renderContainerId;
    rtbDiv.className = "terrax-yan-rtb-target";
    mountEl.appendChild(rtbDiv);

    card.setAttribute("data-ad-initialized", "true");
    card.setAttribute("data-yan-block-id", blockId);
    card.setAttribute("data-yan-last-refresh", String(reason || "auto"));
    card.setAttribute(
      "data-yan-refresh-count",
      String(engineState.refreshCount)
    );

    engineState.activeSlots[slotKey] = {
      slotKey: slotKey,
      blockId: blockId,
      containerId: renderContainerId,
      reason: String(reason || "auto"),
      timestamp: nowTs
    };

    if (isBrowserOffline()) {
      activateSmartlinkFallback(card, "offline-graceful");
      return true;
    }

    if (!canLoadAdsUnderConsent()) {
      activateSmartlinkFallback(card, "consent-opt-out");
      return true;
    }

    // 1. Official Google AdSense Unit Mount (if valid publisherId & slotId are configured)
    mountOrPushAdSenseUnit(card, slotKey);

    var isSupportedBlock = isValidConfiguredBlockId(blockId);

    // 2. Mount the automatic inline ad loader frame for the project's ad source
    mountAutomaticEmbeddedAdFrame(card, slotKey);

    if (!isSupportedBlock) {
      activateSmartlinkFallback(card, "configured-inline-ad");
      return true;
    }

    ensureExternalYandexScriptLoaded();

    // Immediately show the automatic ad unit with loading indicator until Yandex RTB fills or 2s timeout completes
    activateSmartlinkFallback(card, "awaiting-rtb");

    card._yanFallbackTimer = setTimeout(function () {
      card._yanFallbackTimer = null;
      if (engineState.isTesting) return;
      if (hasYandexContainerRendered(renderContainerId)) {
        activateYandexRtbBanner(card);
      } else {
        activateSmartlinkFallback(card, "timeout-2000ms-or-adblock");
      }
    }, YANDEX_FALLBACK_TIMEOUT_MS);

    // Push automatic render instruction to Yandex RTB asynchronous callback queue
    if (typeof root !== "undefined" && Array.isArray(root.yaContextCb)) {
      root.yaContextCb.push(function () {
        // Double-check Network Isolation Lock inside async callback before any network activity!
        if (engineState.isTesting) {
          return;
        }
        try {
          var isNumericYandexBlockId = /^(R-A-\d+-\d+|imp-[a-z0-9_-]+)$/i.test(
            String(blockId || "").trim()
          );
          if (
            isSupportedBlock &&
            isNumericYandexBlockId &&
            root.Ya &&
            root.Ya.Context &&
            root.Ya.Context.AdvManager &&
            typeof root.Ya.Context.AdvManager.render === "function"
          ) {
            card.setAttribute("data-yan-mode", "rtb-requested");
            root.Ya.Context.AdvManager.render(
              {
                blockId: blockId,
                renderTo: renderContainerId,
                async: true
              },
              function onFallback() {
                if (engineState.isTesting) return;
                activateSmartlinkFallback(card, "yandex-no-fill");
              }
            );
            card._yanCheckTimer = setTimeout(function () {
              card._yanCheckTimer = null;
              if (engineState.isTesting) return;
              if (hasYandexContainerRendered(renderContainerId)) {
                activateYandexRtbBanner(card);
              } else {
                updateCardStatusIndicator(card, "ready");
              }
            }, 450);
          } else {
            activateSmartlinkFallback(card, "auto-inline-active");
          }
        } catch (err) {
          if (!engineState.isTesting) {
            activateSmartlinkFallback(card, "render-exception");
          }
        }
      });
    }

    return true;
  }

  /**
   * Smart Ad Lock — Integrate advertising system with the real speed-test engine states:
   * - READY: Advertising may load in approved placements.
   * - RUNNING: Suppress new ad-loading operations that could interfere with the active test.
   * - FINISHED: Allow approved advertising placements.
   * - ERROR: Preserve the error information and application functionality.
   */
  function setEngineTestState(stateName, errorDetails) {
    var normalized = String(stateName || "READY").toUpperCase();
    if (
      normalized !== "READY" &&
      normalized !== "RUNNING" &&
      normalized !== "FINISHED" &&
      normalized !== "ERROR"
    ) {
      normalized = "READY";
    }

    var wasTesting = Boolean(engineState.isTesting);
    engineState.testEngineState = normalized;
    engineState.isTesting = normalized === "RUNNING";

    if (normalized === "ERROR") {
      engineState.lastTestError = errorDetails || {
        message: "Test execution interrupted",
        timestamp: Date.now()
      };
    } else if (normalized === "RUNNING") {
      engineState.lastTestError = null;
    }

    if (engineState.isTesting) {
      abortInFlightAdOperationsForWorkerIsolation();
    } else if (wasTesting) {
      syncGoogleConsentSignals();
    }

    if (
      typeof root !== "undefined" &&
      root.TerraxAdSense &&
      typeof root.TerraxAdSense.setEngineTestState === "function" &&
      root.TerraxAdSense.testEngineState !== normalized
    ) {
      try {
        root.TerraxAdSense.setEngineTestState(normalized, errorDetails);
      } catch (e) {}
    }

    syncAdCardsVisualState();

    // If transitioning out of RUNNING to READY or FINISHED and a load was queued, flush safely
    if (
      wasTesting &&
      !engineState.isTesting &&
      (normalized === "READY" || normalized === "FINISHED") &&
      engineState.pendingAdLoadAfterTest
    ) {
      engineState.pendingAdLoadAfterTest = false;
      refreshAllSlots("smart-lock-released:" + normalized.toLowerCase());
    }

    return {
      testEngineState: engineState.testEngineState,
      isTesting: engineState.isTesting,
      lastTestError: engineState.lastTestError
    };
  }

  /**
   * Set Network Isolation Lock state.
   * When isTesting === true, strictly blocks all network ad loads/refreshes.
   */
  function setTestingState(isTesting) {
    var nextState = Boolean(isTesting);
    setEngineTestState(nextState ? "RUNNING" : "READY");
    return engineState.isTesting;
  }

  /**
   * Trigger a State-Driven Smart Refresh across all active ad slots
   * (Ignored if Network Isolation Lock is currently active).
   */
  function refreshAllSlots(reason) {
    if (engineState.isTesting) {
      // Strictly blocked by Smart Ad Lock during active speed/gaming tests
      engineState.pendingAdLoadAfterTest = true;
      syncAdCardsVisualState();
      return false;
    }

    engineState.refreshCount += 1;
    engineState.lastRefreshReason = String(reason || "refresh");
    engineState.lastRefreshTimestamp = Date.now();

    syncAdCardsVisualState();

    var cards = getAdCards();
    for (var i = 0; i < cards.length; i++) {
      observeAdCardInViewport(cards[i], engineState.lastRefreshReason);
    }
    return true;
  }

  /**
   * Called immediately when a Speed Test, Gaming Test, or Stability Test finishes (onTestComplete)
   */
  function onTestComplete(sourcePage) {
    var wasTesting = Boolean(engineState.isTesting);
    engineState.isTesting = false;
    engineState.testEngineState = "FINISHED";
    engineState.pendingAdLoadAfterTest = false;
    if (wasTesting) {
      syncGoogleConsentSignals();
    }
    if (
      typeof root !== "undefined" &&
      root.TerraxAdSense &&
      typeof root.TerraxAdSense.setEngineTestState === "function" &&
      root.TerraxAdSense.testEngineState !== "FINISHED"
    ) {
      try {
        root.TerraxAdSense.setEngineTestState("FINISHED");
      } catch (e) {}
    }
    return refreshAllSlots("test-complete:" + String(sourcePage || "main"));
  }

  /**
   * Called when a Speed Test, Gaming Test, or Stability Test encounters a connection/server error.
   * Preserves error information and application functionality without fabricating measurements.
   */
  function onTestError(errorInfo) {
    setEngineTestState("ERROR", errorInfo || { message: "Connection error", timestamp: Date.now() });
    return engineState.lastTestError;
  }

  /**
   * Called during the 60-second Stability Test with elapsed seconds.
   * Automatically refreshes the Yandex ad unit at 30s and 60s.
   */
  function onStabilityElapsedTick(elapsedSeconds) {
    var sec = Number(elapsedSeconds) || 0;
    if (sec < 1) {
      engineState.stability30sTriggered = false;
      engineState.stability60sTriggered = false;
      return false;
    }
    if (sec >= 30 && !engineState.stability30sTriggered) {
      engineState.stability30sTriggered = true;
      return refreshAllSlots("stability-30s");
    }
    if (sec >= 60 && !engineState.stability60sTriggered) {
      engineState.stability60sTriggered = true;
      return refreshAllSlots("stability-60s");
    }
    return false;
  }

  /**
   * Called when user switches between the 5 bottom navigation tabs
   */
  function onTabChange(tabId) {
    if (engineState.isTesting) return false;
    return refreshAllSlots("tab-switch:" + String(tabId || "tab"));
  }

  /**
   * Reset Stability milestone flags when starting or resetting a Stability session
   */
  function resetStabilityMilestones() {
    engineState.stability30sTriggered = false;
    engineState.stability60sTriggered = false;
  }

  /**
   * Clean up all timers, observers, and active slot resources when leaving a page
   */
  function cleanupAllSlots() {
    if (autoRotationTimer) {
      clearInterval(autoRotationTimer);
      autoRotationTimer = null;
    }
    if (viewportAdObserver) {
      try {
        viewportAdObserver.disconnect();
      } catch (e) {}
      viewportAdObserver = null;
    }
    var cards = getAdCards();
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      card._terraxViewportObserved = false;
      card._pendingLoadReason = null;
      if (card._yanFallbackTimer) {
        clearTimeout(card._yanFallbackTimer);
        card._yanFallbackTimer = null;
      }
      if (card._yanCheckTimer) {
        clearTimeout(card._yanCheckTimer);
        card._yanCheckTimer = null;
      }
      var frame = card.querySelector("iframe.terrax-auto-ad-frame");
      if (frame && frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
      card.removeAttribute("data-ad-initialized");
      card.removeAttribute("data-in-viewport");
      card.removeAttribute("data-ad-lazy");
    }
    engineState.activeSlots = {};
  }

  /**
   * Observe <dialog> elements (such as #usage-dialog, #settings-dialog, #privacy) so ads and consent controls inside modals
   * automatically register with the viewport IntersectionObserver as soon as the dialog opens.
   */
  function setupDialogAutoAdObserver() {
    if (
      dialogObserver ||
      typeof document === "undefined" ||
      typeof MutationObserver !== "function"
    ) {
      return;
    }
    dialogObserver = new MutationObserver(function (mutations) {
      bindConsentUiControls();
      if (engineState.isTesting) return;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (
          m.type === "attributes" &&
          m.attributeName === "open" &&
          m.target &&
          m.target.hasAttribute("open")
        ) {
          var dialogSlots = m.target.querySelectorAll("[data-terrax-smart-ad], [data-terrax-yan-slot]");
          for (var j = 0; j < dialogSlots.length; j++) {
            observeAdCardInViewport(dialogSlots[j], "dialog-open");
          }
        }
      }
    });

    var dialogs = document.querySelectorAll("dialog");
    for (var d = 0; d < dialogs.length; d++) {
      dialogObserver.observe(dialogs[d], {
        attributes: true,
        attributeFilter: ["open"]
      });
    }
  }

  /**
   * Bind page lifecycle events (pageshow, pagehide, online, offline, visibilitychange)
   * to prevent duplicate ads across navigations and clean up resources on exit.
   */
  function bindLifecycleEvents() {
    if (lifecycleBound || typeof root === "undefined" || typeof root.addEventListener !== "function") {
      return;
    }
    lifecycleBound = true;

    root.addEventListener("pagehide", function () {
      cleanupAllSlots();
    });

    root.addEventListener("pageshow", function (event) {
      if (event && event.persisted) {
        init();
      } else if (!engineState.isTesting) {
        var cards = getAdCards();
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].getAttribute("data-ad-initialized") !== "true") {
            observeAdCardInViewport(cards[i], "pageshow-restore");
          }
        }
      }
    });

    root.addEventListener("online", function () {
      if (!engineState.isTesting) {
        refreshAllSlots("network-reconnected");
      }
    });

    root.addEventListener("offline", function () {
      syncAdCardsVisualState();
    });
  }

  /**
   * Start automatic ad rotation timer when idle (paused automatically during active tests)
   */
  function startAutoAdRotation() {
    if (engineState.adsenseEnabled !== false) return;
    if (autoRotationTimer || typeof setInterval !== "function") return;
    autoRotationTimer = setInterval(function () {
      if (!engineState.isTesting && getAdCards().length > 0) {
        refreshAllSlots("auto-rotation");
      }
    }, AUTO_AD_ROTATION_INTERVAL_MS);
    if (autoRotationTimer && typeof autoRotationTimer.unref === "function") {
      autoRotationTimer.unref();
    }
  }

  /**
   * Initialize the Smart Hybrid Ad Engine automatically when DOM is ready
   */
  function init() {
    engineState.initialized = true;
    loadConsentPreferences();
    configureAdSense();
    ensureYandexQueue();
    bindLifecycleEvents();
    setupViewportAdObserver();
    setupDialogAutoAdObserver();
    bindConsentUiControls();
    syncAdCardsVisualState();
    if (!engineState.isTesting) {
      refreshAllSlots("initial-load");
    }
    startAutoAdRotation();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      setTimeout(init, 0);
    }
  }

  var api = {
    ADSTERRA_SMARTLINK_URL: ADSTERRA_SMARTLINK_URL,
    YANDEX_FALLBACK_TIMEOUT_MS: YANDEX_FALLBACK_TIMEOUT_MS,
    AUTO_AD_ROTATION_INTERVAL_MS: AUTO_AD_ROTATION_INTERVAL_MS,
    DEFAULT_BLOCK_IDS: DEFAULT_BLOCK_IDS,
    DEFAULT_ADSENSE_SLOTS: DEFAULT_ADSENSE_SLOTS,
    CONSENT_STORAGE_KEY: CONSENT_STORAGE_KEY,
    TerraxConsentManager: TerraxConsentManager,
    isValidAdSensePublisherId: isValidAdSensePublisherId,
    normalizeAdSenseClientId: normalizeAdSenseClientId,
    isValidAdSenseSlotId: isValidAdSenseSlotId,
    configureAdSense: configureAdSense,
    ensureGoogleAdSenseVerificationMeta: ensureGoogleAdSenseVerificationMeta,
    ensureGoogleAdSenseScriptLoaded: ensureGoogleAdSenseScriptLoaded,
    ensureExternalYandexScriptLoaded: ensureExternalYandexScriptLoaded,
    abortInFlightAdOperationsForWorkerIsolation: abortInFlightAdOperationsForWorkerIsolation,
    mountOrPushAdSenseUnit: mountOrPushAdSenseUnit,
    setupViewportAdObserver: setupViewportAdObserver,
    observeAdCardInViewport: observeAdCardInViewport,
    setEngineTestState: setEngineTestState,
    onTestError: onTestError,
    setConsentChoice: setConsentChoice,
    getConsentState: getConsentState,
    init: init,
    setTestingState: setTestingState,
    refreshAllSlots: refreshAllSlots,
    renderCardUnit: renderCardUnit,
    cleanupAllSlots: cleanupAllSlots,
    onTestComplete: onTestComplete,
    onStabilityElapsedTick: onStabilityElapsedTick,
    onTabChange: onTabChange,
    resetStabilityMilestones: resetStabilityMilestones,
    syncAdCardsVisualState: syncAdCardsVisualState,
    getDiagnostics: function () {
      var isPubValid = isValidAdSensePublisherId(engineState.adsensePublisherId);
      var slots = engineState.adsenseSlots || {};
      var validSlotsCount = 0;
      for (var s in slots) {
        if (isValidAdSenseSlotId(slots[s])) validSlotsCount++;
      }
      return {
        timestamp: new Date().toISOString(),
        overallReadiness: isPubValid && validSlotsCount > 0 ? "READY" : "PENDING",
        publisherStatus: isPubValid ? "READY" : "PENDING",
        publisherId: isPubValid ? engineState.adsensePublisherId : "UNCONFIGURED (PENDING)",
        autoAdsEnabled: engineState.adsenseAutoAdsEnabled,
        smartAdLockState: engineState.testEngineState || "READY",
        isTesting: engineState.isTesting,
        consentMode: engineState.consentMode,
        configuredSlotsCount: validSlotsCount
      };
    },
    getState: function () {
      return Object.assign({}, engineState, {
        adsenseSlots: Object.assign({}, engineState.adsenseSlots)
      });
    }
  };

  if (typeof root !== "undefined") {
    root.TerraxSmartAdEngine = api;
    root.TerraxAdSlots = api;
    root.TerraxConsentManager = TerraxConsentManager;
  }
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
