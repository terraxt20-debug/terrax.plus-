import React from 'react';
import {ADS_CONFIG} from '../../config/adsConfig.ts';

export interface GamingRadarAutoCardProps {
  currentPing?: number | null;
  smartlinkUrl?: string;
  lang?: 'ar' | 'en';
}

/**
 * GamingRadarAutoCard
 *
 * Automated 6th radar grid card next to Fortnite.
 * - Title: Game Turbo مسرّع (Terrax Booster) with "موصى به" & "PRO" badges.
 * - Description: تخفيض الـ Ping والـ Jitter تلقائياً.
 * - Automatic inline display without opening popups or external tabs on click.
 */
export const GamingRadarAutoCard: React.FC<GamingRadarAutoCardProps> = ({
  currentPing = null,
  smartlinkUrl = ADS_CONFIG.ADSTERRA_SMARTLINK,
  lang = 'ar',
}) => {
  const isEnglish = lang === 'en';
  const hasPing = typeof currentPing === 'number' && Number.isFinite(currentPing) && currentPing > 0;
  const isHighPing = hasPing && currentPing >= 55;

  return (
    <a
      href={smartlinkUrl}
      rel="noopener noreferrer sponsored"
      className={`game-perf-card gaming-booster-card ${isHighPing ? 'needs-boost' : 'optimal-route'}`}
      id="gamingBoosterCard"
      data-game="Game Turbo مسرّع (Terrax Booster)"
      data-cat="booster"
      data-auto-ad="true"
      data-smartlink-url={smartlinkUrl}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      aria-label={
        isEnglish
          ? 'Game Turbo Booster — Ultra-Low Ping Route Optimizer'
          : 'Game Turbo مسرّع — تخفيض الـ Ping والـ Jitter تلقائياً'
      }
      style={{
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'default',
        background: 'rgba(11, 27, 50, 0.70)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(0, 210, 255, 0.25)',
      }}
    >
      <div className="game-card-top">
        <div>
          <div
            className="game-name"
            dir="rtl"
            style={{color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '0.4rem'}}
          >
            <span>{isEnglish ? 'Game Turbo Booster' : 'Game Turbo مسرّع'}</span>
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.45)',
                color: '#4ade80',
                borderRadius: '4px',
                padding: '0.1rem 0.35rem',
                fontWeight: 800,
              }}
            >
              {isEnglish ? 'RECOMMENDED' : 'موصى به'}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                borderRadius: '4px',
                padding: '0.1rem 0.35rem',
                fontWeight: 800,
              }}
            >
              PRO
            </span>
          </div>
          <div className="game-genre" style={{color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.2rem'}}>
            {isEnglish ? 'Automatic Ping & Jitter Reduction' : 'تخفيض الـ Ping والـ Jitter تلقائياً'}
          </div>
        </div>
        <div className="game-icon-box" aria-hidden="true" style={{color: isHighPing ? '#fbbf24' : '#27ddf8'}}>
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path
              d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={isHighPing ? 'rgba(251, 191, 36, 0.15)' : 'rgba(39, 221, 248, 0.15)'}
            />
          </svg>
        </div>
      </div>

      <div className="game-metrics-row">
        <div className="game-ping-readout" dir="ltr">
          {hasPing ? (
            <span className="game-live-ping" style={{color: isHighPing ? '#f59e0b' : '#78e7a0'}}>
              {currentPing.toFixed(0)}
            </span>
          ) : (
            <span className="game-live-ping" style={{color: '#78e7a0'}}>&lt; 55</span>
          )}
          <small>ms</small>
        </div>
        <span
          className="game-fps-state"
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            background: isHighPing ? 'rgba(245, 158, 11, 0.18)' : 'rgba(34, 197, 94, 0.18)',
            color: isHighPing ? '#fbbf24' : '#86efac',
            border: `1px solid ${isHighPing ? 'rgba(245, 158, 11, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
          }}
        >
          {isHighPing
            ? isEnglish
              ? 'Route Optimization Recommended'
              : 'تحسين المسار مطلوب'
            : isEnglish
              ? 'Direct Route < 55ms'
              : 'مسار فائق الاستقرار'}
        </span>
      </div>

      <div
        className="game-bar-track"
        style={{background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden', height: '4px'}}
      >
        <div
          className="game-bar-fill"
          style={{
            width: isHighPing ? '65%' : '95%',
            background: isHighPing
              ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
              : 'linear-gradient(90deg, #38bdf8, #4ade80)',
            height: '100%',
          }}
        />
      </div>
    </a>
  );
};

export default GamingRadarAutoCard;
