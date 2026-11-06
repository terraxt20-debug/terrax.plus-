/**
 * Pure Telemetry & Stability Calculation Module for Terrax Plus LibreSpeed
 * Computes Average Speed, Max Speed, Speed Stability %, and Gauge Angles
 * strictly from real measured samples emitted by speedtest_worker.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TerraxTelemetryMath = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * Convert a raw Mbps number into formatted value and unit metadata.
   * Preserves raw Mbps value while also providing adaptive Gbps display when >= 1000 Mbps.
   * @param {number|string} mbpsValue
   * @param {boolean} allowGbps
   */
  function formatSpeedReading(mbpsValue, allowGbps) {
    if (mbpsValue === null || mbpsValue === undefined || mbpsValue === "") {
      return {
        rawMbps: 0,
        displayNumber: "00",
        unitEn: "Mbps",
        unitAr: "ميجابت في الثانية",
        unitLabelEn: "Megabits per second",
        badgeAr: "جاهز للقياس",
        badgeEn: "Ready to measure",
        hasValue: false,
      };
    }
    const num = Number(mbpsValue);
    if (!Number.isFinite(num) || num <= 0) {
      return {
        rawMbps: 0,
        displayNumber: "00",
        unitEn: "Mbps",
        unitAr: "ميجابت في الثانية",
        unitLabelEn: "Megabits per second",
        badgeAr: "جاهز للقياس",
        badgeEn: "Ready to measure",
        hasValue: false,
      };
    }

    let badgeAr = "جيد";
    let badgeEn = "Good";
    if (num >= 500) {
      badgeAr = "ممتاز";
      badgeEn = "Excellent";
    } else if (num >= 100) {
      badgeAr = "سريع جداً";
      badgeEn = "Very Fast";
    } else if (num >= 25) {
      badgeAr = "سريع";
      badgeEn = "Fast";
    } else {
      badgeAr = "متوسط";
      badgeEn = "Moderate";
    }

    if (allowGbps && num >= 1000) {
      const gbps = num / 1000;
      return {
        rawMbps: num,
        displayNumber: gbps < 10 ? gbps.toFixed(2) : gbps.toFixed(1),
        unitEn: "Gbps",
        unitAr: "جيجابت في الثانية",
        unitLabelEn: "Gigabits per second",
        badgeAr,
        badgeEn,
        hasValue: true,
      };
    }

    let displayNumber;
    if (num < 10) {
      displayNumber = num.toFixed(2);
    } else if (num < 100) {
      displayNumber = num.toFixed(1);
    } else {
      displayNumber = num.toFixed(0);
    }

    return {
      rawMbps: num,
      displayNumber,
      unitEn: "Mbps",
      unitAr: `${displayNumber} ميجابت في الثانية`,
      unitLabelEn: `${displayNumber} Megabits per second`,
      badgeAr,
      badgeEn,
      hasValue: true,
    };
  }

  /**
   * Calculate real Average Speed, Max Speed, and Speed Stability % from actual test samples.
   * Returns null values when no real samples have been collected yet (no fake data).
   *
   * @param {number[]} dlSamples - Array of real download speed samples (in Mbps) from speedtest_worker
   * @param {number[]} ulSamples - Array of real upload speed samples (in Mbps) from speedtest_worker
   * @param {number|string} pingMs - Measured ping in ms
   * @param {number|string} jitterMs - Measured jitter in ms
   */
  function calculateRealMetrics(dlSamples, ulSamples, pingMs, jitterMs) {
    const validDl = Array.isArray(dlSamples)
      ? dlSamples.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const validUl = Array.isArray(ulSamples)
      ? ulSamples.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const allSpeedSamples = validDl.length > 0 ? validDl : validUl;

    const ping = Number(pingMs);
    const jitter = Number(jitterMs);
    const hasLatency =
      Number.isFinite(ping) &&
      ping > 0 &&
      Number.isFinite(jitter) &&
      jitter >= 0;

    let avgSpeedMbps = null;
    let maxSpeedMbps = null;

    if (validDl.length > 0) {
      const sum = validDl.reduce((acc, val) => acc + val, 0);
      avgSpeedMbps = sum / validDl.length;
      maxSpeedMbps = Math.max(...validDl);
    }

    // Calculate Speed Stability % strictly from real measured throughput consistency and latency jitter
    let stabilityPercent = null;
    let stabilityLabelAr = "في انتظار القياس";
    let stabilityLabelEn = "Awaiting measurement";

    if (allSpeedSamples.length >= 2 || hasLatency) {
      let throughputStability = null;
      if (allSpeedSamples.length >= 2) {
        const mean =
          allSpeedSamples.reduce((a, b) => a + b, 0) / allSpeedSamples.length;
        if (mean > 0) {
          const variance =
            allSpeedSamples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
            allSpeedSamples.length;
          const stdDev = Math.sqrt(variance);
          const cv = stdDev / mean; // Coefficient of variation
          // Map CV to 0..100 stability score (CV=0 -> 100%, CV>=0.6 -> 40%)
          throughputStability = Math.max(0, Math.min(100, (1 - cv * 0.85) * 100));
        }
      }

      let latencyStability = null;
      if (hasLatency) {
        const jitterRatio = jitter / Math.max(ping, 1);
        const pingPenalty = Math.max(0, (ping - 20) * 0.12);
        latencyStability = Math.max(
          0,
          Math.min(100, (1 - jitterRatio * 0.7) * 100 - pingPenalty)
        );
      }

      if (throughputStability !== null && latencyStability !== null) {
        stabilityPercent = Math.round(
          throughputStability * 0.65 + latencyStability * 0.35
        );
      } else if (throughputStability !== null) {
        stabilityPercent = Math.round(throughputStability);
      } else if (latencyStability !== null) {
        stabilityPercent = Math.round(latencyStability);
      }

      if (stabilityPercent !== null) {
        stabilityPercent = Math.max(1, Math.min(99, stabilityPercent));
        if (stabilityPercent >= 90) {
          stabilityLabelAr = "مستقر للغاية";
          stabilityLabelEn = "Ultra Stable";
        } else if (stabilityPercent >= 75) {
          stabilityLabelAr = "مستقر جداً";
          stabilityLabelEn = "Very Stable";
        } else if (stabilityPercent >= 55) {
          stabilityLabelAr = "مستقر";
          stabilityLabelEn = "Stable";
        } else {
          stabilityLabelAr = "غير مستقر";
          stabilityLabelEn = "Unstable";
        }
      }
    }

    return {
      avgSpeedMbps,
      maxSpeedMbps,
      stabilityPercent,
      stabilityLabelAr,
      stabilityLabelEn,
      sampleCount: validDl.length + validUl.length,
    };
  }

  /**
   * Convert a percentage (0-100) to gauge rotation degrees (0-180)
   */
  function percentToRotation(percent) {
    const p = Number(percent);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return Math.max(0, Math.min(180, (p / 100) * 180));
  }

  /**
   * Evaluate gaming connection stability strictly from real measured Ping, Jitter, and Packet Loss
   * using disclosed, deterministic thresholds.
   *
   * @param {number} avgPingMs - Average RTT in milliseconds
   * @param {number} jitterMs - Weighted inter-arrival jitter in milliseconds
   * @param {number} packetLossPct - Verified failed probe percentage (0-100)
   * @param {number} totalSamples - Number of completed probe attempts
   */
  function evaluateGamingStability(avgPingMs, jitterMs, packetLossPct, totalSamples) {
    const samples = Number(totalSamples) || 0;
    const avg = Number(avgPingMs);
    const jit = Number(jitterMs);
    const loss = Number(packetLossPct) || 0;

    if (samples > 0 && loss > 0 && (!Number.isFinite(avg) || avg <= 0)) {
      const lossScore = Math.round(Math.max(0, Math.min(99, 100 - loss * 12)));
      return {
        hasData: true,
        grade: "bad",
        statusColor: "#FF647C",
        titleAr: "غير مستقر للألعاب",
        titleEn: "Unstable Connection",
        subtitleAr: "انقطاع لحظي أو فقدان حزم يؤثر على استقرار الخط",
        criteriaAr: `فقدان حزم ${loss.toFixed(1)}% (${lossScore}% استقرار)`,
        scorePercent: lossScore,
      };
    }

    if (samples <= 0 || !Number.isFinite(avg) || avg <= 0) {
      return {
        hasData: false,
        grade: "none",
        statusColor: "#A8BCD4",
        titleAr: "في انتظار القياس",
        titleEn: "Awaiting Measurement",
        subtitleAr: "اضغط على بدء الاختبار لقياس الاستقرار الفعلي",
        criteriaAr: "المعيار: Ping < 35ms • Jitter < 5ms • Loss 0%",
        scorePercent: null,
      };
    }

    const pingPenalty = Math.max(0, (avg - 15) * 0.45);
    const jitterPenalty = Math.max(0, jit * 1.8);
    const lossPenalty = Math.max(0, loss * 12);
    const rawScore = Math.round(Math.max(1, Math.min(99, 100 - pingPenalty - jitterPenalty - lossPenalty)));

    if (avg < 35 && jit < 5 && loss < 0.5) {
      return {
        hasData: true,
        grade: "great",
        statusColor: "#78E7A0",
        titleAr: "ممتاز للألعاب التنافسية",
        titleEn: "Optimal for Gaming",
        subtitleAr: "استجابة فورية وتذبذب منخفض جداً بدون فقدان مؤثر للحزم",
        criteriaAr: `متوافق مع المعيار المثالي (${rawScore}% استقرار)`,
        scorePercent: rawScore,
      };
    }

    if (avg < 65 && jit < 15 && loss < 1.5) {
      return {
        hasData: true,
        grade: "good",
        statusColor: "#27DDF8",
        titleAr: "جيد ومستقر للألعاب",
        titleEn: "Good for Gaming",
        subtitleAr: "اتصال مستقر مناسب للألعاب الجماعية والبث المباشر",
        criteriaAr: `ضمن النطاق المستقر (${rawScore}% استقرار)`,
        scorePercent: rawScore,
      };
    }

    if (avg < 110 && jit < 30 && loss < 4) {
      return {
        hasData: true,
        grade: "poor",
        statusColor: "#F5C46B",
        titleAr: "متوسط — تذبذب ملحوظ",
        titleEn: "Moderate Stability",
        subtitleAr: "قد يظهر تأخر طفيف في الألعاب التنافسية السريعة",
        criteriaAr: `تذبذب أو تأخر متوسط (${rawScore}% استقرار)`,
        scorePercent: rawScore,
      };
    }

    return {
      hasData: true,
      grade: "bad",
      statusColor: "#FF647C",
      titleAr: "غير مستقر للألعاب",
      titleEn: "Unstable Connection",
      subtitleAr: "تذبذب مرتفع أو فقدان حزم يؤثر على سلاسة اللعب الفوري",
      criteriaAr: `خارج النطاق الموصى به (${rawScore}% استقرار)`,
      scorePercent: rawScore,
    };
  }

  /**
   * Frame-rate-independent smooth numerical interpolation (exponential damping)
   * for speed and upload gauge numbers to prevent sudden jarring jumps.
   *
   * @param {number} currentVal - Currently displayed numeric value
   * @param {number|string} targetVal - New target value from measurement
   * @param {number} dtSeconds - Elapsed time since last frame in seconds
   * @param {boolean} snapImmediate - True when phase finished, reduced motion enabled, or resetting
   * @returns {number} Smoothed numeric value
   */
  function smoothNumericValue(currentVal, targetVal, dtSeconds, snapImmediate) {
    const target = Number(targetVal);
    if (!Number.isFinite(target) || target <= 0) {
      return 0;
    }
    const current = Number(currentVal);
    if (snapImmediate || !Number.isFinite(current) || current <= 0) {
      return target;
    }
    const diff = target - current;
    if (Math.abs(diff) <= 0.05) {
      return target;
    }
    const dt = Number.isFinite(dtSeconds)
      ? Math.max(0.002, Math.min(0.1, dtSeconds))
      : 0.016;
    // Exponential damping factor (tau ~ 95ms) for silky 60Hz/120Hz/144Hz/240Hz glide
    const alpha = 1 - Math.exp(-dt / 0.095);
    const next = current + diff * alpha;
    return Math.abs(target - next) <= 0.05 ? target : next;
  }

  /**
   * Resolve the real connection information from the browser environment
   * (navigator.connection / mozConnection / webkitConnection and navigator.onLine)
   * without ever guessing from speed/IP/latency or defaulting to fake Wi-Fi.
   * Strictly separates physical connection type (type) from estimated effective class (effectiveType).
   *
   * @param {Object} [navInput] - Navigator-like object (defaults to globalThis.navigator)
   * @param {string} [lang="ar"] - UI language ("ar" or "en")
   */
  function resolveRealConnectionInfo(navInput, lang) {
    const isEn = lang === "en";
    const fallbackResult = {
      kind: "unavailable",
      source: "unsupported",
      physicalType: null,
      effectiveType: null,
      hasPhysicalType: false,
      hasEffectiveType: false,
      labelAr: "نوع الاتصال غير متاح",
      labelEn: "Connection type unavailable",
      label: isEn ? "Connection type unavailable" : "نوع الاتصال غير متاح",
      detailAr: "المتصفح الحالي لا يوفر معلومات نوع الاتصال",
      detailEn: "Browser does not expose connection type information",
      detail: isEn
        ? "Browser does not expose connection type information"
        : "المتصفح الحالي لا يوفر معلومات نوع الاتصال",
    };

    try {
      const nav =
        navInput !== undefined
          ? navInput
          : typeof globalThis !== "undefined" && globalThis.navigator
            ? globalThis.navigator
            : null;

      if (!nav || typeof nav !== "object") {
        return fallbackResult;
      }

      if (nav.onLine === false) {
        const labelAr = "غير متصل بالإنترنت";
        const labelEn = "Offline / Disconnected";
        const detailAr = "لا يوجد اتصال نشط بالشبكة حالياً";
        const detailEn = "No active network connection";
        return {
          kind: "offline",
          source: "navigator.onLine",
          physicalType: "none",
          effectiveType: null,
          hasPhysicalType: true,
          hasEffectiveType: false,
          labelAr,
          labelEn,
          label: isEn ? labelEn : labelAr,
          detailAr,
          detailEn,
          detail: isEn ? detailEn : detailAr,
        };
      }

      const conn =
        nav.connection || nav.mozConnection || nav.webkitConnection || null;
      if (!conn || typeof conn !== "object") {
        return fallbackResult;
      }

      const rawType =
        typeof conn.type === "string" ? conn.type.trim().toLowerCase() : "";
      const rawEffective =
        typeof conn.effectiveType === "string"
          ? conn.effectiveType.trim().toLowerCase()
          : "";

      const EFFECTIVE_MAP = {
        "4g": "4G",
        "3g": "3G",
        "2g": "2G",
        "slow-2g": "Slow-2G",
      };
      const effectiveDisplay = EFFECTIVE_MAP[rawEffective] || null;

      const rttVal =
        typeof conn.rtt === "number" && Number.isFinite(conn.rtt) && conn.rtt > 0
          ? Math.round(conn.rtt)
          : null;
      const downlinkVal =
        typeof conn.downlink === "number" &&
        Number.isFinite(conn.downlink) &&
        conn.downlink > 0
          ? Number(conn.downlink)
          : null;

      const estSuffixAr = [];
      const estSuffixEn = [];
      if (effectiveDisplay) {
        estSuffixAr.push(`الفئة المقدّرة: ${effectiveDisplay}`);
        estSuffixEn.push(`Est. class: ${effectiveDisplay}`);
      }
      if (rttVal !== null) {
        estSuffixAr.push(`كمون مقدّر: ~${rttVal}ms`);
        estSuffixEn.push(`Est. RTT: ~${rttVal}ms`);
      }
      if (downlinkVal !== null) {
        estSuffixAr.push(`عرض نطاق مقدّر: ~${downlinkVal}Mbps`);
        estSuffixEn.push(`Est. downlink: ~${downlinkVal}Mbps`);
      }

      // 1. Confirmed physical connection type exposed by navigator.connection.type
      const PHYSICAL_TYPES = {
        wifi: {
          labelAr: "اتصال لاسلكي (Wi-Fi)",
          labelEn: "Wireless (Wi-Fi)",
        },
        ethernet: {
          labelAr: "اتصال سلكي (Ethernet)",
          labelEn: "Wired (Ethernet)",
        },
        cellular: {
          labelAr: effectiveDisplay
            ? `بيانات خلوية (Cellular • ${effectiveDisplay})`
            : "بيانات خلوية (Cellular)",
          labelEn: effectiveDisplay
            ? `Cellular (${effectiveDisplay})`
            : "Cellular Network",
        },
        bluetooth: {
          labelAr: "اتصال بلوتوث (Bluetooth)",
          labelEn: "Bluetooth Connection",
        },
        wimax: {
          labelAr: "اتصال لاسلكي (WiMAX)",
          labelEn: "WiMAX Connection",
        },
        none: {
          labelAr: "غير متصل بالشبكة",
          labelEn: "No Network Connection",
        },
        other: {
          labelAr: "اتصال شبكة آخر",
          labelEn: "Other Network",
        },
      };

      if (rawType && Object.prototype.hasOwnProperty.call(PHYSICAL_TYPES, rawType)) {
        const entry = PHYSICAL_TYPES[rawType];
        const detailAr =
          estSuffixAr.length > 0
            ? `${entry.labelAr} • ${estSuffixAr.join(" • ")}`
            : entry.labelAr;
        const detailEn =
          estSuffixEn.length > 0
            ? `${entry.labelEn} • ${estSuffixEn.join(" • ")}`
            : entry.labelEn;
        return {
          kind: rawType === "none" ? "offline" : "physical",
          source: "navigator.connection.type",
          physicalType: rawType,
          effectiveType: effectiveDisplay,
          hasPhysicalType: true,
          hasEffectiveType: Boolean(effectiveDisplay),
          labelAr: entry.labelAr,
          labelEn: entry.labelEn,
          label: isEn ? entry.labelEn : entry.labelAr,
          detailAr,
          detailEn,
          detail: isEn ? detailEn : detailAr,
        };
      }

      // 2. Physical connection type is unknown/unexposed, but browser provides effectiveType estimate
      if (effectiveDisplay) {
        const labelAr = `فئة الاتصال المقدّرة: ${effectiveDisplay}`;
        const labelEn = `Est. Effective Class: ${effectiveDisplay}`;
        const detailAr =
          estSuffixAr.length > 0
            ? `النوع الفيزيائي غير مكشوف من المتصفح • ${estSuffixAr.join(" • ")}`
            : `النوع الفيزيائي غير مكشوف من المتصفح • الفئة الفعالة المقدّرة: ${effectiveDisplay}`;
        const detailEn =
          estSuffixEn.length > 0
            ? `Physical link type not exposed by browser • ${estSuffixEn.join(" • ")}`
            : `Physical link type not exposed by browser • Estimated effective class: ${effectiveDisplay}`;
        return {
          kind: "effective-only",
          source: "navigator.connection.effectiveType",
          physicalType: null,
          effectiveType: effectiveDisplay,
          hasPhysicalType: false,
          hasEffectiveType: true,
          labelAr,
          labelEn,
          label: isEn ? labelEn : labelAr,
          detailAr,
          detailEn,
          detail: isEn ? detailEn : detailAr,
        };
      }

      // 3. Neither physical type nor valid effectiveType is available
      return fallbackResult;
    } catch (e) {
      return fallbackResult;
    }
  }

  const STANDARD_REFRESH_RATES = [60, 75, 90, 120, 144, 165, 240];

  /**
   * Quantize a raw measured frame rate (Hz) to the nearest standard display refresh rate tier
   * (60Hz, 75Hz, 90Hz, 120Hz, 144Hz, 165Hz, 240Hz) when within 8% tolerance, or clamp to [60, 240].
   *
   * @param {number} rawFps - Measured raw refresh rate in Hz
   * @returns {number} Quantized refresh rate in Hz
   */
  function quantizeRefreshRate(rawFps) {
    const numeric = Number(rawFps);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 60;
    }
    const clamped = Math.max(60, Math.min(240, numeric));
    let bestTier = 60;
    let smallestRatioDiff = Infinity;
    for (let i = 0; i < STANDARD_REFRESH_RATES.length; i++) {
      const tier = STANDARD_REFRESH_RATES[i];
      const relDiff = Math.abs(clamped - tier) / tier;
      if (relDiff < smallestRatioDiff) {
        smallestRatioDiff = relDiff;
        bestTier = tier;
      }
    }
    if (smallestRatioDiff <= 0.085) {
      return bestTier;
    }
    return Math.round(clamped);
  }

  /**
   * Estimate the device display refresh rate from a rolling window of requestAnimationFrame
   * VSync frame deltas (in milliseconds), rejecting tab-switch pauses and outlier stalls.
   *
   * @param {number[]} deltaSamplesMs - Array of frame-to-frame delta intervals in ms
   * @param {number} [fallbackFps=60] - Fallback FPS when insufficient valid samples exist
   * @returns {number} Quantized target refresh rate (60..240 Hz)
   */
  function estimateRefreshRateFromDeltas(deltaSamplesMs, fallbackFps) {
    const defaultFps =
      Number.isFinite(Number(fallbackFps)) && Number(fallbackFps) > 0
        ? quantizeRefreshRate(Number(fallbackFps))
        : 60;
    if (!Array.isArray(deltaSamplesMs) || deltaSamplesMs.length === 0) {
      return defaultFps;
    }
    const valid = [];
    for (let i = 0; i < deltaSamplesMs.length; i++) {
      const d = Number(deltaSamplesMs[i]);
      // Accept valid VSync intervals between 2.5ms (400Hz) and 25ms (40Hz)
      if (Number.isFinite(d) && d >= 2.5 && d <= 25) {
        valid.push(d);
      }
    }
    if (valid.length === 0) {
      return defaultFps;
    }
    valid.sort(function (a, b) {
      return a - b;
    });
    const mid = Math.floor(valid.length / 2);
    const medianDeltaMs =
      valid.length % 2 === 1
        ? valid[mid]
        : (valid[mid - 1] + valid[mid]) * 0.5;
    if (medianDeltaMs <= 0) {
      return defaultFps;
    }
    return quantizeRefreshRate(1000 / medianDeltaMs);
  }

  /**
   * Resolve a refresh rate input (number, React ref { current: number }, or getter function)
   * and compute the dynamically scaled VSync throttle interval parameters.
   *
   * @param {number|{current?: number}|(() => number)} [refreshRateInput=60]
   * @returns {{
   *   targetFps: number,
   *   intervalMs: number,
   *   jitterToleranceMs: number,
   *   minElapsedMs: number,
   *   minDtSeconds: number
   * }}
   */
  function computeDynamicThrottleInterval(refreshRateInput) {
    let rawValue = refreshRateInput;
    if (typeof refreshRateInput === "function") {
      try {
        rawValue = refreshRateInput();
      } catch (e) {
        rawValue = 60;
      }
    } else if (
      refreshRateInput &&
      typeof refreshRateInput === "object" &&
      "current" in refreshRateInput
    ) {
      rawValue = refreshRateInput.current;
    }

    const numeric = Number(rawValue);
    const targetFps =
      Number.isFinite(numeric) && numeric > 0
        ? Math.min(240, Math.max(30, numeric))
        : 60;
    const intervalMs = 1000 / targetFps;
    // Allow proportional VSync jitter tolerance (0.45ms at 60Hz, scaled on 120Hz/144Hz/240Hz)
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
   * Precision VSync frame-pacing evaluator for 4K glass gauge animations.
   * Dynamically scales the throttle interval from a numeric refresh rate or a live
   * detectedRefreshRateRef ({ current: number }) to stay in lockstep with 60Hz–240Hz displays.
   *
   * @param {number} nowMs - Current high-resolution timestamp (performance.now())
   * @param {number} lastFrameMs - Timestamp of the last rendered gauge frame
   * @param {number|{current?: number}|(() => number)} [targetFps=60] - Target frame rate or ref (60..240fps)
   * @param {boolean} [force=false] - Force immediate render (e.g. on state transition)
   */
  function shouldRenderGaugeFrame(nowMs, lastFrameMs, targetFps, force) {
    const {
      targetFps: fps,
      intervalMs,
      minElapsedMs,
      minDtSeconds,
    } = computeDynamicThrottleInterval(targetFps);
    const now = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : 0;
    const last = Number.isFinite(lastFrameMs) && lastFrameMs > 0 ? lastFrameMs : 0;

    if (force || last === 0) {
      const rawDt = last > 0 && now > last ? (now - last) / 1000 : 1 / fps;
      return {
        shouldRender: true,
        dtSeconds: Math.min(0.05, Math.max(minDtSeconds, rawDt)),
        nextLastFrameMs: now > 0 ? now : 1,
        intervalMs,
        targetFps: fps,
      };
    }

    const elapsedMs = now - last;
    if (elapsedMs < minElapsedMs) {
      return {
        shouldRender: false,
        dtSeconds: 0,
        nextLastFrameMs: last,
        intervalMs,
        targetFps: fps,
      };
    }

    const dtSeconds = Math.min(0.05, Math.max(minDtSeconds, elapsedMs / 1000));
    // Advance lastFrameMs aligned to the frame budget to prevent drift under load
    const remainder = elapsedMs % intervalMs;
    const nextLastFrameMs = remainder < intervalMs * 0.5 ? now - remainder : now;

    return {
      shouldRender: true,
      dtSeconds,
      nextLastFrameMs,
      intervalMs,
      targetFps: fps,
    };
  }

  /**
   * Creates a high-precision requestAnimationFrame throttler for 4K glass gauge components.
   * Uses window.requestAnimationFrame and dynamically scales the throttle interval using
   * detectedRefreshRateRef (or numeric targetFps) for 60Hz, 75Hz, 90Hz, 120Hz, 144Hz, 165Hz, and 240Hz
   * displays, halting automatically when idle to prevent CPU waste.
   *
   * @param {(dtSeconds: number, nowMs: number, currentFps: number, intervalMs: number) => boolean | void} renderCallback
   *   Invoked at the active refresh rate interval. If it returns true, the throttler schedules the next frame;
   *   if false, the loop halts immediately with zero idle CPU usage until schedule() is called again.
   * @param {number|{current?: number}|(() => number)} [targetFps=60] - Initial target frame rate or detectedRefreshRateRef
   */
  function createRafGaugeThrottler(renderCallback, targetFps) {
    const isRefObject =
      targetFps !== null &&
      typeof targetFps === "object" &&
      "current" in targetFps;
    const isGetterFn = typeof targetFps === "function";

    let fps = computeDynamicThrottleInterval(targetFps).targetFps;
    let rafId = 0;
    let lastFrameMs = 0;
    let lastRawVsyncMs = 0;
    let pendingForce = false;
    const vsyncDeltas = [];

    function resolveActiveFps() {
      if (isRefObject || isGetterFn) {
        const synced = computeDynamicThrottleInterval(targetFps).targetFps;
        fps = synced;
      }
      return fps;
    }

    function syncActiveFps(nextFps) {
      const clamped = computeDynamicThrottleInterval(nextFps).targetFps;
      fps = clamped;
      if (isRefObject) {
        try {
          targetFps.current = clamped;
        } catch (e) {
          // ignore read-only ref
        }
      }
      return fps;
    }

    const winObj =
      typeof window !== "undefined" && window !== null ? window : null;

    const rafFn =
      winObj && typeof winObj.requestAnimationFrame === "function"
        ? winObj.requestAnimationFrame.bind(winObj)
        : typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : function (cb) {
              const currentIntervalMs =
                computeDynamicThrottleInterval(resolveActiveFps()).intervalMs;
              return setTimeout(function () {
                cb(
                  typeof performance !== "undefined" && performance.now
                    ? performance.now()
                    : Date.now()
                );
              }, currentIntervalMs);
            };

    const cafFn =
      winObj && typeof winObj.cancelAnimationFrame === "function"
        ? winObj.cancelAnimationFrame.bind(winObj)
        : typeof cancelAnimationFrame === "function"
          ? cancelAnimationFrame
          : clearTimeout;

    function onFrame(timestamp) {
      rafId = 0;
      const now =
        Number.isFinite(timestamp) && timestamp > 0
          ? timestamp
          : typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();

      let currentFps = resolveActiveFps();

      if (lastRawVsyncMs > 0) {
        const rawDelta = now - lastRawVsyncMs;
        if (rawDelta >= 2.5 && rawDelta <= 25) {
          vsyncDeltas.push(rawDelta);
          if (vsyncDeltas.length > 12) {
            vsyncDeltas.shift();
          }
          if (vsyncDeltas.length >= 4) {
            const detectedFps = estimateRefreshRateFromDeltas(
              vsyncDeltas,
              currentFps
            );
            if (detectedFps !== currentFps) {
              currentFps = syncActiveFps(detectedFps);
            }
          }
        }
      }
      lastRawVsyncMs = now;

      const gate = shouldRenderGaugeFrame(
        now,
        lastFrameMs,
        currentFps,
        pendingForce
      );
      if (!gate.shouldRender) {
        // Wait for the next VSync boundary matching the dynamically scaled throttle interval
        rafId = rafFn(onFrame);
        return;
      }

      pendingForce = false;
      lastFrameMs = gate.nextLastFrameMs;
      const keepRunning =
        typeof renderCallback === "function"
          ? Boolean(
              renderCallback(
                gate.dtSeconds,
                now,
                gate.targetFps,
                gate.intervalMs
              )
            )
          : false;

      if (keepRunning && rafId === 0) {
        rafId = rafFn(onFrame);
      }
    }

    function schedule(force) {
      if (force) {
        pendingForce = true;
      }
      if (rafId === 0) {
        rafId = rafFn(onFrame);
      }
    }

    function cancel() {
      if (rafId !== 0) {
        cafFn(rafId);
        rafId = 0;
      }
      lastRawVsyncMs = 0;
      pendingForce = false;
    }

    function setTargetFps(nextFps) {
      return syncActiveFps(nextFps);
    }

    function getTargetFps() {
      return resolveActiveFps();
    }

    function getThrottleIntervalMs() {
      return computeDynamicThrottleInterval(resolveActiveFps()).intervalMs;
    }

    return {
      schedule,
      cancel,
      setTargetFps,
      getTargetFps,
      getThrottleIntervalMs,
      isPending: function () {
        return rafId !== 0;
      },
    };
  }

  /**
   * Pure ease-out cubic count-up frame calculator for 'Max Speed' and 'Average Speed' cards.
   * Interpolates smoothly from 0 to targetMbps in the target display unit and precision,
   * landing on the exact formatSpeedReading output at progress >= 1.
   *
   * @param {number|string|null|undefined} targetMbps - Final measured speed in Mbps
   * @param {number} progress01 - Normalized animation progress in [0, 1]
   * @param {boolean} allowGbps - Whether values >= 1000 Mbps format as Gbps
   */
  function computeCountUpFrame(targetMbps, progress01, allowGbps) {
    const rawTarget = Number(targetMbps);
    if (
      targetMbps === null ||
      targetMbps === undefined ||
      targetMbps === "" ||
      !Number.isFinite(rawTarget) ||
      rawTarget <= 0
    ) {
      return {
        displayNumber: "--",
        unitEn: "Mbps",
        currentMbps: 0,
        progress: 1,
        isComplete: true,
      };
    }

    const targetFmt = formatSpeedReading(rawTarget, Boolean(allowGbps));
    const t = Number.isFinite(Number(progress01))
      ? Math.max(0, Math.min(1, Number(progress01)))
      : 1;

    if (t >= 1) {
      return {
        displayNumber: targetFmt.displayNumber,
        unitEn: targetFmt.unitEn,
        currentMbps: rawTarget,
        progress: 1,
        isComplete: true,
      };
    }

    // Cubic ease-out: fast initial acceleration, smooth deceleration into final reading
    const eased = 1 - Math.pow(1 - t, 3);
    const targetDisplayNum = Number(targetFmt.displayNumber);
    const dotIndex = targetFmt.displayNumber.indexOf(".");
    const decimals =
      dotIndex !== -1 ? targetFmt.displayNumber.length - dotIndex - 1 : 0;

    const currentDisplayVal =
      Number.isFinite(targetDisplayNum) && targetDisplayNum > 0
        ? targetDisplayNum * eased
        : 0;

    const displayNumber =
      decimals > 0
        ? currentDisplayVal.toFixed(decimals)
        : String(Math.round(currentDisplayVal));

    return {
      displayNumber,
      unitEn: targetFmt.unitEn,
      currentMbps: rawTarget * eased,
      progress: t,
      isComplete: false,
    };
  }

  /**
   * Run a requestAnimationFrame count-up animation for Max Speed and Average Speed stat cards.
   * Returns a cancel function to abort the animation cleanly on test restart or unmount.
   *
   * @param {Object} options
   * @param {number|null} options.maxSpeedMbps
   * @param {number|null} options.avgSpeedMbps
   * @param {boolean} [options.allowGbps=true]
   * @param {number} [options.durationMs=950]
   * @param {boolean} [options.reducedMotion=false]
   * @param {(frame: {maxFrame: Object, avgFrame: Object, progress: number, isComplete: boolean}) => void} options.onFrame
   * @param {() => void} [options.onComplete]
   */
  function animateStatCountUp(options) {
    const opts = options || {};
    const maxSpeedMbps = opts.maxSpeedMbps ?? null;
    const avgSpeedMbps = opts.avgSpeedMbps ?? null;
    const allowGbps = opts.allowGbps !== undefined ? Boolean(opts.allowGbps) : true;
    const durationMs =
      Number.isFinite(Number(opts.durationMs)) && Number(opts.durationMs) > 0
        ? Number(opts.durationMs)
        : 950;
    const reducedMotion = Boolean(opts.reducedMotion);
    const onFrame = typeof opts.onFrame === "function" ? opts.onFrame : null;
    const onComplete = typeof opts.onComplete === "function" ? opts.onComplete : null;

    const hasMax = Number.isFinite(Number(maxSpeedMbps)) && Number(maxSpeedMbps) > 0;
    const hasAvg = Number.isFinite(Number(avgSpeedMbps)) && Number(avgSpeedMbps) > 0;

    if (reducedMotion || (!hasMax && !hasAvg)) {
      const maxFrame = computeCountUpFrame(maxSpeedMbps, 1, allowGbps);
      const avgFrame = computeCountUpFrame(avgSpeedMbps, 1, allowGbps);
      if (onFrame) {
        onFrame({ maxFrame, avgFrame, progress: 1, isComplete: true });
      }
      if (onComplete) {
        onComplete();
      }
      return function noopCancel() {};
    }

    const nowFn =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? function () {
            return performance.now();
          }
        : function () {
            return Date.now();
          };

    const rafFn =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : function (cb) {
            return setTimeout(function () {
              cb(nowFn());
            }, 16);
          };

    const cafFn =
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : clearTimeout;

    let rafId = 0;
    let cancelled = false;
    let startTimeMs = 0;

    function step(timestamp) {
      if (cancelled) return;
      const now =
        typeof timestamp === "number" && timestamp > 0 ? timestamp : nowFn();
      if (startTimeMs === 0) {
        startTimeMs = now;
      }
      const elapsed = Math.max(0, now - startTimeMs);
      const progress = Math.min(1, elapsed / durationMs);
      const maxFrame = computeCountUpFrame(maxSpeedMbps, progress, allowGbps);
      const avgFrame = computeCountUpFrame(avgSpeedMbps, progress, allowGbps);
      const isComplete = progress >= 1;

      if (onFrame) {
        onFrame({ maxFrame, avgFrame, progress, isComplete });
      }

      if (!isComplete && !cancelled) {
        rafId = rafFn(step);
      } else if (isComplete && !cancelled) {
        rafId = 0;
        if (onComplete) {
          onComplete();
        }
      }
    }

    // Emit initial 0% frame immediately so the user sees the count-up start from 0
    const initMax = computeCountUpFrame(maxSpeedMbps, 0, allowGbps);
    const initAvg = computeCountUpFrame(avgSpeedMbps, 0, allowGbps);
    if (onFrame) {
      onFrame({ maxFrame: initMax, avgFrame: initAvg, progress: 0, isComplete: false });
    }
    rafId = rafFn(step);

    return function cancelCountUp() {
      cancelled = true;
      if (rafId !== 0) {
        cafFn(rafId);
        rafId = 0;
      }
    };
  }

  /**
   * Dedicated requestAnimationFrame controller for the 'Max Speed' and 'Average Speed' stat cards.
   * Synchronizes numeric updates (both live testing interpolation and final count-up transitions)
   * with the 60fps gauge arc animations while dirty-checking all formatted strings and CSS classes
   * so unchanged DOM nodes are never mutated (preventing layout thrashing).
   *
   * @param {Object} [options]
   * @param {number} [options.targetFps=60]
   * @param {(commitState: {
   *   maxDisplay: string,
   *   maxUnit: string,
   *   avgDisplay: string,
   *   avgUnit: string,
   *   countingUp: boolean,
   *   mode: string,
   *   maxChanged: boolean,
   *   avgChanged: boolean,
   *   countingClassChanged: boolean
   * }) => void} [options.onCommit]
   */
  function createStatCardsRafLoop(options) {
    const opts = options || {};
    let targetFps =
      Number.isFinite(Number(opts.targetFps)) && Number(opts.targetFps) > 0
        ? Math.min(240, Math.max(30, Number(opts.targetFps)))
        : 60;
    const onCommit = typeof opts.onCommit === "function" ? opts.onCommit : null;

    const nowFn =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? function () {
            return performance.now();
          }
        : function () {
            return Date.now();
          };

    const winObj =
      typeof window !== "undefined" && window !== null ? window : null;

    const rafFn =
      winObj && typeof winObj.requestAnimationFrame === "function"
        ? winObj.requestAnimationFrame.bind(winObj)
        : typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : function (cb) {
              return setTimeout(function () {
                cb(nowFn());
              }, 1000 / targetFps);
            };

    const cafFn =
      winObj && typeof winObj.cancelAnimationFrame === "function"
        ? winObj.cancelAnimationFrame.bind(winObj)
        : typeof cancelAnimationFrame === "function"
          ? cancelAnimationFrame
          : clearTimeout;

    let rafId = 0;
    let lastFrameMs = 0;
    let mode = "idle"; // "idle" | "live" | "countup"
    let allowGbps = true;
    let smoothLive = true;

    let targetMaxMbps = null;
    let targetAvgMbps = null;
    let displayMaxMbps = 0;
    let displayAvgMbps = 0;

    let countUpStartMs = 0;
    let countUpDurationMs = 950;
    let countUpOnComplete = null;

    // Dirty-check cache to prevent redundant DOM writes and layout thrashing
    let lastMaxDisplay = "";
    let lastMaxUnit = "";
    let lastAvgDisplay = "";
    let lastAvgUnit = "";
    let lastCountingUp = false;
    let commitCount = 0;

    function cancelStandaloneRaf() {
      if (rafId !== 0) {
        cafFn(rafId);
        rafId = 0;
      }
    }

    function commitIfDirty(maxDisplay, maxUnit, avgDisplay, avgUnit, countingUp, forceCommit) {
      const maxChanged =
        Boolean(forceCommit) ||
        maxDisplay !== lastMaxDisplay ||
        maxUnit !== lastMaxUnit;
      const avgChanged =
        Boolean(forceCommit) ||
        avgDisplay !== lastAvgDisplay ||
        avgUnit !== lastAvgUnit;
      const countingClassChanged =
        Boolean(forceCommit) || Boolean(countingUp) !== lastCountingUp;

      if (!maxChanged && !avgChanged && !countingClassChanged) {
        return false;
      }

      lastMaxDisplay = maxDisplay;
      lastMaxUnit = maxUnit;
      lastAvgDisplay = avgDisplay;
      lastAvgUnit = avgUnit;
      lastCountingUp = Boolean(countingUp);
      commitCount += 1;

      if (onCommit) {
        onCommit({
          maxDisplay,
          maxUnit,
          avgDisplay,
          avgUnit,
          countingUp: lastCountingUp,
          mode,
          maxChanged,
          avgChanged,
          countingClassChanged,
        });
      }
      return true;
    }

    /**
     * Step a single frame in lockstep with the host gauge requestAnimationFrame loop.
     * Can also be driven by the internal standalone requestAnimationFrame loop.
     *
     * @param {number} [nowMs]
     * @param {number} [dtSeconds]
     * @returns {boolean} true if animation still requires subsequent frames
     */
    function syncFrame(nowMs, dtSeconds) {
      const now =
        typeof nowMs === "number" && nowMs > 0 ? nowMs : nowFn();
      const minDt =
        targetFps > 60
          ? Math.max(0.002, Number((0.5 / targetFps).toFixed(4)))
          : 0.008;
      const dt =
        typeof dtSeconds === "number" && dtSeconds > 0
          ? Math.min(0.05, Math.max(minDt, dtSeconds))
          : 1 / targetFps;

      lastFrameMs = now;

      if (mode === "countup") {
        if (countUpStartMs === 0 || now < countUpStartMs) {
          countUpStartMs = now;
        }
        const elapsed = Math.max(0, now - countUpStartMs);
        const progress = Math.min(1, elapsed / countUpDurationMs);
        const maxFrame = computeCountUpFrame(targetMaxMbps, progress, allowGbps);
        const avgFrame = computeCountUpFrame(targetAvgMbps, progress, allowGbps);
        const isComplete = progress >= 1;

        displayMaxMbps = maxFrame.currentMbps;
        displayAvgMbps = avgFrame.currentMbps;

        commitIfDirty(
          maxFrame.displayNumber,
          maxFrame.unitEn,
          avgFrame.displayNumber,
          avgFrame.unitEn,
          !isComplete,
          false
        );

        if (isComplete) {
          mode = "live";
          const doneCb = countUpOnComplete;
          countUpOnComplete = null;
          if (typeof doneCb === "function") {
            doneCb();
          }
          return false;
        }
        return true;
      }

      if (mode === "live") {
        const hasMax = Number.isFinite(Number(targetMaxMbps)) && Number(targetMaxMbps) > 0;
        const hasAvg = Number.isFinite(Number(targetAvgMbps)) && Number(targetAvgMbps) > 0;

        let nextMaxDisplay = "--";
        let nextMaxUnit = "Mbps";
        let nextAvgDisplay = "--";
        let nextAvgUnit = "Mbps";
        let stillInterpolating = false;

        if (hasMax) {
          const rawMax = Number(targetMaxMbps);
          displayMaxMbps = smoothNumericValue(
            displayMaxMbps,
            rawMax,
            dt,
            !smoothLive
          );
          if (smoothLive && Math.abs(rawMax - displayMaxMbps) > 0.05) {
            stillInterpolating = true;
          }
          const maxFmt = formatSpeedReading(
            smoothLive ? displayMaxMbps : rawMax,
            allowGbps
          );
          nextMaxDisplay = maxFmt.displayNumber;
          nextMaxUnit = maxFmt.unitEn;
        } else {
          displayMaxMbps = 0;
        }

        if (hasAvg) {
          const rawAvg = Number(targetAvgMbps);
          displayAvgMbps = smoothNumericValue(
            displayAvgMbps,
            rawAvg,
            dt,
            !smoothLive
          );
          if (smoothLive && Math.abs(rawAvg - displayAvgMbps) > 0.05) {
            stillInterpolating = true;
          }
          const avgFmt = formatSpeedReading(
            smoothLive ? displayAvgMbps : rawAvg,
            allowGbps
          );
          nextAvgDisplay = avgFmt.displayNumber;
          nextAvgUnit = avgFmt.unitEn;
        } else {
          displayAvgMbps = 0;
        }

        commitIfDirty(
          nextMaxDisplay,
          nextMaxUnit,
          nextAvgDisplay,
          nextAvgUnit,
          false,
          false
        );
        return stillInterpolating;
      }

      return false;
    }

    function standaloneStep(timestamp) {
      rafId = 0;
      const now =
        typeof timestamp === "number" && timestamp > 0 ? timestamp : nowFn();
      const gate = shouldRenderGaugeFrame(now, lastFrameMs, targetFps, false);
      if (!gate.shouldRender) {
        rafId = rafFn(standaloneStep);
        return;
      }
      lastFrameMs = gate.nextLastFrameMs;
      const keepRunning = syncFrame(now, gate.dtSeconds);
      if (keepRunning && rafId === 0) {
        rafId = rafFn(standaloneStep);
      }
    }

    function ensureStandaloneLoop() {
      if (rafId === 0) {
        rafId = rafFn(standaloneStep);
      }
    }

    function setLiveTargets(maxMbps, avgMbps, nextAllowGbps, interpolate, autoSchedule) {
      if (mode === "countup") {
        // Do not overwrite an active final count-up animation unless explicitly cancelled
        return;
      }
      mode = "live";
      targetMaxMbps = maxMbps ?? null;
      targetAvgMbps = avgMbps ?? null;
      if (nextAllowGbps !== undefined) {
        allowGbps = Boolean(nextAllowGbps);
      }
      smoothLive = interpolate !== undefined ? Boolean(interpolate) : true;
      if (autoSchedule) {
        ensureStandaloneLoop();
      }
    }

    function startCountUp(countUpOpts) {
      const cOpts = countUpOpts || {};
      cancelStandaloneRaf();
      targetMaxMbps = cOpts.maxSpeedMbps ?? null;
      targetAvgMbps = cOpts.avgSpeedMbps ?? null;
      if (cOpts.allowGbps !== undefined) {
        allowGbps = Boolean(cOpts.allowGbps);
      }
      countUpDurationMs =
        Number.isFinite(Number(cOpts.durationMs)) && Number(cOpts.durationMs) > 0
          ? Number(cOpts.durationMs)
          : 950;
      countUpOnComplete =
        typeof cOpts.onComplete === "function" ? cOpts.onComplete : null;
      const reducedMotion = Boolean(cOpts.reducedMotion);

      const hasMax = Number.isFinite(Number(targetMaxMbps)) && Number(targetMaxMbps) > 0;
      const hasAvg = Number.isFinite(Number(targetAvgMbps)) && Number(targetAvgMbps) > 0;

      if (reducedMotion || (!hasMax && !hasAvg)) {
        mode = "live";
        displayMaxMbps = hasMax ? Number(targetMaxMbps) : 0;
        displayAvgMbps = hasAvg ? Number(targetAvgMbps) : 0;
        const maxFrame = computeCountUpFrame(targetMaxMbps, 1, allowGbps);
        const avgFrame = computeCountUpFrame(targetAvgMbps, 1, allowGbps);
        commitIfDirty(
          maxFrame.displayNumber,
          maxFrame.unitEn,
          avgFrame.displayNumber,
          avgFrame.unitEn,
          false,
          true
        );
        if (countUpOnComplete) {
          const cb = countUpOnComplete;
          countUpOnComplete = null;
          cb();
        }
        return cancel;
      }

      mode = "countup";
      countUpStartMs = nowFn();
      displayMaxMbps = 0;
      displayAvgMbps = 0;

      const initMax = computeCountUpFrame(targetMaxMbps, 0, allowGbps);
      const initAvg = computeCountUpFrame(targetAvgMbps, 0, allowGbps);
      commitIfDirty(
        initMax.displayNumber,
        initMax.unitEn,
        initAvg.displayNumber,
        initAvg.unitEn,
        true,
        true
      );

      if (cOpts.standalone !== false) {
        ensureStandaloneLoop();
      }
      return cancel;
    }

    function reset(defaultDisplay, defaultUnit) {
      cancelStandaloneRaf();
      mode = "idle";
      targetMaxMbps = null;
      targetAvgMbps = null;
      displayMaxMbps = 0;
      displayAvgMbps = 0;
      countUpStartMs = 0;
      countUpOnComplete = null;
      commitIfDirty(
        defaultDisplay !== undefined ? String(defaultDisplay) : "--",
        defaultUnit !== undefined ? String(defaultUnit) : "Mbps",
        defaultDisplay !== undefined ? String(defaultDisplay) : "--",
        defaultUnit !== undefined ? String(defaultUnit) : "Mbps",
        false,
        false
      );
    }

    function cancel() {
      cancelStandaloneRaf();
      if (mode === "countup") {
        mode = "live";
        countUpStartMs = 0;
        countUpOnComplete = null;
        commitIfDirty(
          lastMaxDisplay || "--",
          lastMaxUnit || "Mbps",
          lastAvgDisplay || "--",
          lastAvgUnit || "Mbps",
          false,
          false
        );
      }
    }

    function setTargetFps(nextFps) {
      const numeric = Number(nextFps);
      if (Number.isFinite(numeric) && numeric > 0) {
        targetFps = Math.min(240, Math.max(30, numeric));
      }
      return targetFps;
    }

    function getTargetFps() {
      return targetFps;
    }

    return {
      setLiveTargets,
      startCountUp,
      syncFrame,
      reset,
      cancel,
      setTargetFps,
      getTargetFps,
      getState: function () {
        return {
          mode,
          lastMaxDisplay,
          lastMaxUnit,
          lastAvgDisplay,
          lastAvgUnit,
          lastCountingUp,
          commitCount,
          targetFps,
          isPending: rafId !== 0,
        };
      },
    };
  }

  /**
   * Format a Date object or epoch timestamp into consistent YYYY-MM-DD, Arabic date,
   * and localized time strings with tabular numerals.
   *
   * @param {Date|number|string} [dateInput]
   * @param {number} [fallbackEpochMs]
   */
  function formatHistoryDateParts(dateInput, fallbackEpochMs) {
    let d = null;
    if (dateInput instanceof Date && Number.isFinite(dateInput.getTime())) {
      d = dateInput;
    } else if (typeof dateInput === "number" && Number.isFinite(dateInput) && dateInput > 0) {
      d = new Date(dateInput);
    } else if (typeof dateInput === "string" && dateInput.trim().length > 0) {
      const parsed = Date.parse(dateInput.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        d = new Date(parsed);
      }
    }

    if (!d || !Number.isFinite(d.getTime())) {
      const fb =
        typeof fallbackEpochMs === "number" && Number.isFinite(fallbackEpochMs) && fallbackEpochMs > 0
          ? fallbackEpochMs
          : Date.now();
      d = new Date(fb);
    }

    const epochMs = d.getTime();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const isoDate = `${year}-${month}-${day}`;
    const dateAr = `${year}/${month}/${day}`;
    const dateEn = isoDate;

    const hours24 = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const time24 = `${hours24}:${minutes}:${seconds}`;

    let timeAr = time24;
    let timeEn = time24;
    try {
      timeAr = d.toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      timeAr = time24;
    }
    try {
      timeEn = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (e) {
      timeEn = time24;
    }

    return {
      epochMs,
      isoDate,
      dateAr,
      dateEn,
      timeAr,
      timeEn,
      time24,
    };
  }

  /**
   * Create a normalized, immutable test history entry with a clear Date field,
   * localized time strings, unique runId, and sanitized numeric telemetry values.
   *
   * @param {Object} rawRun
   * @param {Date|number} [nowInput]
   */
  function createTestHistoryEntry(rawRun, nowInput) {
    const src = rawRun && typeof rawRun === "object" ? rawRun : {};
    const explicitEpoch =
      typeof src.epochMs === "number" && Number.isFinite(src.epochMs) && src.epochMs > 0
        ? src.epochMs
        : null;
    const dateSource =
      explicitEpoch !== null
        ? explicitEpoch
        : src.isoDate || src.date || nowInput || Date.now();

    const parts = formatHistoryDateParts(
      dateSource,
      typeof nowInput === "number" && Number.isFinite(nowInput)
        ? nowInput
        : Date.now()
    );

    const isoDate =
      typeof src.isoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src.isoDate.trim())
        ? src.isoDate.trim()
        : typeof src.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src.date.trim())
          ? src.date.trim()
          : parts.isoDate;

    const dateAr =
      typeof src.dateAr === "string" && src.dateAr.trim().length > 0
        ? src.dateAr.trim()
        : isoDate.replace(/-/g, "/");
    const dateEn =
      typeof src.dateEn === "string" && src.dateEn.trim().length > 0
        ? src.dateEn.trim()
        : isoDate;

    const timeAr =
      typeof src.timeAr === "string" && src.timeAr.trim().length > 0
        ? src.timeAr.trim()
        : typeof src.timestamp === "string" && src.timestamp.trim().length > 0
          ? src.timestamp.trim()
          : parts.timeAr;

    const timeEn =
      typeof src.timeEn === "string" && src.timeEn.trim().length > 0
        ? src.timeEn.trim()
        : typeof src.timestamp === "string" &&
            /^\d{1,2}:\d{2}(:\d{2})?/.test(src.timestamp.trim())
          ? src.timestamp.trim()
          : parts.timeEn;

    const serverName =
      typeof src.serverName === "string" && src.serverName.trim().length > 0
        ? src.serverName.trim()
        : typeof src.server === "string" && src.server.trim().length > 0
          ? src.server.trim()
          : "Terrax Core";

    const toNonNegativeNumber = function (val, decimals) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) return 0;
      if (typeof decimals === "number" && decimals >= 0) {
        return Number(n.toFixed(decimals));
      }
      return n;
    };

    const dlMbps = toNonNegativeNumber(src.dlMbps ?? src.dl, 2);
    const ulMbps = toNonNegativeNumber(src.ulMbps ?? src.ul, 2);
    const pingMs = toNonNegativeNumber(src.pingMs ?? src.ping, 2);
    const jitterMs = toNonNegativeNumber(src.jitterMs ?? src.jitter, 2);
    const megabytesUsed = toNonNegativeNumber(src.megabytesUsed ?? src.mbUsed, 2);

    let stabilityPercent = null;
    if (
      src.stabilityPercent !== null &&
      src.stabilityPercent !== undefined &&
      src.stabilityPercent !== "" &&
      src.stabilityPercent !== "--"
    ) {
      const rawStab =
        typeof src.stabilityPercent === "string"
          ? Number(src.stabilityPercent.replace("%", "").trim())
          : Number(src.stabilityPercent);
      if (Number.isFinite(rawStab) && rawStab >= 0) {
        stabilityPercent = Math.max(0, Math.min(100, Math.round(rawStab)));
      }
    }

    const runId =
      typeof src.runId === "string" && src.runId.trim().length > 0
        ? src.runId.trim()
        : `run_${parts.epochMs}_${Math.round(dlMbps * 100)}_${Math.round(ulMbps * 100)}`;

    return {
      runId,
      epochMs: parts.epochMs,
      isoDate,
      date: isoDate,
      dateAr,
      dateEn,
      timestamp: timeAr,
      timeAr,
      timeEn,
      time24: parts.time24,
      serverName,
      dlMbps,
      ulMbps,
      pingMs,
      jitterMs,
      stabilityPercent,
      megabytesUsed,
    };
  }

  /**
   * Safely normalize an array of stored history entries (including legacy entries without
   * `date` or `epochMs`), deduplicating by `runId` so test restarts never duplicate or corrupt rows.
   *
   * @param {Array} rawList
   * @param {number} [fallbackNowMs]
   */
  function normalizeTestHistoryList(rawList, fallbackNowMs) {
    if (!Array.isArray(rawList)) return [];
    const baseNow =
      typeof fallbackNowMs === "number" && Number.isFinite(fallbackNowMs) && fallbackNowMs > 0
        ? fallbackNowMs
        : Date.now();

    const seenRunIds = new Map();
    const normalized = [];

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== "object") continue;

      // Preserve chronological order for legacy entries lacking epochMs
      const fallbackItemEpoch =
        typeof item.epochMs === "number" && Number.isFinite(item.epochMs) && item.epochMs > 0
          ? item.epochMs
          : baseNow - i * 1000;

      const entry = createTestHistoryEntry(item, fallbackItemEpoch);
      if (seenRunIds.has(entry.runId)) {
        const existingIdx = seenRunIds.get(entry.runId);
        normalized[existingIdx] = entry;
      } else {
        seenRunIds.set(entry.runId, normalized.length);
        normalized.push(entry);
      }
    }

    return normalized;
  }

  /**
   * Immutably record a completed test run into the history list.
   * Ensures accuracy across test restarts:
   * - Never mutates or overwrites previous test runs with different runIds.
   * - Deduplicates if the same runId is committed more than once.
   * - Enforces maxEntries cap (default 25) while keeping the most recent runs.
   *
   * @param {Array} existingList
   * @param {Object} rawRun
   * @param {number} [maxEntries=25]
   * @param {Date|number} [nowInput]
   */
  function appendTestHistoryEntry(existingList, rawRun, maxEntries, nowInput) {
    const cap =
      typeof maxEntries === "number" && Number.isFinite(maxEntries) && maxEntries > 0
        ? Math.floor(maxEntries)
        : 25;
    const normalizedExisting = normalizeTestHistoryList(existingList);
    if (!rawRun || typeof rawRun !== "object") {
      return normalizedExisting.slice(0, cap);
    }

    const newEntry = createTestHistoryEntry(rawRun, nowInput);
    const existingIndex = normalizedExisting.findIndex(function (item) {
      return item.runId === newEntry.runId;
    });

    let nextList;
    if (existingIndex !== -1) {
      nextList = normalizedExisting.slice();
      nextList[existingIndex] = newEntry;
    } else {
      nextList = [newEntry].concat(normalizedExisting);
    }

    return nextList.slice(0, cap);
  }

  /**
   * Sort a normalized test history list by any supported column key and direction.
   * Supported sortKey values: 'date' | 'time' | 'server' | 'dl' | 'ul' | 'stability' | 'ping'
   * Supported sortDir values: 'asc' | 'desc'
   *
   * @param {Array} list
   * @param {string} [sortKey='date']
   * @param {string} [sortDir='desc']
   */
  function sortTestHistoryList(list, sortKey, sortDir) {
    const normalized = normalizeTestHistoryList(list);
    if (normalized.length <= 1) return normalized;

    const key =
      typeof sortKey === "string" &&
      ["date", "time", "server", "dl", "ul", "stability", "ping"].includes(
        sortKey.trim().toLowerCase()
      )
        ? sortKey.trim().toLowerCase()
        : "date";

    const dir =
      typeof sortDir === "string" && sortDir.trim().toLowerCase() === "asc"
        ? "asc"
        : "desc";
    const dirMultiplier = dir === "asc" ? 1 : -1;

    return normalized.slice().sort(function (a, b) {
      if (key === "date") {
        if (a.isoDate !== b.isoDate) {
          return a.isoDate.localeCompare(b.isoDate) * dirMultiplier;
        }
        return (a.epochMs - b.epochMs) * dirMultiplier;
      }

      if (key === "time") {
        if (a.epochMs !== b.epochMs) {
          return (a.epochMs - b.epochMs) * dirMultiplier;
        }
        return (a.time24 || "").localeCompare(b.time24 || "") * dirMultiplier;
      }

      if (key === "server") {
        const cmp = (a.serverName || "").localeCompare(b.serverName || "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (cmp !== 0) return cmp * dirMultiplier;
        return b.epochMs - a.epochMs;
      }

      if (key === "dl") {
        const diff = (Number(a.dlMbps) || 0) - (Number(b.dlMbps) || 0);
        if (diff !== 0) return diff * dirMultiplier;
        return b.epochMs - a.epochMs;
      }

      if (key === "ul") {
        const diff = (Number(a.ulMbps) || 0) - (Number(b.ulMbps) || 0);
        if (diff !== 0) return diff * dirMultiplier;
        return b.epochMs - a.epochMs;
      }

      if (key === "stability") {
        const aHas =
          a.stabilityPercent !== null &&
          a.stabilityPercent !== undefined &&
          Number.isFinite(Number(a.stabilityPercent));
        const bHas =
          b.stabilityPercent !== null &&
          b.stabilityPercent !== undefined &&
          Number.isFinite(Number(b.stabilityPercent));
        // Always place missing/unavailable stability entries at the bottom
        if (!aHas && !bHas) return b.epochMs - a.epochMs;
        if (!aHas) return 1;
        if (!bHas) return -1;
        const diff = Number(a.stabilityPercent) - Number(b.stabilityPercent);
        if (diff !== 0) return diff * dirMultiplier;
        return b.epochMs - a.epochMs;
      }

      if (key === "ping") {
        const aPing = Number(a.pingMs);
        const bPing = Number(b.pingMs);
        const aValid = Number.isFinite(aPing) && aPing > 0;
        const bValid = Number.isFinite(bPing) && bPing > 0;
        if (!aValid && !bValid) return b.epochMs - a.epochMs;
        if (!aValid) return 1;
        if (!bValid) return -1;
        const diff = aPing - bPing;
        if (diff !== 0) return diff * dirMultiplier;
        return b.epochMs - a.epochMs;
      }

      return (a.epochMs - b.epochMs) * dirMultiplier;
    });
  }

  /**
   * Pure cubic ease-out integer count-up frame calculator for the 'Completed Tests'
   * counter (#total-tests-count) inside the Usage & Test History dialog.
   *
   * @param {number|string|null|undefined} targetCount - Total completed tests count
   * @param {number} progress01 - Normalized progress in [0, 1]
   */
  function computeIntegerCountUpFrame(targetCount, progress01) {
    const rawTarget = Math.floor(Number(targetCount));
    const target = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : 0;

    if (target <= 0) {
      return {
        displayValue: "0",
        currentCount: 0,
        targetCount: 0,
        progress: 1,
        isComplete: true,
      };
    }

    const t = Number.isFinite(Number(progress01))
      ? Math.max(0, Math.min(1, Number(progress01)))
      : 1;

    if (t >= 1) {
      return {
        displayValue: String(target),
        currentCount: target,
        targetCount: target,
        progress: 1,
        isComplete: true,
      };
    }

    // Cubic ease-out: responsive initial count-up that settles smoothly into final integer
    const eased = 1 - Math.pow(1 - t, 3);
    const currentCount = Math.min(target, Math.max(0, Math.round(target * eased)));

    return {
      displayValue: String(currentCount),
      currentCount,
      targetCount: target,
      progress: t,
      isComplete: false,
    };
  }

  /**
   * Run a requestAnimationFrame count-up animation for the 'Completed Tests' counter
   * (#total-tests-count) when the Usage dialog opens.
   * Dirty-checks integer frames so DOM writes only occur when the displayed integer changes.
   *
   * @param {Object} options
   * @param {number} options.targetCount
   * @param {number} [options.durationMs=650]
   * @param {boolean} [options.reducedMotion=false]
   * @param {(frame: {displayValue: string, currentCount: number, targetCount: number, progress: number, isComplete: boolean}) => void} [options.onFrame]
   * @param {() => void} [options.onComplete]
   */
  function animateCompletedTestsCountUp(options) {
    const opts = options || {};
    const rawTarget = Math.floor(Number(opts.targetCount));
    const targetCount = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : 0;
    const durationMs =
      Number.isFinite(Number(opts.durationMs)) && Number(opts.durationMs) > 0
        ? Number(opts.durationMs)
        : 650;
    const reducedMotion = Boolean(opts.reducedMotion);
    const onFrame = typeof opts.onFrame === "function" ? opts.onFrame : null;
    const onComplete = typeof opts.onComplete === "function" ? opts.onComplete : null;

    if (reducedMotion || targetCount <= 0) {
      const finalFrame = computeIntegerCountUpFrame(targetCount, 1);
      if (onFrame) {
        onFrame(finalFrame);
      }
      if (onComplete) {
        onComplete();
      }
      return function noopCancel() {};
    }

    const nowFn =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? function () {
            return performance.now();
          }
        : function () {
            return Date.now();
          };

    const rafFn =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : function (cb) {
            return setTimeout(function () {
              cb(nowFn());
            }, 16);
          };

    const cafFn =
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : clearTimeout;

    let rafId = 0;
    let cancelled = false;
    let startTimeMs = 0;
    let lastEmittedDisplay = "";

    function step(timestamp) {
      if (cancelled) return;
      const now =
        typeof timestamp === "number" && timestamp > 0 ? timestamp : nowFn();
      if (startTimeMs === 0) {
        startTimeMs = now;
      }
      const elapsed = Math.max(0, now - startTimeMs);
      const progress = Math.min(1, elapsed / durationMs);
      const frame = computeIntegerCountUpFrame(targetCount, progress);

      if (onFrame && (frame.displayValue !== lastEmittedDisplay || frame.isComplete)) {
        lastEmittedDisplay = frame.displayValue;
        onFrame(frame);
      }

      if (!frame.isComplete && !cancelled) {
        rafId = rafFn(step);
      } else if (frame.isComplete && !cancelled) {
        rafId = 0;
        if (onComplete) {
          onComplete();
        }
      }
    }

    // Emit initial 0 frame immediately on dialog open
    const initFrame = computeIntegerCountUpFrame(targetCount, 0);
    lastEmittedDisplay = initFrame.displayValue;
    if (onFrame) {
      onFrame(initFrame);
    }
    rafId = rafFn(step);

    return function cancelTestsCountUp() {
      cancelled = true;
      if (rafId !== 0) {
        cafFn(rafId);
        rafId = 0;
      }
    };
  }

  /**
   * Pure calculation of scroll progress percentage (0 - 100) with boundary clamping and rubber-band protection
   * @param {number} scrollTop
   * @param {number} scrollHeight
   * @param {number} clientHeight
   * @returns {number} Integer percentage 0 to 100
   */
  function calculateScrollPercentage(scrollTop, scrollHeight, clientHeight) {
    const sTop = Number(scrollTop) || 0;
    const sHeight = Number(scrollHeight) || 0;
    const cHeight = Number(clientHeight) || 0;
    const maxScroll = sHeight - cHeight;
    if (maxScroll <= 0) return 0;
    const clampedTop = Math.max(0, Math.min(sTop, maxScroll));
    const rawPct = (clampedTop / maxScroll) * 100;
    return Math.max(0, Math.min(100, Math.round(rawPct)));
  }

  /**
   * Pure calculation of SVG circular progress meter stroke-dasharray
   * @param {number} percent 0 to 100
   * @param {number} [circumference=100.53] 2 * PI * 16
   * @returns {{ dasharray: string, filledLen: number, circumference: number, percent: number }}
   */
  function calculateScrollRingDash(percent, circumference = 100.53) {
    const circ = Number(circumference) > 0 ? Number(circumference) : 100.53;
    const clampedPct = Math.max(0, Math.min(100, Number(percent) || 0));
    const filledLen = (clampedPct / 100) * circ;
    return {
      dasharray: `${filledLen.toFixed(1)} ${circ.toFixed(2)}`,
      filledLen: Number(filledLen.toFixed(2)),
      circumference: circ,
      percent: clampedPct,
    };
  }

  /**
   * Pure resolution of scroll target Y coordinate
   * @param {'top'|'bottom'|number} target
   * @param {number} scrollHeight
   * @param {number} clientHeight
   * @returns {number} Target scroll Y coordinate
   */
  function resolveScrollJumpTarget(target, scrollHeight, clientHeight) {
    const sHeight = Number(scrollHeight) || 0;
    const cHeight = Number(clientHeight) || 0;
    const maxScroll = Math.max(0, sHeight - cHeight);

    if (target === 'top') return 0;
    if (target === 'bottom') return maxScroll;
    if (typeof target === 'number' && Number.isFinite(target)) {
      return Math.max(0, Math.min(target, maxScroll));
    }
    return 0;
  }

  /**
   * Creates a stateful O(1) moving average window processor for live stability test data ingestion.
   * Smooths out high-frequency RTT and jitter volatility as delta samples arrive while
   * strictly resetting the window on packet loss (lost: true).
   *
   * @param {number} [windowSize=5]
   */
  function createStabilityMovingAverageProcessor(windowSize = 5) {
    const wSize = Math.max(1, Math.min(60, Math.floor(Number(windowSize) || 5)));
    const pingWindow = [];
    const jitterWindow = [];
    let pingSum = 0;
    let jitterSum = 0;

    function reset() {
      pingWindow.length = 0;
      jitterWindow.length = 0;
      pingSum = 0;
      jitterSum = 0;
    }

    function pushSample(sample) {
      const item = sample || {};
      const tVal = Number(item.t) || 0;
      const isLost = Boolean(item.lost);

      if (isLost) {
        reset();
        return {
          t: tVal,
          ping: 0,
          jitter: 0,
          lost: true,
          smoothedPing: 0,
          smoothedJitter: 0,
          windowCount: 0,
        };
      }

      const rawPing = Math.max(0, Number(item.ping) || 0);
      const rawJitter =
        typeof item.jitter === 'number' && Number.isFinite(item.jitter)
          ? Math.max(0, item.jitter)
          : 0;

      pingWindow.push(rawPing);
      pingSum += rawPing;
      if (pingWindow.length > wSize) {
        pingSum -= pingWindow.shift();
      }

      jitterWindow.push(rawJitter);
      jitterSum += rawJitter;
      if (jitterWindow.length > wSize) {
        jitterSum -= jitterWindow.shift();
      }

      const count = pingWindow.length;
      const smoothedPing = Number((pingSum / count).toFixed(2));
      const smoothedJitter = Number((jitterSum / jitterWindow.length).toFixed(2));

      return {
        t: tVal,
        ping: rawPing,
        jitter: rawJitter,
        lost: false,
        smoothedPing,
        smoothedJitter,
        windowCount: count,
      };
    }

    function pushBatch(samples) {
      if (!Array.isArray(samples) || samples.length === 0) return [];
      const out = new Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        out[i] = pushSample(samples[i]);
      }
      return out;
    }

    return {
      pushSample,
      pushBatch,
      reset,
      getWindowSize: () => wSize,
    };
  }

  /**
   * Pure moving average window smoothing for real-time stability graph rendering.
   * Reduces visual jitter during live updates while strictly preserving packet loss
   * discontinuities (resets the moving window across lost packets so spikes/drops
   * are never averaged across disconnection boundaries).
   *
   * @param {Array<{ t: number, ping?: number, jitter?: number, lost?: boolean }>} samples
   * @param {number} [windowSize=5]
   * @returns {Array<{ t: number, ping: number, jitter: number, lost: boolean, smoothedPing: number, smoothedJitter: number, windowCount: number }>}
   */
  function computeStabilityMovingAverage(samples, windowSize = 5) {
    if (!Array.isArray(samples) || samples.length === 0) {
      return [];
    }
    const processor = createStabilityMovingAverageProcessor(windowSize);
    return processor.pushBatch(samples);
  }

  return {
    formatSpeedReading,
    calculateRealMetrics,
    percentToRotation,
    evaluateGamingStability,
    smoothNumericValue,
    resolveRealConnectionInfo,
    STANDARD_REFRESH_RATES,
    quantizeRefreshRate,
    estimateRefreshRateFromDeltas,
    computeDynamicThrottleInterval,
    shouldRenderGaugeFrame,
    createRafGaugeThrottler,
    computeCountUpFrame,
    animateStatCountUp,
    createStatCardsRafLoop,
    createTestHistoryEntry,
    normalizeTestHistoryList,
    appendTestHistoryEntry,
    sortTestHistoryList,
    computeIntegerCountUpFrame,
    animateCompletedTestsCountUp,
    calculateScrollPercentage,
    calculateScrollRingDash,
    resolveScrollJumpTarget,
    computeStabilityMovingAverage,
    createStabilityMovingAverageProcessor,
  };
});


