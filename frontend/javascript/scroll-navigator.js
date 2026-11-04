/**
 * Terrax Plus (تيراكس بلاس) - Cyber Scroll & Page Transition Navigator
 * Dedicated high-performance floating navigation HUD, progress ring,
 * and smooth page transition controller with zero layout thrashing.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TerraxScrollNavigator = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  let initialized = false;
  let rafId = 0;
  let isNavigating = false;

  /**
   * Determine current page key ('speed', 'stability', 'gaming')
   */
  function getCurrentPageKey() {
    if (typeof window === "undefined" || !window.location) return "speed";
    const path = (window.location.pathname || "").toLowerCase();
    if (path.includes("stability")) return "stability";
    if (path.includes("gaming")) return "gaming";
    return "speed";
  }

  /**
   * Safe smooth scroll to top or target offset with zero jitter
   * @param {number} targetY
   * @param {'smooth'|'auto'} [behavior='smooth']
   */
  function smoothScrollTo(targetY = 0, behavior = "smooth") {
    if (typeof window === "undefined") return;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finalBehavior = reducedMotion ? "auto" : behavior;

    try {
      window.scrollTo({
        top: Math.max(0, targetY),
        left: 0,
        behavior: finalBehavior,
      });
    } catch (e) {
      window.scrollTo(0, Math.max(0, targetY));
    }
  }

  /**
   * Smooth transition to another page with anti-freeze and BFCache safety
   * @param {string} targetUrl
   */
  function navigateTo(targetUrl) {
    if (!targetUrl || typeof window === "undefined") return;
    if (isNavigating) return;
    isNavigating = true;

    // Reset lock on pageshow if navigating back via BFCache
    window.addEventListener(
      "pageshow",
      function onPageShow() {
        isNavigating = false;
        document.body.classList.remove("terrax-page-leaving");
      },
      { once: true }
    );

    document.body.classList.add("terrax-page-leaving");

    const doNav = () => {
      window.location.href = targetUrl;
    };

    if (
      typeof document.startViewTransition === "function" &&
      document.visibilityState !== "hidden"
    ) {
      try {
        const vt = document.startViewTransition(() => {
          doNav();
        });
        if (vt?.finished?.catch) vt.finished.catch(() => {});
      } catch (e) {
        doNav();
      }
    } else {
      setTimeout(doNav, 180);
    }

    // Safety fallback timeout to prevent frozen state if browser cancels navigation
    setTimeout(() => {
      isNavigating = false;
      document.body.classList.remove("terrax-page-leaving");
    }, 2500);
  }

  /**
   * Calculate and update scroll progress ring and state
   */
  function syncScrollState() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const math = globalThis.TerraxTelemetryMath;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollHeight =
      document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const clientHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;

    const pct =
      math && typeof math.calculateScrollPercentage === "function"
        ? math.calculateScrollPercentage(scrollTop, scrollHeight, clientHeight)
        : Math.min(
            100,
            Math.max(
              0,
              Math.round((scrollTop / Math.max(1, scrollHeight - clientHeight)) * 100)
            )
          );

    const navEl = document.getElementById("terrax-scroll-navigator");
    if (!navEl) return;

    // Toggle scrolled state (reveal scroll to top button after 120px)
    const isScrolled = scrollTop > 120;
    if (navEl.dataset.scrolled !== String(isScrolled)) {
      navEl.dataset.scrolled = String(isScrolled);
      navEl.classList.toggle("scrolled", isScrolled);
    }

    // Update circular progress arc
    const progressCircle = navEl.querySelector(".scroll-progress-bar");
    const pctBadge = navEl.querySelector("#scroll-pct-badge");
    const circumference = 100.53; // 2 * PI * 16

    if (progressCircle) {
      const ring =
        math && typeof math.calculateScrollRingDash === "function"
          ? math.calculateScrollRingDash(pct, circumference)
          : {
              dasharray: `${((pct / 100) * circumference).toFixed(1)} ${circumference.toFixed(2)}`,
            };
      progressCircle.setAttribute("stroke-dasharray", ring.dasharray);
    }

    if (pctBadge) {
      pctBadge.textContent = `${pct}%`;
    }
  }

  function requestSync() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      syncScrollState();
    });
  }

  /**
   * Render the HTML markup for the floating scroll navigator
   */
  function mountNavigatorMarkup() {
    if (typeof document === "undefined") return;
    if (document.getElementById("terrax-scroll-navigator")) return;

    const isArabic =
      document.documentElement.getAttribute("dir") === "rtl" ||
      document.documentElement.getAttribute("lang") === "ar";
    const pageKey = getCurrentPageKey();

    const container = document.createElement("aside");
    container.id = "terrax-scroll-navigator";
    container.className = "terrax-scroll-navigator";
    container.setAttribute("aria-label", isArabic ? "أداة التصفح والتمرير السريع" : "Page Scroll & Navigation HUD");
    container.dataset.scrolled = "false";
    container.dataset.currentPage = pageKey;

    container.innerHTML = `
      <div class="scroll-nav-dock">
        <!-- Quick Section Jump & Progress Meter -->
        <button type="button" class="scroll-nav-btn scroll-progress-btn" id="scroll-progress-btn" title="${
          isArabic ? "نسبة تصفح الصفحة — النقر للانتقال للأسفل" : "Page Scroll Progress — Click to Jump to Bottom"
        }" aria-label="${isArabic ? "نسبة التمرير" : "Scroll percentage"}">
          <svg class="scroll-progress-svg" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="scroll-progress-bg" cx="20" cy="20" r="16" />
            <circle class="scroll-progress-bar" cx="20" cy="20" r="16" stroke-dasharray="0.0 100.53" />
          </svg>
          <span class="scroll-pct-badge" id="scroll-pct-badge">0%</span>
        </button>

        <!-- Scroll to Top Button -->
        <button type="button" class="scroll-nav-btn scroll-top-btn" id="scroll-to-top-btn" title="${
          isArabic ? "العودة إلى أعلى الصفحة" : "Scroll to Top"
        }" aria-label="${isArabic ? "العودة للأعلى" : "Scroll to Top"}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>

        <!-- Quick Page Switcher Toggle -->
        <button type="button" class="scroll-nav-btn scroll-switcher-toggle" id="scroll-switcher-toggle-btn" title="${
          isArabic ? "التنقل السريع بين الصفحات" : "Quick Page Switcher"
        }" aria-expanded="false" aria-controls="scroll-quick-menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </button>
      </div>

      <!-- Quick Switcher Popover Menu -->
      <nav class="scroll-quick-menu" id="scroll-quick-menu" aria-label="${
        isArabic ? "روابط الانتقال السريع" : "Quick Page Links"
      }">
        <div class="scroll-quick-header">
          <span class="scroll-quick-title">${isArabic ? "الانتقال السريع" : "Quick Jump"}</span>
          <span class="scroll-quick-badge">Terrax 4K</span>
        </div>
        <div class="scroll-quick-list">
          <a href="index-modern.html" class="scroll-quick-link ${pageKey === "speed" ? "active" : ""}" id="quick-link-speed">
            <span class="quick-link-icon">⚡</span>
            <div class="quick-link-info">
              <strong class="quick-link-name">${isArabic ? "فحص السرعة الأساسي" : "Speed Test"}</strong>
              <small class="quick-link-desc">${isArabic ? "قياس التنزيل والرفع والـ Ping" : "Core speed & telemetry"}</small>
            </div>
          </a>
          <a href="stability.html" class="scroll-quick-link ${pageKey === "stability" ? "active" : ""}" id="quick-link-stability">
            <span class="quick-link-icon">📊</span>
            <div class="quick-link-info">
              <strong class="quick-link-name">${isArabic ? "مراقبة الاستقرار" : "Stability Monitor"}</strong>
              <small class="quick-link-desc">${isArabic ? "فحص التذبذب والاتصال المستمر" : "Continuous stream & jitter"}</small>
            </div>
          </a>
          <a href="gaming.html" class="scroll-quick-link ${pageKey === "gaming" ? "active" : ""}" id="quick-link-gaming">
            <span class="quick-link-icon">🎮</span>
            <div class="quick-link-info">
              <strong class="quick-link-name">${isArabic ? "رادار الألعاب" : "Gaming Radar"}</strong>
              <small class="quick-link-desc">${isArabic ? "فحص خوادم الألعاب العالمية" : "Global game latency"}</small>
            </div>
          </a>
        </div>
      </nav>
    `;

    document.body.appendChild(container);
  }

  /**
   * Initialize the Scroll Navigator HUD and listeners
   */
  function init() {
    if (initialized) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    mountNavigatorMarkup();
    initialized = true;

    // Attach passive scroll and resize listeners
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync, { passive: true });

    // Setup interactive event listeners
    const navEl = document.getElementById("terrax-scroll-navigator");
    if (navEl) {
      const topBtn = navEl.querySelector("#scroll-to-top-btn");
      const progressBtn = navEl.querySelector("#scroll-progress-btn");
      const toggleBtn = navEl.querySelector("#scroll-switcher-toggle-btn");
      const quickMenu = navEl.querySelector("#scroll-quick-menu");

      if (topBtn) {
        topBtn.addEventListener("click", () => {
          smoothScrollTo(0, "smooth");
        });
      }

      if (toggleBtn && quickMenu) {
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = navEl.classList.toggle("menu-open");
          toggleBtn.setAttribute("aria-expanded", String(isOpen));
        });

        // Close menu on click outside
        document.addEventListener("click", (e) => {
          if (!navEl.contains(e.target)) {
            navEl.classList.remove("menu-open");
            toggleBtn.setAttribute("aria-expanded", "false");
          }
        });
      }

      if (progressBtn) {
        progressBtn.addEventListener("click", () => {
          const math = globalThis.TerraxTelemetryMath;
          const scrollHeight =
            document.documentElement.scrollHeight || document.body.scrollHeight || 0;
          const clientHeight =
            window.innerHeight || document.documentElement.clientHeight || 0;
          const targetY =
            math && typeof math.resolveScrollJumpTarget === "function"
              ? math.resolveScrollJumpTarget("bottom", scrollHeight, clientHeight)
              : Math.max(0, scrollHeight - clientHeight);
          smoothScrollTo(targetY, "smooth");
        });
      }

      // Quick links smooth navigation handlers
      const quickLinks = navEl.querySelectorAll(".scroll-quick-link");
      quickLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          const href = link.getAttribute("href");
          if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
            e.preventDefault();
            navigateTo(href);
          }
        });
      });
    }

    // Run initial sync
    requestSync();
  }

  /**
   * Destroy and clean up listeners
   */
  function destroy() {
    if (!initialized) return;
    initialized = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    window.removeEventListener("scroll", requestSync);
    window.removeEventListener("resize", requestSync);
    const navEl = document.getElementById("terrax-scroll-navigator");
    navEl?.remove();
  }

  const api = {
    init,
    destroy,
    syncScrollState,
    smoothScrollTo,
    navigateTo,
    getCurrentPageKey,
  };

  // Auto-initialize when document is ready in browser environments
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        init();
      });
    } else {
      init();
    }
  }

  return api;
});
