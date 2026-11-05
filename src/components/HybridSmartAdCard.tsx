import React, {useEffect, useRef, useState} from 'react';
import {
  ADSENSE_CONFIG,
  ADS_CONFIG,
  ADSTERRA_SMARTLINK_URL,
  isValidAdSensePublisherId,
  isValidAdSenseSlotId,
  normalizeAdSenseClientId,
} from '../config/adsConfig.ts';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      requestNonPersonalizedAds?: number;
      pauseAdRequests?: number;
    };
    yaContextCb?: Array<() => void>;
    Ya?: {
      Context?: {
        AdvManager?: {
          render: (
            config: {blockId: string; renderTo: string; async?: boolean},
            onFallback?: () => void
          ) => void;
        };
      };
    };
  }
}

export const YANDEX_FALLBACK_TIMEOUT_MS = 2000;
export const AUTO_AD_ROTATION_INTERVAL_MS = (ADS_CONFIG.AUTO_REFRESH_SECONDS ?? 30) * 1000;

export const AUTO_AD_CREATIVES = [
  {
    badgeAr: 'إعلان مدعوم • AD',
    badgeEn: 'Sponsored Ad • AD',
    titleAr: 'Terrax Cloud DNS & Fiber Optimizer — استجابة أسرع للألعاب والبث 4K',
    titleEn: 'Terrax Cloud DNS & Fiber Optimizer — Ultra-Low Latency for 4K & Gaming',
    subAr: 'توجيه ذكي للحزم عبر مسارات الألياف المباشرة لتقليل الـ Ping والـ Jitter واستقرار البث',
    subEn: 'Smart packet routing over direct fiber backbones to minimize Ping, Jitter, and packet loss',
  },
  {
    badgeAr: 'إعلان تلقائي • AD',
    badgeEn: 'Auto Ad • AD',
    titleAr: 'Terrax IXP High-Precision Telemetry — خوادم قياس معتمدة بدقة 10 Gbps',
    titleEn: 'Terrax IXP High-Precision Telemetry — Certified 10 Gbps Measurement Nodes',
    subAr: 'قياس نقي 100% مع عزل شبكي كامل أثناء الفحص لضمان أعلى مصداقية وسرعة فائقة',
    subEn: '100% pure measurement with full network isolation during active tests for maximum accuracy',
  },
  {
    badgeAr: 'إعلان مدعوم • AD',
    badgeEn: 'Sponsored Ad • AD',
    titleAr: 'Terrax Pro Gaming Route — مسارات شبكية مخصصة لتقليل زمن الاستجابة',
    titleEn: 'Terrax Pro Gaming Route — Dedicated Low-Ping Routing for Competitive Play',
    subAr: 'استقرار فائق في ألعاب التصويب التنافسية والبث المباشر بدون تقطيع أو فقدان حزم',
    subEn: 'Ultra-stable connection for competitive FPS and 4K live streaming with zero packet drop',
  },
];

export interface HybridSmartAdCardProps {
  blockId?: string;
  slotKey?: string;
  adsenseClientId?: string;
  adsenseSlotId?: string;
  adsenseFormat?: 'auto' | 'autorelaxed' | 'fluid';
  adsenseLayoutKey?: string;
  isTesting: boolean;
  refreshTrigger?: number;
  isStabilityTab?: boolean;
  smartlinkUrl?: string;
  lang?: 'ar' | 'en';
}

function ensureGoogleAdSenseScript(clientId: string) {
  if (typeof document === 'undefined' || !isValidAdSensePublisherId(clientId)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const normalized = normalizeAdSenseClientId(clientId);
  const existing = document.querySelector(
    'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
  );
  if (existing || document.getElementById('terrax-adsense-sdk-runtime')) return;
  const s = document.createElement('script');
  s.id = 'terrax-adsense-sdk-runtime';
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    normalized
  )}`;
  (document.head || document.documentElement).appendChild(s);
}

function ensureYandexContextScript() {
  if (typeof document === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const existing = document.querySelector('script[src*="yandex.ru/ads/system/context.js"]');
  if (existing || document.getElementById('terrax-yandex-context-runtime')) return;
  const s = document.createElement('script');
  s.id = 'terrax-yandex-context-runtime';
  s.src = 'https://yandex.ru/ads/system/context.js';
  s.async = true;
  (document.head || document.documentElement).appendChild(s);
}

export const HybridSmartAdCard: React.FC<HybridSmartAdCardProps> = ({
  blockId = ADS_CONFIG.YANDEX_BLOCKS.SPEED_TAB,
  slotKey = 'speed-main',
  adsenseClientId = ADSENSE_CONFIG.PUBLISHER_ID,
  adsenseSlotId,
  adsenseFormat = 'auto',
  adsenseLayoutKey,
  isTesting,
  refreshTrigger = 0,
  isStabilityTab = false,
  smartlinkUrl = ADS_CONFIG.ADSTERRA_SMARTLINK,
  lang = 'ar',
}) => {
  const [internalRefreshTick, setInternalRefreshTick] = useState<number>(0);
  const [adMode, setAdMode] = useState<
    'rtb-loading' | 'rtb-active' | 'adsense-active' | 'smartlink-fallback'
  >('rtb-loading');
  const [adStatus, setAdStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const isTestingRef = useRef<boolean>(isTesting);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const adsenseInsRef = useRef<HTMLModElement | null>(null);

  const resolvedSlotId =
    adsenseSlotId ||
    (ADSENSE_CONFIG.SLOTS as Record<string, string>)[slotKey] ||
    '';
  const hasValidAdSenseUnit =
    isValidAdSensePublisherId(adsenseClientId) && isValidAdSenseSlotId(resolvedSlotId);

  useEffect(() => {
    isTestingRef.current = isTesting;
  }, [isTesting]);

  // Official Google AdSense unit initialization (Protected by Smart Ad Lock, Width Guard & Duplicate Push Guard)
  useEffect(() => {
    if (isTesting || !hasValidAdSenseUnit || typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const insEl = adsenseInsRef.current;
    if (!insEl) return;
    if (typeof insEl.closest === 'function' && insEl.closest('dialog:not([open]), .hidden, [hidden]')) {
      insEl.setAttribute('data-adsbygoogle-status', 'reserved');
      return;
    }
    const measuredWidth =
      insEl.offsetWidth ||
      insEl.parentElement?.offsetWidth ||
      Math.round(insEl.getBoundingClientRect?.().width || 0);
    if (window.innerWidth > 0 && measuredWidth < 120) {
      insEl.setAttribute('data-adsbygoogle-status', 'reserved');
      return;
    }
    if (insEl.getAttribute('data-adsbygoogle-status') === 'reserved') {
      insEl.removeAttribute('data-adsbygoogle-status');
    }
    if (
      insEl.getAttribute('data-terrax-pushed') === 'true' ||
      insEl.getAttribute('data-adsbygoogle-status')
    ) {
      return;
    }
    ensureGoogleAdSenseScript(adsenseClientId);
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      insEl.setAttribute('data-terrax-pushed', 'true');
      window.adsbygoogle.push({});
      setAdMode('adsense-active');
      setAdStatus('ready');
    } catch {
      // Fallback gracefully if blocked or width unavailable
    }
  }, [adsenseClientId, resolvedSlotId, hasValidAdSenseUnit, isTesting, refreshTrigger]);

  // Automatic ad rotation every 30s when idle (strictly paused during active tests and when AdSense unit is active)
  useEffect(() => {
    if (isTesting || hasValidAdSenseUnit) return;
    const autoRotateTimer = window.setInterval(() => {
      if (!isTestingRef.current) {
        setInternalRefreshTick((prev) => prev + 1);
      }
    }, AUTO_AD_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(autoRotateTimer);
  }, [isTesting, hasValidAdSenseUnit]);

  // Smart 30s & 60s refresh timer when viewing the Stability Test tab
  useEffect(() => {
    if (!isStabilityTab) return;
    const timer30 = window.setTimeout(() => {
      if (!isTestingRef.current) {
        setInternalRefreshTick((prev) => prev + 1);
      }
    }, 30000);
    const timer60 = window.setTimeout(() => {
      if (!isTestingRef.current) {
        setInternalRefreshTick((prev) => prev + 1);
      }
    }, 60000);

    return () => {
      window.clearTimeout(timer30);
      window.clearTimeout(timer60);
    };
  }, [isStabilityTab, refreshTrigger]);

  // Hybrid Yandex RTB + Automatic Embedded Ad Banner
  // with strict Network Isolation Lock (Zero-Interference when isTesting === true)
  useEffect(() => {
    // Rule 1: Network Isolation Lock — strictly forbid loading/refreshing network ads while test is running.
    if (isTesting) {
      return;
    }

    const mountNode = mountRef.current;
    if (!mountNode || typeof window === 'undefined') {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAdMode('smartlink-fallback');
      setAdStatus('offline');
      return;
    }

    let cancelled = false;
    setAdStatus('loading');
    ensureYandexContextScript();
    window.yaContextCb = window.yaContextCb || [];
    const cycleId = refreshTrigger + internalRefreshTick;
    const renderContainerId = `yandex_rtb_${slotKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cycleId}`;

    mountNode.innerHTML = '';
    const targetDiv = document.createElement('div');
    targetDiv.id = renderContainerId;
    targetDiv.className = 'terrax-yan-rtb-target';
    mountNode.appendChild(targetDiv);

    const hasYandexAdRendered = () => {
      const el = document.getElementById(renderContainerId);
      if (!el) return false;
      return el.children.length > 0 && el.innerHTML.trim().length > 0;
    };

    // Rule 2: 2-Second (2000ms) Fallback Timer — if Yandex RTB does not fill within 2s or AdBlocker blocks context.js,
    // automatically display the native ad unit inside the card without requiring any user click.
    const fallbackTimerId = window.setTimeout(() => {
      if (cancelled) return;
      if (!hasYandexAdRendered()) {
        setAdMode('smartlink-fallback');
        setAdStatus('ready');
      } else {
        setAdMode('rtb-active');
        setAdStatus('ready');
      }
    }, YANDEX_FALLBACK_TIMEOUT_MS);

    try {
      window.yaContextCb.push(() => {
        // Double-check Network Isolation Lock inside async callback
        if (cancelled || isTestingRef.current) {
          return;
        }
        try {
          const isValidBlockId = /^R-A-[A-Z0-9-]+$/i.test(blockId);
          const isNumericYandexBlockId = /^(R-A-\d+-\d+|imp-[a-z0-9_-]+)$/i.test(blockId);
          if (window.Ya?.Context?.AdvManager?.render && isValidBlockId && isNumericYandexBlockId) {
            setAdMode('rtb-loading');
            window.Ya.Context.AdvManager.render(
              {
                blockId,
                renderTo: renderContainerId,
                async: true,
              },
              () => {
                if (!cancelled) {
                  setAdMode('smartlink-fallback');
                  setAdStatus('ready');
                }
              }
            );
            window.setTimeout(() => {
              if (!cancelled) {
                if (hasYandexAdRendered()) {
                  setAdMode('rtb-active');
                } else {
                  setAdMode('smartlink-fallback');
                }
                setAdStatus('ready');
              }
            }, 450);
          } else {
            setAdMode('smartlink-fallback');
            setAdStatus('ready');
          }
        } catch {
          if (!cancelled) {
            setAdMode('smartlink-fallback');
            setAdStatus('ready');
          }
        }
      });
    } catch {
      setAdMode('smartlink-fallback');
      setAdStatus('ready');
    }

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimerId);
    };
  }, [blockId, slotKey, isTesting, refreshTrigger, internalRefreshTick]);

  const showSmartlinkCard = adMode !== 'rtb-active';

  return (
    <aside
      className={`terrax-yan-card ${isTesting ? 'yan-isolation-active terrax-yan-isolated' : ''}`}
      data-terrax-yan-slot={slotKey}
      data-yan-block-id={blockId}
      data-testing={isTesting ? 'true' : 'false'}
      data-yan-mode={adMode}
      data-ad-state={adStatus}
      data-auto-ad="true"
      data-smartlink-url={smartlinkUrl}
    >
      <div className="terrax-yan-header" hidden aria-hidden="true" style={{ display: 'none' }}>
        <div className="terrax-yan-brand">
          <span className="terrax-yan-dot" aria-hidden="true" />
          <span className="terrax-yan-partner-label terrax-yan-title" />
        </div>
        <div className="terrax-yan-header-actions">
          <span className="terrax-yan-status-indicator" hidden aria-hidden="true" />
          <div className="terrax-yan-isolation-badge" hidden aria-hidden="true" />
        </div>
      </div>

      <div className="terrax-yan-body">
        {hasValidAdSenseUnit && (
          <div
            className="terrax-adsense-mount"
            style={{width: '100%', minHeight: '90px', display: 'block', overflow: 'hidden'}}
          >
            <ins
              ref={adsenseInsRef}
              className="adsbygoogle"
              style={{display: 'block'}}
              data-ad-client={normalizeAdSenseClientId(adsenseClientId)}
              data-ad-slot={resolvedSlotId}
              data-ad-format={adsenseFormat}
              data-ad-layout-key={adsenseLayoutKey || undefined}
              data-full-width-responsive={
                adsenseFormat !== 'autorelaxed' && adsenseFormat !== 'fluid' ? 'true' : undefined
              }
            />
          </div>
        )}
        <div
          className="terrax-yan-rtb-mount"
          ref={mountRef}
          style={{display: adMode === 'rtb-active' ? 'flex' : 'none'}}
        />
        {!isTesting && adStatus !== 'offline' && (
          <iframe
            className="terrax-auto-ad-frame"
            src={smartlinkUrl}
            title="Terrax Automatic Embedded Ad Unit"
            aria-hidden="true"
            tabIndex={-1}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-forms"
            onLoad={() => setAdStatus('ready')}
            onError={() => setAdStatus('ready')}
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              opacity: 0.01,
              pointerEvents: 'none',
              border: 0,
              overflow: 'hidden',
              bottom: 0,
              left: 0,
            }}
          />
        )}
        {showSmartlinkCard && (
          <a
            href={smartlinkUrl}
            rel="noopener noreferrer sponsored"
            className="terrax-yan-sponsor-fallback"
            data-smartlink-fallback="true"
            hidden
            aria-hidden="true"
            style={{ display: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="terrax-yan-fallback-content terrax-yan-sponsor-content" hidden style={{ display: 'none' }}>
              <div className="terrax-yan-sponsor-headline">
                <span className="terrax-yan-fallback-pill terrax-yan-sponsor-badge" />
                <strong className="terrax-yan-fallback-title terrax-yan-sponsor-title" />
              </div>
              <span className="terrax-yan-fallback-sub terrax-yan-sponsor-desc" />
            </div>
          </a>
        )}
      </div>
      <span
        className="terrax-ad-disclosure-label"
        data-label-ar="اعلان"
        data-label-en="Sponsored"
      >
        {lang === 'en' ? 'Sponsored' : 'اعلان • Sponsored'}
      </span>
    </aside>
  );
};

export default HybridSmartAdCard;
