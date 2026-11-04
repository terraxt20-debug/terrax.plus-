/**
 * Terrax Plus (تيراكس بلاس) — Google AdSense Placements Manager
 *
 * Centralizes the 6 core advertising placement points:
 * 1. home (Main Speed Page inline banner)
 * 2. speedTest (Post-Test Results spotlight banner)
 * 3. stability (Stability Test companion banner)
 * 4. consumption (Data Consumption & Test History booster banner)
 * 5. servers (Measurement Servers directory banner)
 * 6. additionalContent (Gaming Latency Radar sponsor banner)
 *
 * Guarantees:
 * - Generates official Google AdSense markup: <ins class="adsbygoogle" ...></ins>
 * - Tracks empty vs filled inventory (data-ad-status) with zero CLS layout collapse
 * - Prevents duplicate .push({}) invocations on the same <ins> element
 */

import { ADSENSE_CONFIG } from './ads.config.js';
import { isValidPublisherId, normalizePublisherId, isValidSlotId } from './adsense.validator.js';
import { loadAdSenseScript } from './adsense.loader.js';

const registeredPlacements = new Map();

/**
 * Initialize default placement registry from central configuration
 */
export function initDefaultPlacements() {
  const cfgPlacements = ADSENSE_CONFIG.placements || {};
  for (const [key, p] of Object.entries(cfgPlacements)) {
    registerPlacement(key, p);
  }
}

/**
 * Register a placement definition
 */
export function registerPlacement(placementKey, placementDef) {
  if (!placementKey || !placementDef) return;
  registeredPlacements.set(placementKey, {
    ...placementDef,
    placementKey,
  });
}

/**
 * Retrieve placement by logical key or slotKey
 */
export function getPlacement(keyOrSlot) {
  if (!keyOrSlot) return null;
  if (registeredPlacements.size === 0) {
    initDefaultPlacements();
  }

  // Lookup by direct key
  if (registeredPlacements.has(keyOrSlot)) {
    return registeredPlacements.get(keyOrSlot);
  }

  // Lookup by slotKey
  for (const p of registeredPlacements.values()) {
    if (p.slotKey === keyOrSlot || p.placementIdentifier === keyOrSlot) {
      return p;
    }
  }

  return null;
}

/**
 * Retrieve all registered placements
 */
export function getAllPlacements() {
  if (registeredPlacements.size === 0) {
    initDefaultPlacements();
  }
  return Array.from(registeredPlacements.values());
}

/**
 * Mount and push a manual Google AdSense <ins> unit into a DOM container
 *
 * @param {HTMLElement} container DOM element to host the unit
 * @param {string} placementKey Logical key (e.g., 'home', 'speedTest') or slot key
 * @param {Object} [options]
 * @param {string} [options.publisherId]
 * @param {boolean} [options.isTesting]
 * @returns {boolean} Whether mounting was initiated
 */
export function mountAdSenseUnit(container, placementKey, options = {}) {
  if (!container || typeof document === 'undefined') return false;
  const isTesting = options.isTesting ?? false;

  // Smart Ad Lock: Never mount/push while active speed test is running
  if (isTesting) {
    container.classList.add('smart-ad-locked');
    return false;
  }

  const placement = getPlacement(placementKey);
  const publisherId = normalizePublisherId(options.publisherId || ADSENSE_CONFIG.publisherId);
  const slotId = placement ? placement.adSlotId : '';

  // Only render official AdSense <ins> when both publisherId and slotId are verified & valid
  if (!isValidPublisherId(publisherId) || !isValidSlotId(slotId)) {
    // Unfilled/unconfigured state: Ensure container collapses cleanly
    container.setAttribute('data-ad-filled', 'false');
    container.setAttribute('data-ad-status', 'unfilled');
    return false;
  }

  // Ensure AdSense library is loaded
  loadAdSenseScript({ publisherId, isTesting });

  // Check if an existing <ins> unit is already mounted inside this container
  let insEl = container.querySelector('ins.adsbygoogle');
  if (insEl) {
    if (
      insEl.getAttribute('data-ad-client') === publisherId &&
      insEl.getAttribute('data-ad-slot') === slotId &&
      (insEl.getAttribute('data-terrax-pushed') === 'true' || insEl.getAttribute('data-adsbygoogle-status'))
    ) {
      return true; // already successfully initialized
    }
  } else {
    insEl = document.createElement('ins');
    insEl.className = 'adsbygoogle';
    insEl.style.display = 'block';
    insEl.setAttribute('data-ad-client', publisherId);
    insEl.setAttribute('data-ad-slot', slotId);
    insEl.setAttribute('data-ad-format', placement.adFormat || 'auto');
    if (placement.fullWidthResponsive) {
      insEl.setAttribute('data-full-width-responsive', 'true');
    }
    container.innerHTML = '';
    container.appendChild(insEl);
  }

  // Observe Google AdSense inventory delivery (filled vs unfilled)
  observeAdSenseStatus(insEl, container);

  try {
    if (typeof window !== 'undefined') {
      window.adsbygoogle = window.adsbygoogle || [];
      if (insEl.getAttribute('data-terrax-pushed') !== 'true') {
        insEl.setAttribute('data-terrax-pushed', 'true');
        window.adsbygoogle.push({});
      }
    }
    return true;
  } catch {
    container.setAttribute('data-ad-filled', 'false');
    container.setAttribute('data-ad-status', 'unfilled');
    return false;
  }
}

/**
 * Observe data-ad-status on <ins.adsbygoogle> to handle filled vs unfilled states with zero-CLS
 */
function observeAdSenseStatus(insEl, container) {
  if (!insEl || !container || typeof MutationObserver === 'undefined') return;
  if (insEl._terraxObserverBound) return;
  insEl._terraxObserverBound = true;

  const observer = new MutationObserver(() => {
    const status = insEl.getAttribute('data-ad-status');
    if (status === 'filled') {
      container.setAttribute('data-ad-filled', 'true');
      container.setAttribute('data-ad-status', 'filled');
      container.classList.add('ad-filled');
      container.style.display = 'flex';
    } else if (status === 'unfilled') {
      container.setAttribute('data-ad-filled', 'false');
      container.setAttribute('data-ad-status', 'unfilled');
      container.classList.remove('ad-filled');
      container.style.display = 'none';
    }
  });

  observer.observe(insEl, {
    attributes: true,
    attributeFilter: ['data-ad-status', 'data-adsbygoogle-status'],
  });
}

// Auto-initialize default placements registry
initDefaultPlacements();

if (typeof window !== 'undefined') {
  window.TerraxAdSensePlacements = {
    initDefaultPlacements,
    registerPlacement,
    getPlacement,
    getAllPlacements,
    mountAdSenseUnit,
  };
}

export default {
  initDefaultPlacements,
  registerPlacement,
  getPlacement,
  getAllPlacements,
  mountAdSenseUnit,
};
