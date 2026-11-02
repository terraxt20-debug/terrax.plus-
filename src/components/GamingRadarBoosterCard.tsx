import React from 'react';
import {ADS_CONFIG} from '../config/adsConfig.ts';

export interface GamingRadarBoosterCardProps {
  currentPing?: number | null;
  smartlinkUrl?: string;
  lang?: 'ar' | 'en';
}

export const GamingRadarBoosterCard: React.FC<GamingRadarBoosterCardProps> = ({
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
      data-game="Terrax Pro Gaming Booster"
      data-cat="booster"
      data-auto-ad="true"
      data-smartlink-url={smartlinkUrl}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      aria-label={
        isEnglish
          ? 'Terrax Pro Gaming Booster — Ultra-Low Ping Route Optimizer'
          : 'مسرّع مسارات الألعاب التنافسية — Terrax Pro Gaming Booster'
      }
      style={{
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'default',
      }}
    >
      <div className="game-card-top">
        <div>
          <div className="game-name" dir="ltr" style={{color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
            <span>{isEnglish ? 'Game Turbo Booster' : 'Game Turbo مسرّع (Terrax Booster)'}</span>
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
          <div className="game-genre">
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
              {Math.round(currentPing)}
            </span>
          ) : (
            <span className="game-live-ping">&lt; 55</span>
          )}
          <small>ms</small>
        </div>

        <span
          className="game-fps-state"
          style={{
            color: isHighPing ? '#fca5a5' : '#86efac',
            background: isHighPing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${isHighPing ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}
        >
          {hasPing
            ? isHighPing
              ? isEnglish
                ? 'Route Boost Needed'
                : 'تحسين المسار مطلوب ⚡'
              : isEnglish
                ? 'Optimal Route'
                : 'مسار فائق الاستقرار ✓'
            : isEnglish
              ? '< 55ms Direct Route'
              : 'مسار مباشر < 55ms'}
        </span>
      </div>

      <div className="game-bar-track" style={{background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden', height: '4px'}}>
        <div
          className="game-bar-fill"
          style={{
            width: isHighPing ? '45%' : '95%',
            background: isHighPing
              ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
              : 'linear-gradient(90deg, #27ddf8, #78e7a0)',
            height: '100%',
            borderRadius: '999px',
            boxShadow: isHighPing ? '0 0 8px #ef4444' : '0 0 8px #27ddf8',
          }}
        />
      </div>
    </a>
  );
};

export default GamingRadarBoosterCard;
