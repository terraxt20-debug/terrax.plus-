import React, {useEffect, useRef, useState} from 'react';
import {ADS_CONFIG, ADSTERRA_SMARTLINK_URL} from '../../config/adsConfig.ts';

declare global {
  interface Window {
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

export interface AutoRefreshHybridAdCardProps {
  blockId?: string;
  slotKey?: string;
  isTesting: boolean;
  refreshTrigger?: number;
  isStabilityTab?: boolean;
  smartlinkUrl?: string;
  lang?: 'ar' | 'en';
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

/**
 * AutoRefreshHybridAdCard
 *
 * 100% Automated, Zero-Click Glassmorphic Hybrid Ad Card.
 * - Automatic initialization & inline display on screen without any user click.
 * - Background auto-refresh timer rotating impressions every 30 seconds.
 * - Network Isolation Lock pausing all ad bandwidth during active tests.
 * - Yandex RTB with 2-second fallback and zero popup windows.
 */
export const AutoRefreshHybridAdCard: React.FC<AutoRefreshHybridAdCardProps> = ({
  blockId = ADS_CONFIG.YANDEX_BLOCKS.SPEED_TAB,
  slotKey = 'speed-main',
  isTesting,
  refreshTrigger = 0,
  isStabilityTab = false,
  smartlinkUrl = ADS_CONFIG.ADSTERRA_SMARTLINK,
  lang = 'ar',
}) => {
  const [internalRefreshTick, setInternalRefreshTick] = useState<number>(0);
  const [adMode, setAdMode] = useState<'rtb-loading' | 'rtb-active' | 'smartlink-fallback'>(
    'rtb-loading'
  );
  const [adStatus, setAdStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const isTestingRef = useRef<boolean>(isTesting);
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isTestingRef.current = isTesting;
  }, [isTesting]);

  // Automatic ad rotation every 30s when idle (paused during active tests)
  useEffect(() => {
    if (isTesting) return;
    const autoRotateTimer = window.setInterval(() => {
      if (!isTestingRef.current) {
        setInternalRefreshTick((prev) => prev + 1);
      }
    }, AUTO_AD_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(autoRotateTimer);
  }, [isTesting]);

  // Smart 30s & 60s refresh timer when viewing Stability Test tab
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

  // Hybrid Yandex RTB + 2-Second Automatic Inline Display
  useEffect(() => {
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

  const isEnglish = lang === 'en';
  const showSmartlinkCard = adMode !== 'rtb-active';
  const currentCreative =
    AUTO_AD_CREATIVES[(refreshTrigger + internalRefreshTick) % AUTO_AD_CREATIVES.length];

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
      aria-label="برعاية تقنية • Terrax Partner"
      style={{
        background: 'rgba(11, 27, 50, 0.70)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(0, 210, 255, 0.25)',
      }}
    >
      <div className="terrax-yan-header">
        <div className="terrax-yan-brand">
          <span className="terrax-yan-dot" aria-hidden="true" />
          <span className="terrax-yan-partner-label terrax-yan-title">
            برعاية تقنية • Terrax Partner
          </span>
        </div>

        <div className="terrax-yan-header-actions">
          {!isTesting && (
            <span
              className="terrax-yan-status-indicator"
              aria-live="polite"
              style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: adStatus === 'offline' ? '#94a3b8' : '#38bdf8',
                opacity: 0.9,
              }}
            >
              {adStatus === 'loading'
                ? isEnglish
                  ? 'Auto-loading ad...'
                  : 'جاري التحميل التلقائي...'
                : adStatus === 'offline'
                  ? isEnglish
                    ? 'Ad paused (Offline)'
                    : 'الإعلان متوقف مؤقتاً (غير متصل)'
                  : isEnglish
                    ? 'Auto Ad Active • تفعيل تلقائي'
                    : 'عرض تلقائي نشط'}
            </span>
          )}
          {isTesting && (
            <div
              className="terrax-yan-isolation-badge"
              role="status"
              style={{
                color: '#86efac',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
              }}
            >
              🛡️ عزل الشبكة نشط لضمان دقة الفحص
            </div>
          )}
        </div>
      </div>

      <div className="terrax-yan-body">
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="terrax-yan-fallback-content terrax-yan-sponsor-content">
              <div className="terrax-yan-sponsor-headline">
                <span className="terrax-yan-fallback-pill terrax-yan-sponsor-badge">
                  {isEnglish ? currentCreative.badgeEn : currentCreative.badgeAr}
                </span>
                <strong className="terrax-yan-fallback-title terrax-yan-sponsor-title">
                  {isEnglish ? currentCreative.titleEn : currentCreative.titleAr}
                </strong>
              </div>
              <span className="terrax-yan-fallback-sub terrax-yan-sponsor-desc">
                {isEnglish ? currentCreative.subEn : currentCreative.subAr}
              </span>
            </div>
          </a>
        )}
      </div>
    </aside>
  );
};

export default AutoRefreshHybridAdCard;
