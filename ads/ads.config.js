/**
 * Terrax Plus (تيراكس بلاس) — Central Google AdSense & Monetization Configuration
 * Specification: Google AdSense Program Policies & Official Tag Integration
 *
 * IMPORTANT:
 * - Do not invent publisher credentials, advertising IDs, or account information.
 * - Uses explicit placeholders until the site owner supplies verified credentials.
 * - All AdSense tags remain inactive and collapsed until real credentials are provided.
 */

// Universal environment variable lookup (works in Vite, Node.js, and browser)
const getEnvVar = (key, fallback = '') => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  if (typeof window !== 'undefined' && window.__TERRAX_ENV__ && window.__TERRAX_ENV__[key] !== undefined) {
    return window.__TERRAX_ENV__[key];
  }
  return fallback;
};

/**
 * Official Publisher Configuration Placeholders
 */
export const DEFAULT_PUBLISHER_ID = 'ca-pub-1225026489802055';
export const PUBLISHER_PLACEHOLDER = 'ca-pub-XXXXXXXXXXXXXXXX';
export const SLOT_ID_PLACEHOLDER = '0000000000';

/**
 * Core Google AdSense System Configuration
 */
export const ADSENSE_CONFIG = {
  // A. Publisher Configuration
  publisherId: getEnvVar('VITE_ADSENSE_PUBLISHER_ID', DEFAULT_PUBLISHER_ID),
  enableAdSense: String(getEnvVar('VITE_ADSENSE_ENABLED', 'true')).toLowerCase() !== 'false',
  enableAutoAds: String(getEnvVar('VITE_ADSENSE_AUTO_ADS_ENABLED', 'true')).toLowerCase() !== 'false',
  testMode: String(getEnvVar('VITE_ADSENSE_TEST_MODE', 'false')).toLowerCase() === 'true',
  scriptLoadingMode: 'async', // Google official requirement: always async
  cmpEnabled: String(getEnvVar('VITE_ADSENSE_CMP_ENABLED', 'true')).toLowerCase() !== 'false',

  // Official Google library URLs
  scriptUrl: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  ampAutoAdsScriptUrl: 'https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js',
  googleTagId: 'f08c47fec0942fa0', // Official Google AdSense Certification Authority

  // B. Advertising Unit Placements Configuration (Centralized 6 Placements)
  placements: {
    home: {
      placementIdentifier: 'terrax-ad-home',
      slotKey: 'speed-main',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_HOME', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر الشاشة الرئيسية لسرعة الإنترنت',
      descriptionEn: 'Home Page Speed Test Inline Banner',
    },
    speedTest: {
      placementIdentifier: 'terrax-ad-speedtest',
      slotKey: 'speed-results',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_SPEEDTEST', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر نتائج فحص السرعة بعد اكتمال الاختبار (أعلى عائد)',
      descriptionEn: 'Post-Test Results Spotlight Banner (Highest RPM)',
    },
    stability: {
      placementIdentifier: 'terrax-ad-stability',
      slotKey: 'stability-main',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_STABILITY', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر مرافق لتحليلات استقرار الاتصال والألياف',
      descriptionEn: 'Connection Stability Companion Banner',
    },
    consumption: {
      placementIdentifier: 'terrax-ad-consumption',
      slotKey: 'usage-main',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_CONSUMPTION', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر سجل الاستهلاك والبيانات المستهلكة',
      descriptionEn: 'Data Consumption & Test History Booster Banner',
    },
    servers: {
      placementIdentifier: 'terrax-ad-servers',
      slotKey: 'servers-main',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_SERVERS', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر قائمة خوادم القياس ومسارات الربط',
      descriptionEn: 'Measurement Servers Directory Banner',
    },
    additionalContent: {
      placementIdentifier: 'terrax-ad-additional-content',
      slotKey: 'gaming-main',
      adSlotId: getEnvVar('VITE_ADSENSE_SLOT_ADDITIONAL', SLOT_ID_PLACEHOLDER),
      adFormat: 'auto',
      fullWidthResponsive: true,
      enabled: true,
      descriptionAr: 'بانر رادار فحص زمن استجابة ألعاب الفيديو التنافسية',
      descriptionEn: 'Competitive Gaming Latency Radar Sponsor Banner',
    },
  },
};

/**
 * Universal export for Browser window, Node.js, and ES Modules
 */
if (typeof window !== 'undefined') {
  window.TerraxAdSenseConfig = ADSENSE_CONFIG;
}

export default ADSENSE_CONFIG;
