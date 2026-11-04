/**
 * Terrax Plus (تيraكس بلاس) — Google AdSense Lifecycle Manager
 *
 * Guarantees:
 * 1. Safe, single initialization on DOMContentLoaded / window load
 * 2. SPA navigation & View Transitions compatibility without duplicate script injection
 * 3. Observer and timer cleanup on pagehide / beforeunload / route change
 * 4. Automatic pause/resume synchronization with Smart Ad Lock
 */

import { getAllPlacements, mountAdSenseUnit } from './adsense.placements.js';

let lifecycleInitialized = false;
const activeObservers = [];

/**
 * Scan DOM and mount configured AdSense units in their respective containers
 * @param {Object} [options]
 * @param {boolean} [options.isTesting]
 */
export function mountAllRegisteredContainers(options = {}) {
  if (typeof document === 'undefined') return 0;
  const isTesting = options.isTesting ?? false;
  let mountedCount = 0;

  const placements = getAllPlacements();
  for (const placement of placements) {
    const selector = [
      `#${placement.placementIdentifier}`,
      `#terrax-smart-ad-${placement.slotKey}`,
      `[data-terrax-smart-ad="${placement.slotKey}"]`,
      `[data-terrax-placement="${placement.placementKey}"]`,
    ].join(',');

    const containers = document.querySelectorAll(selector);
    for (const container of containers) {
      const initiated = mountAdSenseUnit(container, placement.placementKey, { isTesting });
      if (initiated) mountedCount++;
    }
  }

  return mountedCount;
}

/**
 * Attach lifecycle hooks across standard browser events
 * @param {Object} [options]
 * @param {Function} [options.onTestStateChange]
 */
export function initAdSenseLifecycle(options = {}) {
  if (lifecycleInitialized || typeof window === 'undefined') return;
  lifecycleInitialized = true;

  const handlePageReady = () => {
    mountAllRegisteredContainers();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handlePageReady, { once: true });
  } else {
    handlePageReady();
  }

  // SPA navigation & View Transition listener
  window.addEventListener('popstate', () => {
    mountAllRegisteredContainers();
  });

  // Re-initialize on pageshow (e.g. back/forward cache navigation)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      mountAllRegisteredContainers();
    }
  });

  // Clean up observers and timers on pagehide to prevent memory leaks
  window.addEventListener('pagehide', () => {
    cleanupAdSenseLifecycle();
  });
}

/**
 * Clean up active observers
 */
export function cleanupAdSenseLifecycle() {
  while (activeObservers.length > 0) {
    const obs = activeObservers.pop();
    if (obs && typeof obs.disconnect === 'function') {
      obs.disconnect();
    }
  }
}

if (typeof window !== 'undefined') {
  window.TerraxAdSenseLifecycle = {
    initAdSenseLifecycle,
    mountAllRegisteredContainers,
    cleanupAdSenseLifecycle,
  };
}

export default {
  initAdSenseLifecycle,
  mountAllRegisteredContainers,
  cleanupAdSenseLifecycle,
};
