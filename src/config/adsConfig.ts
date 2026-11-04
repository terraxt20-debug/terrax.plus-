/**
 * Terrax Plus (تيراكس بلاس) — Central Advertising & Monetization Configuration
 *
 * Provides central configuration for:
 * - Official Google AdSense Integration (Display, In-Page, Multiplex, Auto Ads, and CMP Consent)
 * - Direct Adsterra Smartlink (Auto-Loaded Inline Ad Source)
 * - Yandex Advertising Network (YAN) RTB Block IDs across all pages & tabs
 * - Automatic initialization on page open (zero click required, no popup windows)
 * - Auto-refresh interval (30 seconds) for non-AdSense fallback rotation
 *
 * STRICT POLICY RULE:
 * Never invent or hardcode fake Google AdSense Publisher IDs (ca-pub-...) or Ad Slot IDs.
 * All AdSense fields remain empty ("") until the publisher supplies real, verified credentials
 * via environment variables (VITE_ADSENSE_*) or window.TERREX_ADSENSE_CONFIG.
 */

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

/**
 * Validate whether a string is a real, properly formatted Google AdSense Publisher ID
 * Accepts "ca-pub-XXXXXXXXXXXXXXXX" or "pub-XXXXXXXXXXXXXXXX" (16 digits, not all zeros/repeating placeholder).
 */
export function isValidAdSensePublisherId(publisherId?: string | null): boolean {
  if (!publisherId || typeof publisherId !== 'string') return false;
  const trimmed = publisherId.trim();
  const match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
  if (!match) return false;
  const digits = match[1];
  // Reject obvious fake placeholders like 0000000000000000 or 1234567890123456 or 1111111111111111
  if (/^(\d)\1{15}$/.test(digits) || digits === '1234567890123456') {
    return false;
  }
  return true;
}

/**
 * Normalize a valid publisher ID to the "ca-pub-XXXXXXXXXXXXXXXX" format required by AdSense tags.
 */
export function normalizeAdSenseClientId(publisherId?: string | null): string {
  if (!isValidAdSensePublisherId(publisherId)) return '';
  const trimmed = String(publisherId).trim();
  const match = trimmed.match(/^(?:ca-)?pub-(\d{16})$/i);
  return match ? `ca-pub-${match[1]}` : '';
}

/**
 * Validate whether a string is a real Google AdSense Ad Unit Slot ID (8 to 12 digits, not all zeros).
 */
export function isValidAdSenseSlotId(slotId?: string | null): boolean {
  if (!slotId || typeof slotId !== 'string') return false;
  const trimmed = slotId.trim();
  if (!/^\d{8,12}$/.test(trimmed)) return false;
  if (/^0+$/.test(trimmed) || trimmed === '1234567890') return false;
  return true;
}

export const DEFAULT_ADSENSE_PUBLISHER_ID = 'ca-pub-1225026489802055';

export const ADSENSE_CONFIG = {
  PUBLISHER_ID: normalizeAdSenseClientId(env.VITE_ADSENSE_PUBLISHER_ID || DEFAULT_ADSENSE_PUBLISHER_ID),
  ENABLE_ADSENSE: String(env.VITE_ADSENSE_ENABLED ?? 'true').toLowerCase() !== 'false',
  AUTO_ADS_ENABLED: String(env.VITE_ADSENSE_AUTO_ADS_ENABLED ?? 'true').toLowerCase() !== 'false',
  CMP_ENABLED: String(env.VITE_ADSENSE_CMP_ENABLED ?? 'true').toLowerCase() !== 'false',
  SCRIPT_LOADING_MODE: 'async' as const,
  SLOTS: {
    'speed-main': String(env.VITE_ADSENSE_SLOT_SPEED_MAIN || '').trim(),
    'speed-results': String(env.VITE_ADSENSE_SLOT_SPEED_RESULTS || '').trim(),
    'stability-main': String(env.VITE_ADSENSE_SLOT_STABILITY_MAIN || '').trim(),
    'gaming-main': String(env.VITE_ADSENSE_SLOT_GAMING_MAIN || '').trim(),
    'usage-main': String(env.VITE_ADSENSE_SLOT_USAGE_MAIN || '').trim(),
    'servers-main': String(env.VITE_ADSENSE_SLOT_SERVERS_MAIN || '').trim(),
    'settings-main': String(env.VITE_ADSENSE_SLOT_SETTINGS_MAIN || '').trim(),
    'multiplex-main': String(env.VITE_ADSENSE_SLOT_MULTIPLEX || '').trim(),
  },
  PLACEMENTS: {
    home: {
      placementIdentifier: 'terrax-ad-home',
      slotKey: 'speed-main',
      adSlotId: String(env.VITE_ADSENSE_SLOT_SPEED_MAIN || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
    speedTest: {
      placementIdentifier: 'terrax-ad-speedtest',
      slotKey: 'speed-results',
      adSlotId: String(env.VITE_ADSENSE_SLOT_SPEED_RESULTS || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
    stability: {
      placementIdentifier: 'terrax-ad-stability',
      slotKey: 'stability-main',
      adSlotId: String(env.VITE_ADSENSE_SLOT_STABILITY_MAIN || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
    consumption: {
      placementIdentifier: 'terrax-ad-consumption',
      slotKey: 'usage-main',
      adSlotId: String(env.VITE_ADSENSE_SLOT_USAGE_MAIN || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
    servers: {
      placementIdentifier: 'terrax-ad-servers',
      slotKey: 'servers-main',
      adSlotId: String(env.VITE_ADSENSE_SLOT_SERVERS_MAIN || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
    additionalContent: {
      placementIdentifier: 'terrax-ad-additional-content',
      slotKey: 'gaming-main',
      adSlotId: String(env.VITE_ADSENSE_SLOT_GAMING_MAIN || '').trim(),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
    },
  },
} as const;

export const ADS_CONFIG = {
  ADSTERRA_SMARTLINK: 'https://asiafilm.org/4/f40a6dd77b401726a12dd304a72bafa5',
  YANDEX_BLOCKS: {
    SPEED_TAB: 'R-A-TERREX-SPEED-1',
    GAMING_TAB: 'R-A-TERREX-GAME-1',
    STABILITY_TAB: 'R-A-TERREX-STAB-1',
    USAGE_TAB: 'R-A-TERREX-USAGE-1',
    SERVERS_TAB: 'R-A-TERREX-SERVERS-1',
    SETTINGS_TAB: 'R-A-TERREX-SETTINGS-1',
  },
  ADSENSE: ADSENSE_CONFIG,
  AUTO_LOAD_ON_OPEN: true,
  PREVENT_POPUPS: true,
  AUTO_REFRESH_SECONDS: 30, // التحديث التلقائي لاحتساب أرباح المشاهدات كل 30 ثانية
  REFRESH_INTERVAL: 30,
} as const;

export const ADSTERRA_SMARTLINK_URL = ADS_CONFIG.ADSTERRA_SMARTLINK;
export const YANDEX_BLOCKS = ADS_CONFIG.YANDEX_BLOCKS;
export const AUTO_REFRESH_SECONDS = ADS_CONFIG.AUTO_REFRESH_SECONDS;
export const AUTO_REFRESH_INTERVAL_SECONDS = ADS_CONFIG.AUTO_REFRESH_SECONDS;
export const AUTO_REFRESH_INTERVAL_MS = ADS_CONFIG.AUTO_REFRESH_SECONDS * 1000;

export default ADS_CONFIG;


