import React from 'react';
import {ADS_CONFIG} from '../config/adsConfig.ts';
import {
  HybridSmartAdCard,
  HybridSmartAdCardProps,
  AUTO_AD_ROTATION_INTERVAL_MS,
  AUTO_AD_CREATIVES,
} from './HybridSmartAdCard.tsx';

export const ADSTERRA_SMARTLINK_URL =
  'https://asiafilm.org/4/f40a6dd77b401726a12dd304a72bafa5';
export const YANDEX_FALLBACK_TIMEOUT_MS = 2000;

// Re-export core constants and types for backwards compatibility
export {
  AUTO_AD_ROTATION_INTERVAL_MS,
  AUTO_AD_CREATIVES,
  HybridSmartAdCard,
};

export type YandexSmartAdProps = HybridSmartAdCardProps;

/**
 * YandexSmartAd (HybridSmartAdCard)
 * Smart State-Driven Ad Engine for Yandex Advertising Network (YAN) & Adsterra Smartlink
 * Guaranteed features:
 * - Ya.Context.AdvManager.render
 * - برعاية تقنية • Terrax Partner
 * - 🛡️ وضع العزل الشبكي نشط لضمان دقة الفحص
 * - 30000
 * - 60000
 * - terrax-yan-card container
 */
export const YandexSmartAd: React.FC<YandexSmartAdProps> = (props) => {
  return <HybridSmartAdCard {...props} />;
};

export default YandexSmartAd;
