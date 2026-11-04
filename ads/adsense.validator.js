/**
 * Terrax Plus (تيراكس بلاس) — Google AdSense Configuration Validator
 *
 * Implements strict, production-grade validation for:
 * 1. Publisher ID format (ca-pub-XXXXXXXXXXXXXXXX)
 * 2. Ad Slot IDs (8-12 digits)
 * 3. Centralized placement definitions & deduplication
 * 4. Technical integration diagnostic states (READY, PENDING, FAILED)
 *
 * Guaranteed Privacy: Never exposes secret keys or full credentials in diagnostics.
 */

import { PUBLISHER_PLACEHOLDER, SLOT_ID_PLACEHOLDER } from './ads.config.js';

const VALID_AD_FORMATS = new Set([
  'auto',
  'rectangle',
  'horizontal',
  'vertical',
  'fluid',
  'autorelaxed',
]);

/**
 * Validate whether a string is a real, non-placeholder Google AdSense Publisher ID
 * Matches official Google specification: ca-pub-XXXXXXXXXXXXXXXX (16 numeric digits)
 */
export function isValidPublisherId(publisherId) {
  if (!publisherId || typeof publisherId !== 'string') return false;
  const trimmed = publisherId.trim();

  // Reject explicit placeholders
  if (
    trimmed === PUBLISHER_PLACEHOLDER ||
    trimmed === 'ca-pub-0000000000000000' ||
    trimmed === 'pub-0000000000000000' ||
    trimmed.includes('XXXX')
  ) {
    return false;
  }

  const match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
  if (!match) return false;

  const digits = match[1];
  // Reject repetitive fake placeholders like 1111111111111111 or sequential 1234567890123456
  if (/^(\d)\1{15}$/.test(digits) || digits === '1234567890123456') {
    return false;
  }

  return true;
}

/**
 * Normalize a valid Publisher ID to official "ca-pub-XXXXXXXXXXXXXXXX" tag format
 */
export function normalizePublisherId(publisherId) {
  if (!isValidPublisherId(publisherId)) return '';
  const trimmed = String(publisherId).trim();
  const match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
  return match ? `ca-pub-${match[1]}` : '';
}

/**
 * Mask Publisher ID for safe public diagnostic reporting (e.g., "ca-pub-1234********5678")
 */
export function maskPublisherId(publisherId) {
  const normalized = normalizePublisherId(publisherId);
  if (!normalized) return 'UNCONFIGURED (PENDING)';
  return normalized.replace(/^(ca-pub-\d{4})\d{8}(\d{4})$/, '$1********$2');
}

/**
 * Validate whether a string is a valid Google AdSense Ad Slot ID (8-12 digits, non-placeholder)
 */
export function isValidSlotId(slotId) {
  if (!slotId || typeof slotId !== 'string') return false;
  const trimmed = slotId.trim();

  // Reject placeholder values
  if (
    trimmed === SLOT_ID_PLACEHOLDER ||
    trimmed === '0000000000' ||
    trimmed === '1234567890' ||
    trimmed.includes('X')
  ) {
    return false;
  }

  if (!/^\d{8,12}$/.test(trimmed)) return false;
  if (/^0+$/.test(trimmed)) return false;

  return true;
}

/**
 * Validate an individual placement configuration object
 */
export function validatePlacementConfig(placementKey, placement) {
  const errors = [];
  const warnings = [];

  if (!placement || typeof placement !== 'object') {
    return {
      valid: false,
      status: 'FAILED',
      errors: [`Placement '${placementKey}' is not an object`],
      warnings,
    };
  }

  if (!placement.placementIdentifier || typeof placement.placementIdentifier !== 'string') {
    errors.push(`Placement '${placementKey}' missing required 'placementIdentifier'`);
  }

  if (!placement.adFormat || !VALID_AD_FORMATS.has(placement.adFormat)) {
    errors.push(
      `Placement '${placementKey}' has invalid adFormat '${placement.adFormat}'. Allowed: ${Array.from(
        VALID_AD_FORMATS
      ).join(', ')}`
    );
  }

  const slotValid = isValidSlotId(placement.adSlotId);
  if (!slotValid) {
    warnings.push(
      `Placement '${placementKey}' adSlotId is unconfigured or a placeholder (${placement.adSlotId || 'empty'}).`
    );
  }

  return {
    valid: errors.length === 0,
    status: errors.length > 0 ? 'FAILED' : slotValid ? 'READY' : 'PENDING',
    errors,
    warnings,
  };
}

/**
 * Comprehensive Validation of the Entire Google AdSense Configuration
 */
export function validateAdSenseConfig(config) {
  const issues = [];
  const warnings = [];
  const placementsStatus = {};

  if (!config) {
    return {
      overallStatus: 'FAILED',
      isReadyForProduction: false,
      issues: ['Configuration object is null or undefined.'],
      warnings: [],
      placements: {},
    };
  }

  // 1. Publisher ID validation
  const pubValid = isValidPublisherId(config.publisherId);
  if (!pubValid) {
    if (config.publisherId === PUBLISHER_PLACEHOLDER || !config.publisherId) {
      warnings.push(
        'Google AdSense Publisher ID is currently unconfigured (using explicit placeholder). Production delivery requires a verified ca-pub-XXXXXXXXXXXXXXXX.'
      );
    } else {
      issues.push(`Invalid Google AdSense Publisher ID format: '${maskPublisherId(config.publisherId)}'`);
    }
  }

  // 2. Script loading mode validation
  if (config.scriptLoadingMode !== 'async') {
    issues.push("Google AdSense official integration requires scriptLoadingMode: 'async'.");
  }

  // 3. Placements validation & duplicate detection
  const seenIdentifiers = new Set();
  const placements = config.placements || {};
  let totalPlacements = 0;
  let readyPlacements = 0;
  let pendingPlacements = 0;

  for (const [key, placement] of Object.entries(placements)) {
    totalPlacements++;
    const res = validatePlacementConfig(key, placement);

    // Duplicate identifier detection
    if (placement && placement.placementIdentifier) {
      if (seenIdentifiers.has(placement.placementIdentifier)) {
        res.errors.push(`Duplicate placementIdentifier detected: '${placement.placementIdentifier}'`);
        res.valid = false;
        res.status = 'FAILED';
      } else {
        seenIdentifiers.add(placement.placementIdentifier);
      }
    }

    if (res.status === 'READY') readyPlacements++;
    if (res.status === 'PENDING') pendingPlacements++;
    if (res.errors.length > 0) issues.push(...res.errors);
    if (res.warnings.length > 0) warnings.push(...res.warnings);

    placementsStatus[key] = res;
  }

  // Calculate overall integration status
  let overallStatus = 'READY';
  if (issues.length > 0) {
    overallStatus = 'FAILED';
  } else if (!pubValid || pendingPlacements > 0 || !config.enableAdSense) {
    overallStatus = 'PENDING';
  }

  return {
    overallStatus,
    isReadyForProduction: overallStatus === 'READY',
    publisherId: maskPublisherId(config.publisherId),
    enableAdSense: Boolean(config.enableAdSense),
    enableAutoAds: Boolean(config.enableAutoAds),
    totalPlacements,
    readyPlacements,
    pendingPlacements,
    issues,
    warnings,
    placements: placementsStatus,
  };
}

if (typeof window !== 'undefined') {
  window.TerraxAdSenseValidator = {
    isValidPublisherId,
    normalizePublisherId,
    isValidSlotId,
    validatePlacementConfig,
    validateAdSenseConfig,
  };
}

export default {
  isValidPublisherId,
  normalizePublisherId,
  isValidSlotId,
  validatePlacementConfig,
  validateAdSenseConfig,
};
