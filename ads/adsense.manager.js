/**
 * Terrax Plus (تيراكس بلاس) — Google AdSense Central Manager
 *
 * Implements the complete orchestrator for:
 * 1. Configuration & Validator enforcement
 * 2. Official asynchronous loader
 * 3. 6 Placement points management
 * 4. Smart Ad Lock state machine (READY, RUNNING, FINISHED, ERROR)
 * 5. Lifecycle & SPA navigation integration
 * 6. Google Consent Mode v2 & diagnostics
 */

import { ADSENSE_CONFIG } from './ads.config.js';
import {
  validateAdSenseConfig,
  isValidPublisherId,
  normalizePublisherId,
  isValidSlotId,
} from './adsense.validator.js';
import { loadAdSenseScript, isAdSenseScriptPresent, isAdSenseLoaded } from './adsense.loader.js';
import {
  getAllPlacements,
  getPlacement,
  mountAdSenseUnit,
  registerPlacement,
} from './adsense.placements.js';
import {
  initAdSenseLifecycle,
  mountAllRegisteredContainers,
  cleanupAdSenseLifecycle,
} from './adsense.lifecycle.js';
import {
  initGoogleConsentModeDefaults,
  getSavedConsentChoice,
  saveConsentChoice,
  isRegulatedPrivacyRegion,
} from './adsense.consent.js';
import { generateAdSenseDiagnostics } from './adsense.diagnostics.js';

class TerraxAdSenseManager {
  constructor() {
    this.config = ADSENSE_CONFIG;
    this.testEngineState = 'READY'; // 'READY' | 'RUNNING' | 'FINISHED' | 'ERROR'
    this.isTesting = false;
    this.pendingAdLoadAfterTest = false;
    this.lastTestError = null;
    this.initialized = false;
  }

  /**
   * Initialize the advertising system
   */
  init(customConfig = {}) {
    if (this.initialized) return this;
    this.initialized = true;

    if (customConfig && typeof customConfig === 'object') {
      Object.assign(this.config, customConfig);
    }

    // 1. Initialize Consent Mode v2 signals
    initGoogleConsentModeDefaults();

    // 2. Validate configuration
    const validation = validateAdSenseConfig(this.config);

    // 3. Pre-load official library if verified publisherId exists and Auto Ads are enabled
    if (
      this.config.enableAdSense &&
      isValidPublisherId(this.config.publisherId) &&
      !this.isTesting
    ) {
      loadAdSenseScript({
        publisherId: this.config.publisherId,
        isTesting: this.isTesting,
      });
    }

    // 4. Attach lifecycle hooks
    initAdSenseLifecycle();

    return this;
  }

  /**
   * Set Smart Ad Lock Engine State (READY, RUNNING, FINISHED, ERROR)
   * Protects network telemetry during active speed/stability/gaming tests
   */
  setEngineTestState(state, errorMeta = null) {
    const validStates = ['READY', 'RUNNING', 'FINISHED', 'ERROR'];
    const nextState = validStates.includes(state) ? state : 'READY';
    this.testEngineState = nextState;
    this.isTesting = nextState === 'RUNNING';

    if (nextState === 'ERROR') {
      this.lastTestError = errorMeta;
    } else if (nextState === 'READY' || nextState === 'FINISHED') {
      this.lastTestError = null;
    }

    // Pause or resume Google AdSense runtime ad requests to isolate Web Worker bandwidth
    if (typeof window !== 'undefined') {
      window.adsbygoogle = window.adsbygoogle || [];
      const savedConsent = getSavedConsentChoice();
      window.adsbygoogle.pauseAdRequests =
        this.isTesting || savedConsent === 'rejected' ? 1 : 0;
    }

    // Update DOM containers to reflect locked state
    if (typeof document !== 'undefined') {
      const adContainers = document.querySelectorAll(
        '.terrax-adsense-container, .terrax-smart-ad-slot, .terrax-smart-banner'
      );
      for (const container of adContainers) {
        container.classList.toggle('smart-ad-locked', this.isTesting);
        container.setAttribute('data-testing', this.isTesting ? 'true' : 'false');
        container.setAttribute('data-engine-test-state', nextState);
      }
    }

    // If transitioning from RUNNING -> FINISHED, fulfill pending ad refreshes
    if (nextState === 'FINISHED' && this.pendingAdLoadAfterTest) {
      this.pendingAdLoadAfterTest = false;
      this.onTestComplete('speed');
    }

    return {
      testEngineState: this.testEngineState,
      isTesting: this.isTesting,
    };
  }

  /**
   * Compatibility alias for setEngineTestState
   */
  setTestingState(isTesting) {
    return this.setEngineTestState(isTesting ? 'RUNNING' : 'READY');
  }

  /**
   * Hook called immediately upon test completion
   */
  onTestComplete(testKind = 'speed') {
    this.setEngineTestState('FINISHED');

    // High-yield post-test spotlight: render the speed-results ad slot
    if (typeof document !== 'undefined') {
      const resultsSlot = document.querySelector(
        '#terrax-smart-ad-speed-results, [data-terrax-smart-ad="speed-results"]'
      );
      if (resultsSlot) {
        mountAdSenseUnit(resultsSlot, 'speedTest', {
          isTesting: false,
          publisherId: this.config.publisherId,
        });
      }
    }

    return true;
  }

  /**
   * Hook called on test error
   */
  onTestError(err) {
    this.setEngineTestState('ERROR', err);
    return err;
  }

  /**
   * Hook called on tab change (SPA navigation)
   */
  onTabChange(tabKey) {
    if (this.isTesting) {
      this.pendingAdLoadAfterTest = true;
      return false;
    }
    mountAllRegisteredContainers({ isTesting: false });
    return true;
  }

  /**
   * Refresh all ad slots safely (suppressed during active tests)
   */
  refreshAllSlots(reason = 'manual') {
    if (this.isTesting) {
      this.pendingAdLoadAfterTest = true;
      return false;
    }
    mountAllRegisteredContainers({ isTesting: false });
    return true;
  }

  /**
   * User privacy consent setter
   */
  setConsentChoice(choice) {
    return saveConsentChoice(choice);
  }

  /**
   * Return full diagnostic payload
   */
  getDiagnostics() {
    return generateAdSenseDiagnostics({
      isTesting: this.isTesting,
      testEngineState: this.testEngineState,
    });
  }

  /**
   * Return current manager state
   */
  getState() {
    return {
      initialized: this.initialized,
      testEngineState: this.testEngineState,
      isTesting: this.isTesting,
      pendingAdLoadAfterTest: this.pendingAdLoadAfterTest,
      publisherId: this.config.publisherId,
      scriptLoaded: isAdSenseLoaded() || isAdSenseScriptPresent(),
    };
  }
}

// Global Singleton Instance
export const AdSenseManager = new TerraxAdSenseManager();

// Automatically attach to window for browser usage
if (typeof window !== 'undefined') {
  window.TerraxAdSense = AdSenseManager;
  // Initialize automatically on script load
  AdSenseManager.init();
}

export default AdSenseManager;
