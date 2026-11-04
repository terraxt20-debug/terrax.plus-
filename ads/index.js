/**
 * Terrax Plus (تيراكس بلاس) — Google AdSense Infrastructure Package
 *
 * Exports all advertising subsystems:
 * - ads.config.js: Configuration & placeholders
 * - adsense.validator.js: Strict ID and placement validation
 * - adsense.loader.js: Official async script loader
 * - adsense.placements.js: 6 Manual placement points
 * - adsense.lifecycle.js: SPA navigation & lifecycle hooks
 * - adsense.consent.js: Google Consent Mode v2 & CMP
 * - adsense.diagnostics.js: Technical readiness report
 * - adsense.manager.js: Central orchestrator & Smart Ad Lock
 */

export * from './ads.config.js';
export * from './adsense.validator.js';
export * from './adsense.loader.js';
export * from './adsense.placements.js';
export * from './adsense.lifecycle.js';
export * from './adsense.consent.js';
export * from './adsense.diagnostics.js';
export * from './adsense.manager.js';

import { AdSenseManager } from './adsense.manager.js';
export default AdSenseManager;
