/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import '../frontend/javascript/telemetry-math.js';
import {ADS_CONFIG, ADSTERRA_SMARTLINK_URL} from './config/adsConfig.ts';
import {HybridSmartAdCard} from './components/HybridSmartAdCard.tsx';

export interface SpeedtestServer {
  name: string;
  server: string;
  id?: number;
  dlURL: string;
  ulURL: string;
  pingURL: string;
  getIpURL: string;
  sponsorName?: string;
  sponsorURL?: string;
  pingT?: number;
}

export interface LibreSpeedUpdateData {
  dlStatus?: string | number;
  ulStatus?: string | number;
  pingStatus?: string | number;
  jitterStatus?: string | number;
  dlProgress?: string | number;
  ulProgress?: string | number;
  pingProgress?: string | number;
  testState?: number;
  clientIp?: string;
  testId?: string;
}

interface SpeedtestInstance {
  getState: () => number;
  setParameter: (param: string, value: unknown) => void;
  addTestPoint: (server: SpeedtestServer) => void;
  addTestPoints: (servers: SpeedtestServer[]) => void;
  getSelectedServer: () => SpeedtestServer;
  setSelectedServer: (server: SpeedtestServer) => void;
  selectServer: (callback: (bestServer: SpeedtestServer | null) => void) => void;
  start: () => void;
  abort: () => void;
  onupdate?: (data: LibreSpeedUpdateData) => void;
  onend?: (aborted: boolean) => void;
}

interface FormattedSpeed {
  rawMbps: number;
  displayNumber: string;
  unitEn: string;
  unitAr: string;
  unitLabelEn?: string;
  badgeAr: string;
  badgeEn?: string;
  hasValue: boolean;
}

interface RealMetricsResult {
  avgSpeedMbps: number | null;
  maxSpeedMbps: number | null;
  stabilityPercent: number | null;
  stabilityLabelAr: string;
  stabilityLabelEn?: string;
  sampleCount: number;
}

interface RealConnectionInfo {
  kind: 'physical' | 'effective-only' | 'offline' | 'unavailable';
  source: string;
  physicalType: string | null;
  effectiveType: string | null;
  hasPhysicalType: boolean;
  hasEffectiveType: boolean;
  labelAr: string;
  labelEn: string;
  label: string;
  detailAr: string;
  detailEn: string;
  detail: string;
}

interface TelemetryMathApi {
  formatSpeedReading: (mbpsValue: number | string | null | undefined, allowGbps: boolean) => FormattedSpeed;
  calculateRealMetrics: (
    dlSamples: number[],
    ulSamples: number[],
    pingMs: number | string | null | undefined,
    jitterMs: number | string | null | undefined
  ) => RealMetricsResult;
  percentToRotation: (percent: number) => number;
  smoothNumericValue: (
    currentVal: number,
    targetVal: number | string,
    dtSeconds: number,
    snapImmediate: boolean
  ) => number;
  resolveRealConnectionInfo?: (navInput?: unknown, lang?: string) => RealConnectionInfo;
  STANDARD_REFRESH_RATES?: number[];
  quantizeRefreshRate?: (rawFps: number) => number;
  estimateRefreshRateFromDeltas?: (deltaSamplesMs: number[], fallbackFps?: number) => number;
  computeDynamicThrottleInterval?: (
    refreshRateInput?: number | { current?: number } | (() => number)
  ) => {
    targetFps: number;
    intervalMs: number;
    jitterToleranceMs: number;
    minElapsedMs: number;
    minDtSeconds: number;
  };
  shouldRenderGaugeFrame?: (
    nowMs: number,
    lastFrameMs: number,
    targetFps?: number | { current?: number } | (() => number),
    force?: boolean
  ) => {
    shouldRender: boolean;
    dtSeconds: number;
    nextLastFrameMs: number;
    intervalMs?: number;
    targetFps?: number;
  };
  createRafGaugeThrottler?: (
    renderCallback: (
      dtSeconds: number,
      nowMs: number,
      currentFps?: number,
      intervalMs?: number
    ) => boolean | void,
    targetFps?: number | { current?: number } | (() => number)
  ) => {
    schedule: (force?: boolean) => void;
    cancel: () => void;
    setTargetFps?: (nextFps: number) => number;
    getTargetFps?: () => number;
    getThrottleIntervalMs?: () => number;
    isPending: () => boolean;
  };
  computeCountUpFrame?: (
    targetMbps: number | string | null | undefined,
    progress01: number,
    allowGbps: boolean
  ) => {
    displayNumber: string;
    unitEn: string;
    currentMbps: number;
    progress: number;
    isComplete: boolean;
  };
  animateStatCountUp?: (options: {
    maxSpeedMbps: number | null;
    avgSpeedMbps: number | null;
    allowGbps?: boolean;
    durationMs?: number;
    reducedMotion?: boolean;
    onFrame: (frame: {
      maxFrame: { displayNumber: string; unitEn: string };
      avgFrame: { displayNumber: string; unitEn: string };
      progress: number;
      isComplete: boolean;
    }) => void;
    onComplete?: () => void;
  }) => () => void;
  createStatCardsRafLoop?: (options?: {
    targetFps?: number;
    onCommit?: (commitState: {
      maxDisplay: string;
      maxUnit: string;
      avgDisplay: string;
      avgUnit: string;
      countingUp: boolean;
      mode: string;
      maxChanged: boolean;
      avgChanged: boolean;
      countingClassChanged: boolean;
    }) => void;
  }) => {
    setLiveTargets: (
      maxMbps: number | null,
      avgMbps: number | null,
      allowGbps?: boolean,
      interpolate?: boolean,
      autoSchedule?: boolean
    ) => void;
    startCountUp: (opts: {
      maxSpeedMbps: number | null;
      avgSpeedMbps: number | null;
      allowGbps?: boolean;
      durationMs?: number;
      reducedMotion?: boolean;
      standalone?: boolean;
      onComplete?: () => void;
    }) => () => void;
    syncFrame: (nowMs?: number, dtSeconds?: number) => boolean;
    reset: (defaultDisplay?: string, defaultUnit?: string) => void;
    cancel: () => void;
    setTargetFps?: (nextFps: number) => number;
    getTargetFps?: () => number;
    getState: () => {
      mode: string;
      lastMaxDisplay: string;
      lastMaxUnit: string;
      lastAvgDisplay: string;
      lastAvgUnit: string;
      lastCountingUp: boolean;
      commitCount: number;
      targetFps?: number;
      isPending: boolean;
    };
  };
  createTestHistoryEntry?: (rawRun: Record<string, unknown>, nowInput?: Date | number) => NormalizedHistoryEntry;
  normalizeTestHistoryList?: (rawList: unknown, fallbackNowMs?: number) => NormalizedHistoryEntry[];
  appendTestHistoryEntry?: (
    existingList: unknown,
    rawRun: Record<string, unknown>,
    maxEntries?: number,
    nowInput?: Date | number
  ) => NormalizedHistoryEntry[];
  sortTestHistoryList?: (
    list: NormalizedHistoryEntry[],
    sortKey?: HistorySortKey,
    sortDir?: 'asc' | 'desc'
  ) => NormalizedHistoryEntry[];
  computeIntegerCountUpFrame?: (
    targetCount: number | string | null | undefined,
    progress01: number
  ) => {
    displayValue: string;
    currentCount: number;
    targetCount: number;
    progress: number;
    isComplete: boolean;
  };
  animateCompletedTestsCountUp?: (options: {
    targetCount: number;
    durationMs?: number;
    reducedMotion?: boolean;
    onFrame?: (frame: {
      displayValue: string;
      currentCount: number;
      targetCount: number;
      progress: number;
      isComplete: boolean;
    }) => void;
    onComplete?: () => void;
  }) => () => void;
}

export type HistorySortKey = 'date' | 'time' | 'server' | 'dl' | 'ul' | 'stability' | 'ping';

export interface NormalizedHistoryEntry {
  runId: string;
  epochMs: number;
  isoDate: string;
  date: string;
  dateAr: string;
  dateEn: string;
  timestamp: string;
  timeAr: string;
  timeEn: string;
  time24: string;
  serverName: string;
  dlMbps: number;
  ulMbps: number;
  pingMs: number;
  jitterMs: number;
  stabilityPercent: number | null;
  megabytesUsed: number;
}

declare global {
  interface Window {
    Speedtest?: new () => SpeedtestInstance;
    TerraxTelemetryMath?: TelemetryMathApi;
    SPEEDTEST_SERVERS?: string | SpeedtestServer[];
  }
}

export const INITIALIZING = 0;
export const READY = 1;
export const RUNNING = 2;
export const FINISHED = 3;

export const YANDEX_SILENT_REFRESH_INTERVAL_MS = 30000;

const LANGUAGE_STORAGE_KEY = 'terrax_ui_lang_v1';
const HISTORY_STORAGE_KEY = 'terrax_librespeed_history_v1';
const AUTO_GBPS_STORAGE_KEY = 'terrax_auto_gbps_v1';

export const STANDARD_REFRESH_RATES = [60, 75, 90, 120, 144, 165, 240] as const;

/**
 * Quantize a raw measured frame rate (Hz) to the nearest standard display refresh rate tier
 * (60Hz, 75Hz, 90Hz, 120Hz, 144Hz, 165Hz, 240Hz) when within 8.5% tolerance, or clamp to [60, 240].
 */
export function quantizeDeviceRefreshRate(rawFps: number): number {
  const math =
    globalThis.window?.TerraxTelemetryMath ??
    (globalThis as unknown as {TerraxTelemetryMath?: TelemetryMathApi}).TerraxTelemetryMath;
  if (math?.quantizeRefreshRate) {
    return math.quantizeRefreshRate(rawFps);
  }
  const numeric = Number(rawFps);
  if (!Number.isFinite(numeric) || numeric <= 0) return 60;
  const clamped = Math.max(60, Math.min(240, numeric));
  let bestTier = 60;
  let smallestRatioDiff = Infinity;
  for (const tier of STANDARD_REFRESH_RATES) {
    const relDiff = Math.abs(clamped - tier) / tier;
    if (relDiff < smallestRatioDiff) {
      smallestRatioDiff = relDiff;
      bestTier = tier;
    }
  }
  return smallestRatioDiff <= 0.085 ? bestTier : Math.round(clamped);
}

/**
 * Estimate the user's device refresh rate from a rolling window of window.requestAnimationFrame
 * VSync frame deltas (ms), rejecting tab-switch pauses and outlier stalls.
 */
export function estimateRefreshRateFromDeltas(
  deltaSamplesMs: number[],
  fallbackFps = 60
): number {
  const math =
    globalThis.window?.TerraxTelemetryMath ??
    (globalThis as unknown as {TerraxTelemetryMath?: TelemetryMathApi}).TerraxTelemetryMath;
  if (math?.estimateRefreshRateFromDeltas) {
    return math.estimateRefreshRateFromDeltas(deltaSamplesMs, fallbackFps);
  }
  const defaultFps =
    Number.isFinite(Number(fallbackFps)) && Number(fallbackFps) > 0
      ? quantizeDeviceRefreshRate(Number(fallbackFps))
      : 60;
  if (!Array.isArray(deltaSamplesMs) || deltaSamplesMs.length === 0) {
    return defaultFps;
  }
  const valid = deltaSamplesMs
    .map(Number)
    .filter((d) => Number.isFinite(d) && d >= 2.5 && d <= 25)
    .sort((a, b) => a - b);
  if (valid.length === 0) return defaultFps;
  const mid = Math.floor(valid.length / 2);
  const medianDeltaMs =
    valid.length % 2 === 1 ? valid[mid] : (valid[mid - 1] + valid[mid]) * 0.5;
  return medianDeltaMs > 0 ? quantizeDeviceRefreshRate(1000 / medianDeltaMs) : defaultFps;
}

/**
 * Compute the dynamically scaled VSync throttle interval (ms), jitter tolerance, and minimum dt (s)
 * directly from `detectedRefreshRateRef` (or a numeric Hz / getter).
 */
export function computeDynamicThrottleInterval(
  refreshRateInput: number | { current?: number } | (() => number) = 60
): {
  targetFps: number;
  intervalMs: number;
  jitterToleranceMs: number;
  minElapsedMs: number;
  minDtSeconds: number;
} {
  const math =
    globalThis.window?.TerraxTelemetryMath ??
    (globalThis as unknown as {TerraxTelemetryMath?: TelemetryMathApi}).TerraxTelemetryMath;
  if (math?.computeDynamicThrottleInterval) {
    return math.computeDynamicThrottleInterval(refreshRateInput);
  }
  let rawValue: unknown = refreshRateInput;
  if (typeof refreshRateInput === 'function') {
    try {
      rawValue = refreshRateInput();
    } catch {
      rawValue = 60;
    }
  } else if (
    refreshRateInput &&
    typeof refreshRateInput === 'object' &&
    'current' in refreshRateInput
  ) {
    rawValue = refreshRateInput.current;
  }
  const numeric = Number(rawValue);
  const targetFps =
    Number.isFinite(numeric) && numeric > 0
      ? Math.min(240, Math.max(30, numeric))
      : 60;
  const intervalMs = 1000 / targetFps;
  const jitterToleranceMs =
    targetFps <= 60 ? 0.45 : Math.min(0.45, intervalMs * 0.06);
  const minElapsedMs = Math.max(1, intervalMs - jitterToleranceMs);
  const minDtSeconds =
    targetFps > 60
      ? Math.max(0.002, Number((0.5 / targetFps).toFixed(4)))
      : 0.008;
  return {
    targetFps,
    intervalMs,
    jitterToleranceMs,
    minElapsedMs,
    minDtSeconds,
  };
}

/**
 * Convert a real LibreSpeed measurement in Mbps to a 4K gauge rotation angle (0..180 deg)
 * using the logarithmic 10 Gbps scale.
 */
export function mbpsToRotation(speed: number | string, oscillate = false): number {
  const numericSpeed = Number(speed);
  if (!Number.isFinite(numericSpeed) || numericSpeed <= 0) return 0;

  const minSpeed = 0;
  const maxSpeed = 10000; // 10 Gbps full scale
  const minRotation = 0;
  const maxRotation = 180;

  const logMinSpeed = Math.log10(minSpeed + 1);
  const logMaxSpeed = Math.log10(maxSpeed + 1);
  const logSpeed = Math.log10(numericSpeed + 1);

  const power = (logSpeed - logMinSpeed) / (logMaxSpeed - logMinSpeed);
  const oscillation = 1;
  const rotation = power * oscillation * maxRotation;

  return Math.max(Math.min(rotation, maxRotation), minRotation);
}

export interface SmoothedTelemetryValues {
  stabilityDisplayPercent?: number | null;
  pingDisplayMs?: number;
  jitterDisplayMs?: number;
  dlProgressRatio?: number;
  ulProgressRatio?: number;
  maxSpeedDisplayMbps?: number | null;
  avgSpeedDisplayMbps?: number | null;
}

/**
 * Compute real-time 4K gauge state directly from LibreSpeed worker telemetry data and collected samples.
 */
export function computeRealTimeGaugeTelemetry(
  data: LibreSpeedUpdateData | null,
  dlSamples: number[],
  ulSamples: number[],
  dlDisplayMbps: number,
  ulDisplayMbps: number,
  autoGbps: boolean,
  lang: 'ar' | 'en',
  uiState: number,
  smoothedTelemetry?: SmoothedTelemetryValues
) {
  const math = globalThis.window?.TerraxTelemetryMath ?? (globalThis as unknown as {TerraxTelemetryMath?: TelemetryMathApi}).TerraxTelemetryMath;
  const isEnglish = lang === 'en';

  if (!data || !math) {
    return {
      dlDisplayNumber: '00',
      dlUnit: 'Mbps',
      dlUnitSub: isEnglish ? 'Megabits per second' : 'ميجابت في الثانية',
      dlBadge: isEnglish ? 'Ready to measure' : 'جاهز للقياس',
      dlRotationDeg: 0,
      dlArcDash: '0 680',
      dlProgressDeg: 0,
      ulDisplayNumber: '00',
      ulUnit: 'Mbps',
      ulUnitSub: isEnglish ? 'Megabits per second' : 'ميجابت في الثانية',
      ulBadge: isEnglish ? 'Ready to measure' : 'جاهز للقياس',
      ulRotationDeg: 0,
      ulArcDash: '0 560',
      ulProgressDeg: 0,
      stabilityDisplay: '--',
      stabilityStatus: isEnglish ? 'Awaiting measurement' : 'في انتظار القياس',
      stabilityArcDash: '0 560',
      maxSpeedDisplay: '--',
      maxSpeedUnit: 'Mbps',
      avgSpeedDisplay: '--',
      avgSpeedUnit: 'Mbps',
      pingDisplay: '00',
      jitterDisplay: '00',
      hasLatency: false,
    };
  }

  const testStage = Number(data.testState);
  const snapDl = uiState !== RUNNING || testStage !== 1;
  const snapUl = uiState !== RUNNING || testStage !== 3;

  const dlSourceVal = snapDl ? Number(data.dlStatus) || 0 : dlDisplayMbps;
  const ulSourceVal = snapUl ? Number(data.ulStatus) || 0 : ulDisplayMbps;

  const dlRot = mbpsToRotation(dlSourceVal, uiState === RUNNING && testStage === 1);
  const ulRot = mbpsToRotation(ulSourceVal, uiState === RUNNING && testStage === 3);

  const dlArcLen = Math.max(0, Math.min(510, (dlRot / 180) * 510));
  const ulArcLen = Math.max(0, Math.min(415, (ulRot / 180) * 415));

  const dlFmt = math.formatSpeedReading(dlSourceVal, autoGbps);
  const ulFmt = math.formatSpeedReading(ulSourceVal, autoGbps);

  const metrics = math.calculateRealMetrics(
    dlSamples,
    ulSamples,
    data.pingStatus,
    data.jitterStatus
  );

  const effectiveMaxSpeedMbps =
    uiState === RUNNING &&
    smoothedTelemetry?.maxSpeedDisplayMbps !== undefined &&
    smoothedTelemetry.maxSpeedDisplayMbps !== null &&
    Number.isFinite(smoothedTelemetry.maxSpeedDisplayMbps) &&
    smoothedTelemetry.maxSpeedDisplayMbps > 0
      ? smoothedTelemetry.maxSpeedDisplayMbps
      : metrics.maxSpeedMbps;

  const effectiveAvgSpeedMbps =
    uiState === RUNNING &&
    smoothedTelemetry?.avgSpeedDisplayMbps !== undefined &&
    smoothedTelemetry.avgSpeedDisplayMbps !== null &&
    Number.isFinite(smoothedTelemetry.avgSpeedDisplayMbps) &&
    smoothedTelemetry.avgSpeedDisplayMbps > 0
      ? smoothedTelemetry.avgSpeedDisplayMbps
      : metrics.avgSpeedMbps;

  const maxFmt =
    effectiveMaxSpeedMbps !== null
      ? math.formatSpeedReading(effectiveMaxSpeedMbps, autoGbps)
      : null;
  const avgFmt =
    effectiveAvgSpeedMbps !== null
      ? math.formatSpeedReading(effectiveAvgSpeedMbps, autoGbps)
      : null;

  const effectiveStabilityPercent =
    uiState === RUNNING &&
    smoothedTelemetry?.stabilityDisplayPercent !== undefined &&
    smoothedTelemetry.stabilityDisplayPercent !== null &&
    Number.isFinite(smoothedTelemetry.stabilityDisplayPercent) &&
    smoothedTelemetry.stabilityDisplayPercent > 0
      ? smoothedTelemetry.stabilityDisplayPercent
      : metrics.stabilityPercent;

  const stabRot =
    effectiveStabilityPercent !== null
      ? math.percentToRotation(effectiveStabilityPercent)
      : 0;
  const stabArcLen = Math.max(0, Math.min(415, (stabRot / 180) * 415));

  const formatLatency = (val: string | number | undefined) => {
    if (val === undefined || val === null || val === '') return '00';
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return '00';
    if (n < 10) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    return n.toFixed(0);
  };

  const dlProgressSource =
    uiState === RUNNING &&
    smoothedTelemetry?.dlProgressRatio !== undefined &&
    Number.isFinite(smoothedTelemetry.dlProgressRatio) &&
    smoothedTelemetry.dlProgressRatio > 0
      ? smoothedTelemetry.dlProgressRatio
      : Number(data.dlProgress) || 0;

  const ulProgressSource =
    uiState === RUNNING &&
    smoothedTelemetry?.ulProgressRatio !== undefined &&
    Number.isFinite(smoothedTelemetry.ulProgressRatio) &&
    smoothedTelemetry.ulProgressRatio > 0
      ? smoothedTelemetry.ulProgressRatio
      : Number(data.ulProgress) || 0;

  const pingSourceVal =
    uiState === RUNNING &&
    smoothedTelemetry?.pingDisplayMs !== undefined &&
    Number.isFinite(smoothedTelemetry.pingDisplayMs) &&
    smoothedTelemetry.pingDisplayMs > 0
      ? smoothedTelemetry.pingDisplayMs
      : data.pingStatus;

  const jitterSourceVal =
    uiState === RUNNING &&
    smoothedTelemetry?.jitterDisplayMs !== undefined &&
    Number.isFinite(smoothedTelemetry.jitterDisplayMs) &&
    smoothedTelemetry.jitterDisplayMs > 0
      ? smoothedTelemetry.jitterDisplayMs
      : data.jitterStatus;

  const dlBadge =
    uiState === RUNNING && testStage === 1
      ? isEnglish
        ? 'Testing download...'
        : 'جاري فحص التنزيل...'
      : isEnglish
        ? dlFmt.badgeEn || dlFmt.badgeAr
        : dlFmt.badgeAr;

  const ulBadge =
    uiState === RUNNING && testStage === 3
      ? isEnglish
        ? 'Testing upload...'
        : 'جاري فحص الرفع...'
      : isEnglish
        ? ulFmt.badgeEn || ulFmt.badgeAr
        : ulFmt.badgeAr;

  return {
    dlDisplayNumber: dlFmt.displayNumber,
    dlUnit: dlFmt.unitEn,
    dlUnitSub: isEnglish ? dlFmt.unitLabelEn || dlFmt.unitEn : dlFmt.unitAr,
    dlBadge,
    dlRotationDeg: dlRot,
    dlArcDash: `${dlArcLen.toFixed(1)} 680`,
    dlProgressDeg: Math.max(0, Math.min(180, dlProgressSource * 180)),
    ulDisplayNumber: ulFmt.displayNumber,
    ulUnit: ulFmt.unitEn,
    ulUnitSub: isEnglish ? ulFmt.unitLabelEn || ulFmt.unitEn : ulFmt.unitAr,
    ulBadge,
    ulRotationDeg: ulRot,
    ulArcDash: `${ulArcLen.toFixed(1)} 560`,
    ulProgressDeg: Math.max(0, Math.min(180, ulProgressSource * 180)),
    stabilityDisplay:
      effectiveStabilityPercent !== null
        ? String(Math.round(effectiveStabilityPercent))
        : '--',
    stabilityStatus: isEnglish
      ? metrics.stabilityLabelEn || metrics.stabilityLabelAr
      : metrics.stabilityLabelAr,
    stabilityArcDash: `${stabArcLen.toFixed(1)} 560`,
    maxSpeedDisplay: maxFmt ? maxFmt.displayNumber : '--',
    maxSpeedUnit: maxFmt ? maxFmt.unitEn : 'Mbps',
    avgSpeedDisplay: avgFmt ? avgFmt.displayNumber : '--',
    avgSpeedUnit: avgFmt ? avgFmt.unitEn : 'Mbps',
    pingDisplay: formatLatency(pingSourceVal),
    jitterDisplay: formatLatency(jitterSourceVal),
    hasLatency: Boolean(data.pingStatus && data.jitterStatus),
  };
}

async function ensureLibreSpeedScriptLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof window.Speedtest === 'function') return true;

  const candidateUrls = ['/speedtest.js', 'speedtest.js', '../speedtest.js'];
  for (const src of candidateUrls) {
    const loaded = await new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = src;
      script.onload = () => resolve(typeof window.Speedtest === 'function');
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    if (loaded) return true;
  }
  return typeof window.Speedtest === 'function';
}

export default function App() {
  const [uiState, setUiState] = useState<number>(INITIALIZING);
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return stored === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });
  const [autoGbps, setAutoGbps] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTO_GBPS_STORAGE_KEY);
      if (saved === '0' || saved === 'false') return false;
      if (saved === '1' || saved === 'true') return true;
    } catch {
      // ignore storage errors
    }
    return true;
  });
  const [servers, setServers] = useState<SpeedtestServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<SpeedtestServer | null>(null);
  const [serverDropdownOpen, setServerDropdownOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [usageOpen, setUsageOpen] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const [privacyOpen, setPrivacyOpen] = useState<boolean>(false);
  const [copyLinkActive, setCopyLinkActive] = useState<boolean>(false);
  const [testHistory, setTestHistory] = useState<NormalizedHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const math = typeof window !== 'undefined' ? window.TerraxTelemetryMath : undefined;
      if (math?.normalizeTestHistoryList) {
        return math.normalizeTestHistoryList(parsed);
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [historySortKey, setHistorySortKey] = useState<HistorySortKey>('date');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'speed' | 'usage' | 'stability' | 'gaming' | 'settings'>('speed');
  const [adRefreshTrigger, setAdRefreshTrigger] = useState<number>(0);
  const [testData, setTestData] = useState<LibreSpeedUpdateData | null>(null);
  const [dlDisplayMbps, setDlDisplayMbps] = useState<number>(0);
  const [ulDisplayMbps, setUlDisplayMbps] = useState<number>(0);
  const [smoothedTelemetry, setSmoothedTelemetry] = useState<SmoothedTelemetryValues>({
    stabilityDisplayPercent: null,
    pingDisplayMs: 0,
    jitterDisplayMs: 0,
    dlProgressRatio: 0,
    ulProgressRatio: 0,
    maxSpeedDisplayMbps: null,
    avgSpeedDisplayMbps: null,
  });
  const [statCountUp, setStatCountUp] = useState<{
    maxDisplay: string;
    maxUnit: string;
    avgDisplay: string;
    avgUnit: string;
    active: boolean;
  } | null>(null);

  const speedtestRef = useRef<SpeedtestInstance | null>(null);
  const dlSamplesRef = useRef<number[]>([]);
  const ulSamplesRef = useRef<number[]>([]);
  const lastSampleTsRef = useRef<number>(0);
  const currentTestBytesRef = useRef<number>(0);
  const currentRunIdRef = useRef<string | null>(null);
  const historyRecordedForRunRef = useRef<boolean>(false);
  const selectedServerRef = useRef<SpeedtestServer | null>(null);
  const langRef = useRef<'ar' | 'en'>(lang);
  const latestDataRef = useRef<LibreSpeedUpdateData | null>(null);
  const testDataDirtyRef = useRef<boolean>(false);
  const dlDisplayRef = useRef<number>(0);
  const ulDisplayRef = useRef<number>(0);
  const stabDisplayRef = useRef<number>(0);
  const pingDisplayRef = useRef<number>(0);
  const jitterDisplayRef = useRef<number>(0);
  const dlProgressRef = useRef<number>(0);
  const ulProgressRef = useRef<number>(0);
  const maxSpeedDisplayRef = useRef<number>(0);
  const avgSpeedDisplayRef = useRef<number>(0);
  const uiStateRef = useRef<number>(INITIALIZING);
  const isNavigatingRef = useRef<boolean>(false);
  const autoGbpsRef = useRef<boolean>(autoGbps);
  const statCountUpCancelRef = useRef<(() => void) | null>(null);
  const statCardsLoopRef = useRef<ReturnType<NonNullable<TelemetryMathApi['createStatCardsRafLoop']>> | null>(null);
  const gaugeRafThrottlerRef = useRef<ReturnType<NonNullable<TelemetryMathApi['createRafGaugeThrottler']>> | null>(null);
  const detectedRefreshRateRef = useRef<number>(60);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    autoGbpsRef.current = autoGbps;
  }, [autoGbps]);

  useEffect(() => {
    selectedServerRef.current = selectedServer;
  }, [selectedServer]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const handleHistorySort = useCallback((sortKey: HistorySortKey) => {
    setHistorySortKey((prevKey) => {
      if (prevKey === sortKey) {
        setHistorySortDir((prevDir) => (prevDir === 'desc' ? 'asc' : 'desc'));
        return prevKey;
      }
      setHistorySortDir(sortKey === 'server' || sortKey === 'ping' ? 'asc' : 'desc');
      return sortKey;
    });
  }, []);

  const [usageTestsCountUp, setUsageTestsCountUp] = useState<{
    displayValue: string;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    if (!usageOpen) {
      setUsageTestsCountUp(null);
      return;
    }
    const targetCount = testHistory.length;
    const math = typeof window !== 'undefined' ? window.TerraxTelemetryMath : undefined;
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!math?.animateCompletedTestsCountUp || reducedMotion || targetCount <= 0) {
      setUsageTestsCountUp({displayValue: String(targetCount), active: false});
      return;
    }

    setUsageTestsCountUp({displayValue: '0', active: true});
    const cancel = math.animateCompletedTestsCountUp({
      targetCount,
      durationMs: 650,
      reducedMotion,
      onFrame: ({displayValue, isComplete}) => {
        setUsageTestsCountUp({
          displayValue,
          active: !isComplete,
        });
      },
      onComplete: () => {
        setUsageTestsCountUp({
          displayValue: String(targetCount),
          active: false,
        });
      },
    });

    return () => {
      cancel();
    };
  }, [usageOpen, testHistory.length]);

  const computeConnectionInfo = useCallback(
    (activeLang: 'ar' | 'en'): RealConnectionInfo => {
      const math = typeof window !== 'undefined' ? window.TerraxTelemetryMath : undefined;
      if (math && typeof math.resolveRealConnectionInfo === 'function') {
        return math.resolveRealConnectionInfo(
          typeof navigator !== 'undefined' ? navigator : undefined,
          activeLang
        );
      }
      const isEn = activeLang === 'en';
      return {
        kind: 'unavailable',
        source: 'unsupported',
        physicalType: null,
        effectiveType: null,
        hasPhysicalType: false,
        hasEffectiveType: false,
        labelAr: 'نوع الاتصال غير متاح',
        labelEn: 'Connection type unavailable',
        label: isEn ? 'Connection type unavailable' : 'نوع الاتصال غير متاح',
        detailAr: 'المتصفح الحالي لا يوفر معلومات نوع الاتصال',
        detailEn: 'Browser does not expose connection type information',
        detail: isEn
          ? 'Browser does not expose connection type information'
          : 'المتصفح الحالي لا يوفر معلومات نوع الاتصال',
      };
    },
    []
  );

  const [connectionInfo, setConnectionInfo] = useState<RealConnectionInfo>(() =>
    computeConnectionInfo(lang)
  );

  useEffect(() => {
    const refreshConnection = () => {
      setConnectionInfo(computeConnectionInfo(lang));
    };
    refreshConnection();

    window.addEventListener('online', refreshConnection);
    window.addEventListener('offline', refreshConnection);

    const nav = navigator as Navigator & {
      connection?: EventTarget;
      mozConnection?: EventTarget;
      webkitConnection?: EventTarget;
    };
    const connObj = nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
    try {
      connObj?.addEventListener?.('change', refreshConnection);
    } catch {
      // Ignore unsupported NetworkInformation event listener
    }

    return () => {
      window.removeEventListener('online', refreshConnection);
      window.removeEventListener('offline', refreshConnection);
      try {
        connObj?.removeEventListener?.('change', refreshConnection);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [lang, computeConnectionInfo, uiState]);

  /**
   * Unified silent Yandex RTB ad refresh function.
   * Respects the Network Isolation Lock (never refreshes while a speed test is RUNNING)
   * and updates Yandex ad units seamlessly in the background without user intervention.
   */
  const refreshYandexAdUnits = useCallback((reason = 'periodic-30s') => {
    if (uiStateRef.current === RUNNING) {
      return false;
    }
    setAdRefreshTrigger((prev) => prev + 1);
    try {
      const globalEngine = (
        window as unknown as {
          TerraxSmartAdEngine?: {refreshAllSlots?: (r: string) => boolean};
        }
      ).TerraxSmartAdEngine;
      globalEngine?.refreshAllSlots?.(reason);
    } catch {
      // Ignore external engine sync errors
    }
    return true;
  }, []);

  // Periodic 30-second silent interval to refresh Yandex ad units automatically without user intervention
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (uiStateRef.current !== RUNNING) {
        refreshYandexAdUnits('silent-interval-30s');
      }
    }, YANDEX_SILENT_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshYandexAdUnits]);

  const handleLanguageChange = useCallback((nextLang: 'ar' | 'en') => {
    setLang(nextLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage restrictions
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = nextLang;
      document.documentElement.dir = nextLang === 'en' ? 'ltr' : 'rtl';
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    }
  }, [lang]);

  // Initialize real LibreSpeed engine, settings.json, and server-list.json
  useEffect(() => {
    let mounted = true;

    async function bootstrapLibreSpeed() {
      const engineReady = await ensureLibreSpeedScriptLoaded();
      if (!mounted || !engineReady || typeof window.Speedtest !== 'function') {
        return;
      }

      const st = new window.Speedtest();
      speedtestRef.current = st;

      st.onupdate = (data: LibreSpeedUpdateData) => {
        if (!mounted) return;
        const now = performance.now();
        const dtSeconds =
          lastSampleTsRef.current > 0
            ? Math.min(1, Math.max(0.02, (now - lastSampleTsRef.current) / 1000))
            : 0.15;
        lastSampleTsRef.current = now;

        const stage = Number(data.testState);
        if (stage === 1) {
          const dlVal = Number(data.dlStatus);
          if (Number.isFinite(dlVal) && dlVal > 0) {
            dlSamplesRef.current.push(dlVal);
            currentTestBytesRef.current += (dlVal * 1e6 * dtSeconds) / 8;
          }
        } else if (stage === 3) {
          const ulVal = Number(data.ulStatus);
          if (Number.isFinite(ulVal) && ulVal > 0) {
            ulSamplesRef.current.push(ulVal);
            currentTestBytesRef.current += (ulVal * 1e6 * dtSeconds) / 8;
          }
        }
        latestDataRef.current = data;
        testDataDirtyRef.current = true;
        // Coalesce bursty worker updates via 60fps requestAnimationFrame throttler
        if (gaugeRafThrottlerRef.current) {
          gaugeRafThrottlerRef.current.schedule(false);
        } else {
          requestAnimationFrame(() => {
            if (!mounted) return;
            setTestData({...data});
          });
        }
      };

      st.onend = (aborted: boolean) => {
        if (!mounted) return;
        const nextState = aborted ? READY : FINISHED;
        uiStateRef.current = nextState;
        setUiState(nextState);
        if (statCountUpCancelRef.current) {
          statCountUpCancelRef.current();
          statCountUpCancelRef.current = null;
        }
        if (!aborted) {
          // Release Network Isolation Lock and trigger State-Driven Smart Refresh on test completion
          try {
            const globalEngine = (
              window as unknown as {
                TerraxSmartAdEngine?: {
                  setTestingState?: (isTesting: boolean) => boolean;
                  onTestComplete?: (sourcePage: string) => boolean;
                };
              }
            ).TerraxSmartAdEngine;
            globalEngine?.onTestComplete?.('speed');
          } catch {
            // Ignore external engine sync errors
          }
          refreshYandexAdUnits('onTestComplete');

          const math = window.TerraxTelemetryMath;
          if (math?.calculateRealMetrics && latestDataRef.current) {
            const finalMetrics = math.calculateRealMetrics(
              dlSamplesRef.current,
              ulSamplesRef.current,
              latestDataRef.current.pingStatus,
              latestDataRef.current.jitterStatus
            );

            if (!historyRecordedForRunRef.current) {
              historyRecordedForRunRef.current = true;
              const nowDate = new Date();
              const runId =
                currentRunIdRef.current ||
                `run_${nowDate.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
              currentRunIdRef.current = runId;
              const rawRun = {
                runId,
                epochMs: nowDate.getTime(),
                serverName:
                  selectedServerRef.current?.name ||
                  (langRef.current === 'en' ? 'Yemen' : 'اليمن'),
                dlMbps: Number(latestDataRef.current.dlStatus) || 0,
                ulMbps: Number(latestDataRef.current.ulStatus) || 0,
                pingMs: Number(latestDataRef.current.pingStatus) || 0,
                jitterMs: Number(latestDataRef.current.jitterStatus) || 0,
                stabilityPercent: finalMetrics.stabilityPercent,
                megabytesUsed: Math.max(
                  0.5,
                  Number((currentTestBytesRef.current / (1024 * 1024)).toFixed(1))
                ),
              };
              setTestHistory((prevHistory) => {
                const updated = math.appendTestHistoryEntry
                  ? math.appendTestHistoryEntry(prevHistory, rawRun, 25, nowDate)
                  : prevHistory;
                try {
                  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
                } catch {
                  // Ignore storage restrictions
                }
                return updated;
              });
            }

            const reducedMotion =
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (statCardsLoopRef.current) {
              statCountUpCancelRef.current = statCardsLoopRef.current.startCountUp({
                maxSpeedMbps: finalMetrics.maxSpeedMbps,
                avgSpeedMbps: finalMetrics.avgSpeedMbps,
                allowGbps: autoGbpsRef.current,
                durationMs: 950,
                reducedMotion,
                standalone: false,
                onComplete: () => {
                  if (!mounted) return;
                  statCountUpCancelRef.current = null;
                },
              });
            } else if (math?.animateStatCountUp) {
              statCountUpCancelRef.current = math.animateStatCountUp({
                maxSpeedMbps: finalMetrics.maxSpeedMbps,
                avgSpeedMbps: finalMetrics.avgSpeedMbps,
                allowGbps: autoGbpsRef.current,
                durationMs: 950,
                reducedMotion,
                onFrame: ({ maxFrame, avgFrame, isComplete }) => {
                  if (!mounted) return;
                  setStatCountUp({
                    maxDisplay: maxFrame.displayNumber,
                    maxUnit: maxFrame.unitEn,
                    avgDisplay: avgFrame.displayNumber,
                    avgUnit: avgFrame.unitEn,
                    active: !isComplete && !reducedMotion,
                  });
                },
                onComplete: () => {
                  if (!mounted) return;
                  statCountUpCancelRef.current = null;
                  setStatCountUp(null);
                },
              });
            }
          }
        } else {
          try {
            const globalEngine = (
              window as unknown as {
                TerraxSmartAdEngine?: {
                  setTestingState?: (isTesting: boolean) => boolean;
                };
              }
            ).TerraxSmartAdEngine;
            globalEngine?.setTestingState?.(false);
          } catch {
            // Ignore external engine sync errors
          }
          statCardsLoopRef.current?.reset('--', 'Mbps');
          setStatCountUp(null);
        }
        testDataDirtyRef.current = true;
        if (gaugeRafThrottlerRef.current) {
          gaugeRafThrottlerRef.current.schedule(true);
        } else if (latestDataRef.current) {
          requestAnimationFrame(() => {
            if (!mounted || !latestDataRef.current) return;
            const finalDl = Number(latestDataRef.current.dlStatus) || 0;
            const finalUl = Number(latestDataRef.current.ulStatus) || 0;
            dlDisplayRef.current = finalDl;
            ulDisplayRef.current = finalUl;
            setTestData({...latestDataRef.current});
            setDlDisplayMbps(finalDl);
            setUlDisplayMbps(finalUl);
          });
        }
      };

      // Load settings.json
      try {
        const res = await fetch('settings.json');
        if (res.ok) {
          const settings = await res.json();
          if (settings && typeof settings === 'object') {
            for (const [key, val] of Object.entries(settings)) {
              st.setParameter(key, val);
            }
          }
        }
      } catch {
        // Fallback to engine defaults
      }

      // Load server-list.json
      try {
        const serverSource = window.SPEEDTEST_SERVERS ?? 'server-list.json';
        const loadedServers: SpeedtestServer[] = Array.isArray(serverSource)
          ? serverSource
          : await fetch(serverSource).then((r) => r.json());

        if (!mounted || !Array.isArray(loadedServers) || loadedServers.length === 0) {
          return;
        }

        if (loadedServers.length === 1) {
          st.setSelectedServer(loadedServers[0]);
          setServers(loadedServers);
          setSelectedServer(loadedServers[0]);
          setUiState(READY);
          return;
        }

        st.addTestPoints(loadedServers);
        st.selectServer((bestServer) => {
          if (!mounted) return;
          const alive = loadedServers.filter(
            (s) => s.pingT !== -1 || (typeof s.server === 'string' && s.server.startsWith('//'))
          );
          const finalServers = alive.length > 0 ? alive : loadedServers;
          const yemenServer = finalServers.find((s) => s.name === 'اليمن');
          const chosen = yemenServer || bestServer || finalServers[0];
          if (chosen) {
            st.setSelectedServer(chosen);
            setSelectedServer(chosen);
          }
          setServers(finalServers);
          setUiState(READY);
        });
      } catch {
        if (mounted) {
          setUiState(READY);
        }
      }
    }

    bootstrapLibreSpeed();

    return () => {
      mounted = false;
      if (speedtestRef.current && speedtestRef.current.getState() === 3) {
        try {
          speedtestRef.current.abort();
        } catch {
          // Ignore abort errors on unmount
        }
      }
    };
  }, [refreshYandexAdUnits]);

  // Dynamic high-refresh-rate requestAnimationFrame gauge rendering loop for all 4K telemetry UI updates
  useEffect(() => {
    detectedRefreshRateRef.current = quantizeDeviceRefreshRate(
      detectedRefreshRateRef.current || 60
    );
    let fallbackRafId = 0;
    let calibrationRafId = 0;
    let lastFrameTime = 0;
    let lastVsyncTime = 0;
    let fallbackPendingForce = false;
    const vsyncDeltaWindow: number[] = [];

    const scheduleWindowRaf = (cb: FrameRequestCallback): number => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(cb);
      }
      return requestAnimationFrame(cb);
    };

    const cancelWindowRaf = (id: number): void => {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(id);
        return;
      }
      cancelAnimationFrame(id);
    };

    const applyDetectedRefreshRate = (nextFps: number) => {
      const quantized = quantizeDeviceRefreshRate(nextFps);
      if (quantized !== detectedRefreshRateRef.current) {
        detectedRefreshRateRef.current = quantized;
        gaugeRafThrottlerRef.current?.setTargetFps?.(quantized);
        statCardsLoopRef.current?.setTargetFps?.(quantized);
      }
    };

    const recordVsyncTimestamp = (nowMs: number) => {
      if (lastVsyncTime > 0) {
        const deltaMs = nowMs - lastVsyncTime;
        if (deltaMs >= 2.5 && deltaMs <= 25) {
          vsyncDeltaWindow.push(deltaMs);
          if (vsyncDeltaWindow.length > 12) {
            vsyncDeltaWindow.shift();
          }
          if (vsyncDeltaWindow.length >= 4) {
            const estimated = estimateRefreshRateFromDeltas(
              vsyncDeltaWindow,
              detectedRefreshRateRef.current
            );
            applyDetectedRefreshRate(estimated);
          }
        }
      }
      lastVsyncTime = nowMs;
    };

    // Initial VSync refresh rate calibration probe using window.requestAnimationFrame
    let calibrationSamples = 0;
    const calibrateStep = (timestamp: number) => {
      calibrationRafId = 0;
      const now =
        Number.isFinite(timestamp) && timestamp > 0 ? timestamp : performance.now();
      recordVsyncTimestamp(now);
      calibrationSamples += 1;
      if (calibrationSamples < 10) {
        calibrationRafId = scheduleWindowRaf(calibrateStep);
      }
    };
    calibrationRafId = scheduleWindowRaf(calibrateStep);

    const mathInit = window.TerraxTelemetryMath;
    if (mathInit?.createStatCardsRafLoop && !statCardsLoopRef.current) {
      statCardsLoopRef.current = mathInit.createStatCardsRafLoop({
        targetFps: detectedRefreshRateRef.current,
        onCommit: ({ maxDisplay, maxUnit, avgDisplay, avgUnit, countingUp }) => {
          setStatCountUp((prev) => {
            if (
              prev &&
              prev.maxDisplay === maxDisplay &&
              prev.maxUnit === maxUnit &&
              prev.avgDisplay === avgDisplay &&
              prev.avgUnit === avgUnit &&
              prev.active === countingUp
            ) {
              return prev;
            }
            return {
              maxDisplay,
              maxUnit,
              avgDisplay,
              avgUnit,
              active: countingUp,
            };
          });
        },
      });
    }

    const renderGaugeFrame = (
      dt: number,
      now: number,
      throttlerDetectedFps?: number
    ): boolean => {
      if (
        typeof throttlerDetectedFps === 'number' &&
        Number.isFinite(throttlerDetectedFps) &&
        throttlerDetectedFps > 0
      ) {
        applyDetectedRefreshRate(throttlerDetectedFps);
      } else {
        recordVsyncTimestamp(now);
      }

      const activeRefreshRate = detectedRefreshRateRef.current || 60;
      statCardsLoopRef.current?.setTargetFps?.(activeRefreshRate);

      const math = window.TerraxTelemetryMath;
      const data = latestDataRef.current;
      let stillInterpolating = false;

      if (!data) {
        if (testDataDirtyRef.current) {
          testDataDirtyRef.current = false;
          dlDisplayRef.current = 0;
          ulDisplayRef.current = 0;
          stabDisplayRef.current = 0;
          pingDisplayRef.current = 0;
          jitterDisplayRef.current = 0;
          dlProgressRef.current = 0;
          ulProgressRef.current = 0;
          maxSpeedDisplayRef.current = 0;
          avgSpeedDisplayRef.current = 0;
          setDlDisplayMbps(0);
          setUlDisplayMbps(0);
          setSmoothedTelemetry({
            stabilityDisplayPercent: null,
            pingDisplayMs: 0,
            jitterDisplayMs: 0,
            dlProgressRatio: 0,
            ulProgressRatio: 0,
            maxSpeedDisplayMbps: null,
            avgSpeedDisplayMbps: null,
          });
          setTestData(null);
        }
      } else if (math) {
        const reducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isRunning = uiStateRef.current === RUNNING;
        const stage = Number(data.testState);
        const snapAll = !isRunning || reducedMotion;
        const snapDl = snapAll || stage !== 1;
        const snapUl = snapAll || stage !== 3;
        const snapPing = snapAll || stage !== 2;

        const targetDl = Number(data.dlStatus) || 0;
        const targetUl = Number(data.ulStatus) || 0;
        const targetPing = Number(data.pingStatus) || 0;
        const targetJitter = Number(data.jitterStatus) || 0;
        const targetDlProgress = Number(data.dlProgress) || 0;
        const targetUlProgress = Number(data.ulProgress) || 0;

        const nextDl = math.smoothNumericValue(
          dlDisplayRef.current,
          targetDl,
          dt,
          snapDl
        );
        const nextUl = math.smoothNumericValue(
          ulDisplayRef.current,
          targetUl,
          dt,
          snapUl
        );
        const nextPing = math.smoothNumericValue(
          pingDisplayRef.current,
          targetPing,
          dt,
          snapPing
        );
        const nextJitter = math.smoothNumericValue(
          jitterDisplayRef.current,
          targetJitter,
          dt,
          snapPing
        );
        const nextDlProgress = math.smoothNumericValue(
          dlProgressRef.current,
          targetDlProgress,
          dt,
          snapDl
        );
        const nextUlProgress = math.smoothNumericValue(
          ulProgressRef.current,
          targetUlProgress,
          dt,
          snapUl
        );

        let nextStab = stabDisplayRef.current;
        let nextMaxSpeed = maxSpeedDisplayRef.current;
        let nextAvgSpeed = avgSpeedDisplayRef.current;

        if (math.calculateRealMetrics) {
          const liveMetrics = math.calculateRealMetrics(
            dlSamplesRef.current,
            ulSamplesRef.current,
            data.pingStatus,
            data.jitterStatus
          );
          const targetStab = liveMetrics.stabilityPercent ?? 0;
          const targetMax = liveMetrics.maxSpeedMbps ?? 0;
          const targetAvg = liveMetrics.avgSpeedMbps ?? 0;

          nextStab =
            targetStab > 0
              ? math.smoothNumericValue(
                  stabDisplayRef.current,
                  targetStab,
                  dt,
                  snapAll
                )
              : 0;
          nextMaxSpeed =
            targetMax > 0
              ? math.smoothNumericValue(
                  maxSpeedDisplayRef.current,
                  targetMax,
                  dt,
                  snapAll
                )
              : 0;
          nextAvgSpeed =
            targetAvg > 0
              ? math.smoothNumericValue(
                  avgSpeedDisplayRef.current,
                  targetAvg,
                  dt,
                  snapAll
                )
              : 0;

          if (isRunning && statCardsLoopRef.current) {
            statCardsLoopRef.current.setLiveTargets(
              liveMetrics.maxSpeedMbps,
              liveMetrics.avgSpeedMbps,
              autoGbpsRef.current,
              true,
              false
            );
          }

          if (
            isRunning &&
            ((targetStab > 0 && Math.abs(targetStab - nextStab) > 0.05) ||
              (targetMax > 0 && Math.abs(targetMax - nextMaxSpeed) > 0.05) ||
              (targetAvg > 0 && Math.abs(targetAvg - nextAvgSpeed) > 0.05))
          ) {
            stillInterpolating = true;
          }
        }

        if (
          isRunning &&
          (Math.abs(targetDl - nextDl) > 0.05 ||
            Math.abs(targetUl - nextUl) > 0.05 ||
            Math.abs(targetPing - nextPing) > 0.05 ||
            Math.abs(targetJitter - nextJitter) > 0.05 ||
            Math.abs(targetDlProgress - nextDlProgress) > 0.005 ||
            Math.abs(targetUlProgress - nextUlProgress) > 0.005)
        ) {
          stillInterpolating = true;
        }

        if (Math.abs(nextDl - dlDisplayRef.current) > 0.01 || testDataDirtyRef.current) {
          dlDisplayRef.current = nextDl;
          setDlDisplayMbps(nextDl);
        }
        if (Math.abs(nextUl - ulDisplayRef.current) > 0.01 || testDataDirtyRef.current) {
          ulDisplayRef.current = nextUl;
          setUlDisplayMbps(nextUl);
        }

        const stabChanged = Math.abs(nextStab - stabDisplayRef.current) > 0.05;
        const pingChanged = Math.abs(nextPing - pingDisplayRef.current) > 0.01;
        const jitterChanged = Math.abs(nextJitter - jitterDisplayRef.current) > 0.01;
        const dlProgChanged = Math.abs(nextDlProgress - dlProgressRef.current) > 0.002;
        const ulProgChanged = Math.abs(nextUlProgress - ulProgressRef.current) > 0.002;
        const maxChanged = Math.abs(nextMaxSpeed - maxSpeedDisplayRef.current) > 0.02;
        const avgChanged = Math.abs(nextAvgSpeed - avgSpeedDisplayRef.current) > 0.02;

        if (
          stabChanged ||
          pingChanged ||
          jitterChanged ||
          dlProgChanged ||
          ulProgChanged ||
          maxChanged ||
          avgChanged ||
          testDataDirtyRef.current
        ) {
          stabDisplayRef.current = nextStab;
          pingDisplayRef.current = nextPing;
          jitterDisplayRef.current = nextJitter;
          dlProgressRef.current = nextDlProgress;
          ulProgressRef.current = nextUlProgress;
          maxSpeedDisplayRef.current = nextMaxSpeed;
          avgSpeedDisplayRef.current = nextAvgSpeed;
          setSmoothedTelemetry({
            stabilityDisplayPercent: nextStab > 0 ? nextStab : null,
            pingDisplayMs: nextPing,
            jitterDisplayMs: nextJitter,
            dlProgressRatio: nextDlProgress,
            ulProgressRatio: nextUlProgress,
            maxSpeedDisplayMbps: nextMaxSpeed > 0 ? nextMaxSpeed : null,
            avgSpeedDisplayMbps: nextAvgSpeed > 0 ? nextAvgSpeed : null,
          });
        }

        if (testDataDirtyRef.current) {
          testDataDirtyRef.current = false;
          setTestData({...data});
        }
      }

      let statCardsActive = false;
      if (statCardsLoopRef.current) {
        statCardsActive = Boolean(statCardsLoopRef.current.syncFrame(now, dt));
      }

      // Only continue scheduling frames while gauge values or stat cards are actively interpolating
      // or dirty telemetry is queued, eliminating idle CPU waste between network samples.
      return Boolean(
        stillInterpolating ||
          statCardsActive ||
          testDataDirtyRef.current
      );
    };

    if (mathInit?.createRafGaugeThrottler) {
      gaugeRafThrottlerRef.current = mathInit.createRafGaugeThrottler(
        renderGaugeFrame,
        detectedRefreshRateRef
      );
    } else {
      const fallbackTick = (now: number) => {
        fallbackRafId = 0;
        recordVsyncTimestamp(now);
        const math = window.TerraxTelemetryMath;
        const {
          targetFps: currentRefreshRate,
          intervalMs: frameIntervalMs,
          minElapsedMs,
          minDtSeconds,
        } = computeDynamicThrottleInterval(detectedRefreshRateRef);
        let shouldRender = true;
        let dt = 1 / currentRefreshRate;

        if (math?.shouldRenderGaugeFrame) {
          const gate = math.shouldRenderGaugeFrame(
            now,
            lastFrameTime,
            detectedRefreshRateRef,
            fallbackPendingForce
          );
          shouldRender = gate.shouldRender;
          dt = gate.dtSeconds;
          if (shouldRender) {
            fallbackPendingForce = false;
            lastFrameTime = gate.nextLastFrameMs;
          }
        } else {
          const elapsed = lastFrameTime > 0 ? now - lastFrameTime : frameIntervalMs;
          if (
            !fallbackPendingForce &&
            lastFrameTime > 0 &&
            elapsed < minElapsedMs
          ) {
            shouldRender = false;
          } else {
            fallbackPendingForce = false;
            dt = Math.min(0.05, Math.max(minDtSeconds, elapsed / 1000));
            lastFrameTime = now;
          }
        }

        const keepRunning = shouldRender
          ? renderGaugeFrame(dt, now, currentRefreshRate)
          : true;
        if (keepRunning && fallbackRafId === 0) {
          fallbackRafId = scheduleWindowRaf(fallbackTick);
        }
      };

      gaugeRafThrottlerRef.current = {
        schedule: (force?: boolean) => {
          if (force) {
            fallbackPendingForce = true;
          }
          if (fallbackRafId === 0) {
            fallbackRafId = scheduleWindowRaf(fallbackTick);
          }
        },
        cancel: () => {
          if (fallbackRafId !== 0) {
            cancelWindowRaf(fallbackRafId);
            fallbackRafId = 0;
          }
          fallbackPendingForce = false;
        },
        setTargetFps: (nextFps: number) => {
          applyDetectedRefreshRate(nextFps);
          return detectedRefreshRateRef.current;
        },
        getTargetFps: () => detectedRefreshRateRef.current,
        getThrottleIntervalMs: () =>
          computeDynamicThrottleInterval(detectedRefreshRateRef).intervalMs,
        isPending: () => fallbackRafId !== 0,
      };
    }

    return () => {
      if (calibrationRafId !== 0) {
        cancelWindowRaf(calibrationRafId);
        calibrationRafId = 0;
      }
      gaugeRafThrottlerRef.current?.cancel();
      statCardsLoopRef.current?.cancel();
    };
  }, []);

  const handleSelectServer = useCallback((srv: SpeedtestServer) => {
    const st = speedtestRef.current;
    if (!st || uiStateRef.current === RUNNING || st.getState() === 3) return;
    st.setSelectedServer(srv);
    setSelectedServer(srv);
    setServerDropdownOpen(false);
    setUiState(READY);
  }, []);

  const startRunTokenRef = useRef<number>(0);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const warmupTimeoutRef = useRef<number | null>(null);
  const [arcFlickerActive, setArcFlickerActive] = useState<boolean>(false);
  const arcFlickerTimeoutRef = useRef<number | null>(null);

  const clearGaugeArcFlicker = useCallback(() => {
    if (arcFlickerTimeoutRef.current !== null) {
      window.clearTimeout(arcFlickerTimeoutRef.current);
      arcFlickerTimeoutRef.current = null;
    }
    setArcFlickerActive(false);
  }, []);

  const triggerGaugeArcFlicker = useCallback(() => {
    if (arcFlickerTimeoutRef.current !== null) {
      window.clearTimeout(arcFlickerTimeoutRef.current);
      arcFlickerTimeoutRef.current = null;
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setArcFlickerActive(false);
      return;
    }
    setArcFlickerActive(true);
    arcFlickerTimeoutRef.current = window.setTimeout(() => {
      arcFlickerTimeoutRef.current = null;
      setArcFlickerActive(false);
    }, 620);
  }, []);

  useEffect(() => {
    return () => {
      if (arcFlickerTimeoutRef.current !== null) {
        window.clearTimeout(arcFlickerTimeoutRef.current);
        arcFlickerTimeoutRef.current = null;
      }
    };
  }, []);

  const cancelPendingWarmup = useCallback(() => {
    if (warmupTimeoutRef.current !== null) {
      window.clearTimeout(warmupTimeoutRef.current);
      warmupTimeoutRef.current = null;
    }
    if (warmupAbortRef.current) {
      try {
        warmupAbortRef.current.abort();
      } catch {
        // ignore abort error
      }
      warmupAbortRef.current = null;
    }
  }, []);

  const handleStartOrAbort = useCallback(() => {
    const st = speedtestRef.current;
    if (!st) return;

    if (uiState === RUNNING || st.getState() === 3) {
      startRunTokenRef.current += 1;
      cancelPendingWarmup();
      clearGaugeArcFlicker();
      if (statCountUpCancelRef.current) {
        statCountUpCancelRef.current();
        statCountUpCancelRef.current = null;
      }
      statCardsLoopRef.current?.reset('--', 'Mbps');
      setStatCountUp(null);
      try {
        const globalEngine = (
          window as unknown as {
            TerraxSmartAdEngine?: {
              setTestingState?: (isTesting: boolean) => boolean;
            };
          }
        ).TerraxSmartAdEngine;
        globalEngine?.setTestingState?.(false);
      } catch {
        // Ignore external engine sync errors
      }
      try {
        if (st.getState() === 3) {
          st.abort();
        } else {
          setUiState(READY);
        }
      } catch {
        setUiState(READY);
      }
      return;
    }

    if (uiState === READY || uiState === FINISHED) {
      startRunTokenRef.current += 1;
      const activeRunToken = startRunTokenRef.current;
      cancelPendingWarmup();
      triggerGaugeArcFlicker();
      if (statCountUpCancelRef.current) {
        statCountUpCancelRef.current();
        statCountUpCancelRef.current = null;
      }
      statCardsLoopRef.current?.reset('--', 'Mbps');
      setStatCountUp(null);
      dlSamplesRef.current = [];
      ulSamplesRef.current = [];
      lastSampleTsRef.current = performance.now();
      currentTestBytesRef.current = 0;
      currentRunIdRef.current = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      historyRecordedForRunRef.current = false;
      latestDataRef.current = null;
      testDataDirtyRef.current = true;
      // Activate Network Isolation Lock before starting bandwidth Web Worker
      try {
        const globalEngine = (
          window as unknown as {
            TerraxSmartAdEngine?: {
              setTestingState?: (isTesting: boolean) => boolean;
            };
          }
        ).TerraxSmartAdEngine;
        globalEngine?.setTestingState?.(true);
      } catch {
        // Ignore external engine sync errors
      }
      uiStateRef.current = RUNNING;
      setUiState(RUNNING);
      gaugeRafThrottlerRef.current?.schedule(true);

      // Pre-test socket warm-up to verify latency to 'Yemen' server and prioritize if <= threshold
      const yemenCandidate = servers.find((s) => s.name === 'اليمن' || s.name === 'Yemen');
      if (yemenCandidate && typeof fetch === 'function') {
        const basePath = `${yemenCandidate.server || ''}${yemenCandidate.pingURL || 'backend/empty.php'}`;
        const pingUrl = basePath
          ? `${basePath}${basePath.includes('?') ? '&' : '?'}cors=true&r=${Math.random()}`
          : null;
        if (pingUrl) {
          const t0 = performance.now();
          const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
          warmupAbortRef.current = ctrl;
          fetch(pingUrl, { cache: 'no-store', signal: ctrl?.signal })
            .then(() => {
              if (startRunTokenRef.current !== activeRunToken || uiStateRef.current !== RUNNING) {
                return;
              }
              const latency = performance.now() - t0;
              // Reasonable threshold: <= 250ms; keep minimum warm RTT
              if (latency > 0 && latency <= 250 && st.getState() !== 3) {
                yemenCandidate.pingT =
                  typeof yemenCandidate.pingT === 'number' && yemenCandidate.pingT > 0
                    ? Math.min(yemenCandidate.pingT, latency)
                    : latency;
                st.setSelectedServer(yemenCandidate);
                setSelectedServer(yemenCandidate);
              }
            })
            .catch(() => {})
            .finally(() => {
              if (warmupAbortRef.current === ctrl) {
                warmupAbortRef.current = null;
              }
              if (startRunTokenRef.current !== activeRunToken || uiStateRef.current !== RUNNING) {
                return;
              }
              warmupTimeoutRef.current = window.setTimeout(() => {
                warmupTimeoutRef.current = null;
                if (
                  startRunTokenRef.current === activeRunToken &&
                  uiStateRef.current === RUNNING &&
                  st.getState() !== 3
                ) {
                  st.start();
                }
              }, 20);
            });
          return;
        }
      }

      if (startRunTokenRef.current === activeRunToken && st.getState() !== 3) {
        st.start();
      }
    }
  }, [uiState, servers, cancelPendingWarmup, clearGaugeArcFlicker, triggerGaugeArcFlicker]);

  const handleTabSwitch = useCallback(
    (tab: 'speed' | 'usage' | 'stability' | 'gaming' | 'settings') => {
      if (tab === activeTab) return;
      if (isNavigatingRef.current) return;
      setActiveTab(tab);
      if (tab === 'settings') {
        setSettingsOpen(true);
      } else {
        setSettingsOpen(false);
      }
      if (tab === 'usage') {
        setUsageOpen(true);
      } else {
        setUsageOpen(false);
      }
      if (tab === 'gaming' || tab === 'stability') {
        isNavigatingRef.current = true;
        startRunTokenRef.current += 1;
        cancelPendingWarmup();
        clearGaugeArcFlicker();
        if (statCountUpCancelRef.current) {
          statCountUpCancelRef.current();
          statCountUpCancelRef.current = null;
        }
        gaugeRafThrottlerRef.current?.cancel();
        try {
          if (speedtestRef.current?.getState() === 3) {
            speedtestRef.current.abort();
          }
        } catch {
          // ignore
        }
        window.location.assign(tab === 'gaming' ? 'gaming.html' : 'stability.html');
        return;
      }
      refreshYandexAdUnits(`tab-switch:${tab}`);
    },
    [activeTab, refreshYandexAdUnits, cancelPendingWarmup, clearGaugeArcFlicker]
  );

  const telemetry = computeRealTimeGaugeTelemetry(
    testData,
    dlSamplesRef.current,
    ulSamplesRef.current,
    dlDisplayMbps,
    ulDisplayMbps,
    autoGbps,
    lang,
    uiState,
    smoothedTelemetry
  );

  const isEnglish = lang === 'en';
  const gaugesEnabled = uiState === RUNNING || uiState === FINISHED;
  const gaugesRunning = uiState === RUNNING;

  const buttonLabel = isEnglish
    ? uiState === INITIALIZING
      ? 'Loading...'
      : uiState === RUNNING
        ? 'Abort'
        : uiState === FINISHED
          ? 'Restart'
          : "Let's start"
    : uiState === INITIALIZING
      ? 'جاري التحميل...'
      : uiState === RUNNING
        ? 'إيقاف الاختبار'
        : 'بدء اختبار جديد';

  return (
    <div className="terrax-cyber-shell" data-layer="main-frame">
      {React.createElement('amp-auto-ads', {
        type: 'adsense',
        'data-ad-client': 'ca-pub-1225026489802055',
      })}
      <div className="panel-ambient-backlight" aria-hidden="true" />

      <header className="terrax-header" data-layer="header-surface">
        <div className="header-title-side">
          <span className="cyber-header-dot" aria-hidden="true" />
          <span className="header-section-title">
            {isEnglish
              ? 'Core Internet Speed Telemetry'
              : 'اختبارات سرعة الإنترنت الأساسية'}
          </span>
        </div>
        <div className="header-brand-side">
          <div className="brand-text-group">
            <div className="brand-name-ar">
              <span className="brand-highlight">{isEnglish ? 'Terrax' : 'تيراكس'}</span>{' '}
              {isEnglish ? 'Plus' : 'بلاس'}
            </div>
            <div className="brand-sub-ar">
              {isEnglish ? 'Insights, Reviews, Innovation' : 'رؤى، مراجعات، ابتكار'}
            </div>
          </div>
          <div className="brand-shield-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shield-grad-react" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <path
                d="M24 4L8 11V22.5C8 33.2 14.8 42.8 24 45C33.2 42.8 40 33.2 40 22.5V11L24 4Z"
                fill="rgba(14, 116, 144, 0.25)"
                stroke="url(#shield-grad-react)"
                strokeWidth="2.2"
              />
              <path
                d="M24 9L12 14.2V22.5C12 30.6 17.1 37.9 24 39.8C30.9 37.9 36 30.6 36 22.5V14.2L24 9Z"
                stroke="#38bdf8"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <path
                d="M17 20H31M24 20V32M20 26H28"
                stroke="#7dd3fc"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <circle cx="24" cy="15" r="2" fill="#38bdf8" />
            </svg>
          </div>
        </div>
      </header>

      <main className="terrax-inner-stage" data-layer="internal-surface">
        <h1>Free and Open Source Speedtest.</h1>
        <p className="tagline">No Flash, No Java, No Websockets, No Bullsh*t</p>

        <div className="gauge-layout" data-layer="gauges-stage">
          {/* Primary 4K Download Gauge */}
          <div
            className={`gauge download ${gaugesEnabled ? 'enabled' : ''} ${
              gaugesRunning ? 'running' : ''
            } ${arcFlickerActive ? 'cyber-arc-activating' : ''}`}
            id="download-gauge"
          >
            <div
              className="progress"
              style={
                {'--progress-rotation': `${telemetry.dlProgressDeg}deg`} as React.CSSProperties
              }
            />
            <div
              className="speed"
              style={
                {'--speed-rotation': `${telemetry.dlRotationDeg}deg`} as React.CSSProperties
              }
            />

            <svg className="cyber-gauge-svg" viewBox="0 0 260 260" aria-hidden="true">
              <defs>
                <linearGradient id="dlGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
              <circle
                cx="130"
                cy="130"
                r="124"
                className={`gauge-outer-bezel ${gaugesRunning ? 'running' : ''}`}
              />
              <circle cx="130" cy="130" r="95" className="gauge-inner-border dl-inner-border" />
              <circle
                cx="130"
                cy="130"
                r="117"
                className="gauge-ticks-minor"
                strokeDasharray="1.5 7.68"
                transform="rotate(135 130 130)"
              />
              <circle
                cx="130"
                cy="130"
                r="117"
                className="gauge-ticks-major dl-ticks"
                strokeDasharray="2.5 43.38"
                transform="rotate(135 130 130)"
              />
              <circle
                cx="130"
                cy="130"
                r="107"
                className="gauge-track-bg"
                strokeDasharray="504 680"
                strokeDashoffset="0"
                transform="rotate(135 130 130)"
              />
              <circle
                cx="130"
                cy="130"
                r="107"
                id="dl-svg-arc"
                className={`gauge-active-arc dl-arc ${gaugesRunning ? 'running' : ''} ${
                  arcFlickerActive ? 'cyber-arc-activating' : ''
                }`}
                stroke="url(#dlGrad)"
                strokeDasharray={telemetry.dlArcDash}
                transform="rotate(135 130 130)"
              />
            </svg>

            <div className="gauge-center-content">
              <div className="gauge-area-title">
                <div className="gauge-title-ar">
                  {isEnglish ? 'Download Speed' : 'سرعة التنزيل'}
                </div>
                <div className="gauge-title-en" dir="ltr">
                  DOWNLOAD SPEED
                </div>
              </div>
              <div className="gauge-area-reading">
                <h1 dir="ltr">
                  <span id="download-speed">{telemetry.dlDisplayNumber}</span>
                  <small id="download-unit">{telemetry.dlUnit}</small>
                </h1>
              </div>
              <div className="gauge-area-unit">
                <div className="gauge-unit-ar" id="download-unit-ar">
                  {telemetry.dlUnitSub}
                </div>
              </div>
              <div className="gauge-area-status">
                <div className="gauge-quality-status" id="download-status-wrap">
                  <span id="download-quality-text">{telemetry.dlBadge}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="secondary-gauges-row">
            {/* 4K Speed Stability Gauge */}
            <div
              className={`gauge stability ${gaugesEnabled ? 'enabled' : ''} ${
                gaugesRunning ? 'running' : ''
              } ${arcFlickerActive ? 'cyber-arc-activating' : ''}`}
              id="stability-gauge"
            >
              <svg className="cyber-gauge-svg" viewBox="0 0 220 220" aria-hidden="true">
                <defs>
                  <linearGradient id="stabGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <circle
                  cx="110"
                  cy="110"
                  r="104"
                  className={`gauge-outer-bezel stab-outer-bezel ${gaugesRunning ? 'running' : ''}`}
                />
                <circle cx="110" cy="110" r="77" className="gauge-inner-border stab-inner-border" />
                <circle
                  cx="110"
                  cy="110"
                  r="88"
                  className="gauge-track-bg"
                  strokeDasharray="415 560"
                  transform="rotate(135 110 110)"
                />
                <circle
                  cx="110"
                  cy="110"
                  r="88"
                  id="stab-svg-arc"
                  className={`gauge-active-arc stab-arc ${gaugesRunning ? 'running' : ''} ${
                    arcFlickerActive ? 'cyber-arc-activating' : ''
                  }`}
                  stroke="url(#stabGrad)"
                  strokeDasharray={telemetry.stabilityArcDash}
                  transform="rotate(135 110 110)"
                />
              </svg>

              <div className="gauge-center-content secondary-content">
                <div className="gauge-area-title">
                  <div className="gauge-title-ar">
                    {isEnglish ? 'Speed Stability' : 'استقرار السرعة'}
                  </div>
                  <div className="gauge-title-en" dir="ltr">
                    SPEED STABILITY
                  </div>
                </div>
                <div className="gauge-area-reading">
                  <h1 dir="ltr" className="stability-readout">
                    <span id="stability-value">{telemetry.stabilityDisplay}</span>
                    <small>%</small>
                  </h1>
                </div>
                <div className="gauge-area-status">
                  <div className="gauge-unit-ar stability-label" id="stability-status">
                    {telemetry.stabilityStatus}
                  </div>
                </div>
              </div>
            </div>

            {/* 4K Upload Gauge */}
            <div
              className={`gauge upload ${gaugesEnabled ? 'enabled' : ''} ${
                gaugesRunning ? 'running' : ''
              } ${arcFlickerActive ? 'cyber-arc-activating' : ''}`}
              id="upload-gauge"
            >
              <div
                className="progress"
                style={
                  {'--progress-rotation': `${telemetry.ulProgressDeg}deg`} as React.CSSProperties
                }
              />
              <div
                className="speed"
                style={
                  {'--speed-rotation': `${telemetry.ulRotationDeg}deg`} as React.CSSProperties
                }
              />

              <svg className="cyber-gauge-svg" viewBox="0 0 220 220" aria-hidden="true">
                <defs>
                  <linearGradient id="ulGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7e22ce" />
                    <stop offset="52%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <circle
                  cx="110"
                  cy="110"
                  r="104"
                  className={`gauge-outer-bezel ul-outer-bezel ${gaugesRunning ? 'running' : ''}`}
                />
                <circle cx="110" cy="110" r="77" className="gauge-inner-border ul-inner-border" />
                <circle
                  cx="110"
                  cy="110"
                  r="88"
                  className="gauge-track-bg"
                  strokeDasharray="415 560"
                  transform="rotate(135 110 110)"
                />
                <circle
                  cx="110"
                  cy="110"
                  r="88"
                  id="ul-svg-arc"
                  className={`gauge-active-arc ul-arc ${gaugesRunning ? 'running' : ''} ${
                    arcFlickerActive ? 'cyber-arc-activating' : ''
                  }`}
                  stroke="url(#ulGrad)"
                  strokeDasharray={telemetry.ulArcDash}
                  transform="rotate(135 110 110)"
                />
              </svg>

              <div className="gauge-center-content secondary-content">
                <div className="gauge-area-title">
                  <div className="gauge-title-ar">
                    {isEnglish ? 'Upload Speed' : 'سرعة الرفع'}
                  </div>
                  <div className="gauge-title-en" dir="ltr">
                    UPLOAD SPEED
                  </div>
                </div>
                <div className="gauge-area-reading">
                  <h1 dir="ltr" className="upload-readout">
                    <span id="upload-speed">{telemetry.ulDisplayNumber}</span>
                    <small id="upload-unit">{telemetry.ulUnit}</small>
                  </h1>
                </div>
                <div className="gauge-area-unit">
                  <div className="gauge-unit-ar" id="upload-unit-ar">
                    {telemetry.ulUnitSub}
                  </div>
                </div>
                <div className="gauge-area-status">
                  <div className="gauge-quality-status upload-quality" id="upload-status-wrap">
                    <span id="upload-quality-text">{telemetry.ulBadge}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Ping & Jitter Telemetry Bar */}
          <div className="latency-telemetry-strip">
            <div className={`ping ${telemetry.hasLatency ? '' : 'hidden'}`}>
              <span className="label">
                {isEnglish ? 'Latency (Ping):' : 'زمن الاستجابة (Ping):'}
              </span>
              <span className="value" id="ping" dir="ltr">
                {telemetry.pingDisplay}
              </span>
              <small dir="ltr">ms</small>
            </div>
            <div className={`jitter ${telemetry.hasLatency ? '' : 'hidden'}`}>
              <span className="label">
                {isEnglish ? 'Connection Jitter:' : 'تذبذب الاتصال (Jitter):'}
              </span>
              <span className="value" id="jitter" dir="ltr">
                {telemetry.jitterDisplay}
              </span>
              <small dir="ltr">ms</small>
            </div>
          </div>
        </div>

        {/* Summary Stat Cards Row */}
        <div className="summary-cards-row" data-layer="summary-cards">
          <div
            className={`cyber-stat-card ${statCountUp?.active ? 'counting-up' : ''}`}
            id="max-speed-card"
          >
            <div className="stat-card-info">
              <div className="stat-title-ar">
                {isEnglish ? 'Max Speed' : 'أعلى سرعة'}
              </div>
              <div className="stat-title-en" dir="ltr">
                MAX SPEED
              </div>
              <div className="stat-value-wrap" dir="ltr">
                <span
                  className={`stat-number ${statCountUp?.active ? 'counting-up' : ''}`}
                  id="max-speed-value"
                >
                  {statCountUp ? statCountUp.maxDisplay : telemetry.maxSpeedDisplay}
                </span>
                <span className="stat-unit" id="max-speed-unit">
                  {statCountUp ? statCountUp.maxUnit : telemetry.maxSpeedUnit}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`cyber-stat-card ${statCountUp?.active ? 'counting-up' : ''}`}
            id="avg-speed-card"
          >
            <div className="stat-card-info">
              <div className="stat-title-ar">
                {isEnglish ? 'Average Speed' : 'متوسط السرعة'}
              </div>
              <div className="stat-title-en" dir="ltr">
                AVERAGE SPEED
              </div>
              <div className="stat-value-wrap" dir="ltr">
                <span
                  className={`stat-number ${statCountUp?.active ? 'counting-up' : ''}`}
                  id="avg-speed-value"
                >
                  {statCountUp ? statCountUp.avgDisplay : telemetry.avgSpeedDisplay}
                </span>
                <span className="stat-unit" id="avg-speed-unit">
                  {statCountUp ? statCountUp.avgUnit : telemetry.avgSpeedUnit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Server Selector & Connection Row */}
        <div className="connection-server-row" data-layer="controls-surface">
          <div
            className={`server-selector ${servers.length <= 1 ? 'single-server' : 'active'} ${
              uiState === RUNNING ? 'disabled' : ''
            }`}
          >
            <div
              className="chosen"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (servers.length > 1 && uiState !== RUNNING) {
                  setServerDropdownOpen((prev) => !prev);
                }
              }}
            >
              <p>{isEnglish ? 'Current Test Server :' : 'خادم القياس الحالي :'}</p>
              <h2 id="selected-server">
                {selectedServer
                  ? selectedServer.name
                  : isEnglish
                    ? 'Searching for nearest server...'
                    : 'جاري البحث عن أقرب خادم...'}
              </h2>
            </div>
            <ul className={`servers ${serverDropdownOpen ? 'active' : ''}`} role="listbox">
              {servers.map((srv) => (
                <li key={`${srv.id ?? srv.name}-${srv.server}`}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectServer(srv);
                    }}
                  >
                    <span className="server-name-text" dir="auto">
                      {srv.name}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`connection-info-pill ${uiState === RUNNING ? 'is-testing' : ''} ${
              uiState === FINISHED ? 'is-completed' : ''
            }`}
            id="connection-type-card"
            data-connection-state={
              uiState === RUNNING ? 'testing' : uiState === FINISHED ? 'completed' : 'idle'
            }
            data-is-testing={uiState === RUNNING ? 'true' : 'false'}
            data-connection-kind={connectionInfo.kind}
            data-connection-source={connectionInfo.source}
            title={
              uiState === RUNNING
                ? `${connectionInfo.detail} • ${
                    isEnglish
                      ? 'Verifying network & measuring speed...'
                      : 'جاري التحقق من الشبكة وقياس السرعة...'
                  }`
                : connectionInfo.detail
            }
          >
            <div className="conn-text-block">
              <span className="conn-label">
                {isEnglish ? 'Connection Type:' : 'نوع الاتصال:'}
              </span>
              <strong className="conn-value" id="connection-type-text">
                {connectionInfo.label}
              </strong>
            </div>
            <div className="conn-chip-icon" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <path
                  className="conn-diamond-frame"
                  d="M14 3L25 14L14 25L3 14L14 3Z"
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                  fill="rgba(56, 189, 248, 0.12)"
                />
                <circle className="conn-diamond-dot" cx="14" cy="14" r="3.2" fill="#67e8f9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Zero-CLS Google AdSense Container (Auto-Collapses when unfilled) */}
        <div
          className="terrax-adsense-container terrax-smart-ad-slot terrax-smart-banner"
          id="terrax-smart-ad-speed-main"
          data-terrax-smart-ad="speed-main"
          data-ad-status="unfilled"
          data-ad-filled="false"
        >
          <div className="terrax-smart-ad-body terrax-adsense-mount">
            <ins
              className="adsbygoogle"
              style={{ display: 'block' }}
              data-ad-client="ca-pub-1225026489802055"
              data-ad-slot="7159014601"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
          <span
            className="terrax-ad-disclosure-label"
            data-label-ar="اعلان"
            data-label-en="Sponsored"
          >
            {isEnglish ? 'Sponsored' : 'اعلان • Sponsored'}
          </span>
        </div>

        <p id="privacy-warning" className={testData?.clientIp ? '' : 'hidden'}>
          {testData?.clientIp ? (
            <>
              <span>{isEnglish ? 'Connected via:' : 'متصل عبر:'}</span>
              <br />
              {` ${String(testData.clientIp).slice(0, 60)}`}
            </>
          ) : (
            <>
              {isEnglish
                ? 'By clicking start you agree to the service privacy policy'
                : 'بالنقر على زر البدء فإنك توافق على سياسة الخصوصية الخاصة بالخدمة'}
              <br />
              <a
                href="#"
                id="choose-privacy"
                onClick={(e) => {
                  e.preventDefault();
                  setPrivacyOpen(true);
                }}
              >
                {isEnglish ? 'View privacy & data details' : 'عرض تفاصيل الخصوصية والبيانات'}
              </a>
            </>
          )}
        </p>

        {/* Primary Action Button & Timeline Progress */}
        <div className="cta-button-container" data-layer="primary-controls">
          <div className="cta-button-row">
            <button
              className={`${uiState === INITIALIZING ? 'disabled initializing' : ''} ${
                uiState === RUNNING ? 'active' : ''
              }`}
              id="start-button"
              type="button"
              onClick={handleStartOrAbort}
            >
              {buttonLabel}
            </button>
            <button
              className={`small inverted ${
                uiState === FINISHED && testData?.testId ? '' : 'hidden'
              }`}
              id="share-results"
              type="button"
              onClick={() => setShareOpen(true)}
            >
              {isEnglish ? 'Share Results' : 'مشاركة النتائج'}
            </button>
          </div>
          {(() => {
            let overallProgress = 0;
            let phaseText = isEnglish ? 'Ready' : 'جاهز للاختبار';
            if (uiState === RUNNING) {
              const s = Number(testData?.testState);
              const dlP = Math.max(0, Math.min(1, Number(testData?.dlProgress) || 0));
              const ulP = Math.max(0, Math.min(1, Number(testData?.ulProgress) || 0));
              const pingP = Math.max(0, Math.min(1, Number(testData?.pingProgress) || 0));
              if (s === 0) {
                phaseText = isEnglish ? 'Connecting to server...' : 'جاري الاتصال بالخادم...';
                overallProgress = Math.max(0.04, pingP * 0.08);
              } else if (s === 2) {
                phaseText = isEnglish
                  ? 'Testing latency & jitter...'
                  : 'قياس زمن الاستجابة والتذبذب...';
                overallProgress = 0.08 + pingP * 0.12;
              } else if (s === 1) {
                phaseText = isEnglish ? 'Testing download speed...' : 'جاري فحص سرعة التنزيل...';
                overallProgress = 0.2 + dlP * 0.42;
              } else if (s === 3) {
                phaseText = isEnglish ? 'Testing upload speed...' : 'جاري فحص سرعة الرفع...';
                overallProgress = 0.62 + ulP * 0.37;
              } else if (s >= 4) {
                phaseText = isEnglish ? 'Test completed' : 'اكتمل الاختبار';
                overallProgress = 1.0;
              } else {
                phaseText = isEnglish ? 'Initializing test...' : 'جاري تهيئة الفحص...';
                overallProgress = 0.04;
              }
            } else if (uiState === FINISHED) {
              phaseText = isEnglish ? 'Test completed' : 'اكتمل الاختبار';
              overallProgress = 1.0;
            }
            const pct = Math.min(100, Math.max(0, Math.round(overallProgress * 100)));
            const isTimelineActive = uiState === RUNNING || uiState === FINISHED;
            return (
              <div
                className={`test-timeline-progress ${isTimelineActive ? 'active' : ''}`}
                id="test-timeline-progress"
                aria-hidden={!isTimelineActive}
              >
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <div
                    className="progress-fill"
                    id="test-progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="progress-labels">
                  <span className="progress-phase-text" id="test-progress-phase">
                    {phaseText}
                  </span>
                  <span className="progress-pct-text" id="test-progress-pct">
                    {`${pct}%`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Bottom 5-Tab Cyber Glass Navigation Bar */}
      <nav className="terrax-bottom-nav" aria-label="التنقل الرئيسي" data-layer="bottom-navigation">
        <button
          type="button"
          className={`nav-dock-item ${activeTab === 'speed' ? 'active' : ''}`}
          id="nav-speed-btn"
          onClick={() => handleTabSwitch('speed')}
        >
          <span className="nav-active-bar" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15L16.5 9.5M4.93 19.07A10 10 0 1 1 19.07 19.07"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="15" r="2" fill="currentColor" />
          </svg>
          <span>{isEnglish ? 'Speed' : 'السرعة'}</span>
        </button>
        <button
          type="button"
          className={`nav-dock-item ${activeTab === 'usage' ? 'active' : ''}`}
          id="nav-usage-btn"
          onClick={() => handleTabSwitch('usage')}
        >
          <span className="nav-active-bar" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20H20M6 17V12M10 17V9M14 17V13M18 17V7M5 9L10 5L14 8L19 3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{isEnglish ? 'Usage' : 'الاستهلاك'}</span>
        </button>
        <button
          type="button"
          className={`nav-dock-item ${activeTab === 'stability' ? 'active' : ''}`}
          id="nav-stability-btn"
          onClick={() => handleTabSwitch('stability')}
        >
          <span className="nav-active-bar" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 12H5.5L8.5 5L13.5 19L16.5 12H22"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{isEnglish ? 'Stability' : 'الاستقرار'}</span>
        </button>
        <button
          type="button"
          className={`nav-dock-item ${activeTab === 'gaming' ? 'active' : ''}`}
          id="nav-gaming-btn"
          onClick={() => handleTabSwitch('gaming')}
        >
          <span className="nav-active-bar" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12H10M8 10V14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <circle cx="15.5" cy="11" r="1" fill="currentColor" />
            <circle cx="17.5" cy="13" r="1" fill="currentColor" />
            <path
              d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{isEnglish ? 'Gaming Test' : 'اختبار الألعاب'}</span>
        </button>
        <button
          type="button"
          className={`nav-dock-item ${activeTab === 'settings' ? 'active' : ''}`}
          id="nav-settings-btn"
          onClick={() => handleTabSwitch('settings')}
        >
          <span className="nav-active-bar" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          <span>{isEnglish ? 'Settings' : 'الإعدادات'}</span>
        </button>
      </nav>

      {/* Settings Dialog with Language Selector */}
      <dialog id="settings-dialog" className="cyber-modal" open={settingsOpen}>
        <div
          className="close-dialog"
          role="button"
          tabIndex={0}
          onClick={() => setSettingsOpen(false)}
        >
          ×
        </div>
        <section className="cyber-modal-body">
          <h1>
            {isEnglish ? 'Measurement & UI Settings' : 'إعدادات القياس والواجهة'}
          </h1>
          <div className="settings-list">
            <div className="setting-row">
              <label htmlFor="language-select" id="language-select-label">
                {isEnglish ? 'Interface Language (اللغة)' : 'لغة الواجهة (Language)'}
              </label>
              <select
                id="language-select"
                className="cyber-select"
                value={lang}
                onChange={(e) =>
                  handleLanguageChange(e.target.value === 'en' ? 'en' : 'ar')
                }
              >
                <option value="ar">العربية (Arabic)</option>
                <option value="en">English (الإنجليزية)</option>
              </select>
            </div>
            <label className="setting-row">
              <span id="setting-auto-gbps-label">
                {isEnglish
                  ? 'Automatically display ultra speeds in Gbps (above 1000 Mbps)'
                  : 'عرض السرعات الفائقة تلقائياً بوحدة Gbps (عند تجاوز 1000 Mbps)'}
              </span>
              <input
                type="checkbox"
                id="toggle-auto-gbps"
                checked={autoGbps}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoGbps(next);
                  try {
                    localStorage.setItem(AUTO_GBPS_STORAGE_KEY, next ? '1' : '0');
                  } catch {
                    // ignore storage errors
                  }
                }}
              />
            </label>
            <div className="setting-row">
              <span id="setting-stability-label">
                {isEnglish
                  ? 'Continuous Stability Monitor'
                  : 'وضع الفحص المستمر (Stability Monitor)'}
              </span>
              <a href="stability.html" className="cyber-inline-link" id="setting-stability-link">
                {isEnglish ? 'Open Stability Page →' : 'الانتقال إلى صفحة الاستقرار ←'}
              </a>
            </div>
            <div className="setting-row">
              <span id="setting-privacy-label">
                {isEnglish ? 'Privacy Policy & Data Protection' : 'سياسة الخصوصية وحماية البيانات'}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="small inverted"
                  id="open-privacy-from-settings"
                  onClick={() => {
                    setSettingsOpen(false);
                    setPrivacyOpen(true);
                  }}
                >
                  {isEnglish ? 'View Policy' : 'عرض السياسة'}
                </button>
              </div>
            </div>
            <div className="setting-row support-setting-row">
              <div className="support-setting-info">
                <span id="setting-support-label">
                  {isEnglish ? 'Contact Support' : 'لتواصل لخدمة الدعم'}
                </span>
                <small className="support-phone-hint" dir="ltr">
                  +967772772814
                </small>
              </div>
              <a
                href="https://wa.me/967772772814"
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-support-btn"
                id="whatsapp-support-btn"
                role="button"
                aria-label="لخدمة الدعم عبر واتساب +967772772814"
              >
                <span id="setting-support-btn-text">
                  {isEnglish ? 'Support Service' : 'لخدمة الدعم'}
                </span>
              </a>
            </div>
          </div>
        </section>
      </dialog>

      {/* Share Results Dialog */}
      <dialog id="share" open={shareOpen}>
        <div
          className="close-dialog"
          role="button"
          tabIndex={0}
          aria-label="إغلاق"
          onClick={() => setShareOpen(false)}
        >
          ×
        </div>
        <h2 className="dialog-heading">
          {isEnglish ? 'Share Result Card' : 'مشاركة بطاقة النتيجة'}
        </h2>
        <img
          id="results"
          src={
            testData?.testId
              ? `/results/?id=${encodeURIComponent(String(testData.testId))}&style=modern&dl=${encodeURIComponent(
                  String(testData.dlStatus || '')
                )}&ul=${encodeURIComponent(String(testData.ulStatus || ''))}&ping=${encodeURIComponent(
                  String(testData.pingStatus || '')
                )}&jitter=${encodeURIComponent(
                  String(testData.jitterStatus || '')
                )}&stab=${encodeURIComponent(String(telemetry.stabilityDisplay || ''))}`
              : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='480' viewBox='0 0 800 480'/%3E"
          }
          alt="Test results in graphical form"
        />
        <button
          id="copy-link"
          type="button"
          className={copyLinkActive ? 'active' : ''}
          onClick={() => {
            const imgEl = document.getElementById('results') as HTMLImageElement | null;
            const shareUrl = imgEl?.src || window.location.href;
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(shareUrl).catch(() => {});
            }
            setCopyLinkActive(true);
            setTimeout(() => setCopyLinkActive(false), 2000);
          }}
        >
          {copyLinkActive
            ? isEnglish
              ? 'Copied!'
              : 'تم نسخ الرابط!'
            : isEnglish
              ? 'Copy Result Link'
              : 'نسخ رابط النتيجة'}
        </button>
      </dialog>

      {/* Privacy Policy, About Us, Terms of Use & Contact Dialog */}
      <dialog id="privacy" open={privacyOpen}>
        <div
          className="close-dialog"
          role="button"
          tabIndex={0}
          aria-label="إغلاق"
          onClick={() => setPrivacyOpen(false)}
        >
          ×
        </div>
        <section>
          <h1>
            {isEnglish
              ? 'Privacy Policy, Terms of Use & About Terrax Plus'
              : 'سياسة الخصوصية، شروط الاستخدام، ونبذة عن المنصة (Privacy, Terms & About)'}
          </h1>
          <p>
            {isEnglish
              ? 'This speed test server records measurement results only for result sharing and network quality diagnostics.'
              : 'يعمل خادم قياس السرعة هذا مع تفعيل حفظ نتائج القياس لمشاركتها وتحسين جودة الشبكة.'}
          </p>

          <h2 id="about-terrax-heading">
            {isEnglish
              ? 'About Terrax Plus — 4K Network Telemetry Platform'
              : 'من نحن — نبذة عن منصة تيراكس بلاس (About Terrax Plus)'}
          </h2>
          <p>
            {isEnglish
              ? 'Terrax Plus is an advanced 4K network speed and stability measurement platform built on the open-source LibreSpeed engine, utilizing isolated Web Workers to measure Download, Upload, Ping, Jitter, and Packet Loss with zero main-thread interference.'
              : 'منصة تيراكس بلاس (Terrax Plus) هي منظومة عربية متخصصة لقياس سرعة الإنترنت الفائقة واستقرار الشبكة للألعاب التنافسية والبث المباشر بدقة 4K، مبنية على محرك القياس مفتوح المصدر LibreSpeed وتعمل عبر خيوط معالجة مستقلة (Web Workers) لضمان دقة القياس الفعلي.'}
          </p>

          <h2 id="adsense-cookies-heading">
            {isEnglish
              ? 'Google AdSense, Cookies & Smart Ad Lock'
              : 'إعلانات Google AdSense وملفات تعريف الارتباط (Cookies & Consent Mode v2)'}
          </h2>
          <p>
            {isEnglish
              ? 'Terrax Plus integrates Google AdSense in isolated, non-intrusive containers governed by Google Consent Mode v2 and Smart Ad Lock (which pauses all ad network activity during active speed tests). Users may manage personalized ad preferences at any time via Google My Ad Center.'
              : 'تستخدم منصة تيراكس بلاس خدمة Google AdSense في حاويات معزولة تخضع لنظام العزل الشبكي الذكي (Smart Ad Lock) ومعيار Google Consent Mode v2، مع إتاحة التحكم الكامل في تخصيص الإعلانات وملفات تعريف الارتباط.'}
          </p>

          <h2 id="terms-of-use-heading">
            {isEnglish ? 'Terms of Use' : 'شروط الاستخدام (Terms of Use)'}
          </h2>
          <p>
            {isEnglish
              ? 'Measurements are provided for technical diagnostics. Automated abuse, scraping, or invalid traffic generation is strictly prohibited.'
              : 'تُقدّم نتائج القياس لأغراض الفحص التقني وتشخيص جودة الاتصال، ويُحظر استخدام أي أدوات آلية لتوليد زيارات أو نقرات غير صالحة.'}
          </p>

          <h2 id="contact-us-heading">
            {isEnglish
              ? 'Contact Us & Data Deletion'
              : 'اتصل بنا وحذف البيانات (Contact Us & Data Deletion)'}
          </h2>
          <p>
            {isEnglish ? (
              <>
                For support or data deletion requests (with your Test ID), contact:{' '}
                <a href="mailto:terrax.t20@gmail.com" id="official-privacy-email">
                  terrax.t20@gmail.com
                </a>{' '}
                or WhatsApp <span dir="ltr">+967772772814</span>.
              </>
            ) : (
              <>
                للتواصل مع إدارة المنصة أو لطلب حذف سجل اختبار معين، يرجى مراسلتنا عبر البريد الرسمي:{' '}
                <a href="mailto:terrax.t20@gmail.com" id="official-privacy-email">
                  terrax.t20@gmail.com
                </a>{' '}
                أو عبر خدمة الدعم الفني المباشر: <span dir="ltr">+967772772814</span>.
              </>
            )}
          </p>
        </section>
        <button id="close-privacy" type="button" onClick={() => setPrivacyOpen(false)}>
          {isEnglish ? 'Close' : 'إغلاق'}
        </button>
      </dialog>

      {/* Data Consumption & Test History Dialog (Opened via الاستهلاك Tab) */}
      <dialog id="usage-dialog" className="cyber-modal" open={usageOpen}>
        <div
          className="close-dialog"
          role="button"
          tabIndex={0}
          onClick={() => setUsageOpen(false)}
        >
          ×
        </div>
        <section className="cyber-modal-body">
          <h1>
            {isEnglish ? 'Data Consumption & Test History' : 'سجل الاستهلاك والاختبارات الفعلية'}
          </h1>
          <p className="modal-subtitle">
            {isEnglish
              ? 'Calculated exclusively from real measurements.'
              : 'يتم حساب البيانات المستهلكة وسجل السرعات من الاختبارات الحقيقية فقط.'}
          </p>

          <div className="usage-summary-grid">
            <div className="usage-stat-box">
              <span className="usage-label">
                {isEnglish ? 'Total Data Used' : 'إجمالي البيانات المستهلكة'}
              </span>
              <strong className="usage-val" id="total-data-used" dir="ltr">
                {(() => {
                  const totalMB = testHistory.reduce(
                    (sum, item) => sum + (Number(item.megabytesUsed) || 0),
                    0
                  );
                  return totalMB >= 1024
                    ? `${(totalMB / 1024).toFixed(2)} GB`
                    : `${totalMB.toFixed(1)} MB`;
                })()}
              </strong>
            </div>
            <div className={`usage-stat-box${usageTestsCountUp?.active ? ' counting-up' : ''}`}>
              <span className="usage-label">
                {isEnglish ? 'Completed Tests' : 'عدد الاختبارات المكتملة'}
              </span>
              <strong
                className={`usage-val${usageTestsCountUp?.active ? ' counting-up' : ''}`}
                id="total-tests-count"
                dir="ltr"
                data-target-count={testHistory.length}
                data-counting-up={usageTestsCountUp?.active ? 'true' : 'false'}
              >
                {usageTestsCountUp ? usageTestsCountUp.displayValue : testHistory.length}
              </strong>
            </div>
          </div>

          <div className="history-table-wrap">
            <table className="cyber-history-table">
              <thead>
                <tr>
                  {(
                    [
                      {key: 'date' as HistorySortKey, label: isEnglish ? 'Date' : 'التاريخ'},
                      {key: 'time' as HistorySortKey, label: isEnglish ? 'Time' : 'التوقيت'},
                      {key: 'server' as HistorySortKey, label: isEnglish ? 'Server' : 'الخادم'},
                      {key: 'dl' as HistorySortKey, label: isEnglish ? 'Download' : 'التنزيل'},
                      {key: 'ul' as HistorySortKey, label: isEnglish ? 'Upload' : 'الرفع'},
                      {key: 'stability' as HistorySortKey, label: isEnglish ? 'Stability' : 'الاستقرار'},
                      {key: 'ping' as HistorySortKey, label: 'Ping'},
                    ]
                  ).map((col) => {
                    const isSorted = historySortKey === col.key;
                    const ariaSort = isSorted
                      ? historySortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none';
                    const indicator = isSorted
                      ? historySortDir === 'asc'
                        ? '↑'
                        : '↓'
                      : '↕';
                    return (
                      <th
                        key={col.key}
                        data-sort-key={col.key}
                        role="button"
                        tabIndex={0}
                        aria-sort={ariaSort}
                        className={`sortable-th${isSorted ? ' is-sorted' : ''}`}
                        onClick={() => handleHistorySort(col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleHistorySort(col.key);
                          }
                        }}
                      >
                        <span className="th-label">{col.label}</span>
                        <span className="sort-indicator" aria-hidden="true">
                          {indicator}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody id="test-history-tbody">
                {testHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-history-cell">
                      {isEnglish
                        ? 'No tests recorded yet. Start a speed test to record results.'
                        : 'لا توجد اختبارات مسجلة بعد. ابدأ اختبار السرعة لتسجيل النتائج.'}
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const math =
                      typeof window !== 'undefined' ? window.TerraxTelemetryMath : undefined;
                    const sorted = math?.sortTestHistoryList
                      ? math.sortTestHistoryList(testHistory, historySortKey, historySortDir)
                      : testHistory;
                    return sorted.map((item, idx) => {
                      const dateText = isEnglish
                        ? item.dateEn || item.isoDate || item.date || '--'
                        : item.dateAr || item.isoDate || item.date || '--';
                      const timeText = isEnglish
                        ? item.timeEn || item.timestamp || '--'
                        : item.timeAr || item.timestamp || '--';
                      const stabText =
                        item.stabilityPercent !== null && item.stabilityPercent !== undefined
                          ? `${item.stabilityPercent}%`
                          : '--';
                      return (
                        <tr
                          key={item.runId || `${item.epochMs}_${idx}`}
                          data-run-id={item.runId || ''}
                          data-epoch-ms={item.epochMs || 0}
                        >
                          <td className="history-date-cell" dir="ltr">
                            {dateText}
                          </td>
                          <td className="history-time-cell" dir="ltr">
                            {timeText}
                          </td>
                          <td>{item.serverName}</td>
                          <td dir="ltr">{Number(item.dlMbps).toFixed(1)} Mbps</td>
                          <td dir="ltr">{Number(item.ulMbps).toFixed(1)} Mbps</td>
                          <td dir="ltr">{stabText}</td>
                          <td dir="ltr">{Number(item.pingMs).toFixed(1)} ms</td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>

          <div className="modal-actions-row">
            <a href="stability.html" className="cyber-link-btn">
              {isEnglish
                ? 'Open Continuous Stability Test'
                : 'فتح فحص الاستقرار المستمر (Stability Test)'}
            </a>
            <button
              type="button"
              className="small inverted"
              id="clear-history-btn"
              onClick={() => {
                try {
                  localStorage.removeItem(HISTORY_STORAGE_KEY);
                } catch {
                  // Ignore storage restrictions
                }
                setTestHistory([]);
              }}
            >
              {isEnglish ? 'Clear Local History' : 'مسح السجل المحلي'}
            </button>
          </div>
        </section>
      </dialog>
    </div>
  );
}
