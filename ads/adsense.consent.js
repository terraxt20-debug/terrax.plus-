/**
 * Terrax Plus (تيراكس بلاس) — Privacy & Consent Management (Google Consent Mode v2)
 *
 * Implements:
 * 1. Google Consent Mode v2 signals (ad_storage, ad_user_data, ad_personalization, analytics_storage)
 * 2. European Economic Area (EEA), UK, and Switzerland (CH) detection
 * 3. Non-Personalized Ads (NPA) flag (window.adsbygoogle.requestNonPersonalizedAds = 1)
 * 4. Pause requests flag (window.adsbygoogle.pauseAdRequests = 1)
 * 5. Google-certified CMP integration readiness (TCF v2.2 __tcfapi & Funding Choices)
 */

export const CONSENT_STORAGE_KEY = 'terrax_adsense_consent_v1';

const EEA_UK_CH_TIMEZONES = [
  'europe/',
  'atlantic/reykjavik',
  'atlantic/canary',
  'atlantic/faroe',
  'atlantic/madeira',
  'atlantic/azores',
];

/**
 * Detect whether the user is located in the EEA, UK, or Switzerland where explicit CMP consent is required
 */
export function isRegulatedPrivacyRegion() {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        const lowerTz = tz.toLowerCase();
        for (const pattern of EEA_UK_CH_TIMEZONES) {
          if (lowerTz.includes(pattern)) return true;
        }
      }
    }
  } catch {
    // fallback
  }
  return false;
}

/**
 * Detect whether a Google-certified CMP (IAB TCF v2.2 or Google FC) is present
 */
export function isCertifiedCmpPresent() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    typeof window.__tcfapi === 'function' ||
      window.googlefc ||
      document.getElementById('google-funding-choices')
  );
}

/**
 * Initialize Google Consent Mode v2 default signals before any tags fire
 */
export function initGoogleConsentModeDefaults() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  const savedConsent = getSavedConsentChoice();
  const requiresStrictConsent = isRegulatedPrivacyRegion();

  if (savedConsent === 'personalized') {
    gtag('consent', 'default', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
      wait_for_update: 500,
    });
    setAdSenseNpaFlags(false, false);
  } else if (savedConsent === 'non_personalized') {
    gtag('consent', 'default', {
      ad_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
      wait_for_update: 500,
    });
    setAdSenseNpaFlags(true, false);
  } else if (savedConsent === 'rejected') {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    });
    setAdSenseNpaFlags(true, true);
  } else {
    // Default when unset: in EEA/UK/CH, deny personalization by default until user consents
    gtag('consent', 'default', {
      ad_storage: requiresStrictConsent ? 'denied' : 'granted',
      ad_user_data: requiresStrictConsent ? 'denied' : 'granted',
      ad_personalization: requiresStrictConsent ? 'denied' : 'granted',
      analytics_storage: 'granted',
      wait_for_update: 500,
    });
    if (requiresStrictConsent) {
      setAdSenseNpaFlags(true, false);
    }
  }
}

/**
 * Configure window.adsbygoogle NPA (Non-Personalized Ads) and pause flags
 */
export function setAdSenseNpaFlags(nonPersonalizedOnly, pauseRequests) {
  if (typeof window === 'undefined') return;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = nonPersonalizedOnly ? 1 : 0;
  window.adsbygoogle.pauseAdRequests = pauseRequests ? 1 : 0;
}

/**
 * Retrieve saved user consent from localStorage
 * @returns {'personalized' | 'non_personalized' | 'rejected' | 'unset'}
 */
export function getSavedConsentChoice() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved === 'personalized' || saved === 'non_personalized' || saved === 'rejected') {
        return saved;
      }
    }
  } catch {
    // ignore
  }
  return 'unset';
}

/**
 * Save user consent choice and update Google signals accordingly
 * @param {'personalized' | 'non_personalized' | 'rejected' | 'unset'} choice
 */
export function saveConsentChoice(choice) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    if (choice === 'personalized') {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      });
      setAdSenseNpaFlags(false, false);
    } else if (choice === 'non_personalized') {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      });
      setAdSenseNpaFlags(true, false);
    } else if (choice === 'rejected') {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      setAdSenseNpaFlags(true, true);
    }
  }

  return {
    choice,
    canLoadAds: choice !== 'rejected',
    nonPersonalizedOnly: choice === 'non_personalized',
  };
}

// Auto-run consent mode defaults
initGoogleConsentModeDefaults();

if (typeof window !== 'undefined') {
  window.TerraxAdSenseConsent = {
    isRegulatedPrivacyRegion,
    isCertifiedCmpPresent,
    initGoogleConsentModeDefaults,
    setAdSenseNpaFlags,
    getSavedConsentChoice,
    saveConsentChoice,
  };
}

export default {
  isRegulatedPrivacyRegion,
  isCertifiedCmpPresent,
  initGoogleConsentModeDefaults,
  setAdSenseNpaFlags,
  getSavedConsentChoice,
  saveConsentChoice,
};
