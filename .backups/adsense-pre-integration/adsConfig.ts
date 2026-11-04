/**
 * Terrax Plus (تيراكس بلاس) — Central Advertising & Smartlink Configuration
 *
 * Provides central configuration for:
 * - Direct Adsterra Smartlink (Auto-Loaded Inline Ad Source)
 * - Yandex Advertising Network (YAN) RTB Block IDs across all pages & tabs
 * - Automatic initialization on page open (zero click required, no popup windows)
 * - Auto-refresh interval (30 seconds) for auto-impression and revenue optimization
 */

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
