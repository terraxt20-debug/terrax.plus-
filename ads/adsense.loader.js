/**
 * Terrax Plus (تيراكس بلاس) — Official Google AdSense Script Loader
 *
 * Implements Google's official asynchronous tag loader specification:
 * <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-..." crossorigin="anonymous"></script>
 *
 * Guarantees:
 * 1. Asynchronous execution (never blocks DOM parsing or app bootstrap)
 * 2. Strict duplicate prevention (singleton script guarantee)
 * 3. Smart Ad Lock adherence (never loads during active speed tests)
 * 4. Safety: does not load if publisher ID is placeholder/unconfigured
 * 5. Official <meta name="google-adsense-account"> verification injection
 */

import { ADSENSE_CONFIG } from './ads.config.js';
import { isValidPublisherId, normalizePublisherId } from './adsense.validator.js';

let scriptLoadPromise = null;
let scriptLoadedSuccessfully = false;

/**
 * Check whether the official Google AdSense script is already attached or loaded
 */
export function isAdSenseScriptPresent() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.getElementById('terrax-adsense-sdk-runtime') ||
      document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')
  );
}

/**
 * Ensure official Google AdSense publisher account verification meta tag exists in <head>
 */
export function ensurePublisherAccountMeta(publisherId) {
  const validId = normalizePublisherId(publisherId || ADSENSE_CONFIG.publisherId);
  if (!validId || typeof document === 'undefined' || !document.head) {
    return false;
  }

  let meta = document.querySelector('meta[name="google-adsense-account"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'google-adsense-account');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', validId);
  return true;
}

/**
 * Load the official Google AdSense JavaScript library asynchronously
 *
 * @param {Object} options
 * @param {string} [options.publisherId]
 * @param {boolean} [options.force]
 * @param {boolean} [options.isTesting] Smart Ad Lock flag
 * @returns {Promise<boolean>}
 */
export function loadAdSenseScript(options = {}) {
  const publisherId = options.publisherId || ADSENSE_CONFIG.publisherId;
  const isTesting = options.isTesting ?? false;
  const normalizedId = normalizePublisherId(publisherId);

  // Guard 1: Server-side or non-DOM environment
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  // Guard 2: Smart Ad Lock — Never load while test is running
  if (isTesting) {
    return Promise.resolve(false);
  }

  // Guard 3: Offline detection
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve(false);
  }

  // Guard 4: Require valid, verified Publisher ID (prevent 400 Bad Request on placeholders)
  if (!isValidPublisherId(normalizedId)) {
    return Promise.resolve(false);
  }

  // Ensure publisher verification meta tag in <head>
  ensurePublisherAccountMeta(normalizedId);

  // Guard 5: Singleton script deduplication
  if (isAdSenseScriptPresent()) {
    scriptLoadedSuccessfully = true;
    return Promise.resolve(true);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve) => {
    try {
      // Initialize window.adsbygoogle queue
      window.adsbygoogle = window.adsbygoogle || [];

      const script = document.createElement('script');
      script.id = 'terrax-adsense-sdk-runtime';
      script.async = true;
      script.crossOrigin = 'anonymous';

      const scriptBase = ADSENSE_CONFIG.scriptUrl || 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.src = `${scriptBase}?client=${encodeURIComponent(normalizedId)}`;

      script.onload = () => {
        scriptLoadedSuccessfully = true;
        resolve(true);
      };

      script.onerror = () => {
        scriptLoadedSuccessfully = false;
        scriptLoadPromise = null; // allow retry if network recovers
        resolve(false);
      };

      const target = document.head || document.documentElement;
      target.appendChild(script);
    } catch {
      scriptLoadedSuccessfully = false;
      scriptLoadPromise = null;
      resolve(false);
    }
  });

  return scriptLoadPromise;
}

/**
 * Check whether the library has successfully finished loading
 */
export function isAdSenseLoaded() {
  return scriptLoadedSuccessfully && typeof window !== 'undefined' && Boolean(window.adsbygoogle);
}

if (typeof window !== 'undefined') {
  window.TerraxAdSenseLoader = {
    loadAdSenseScript,
    isAdSenseScriptPresent,
    isAdSenseLoaded,
    ensurePublisherAccountMeta,
  };
}

export default {
  loadAdSenseScript,
  isAdSenseScriptPresent,
  isAdSenseLoaded,
  ensurePublisherAccountMeta,
};
