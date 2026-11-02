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
    "https://asiafilm.org/4/f40a6dd77b401726a12dd304a72bafa5";
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

  var autoRotationTimer = null;
  var dialogObserver = null;
  var lifecycleBound = false;

  var engineState = {
    isTesting: false,
    initialized: false,
    refreshCount: 0,
    lastRefreshReason: "init",
    lastRefreshTimestamp: 0,
    stability30sTriggered: false,
    stability60sTriggered: false,
    smartlinkUrl: ADSTERRA_SMARTLINK_URL,
    fallbackTimeoutMs: YANDEX_FALLBACK_TIMEOUT_MS,
    blockIds: Object.assign({}, DEFAULT_BLOCK_IDS),
    activeSlots: {}
  };

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
   * Discover all Yandex Smart Ad containers in the current DOM
   */
  function getAdCards() {
    if (typeof document === "undefined") return [];
    return Array.prototype.slice.call(
      document.querySelectorAll("[data-terrax-yan-slot]")
    );
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

    // Ensure header has an automatic status indicator for loading/ready feedback
    var headerEl = card.querySelector(".terrax-yan-header");
    if (headerEl) {
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
      var statusEl = actionsEl.querySelector(".terrax-yan-status-indicator");
      if (!statusEl) {
        statusEl = document.createElement("span");
        statusEl.className = "terrax-yan-status-indicator";
        statusEl.setAttribute("aria-live", "polite");
        actionsEl.insertBefore(statusEl, actionsEl.firstChild);
      }
    }

    var bodyEl = card.querySelector(".terrax-yan-body");
    if (!bodyEl) return null;

    var mountEl = bodyEl.querySelector(".terrax-yan-rtb-mount");
    if (!mountEl) {
      mountEl = document.createElement("div");
      mountEl.className = "terrax-yan-rtb-mount";
      bodyEl.insertBefore(mountEl, bodyEl.firstChild);
    }

    var fallbackEl = bodyEl.querySelector(".terrax-yan-sponsor-fallback");
    if (!fallbackEl) {
      fallbackEl = document.createElement("a");
      fallbackEl.className = "terrax-yan-sponsor-fallback";
      fallbackEl.href = ADSTERRA_SMARTLINK_URL;
      fallbackEl.rel = "noopener noreferrer sponsored";
      fallbackEl.setAttribute("data-smartlink-fallback", "true");
      fallbackEl.innerHTML =
        '<div class="terrax-yan-fallback-content terrax-yan-sponsor-content">' +
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
      var legacyCta = fallbackEl.querySelector(".terrax-yan-sponsor-cta");
      if (legacyCta && legacyCta.parentNode) {
        legacyCta.parentNode.removeChild(legacyCta);
      }
    }

    bindZeroPopupGuard(fallbackEl);
    return fallbackEl;
  }

  /**
   * Mount or refresh the sandboxed automatic inline ad frame inside the card
   * so the configured ad source loads automatically on page open without requiring user click
   * and without opening any popups or redirecting the page.
   */
  function mountAutomaticEmbeddedAdFrame(card, slotKey) {
    if (!card || typeof document === "undefined") return;
    if (engineState.isTesting || isBrowserOffline()) return;

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
   * Update the card's non-intrusive automatic status badge (loading / ready / isolated / offline)
   */
  function updateCardStatusIndicator(card, statusState) {
    if (!card) return;
    card.setAttribute("data-ad-state", statusState);
    var statusEl = card.querySelector(".terrax-yan-status-indicator");
    if (!statusEl) return;

    var lang = getCurrentLang();
    if (engineState.isTesting) {
      statusEl.textContent = "";
      statusEl.hidden = true;
      return;
    }

    statusEl.hidden = false;
    if (statusState === "loading") {
      statusEl.textContent =
        lang === "en" ? "Auto-loading ad..." : "جاري التحميل التلقائي...";
      statusEl.style.cssText =
        "font-size:0.92rem;font-weight:700;color:#67e8f9;opacity:0.88;";
    } else if (statusState === "offline") {
      statusEl.textContent =
        lang === "en" ? "Ad paused (Offline)" : "الإعلان متوقف مؤقتاً (غير متصل)";
      statusEl.style.cssText =
        "font-size:0.92rem;font-weight:700;color:#94a3b8;opacity:0.85;";
    } else {
      statusEl.textContent =
        lang === "en" ? "Auto Ad Active • تفعيل تلقائي" : "عرض تلقائي نشط";
      statusEl.style.cssText =
        "font-size:0.92rem;font-weight:700;color:#38bdf8;opacity:0.9;";
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
    var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback");
    if (fallbackEl) {
      fallbackEl.style.display = "flex";
    }
    var status =
      fallbackReason === "awaiting-rtb"
        ? "loading"
        : isBrowserOffline()
          ? "offline"
          : "ready";
    updateCardStatusIndicator(card, status);
  }

  /**
   * Activate the Yandex RTB banner display when an ad successfully renders
   */
  function activateYandexRtbBanner(card) {
    if (!card) return;
    card.setAttribute("data-yan-mode", "rtb-active");
    var mountEl = card.querySelector(".terrax-yan-rtb-mount");
    if (mountEl) {
      mountEl.style.display = "flex";
    }
    var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback");
    if (fallbackEl) {
      fallbackEl.style.display = "none";
    }
    updateCardStatusIndicator(card, "ready");
  }

  /**
   * Update the visual state of all ad cards (header text, isolation badge, slot-specific automatic ad copy)
   */
  function syncAdCardsVisualState() {
    var cards = getAdCards();
    var isTesting = Boolean(engineState.isTesting);
    var lang = getCurrentLang();

    bindPageAuxiliaryAdElements();

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      ensureSmartlinkDomInCard(card);

      var slotKey = card.getAttribute("data-terrax-yan-slot") || "speed-main";
      var slotOffset = SLOT_CREATIVE_OFFSETS[slotKey] || 0;
      var sponsorItem =
        SPONSOR_FALLBACK_ITEMS[
          (engineState.refreshCount + slotOffset) % SPONSOR_FALLBACK_ITEMS.length
        ];

      card.setAttribute("data-testing", isTesting ? "true" : "false");
      card.classList.toggle("yan-isolation-active", isTesting);
      card.classList.toggle("terrax-yan-isolated", isTesting);

      // Pause/remove background ad frame during active speed test for 100% network isolation
      if (isTesting) {
        var activeFrame = card.querySelector("iframe.terrax-auto-ad-frame");
        if (activeFrame && activeFrame.parentNode) {
          activeFrame.parentNode.removeChild(activeFrame);
        }
      }

      var partnerTextEl =
        card.querySelector(".terrax-yan-partner-label") ||
        card.querySelector(".terrax-yan-title");
      if (partnerTextEl) {
        partnerTextEl.textContent = "برعاية تقنية • Terrax Partner";
      }

      var badgeEl = card.querySelector(".terrax-yan-isolation-badge");
      if (badgeEl) {
        badgeEl.textContent = "🛡️ وضع العزل الشبكي نشط لضمان دقة الفحص";
        badgeEl.hidden = !isTesting;
        badgeEl.setAttribute("aria-hidden", isTesting ? "false" : "true");
      }

      var fallbackEl = card.querySelector(".terrax-yan-sponsor-fallback");
      if (fallbackEl) {
        fallbackEl.href = ADSTERRA_SMARTLINK_URL;
        bindZeroPopupGuard(fallbackEl);
      }

      var fallbackHeadline =
        card.querySelector(".terrax-yan-fallback-title") ||
        card.querySelector(".terrax-yan-sponsor-title");
      var fallbackSub =
        card.querySelector(".terrax-yan-fallback-sub") ||
        card.querySelector(".terrax-yan-sponsor-desc");
      var fallbackBadge =
        card.querySelector(".terrax-yan-fallback-pill") ||
        card.querySelector(".terrax-yan-sponsor-badge");

      if (fallbackHeadline) {
        fallbackHeadline.textContent =
          lang === "en" ? sponsorItem.titleEn : sponsorItem.titleAr;
      }
      if (fallbackSub) {
        fallbackSub.textContent =
          lang === "en" ? sponsorItem.subEn : sponsorItem.subAr;
      }
      if (fallbackBadge) {
        fallbackBadge.textContent =
          lang === "en" ? sponsorItem.badgeEn : sponsorItem.badgeAr;
      }

      updateCardStatusIndicator(
        card,
        isBrowserOffline() ? "offline" : card.getAttribute("data-ad-state") || "ready"
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
    if (typeof document === "undefined" || isBrowserOffline()) return;

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
      return;
    }

    var s = document.createElement("script");
    s.id = "terrax-yandex-context-runtime";
    s.src = "https://yandex.ru/ads/system/context.js";
    s.async = true;
    (document.head || document.documentElement).appendChild(s);
  }

  /**
   * Render or refresh a single Hybrid Yandex RTB + Automatic Embedded Ad card
   * ONLY when Network Isolation Lock is OFF (engineState.isTesting === false)
   */
  function renderCardUnit(card, reason) {
    if (!card || engineState.isTesting) {
      return false;
    }

    ensureYandexQueue();
    ensureSmartlinkDomInCard(card);

    var slotKey = card.getAttribute("data-terrax-yan-slot") || "speed-main";
    var blockId =
      card.getAttribute("data-yan-block-id") ||
      card.getAttribute("data-block-id") ||
      engineState.blockIds[slotKey] ||
      DEFAULT_BLOCK_IDS[slotKey] ||
      DEFAULT_BLOCK_IDS["speed-main"];

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

    var mountEl = card.querySelector(".terrax-yan-rtb-mount");
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

    // Create a clean container ID for Yandex RTB render/refresh cycle
    var renderContainerId =
      "yandex_rtb_" +
      slotKey.replace(/[^a-zA-Z0-9_-]/g, "_") +
      "_" +
      engineState.refreshCount;
    mountEl.innerHTML = "";
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

    var isSupportedBlock = isValidConfiguredBlockId(blockId);

    // Mount the automatic inline ad loader frame for the project's ad source
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
                activateSmartlinkFallback(card, "yandex-no-fill");
              }
            );
            card._yanCheckTimer = setTimeout(function () {
              card._yanCheckTimer = null;
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
          activateSmartlinkFallback(card, "render-exception");
        }
      });
    }

    return true;
  }

  /**
   * Set Network Isolation Lock state.
   * When isTesting === true, strictly blocks all network ad loads/refreshes.
   */
  function setTestingState(isTesting) {
    var nextState = Boolean(isTesting);
    engineState.isTesting = nextState;
    syncAdCardsVisualState();
    return engineState.isTesting;
  }

  /**
   * Trigger a State-Driven Smart Refresh across all active ad slots
   * (Ignored if Network Isolation Lock is currently active).
   */
  function refreshAllSlots(reason) {
    if (engineState.isTesting) {
      // Strictly blocked by Network Isolation Lock during active speed/gaming tests
      syncAdCardsVisualState();
      return false;
    }

    engineState.refreshCount += 1;
    engineState.lastRefreshReason = String(reason || "refresh");
    engineState.lastRefreshTimestamp = Date.now();

    syncAdCardsVisualState();

    var cards = getAdCards();
    for (var i = 0; i < cards.length; i++) {
      renderCardUnit(cards[i], engineState.lastRefreshReason);
    }
    return true;
  }

  /**
   * Called immediately when a Speed Test, Gaming Test, or Stability Test finishes (onTestComplete)
   */
  function onTestComplete(sourcePage) {
    engineState.isTesting = false;
    return refreshAllSlots("test-complete:" + String(sourcePage || "main"));
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
      var frame = card.querySelector("iframe.terrax-auto-ad-frame");
      if (frame && frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
      card.removeAttribute("data-ad-initialized");
    }
    engineState.activeSlots = {};
  }

  /**
   * Observe <dialog> elements (such as #usage-dialog and #settings-dialog) so ads inside modals
   * automatically initialize and render as soon as the dialog opens.
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
      if (engineState.isTesting) return;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (
          m.type === "attributes" &&
          m.attributeName === "open" &&
          m.target &&
          m.target.hasAttribute("open")
        ) {
          var dialogSlots = m.target.querySelectorAll("[data-terrax-yan-slot]");
          for (var j = 0; j < dialogSlots.length; j++) {
            renderCardUnit(dialogSlots[j], "dialog-open");
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
            renderCardUnit(cards[i], "pageshow-restore");
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
    ensureYandexQueue();
    bindLifecycleEvents();
    setupDialogAutoAdObserver();
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
    getState: function () {
      return Object.assign({}, engineState);
    }
  };

  if (typeof root !== "undefined") {
    root.TerraxSmartAdEngine = api;
    root.TerraxAdSlots = api;
  }
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
