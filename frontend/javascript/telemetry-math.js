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
      ? Math.max(0.004, Math.min(0.1, dtSeconds))
      : 0.016;
    // Exponential damping factor (tau ~ 95ms) for silky 60Hz/120Hz glide
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

  /**
   * Pure 60fps frame-pacing evaluator for 4K glass gauge animations.
   * Ensures consistent 60fps (~16.67ms) frame intervals even on 120Hz/144Hz/240Hz displays
   * or under heavy multi-stream network load, while clamping dtSeconds to prevent jumps.
   *
   * @param {number} nowMs - Current high-resolution timestamp (performance.now())
   * @param {number} lastFrameMs - Timestamp of the last rendered gauge frame
   * @param {number} [targetFps=60] - Target frame rate (default 60fps)
   * @param {boolean} [force=false] - Force immediate render (e.g. on state transition)
   */
  function shouldRenderGaugeFrame(nowMs, lastFrameMs, targetFps, force) {
    const fps = Number.isFinite(targetFps) && targetFps > 0 ? targetFps : 60;
    const intervalMs = 1000 / fps;
    // Allow 0.45ms VSync jitter tolerance so native 60Hz VSync ticks (~16.3ms-16.7ms) never drop
    const minElapsedMs = Math.max(1, intervalMs - 0.45);
    const now = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : 0;
    const last = Number.isFinite(lastFrameMs) && lastFrameMs > 0 ? lastFrameMs : 0;

    if (force || last === 0) {
      const rawDt = last > 0 && now > last ? (now - last) / 1000 : 1 / fps;
      return {
        shouldRender: true,
        dtSeconds: Math.min(0.05, Math.max(0.008, rawDt)),
        nextLastFrameMs: now > 0 ? now : 1,
      };
    }

    const elapsedMs = now - last;
    if (elapsedMs < minElapsedMs) {
      return {
        shouldRender: false,
        dtSeconds: 0,
        nextLastFrameMs: last,
      };
    }

    const dtSeconds = Math.min(0.05, Math.max(0.008, elapsedMs / 1000));
    // Advance lastFrameMs aligned to the frame budget to prevent drift under load
    const remainder = elapsedMs % intervalMs;
    const nextLastFrameMs = remainder < intervalMs * 0.5 ? now - remainder : now;

    return {
      shouldRender: true,
      dtSeconds,
      nextLastFrameMs,
    };
  }

  /**
   * Creates a requestAnimationFrame throttler for 4K glass gauge components.
   * Coalesces bursty worker updates and throttles continuous gauge interpolation to a steady 60fps.
   *
   * @param {(dtSeconds: number, nowMs: number) => boolean | void} renderCallback
   *   Invoked at most at targetFps. If it returns true, the throttler automatically schedules the next frame.
   * @param {number} [targetFps=60]
   */
  function createRafGaugeThrottler(renderCallback, targetFps) {
    const fps = Number.isFinite(targetFps) && targetFps > 0 ? targetFps : 60;
    let rafId = 0;
    let lastFrameMs = 0;
    let pendingForce = false;

    const rafFn =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : function (cb) {
            return setTimeout(function () {
              cb(typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
            }, 1000 / fps);
          };

    const cafFn =
      typeof cancelAnimationFrame === "function"
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

      const gate = shouldRenderGaugeFrame(now, lastFrameMs, fps, pendingForce);
      if (!gate.shouldRender) {
        // Not yet at the 60fps boundary; wait for the next VSync frame
        rafId = rafFn(onFrame);
        return;
      }

      pendingForce = false;
      lastFrameMs = gate.nextLastFrameMs;
      const keepRunning =
        typeof renderCallback === "function"
          ? Boolean(renderCallback(gate.dtSeconds, now))
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
      pendingForce = false;
    }

    return {
      schedule,
      cancel,
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
    const targetFps =
      Number.isFinite(Number(opts.targetFps)) && Number(opts.targetFps) > 0
        ? Number(opts.targetFps)
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

    const rafFn =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : function (cb) {
            return setTimeout(function () {
              cb(nowFn());
            }, 1000 / targetFps);
          };

    const cafFn =
      typeof cancelAnimationFrame === "function"
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
      const dt =
        typeof dtSeconds === "number" && dtSeconds > 0
          ? Math.min(0.05, Math.max(0.008, dtSeconds))
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

    return {
      setLiveTargets,
      startCountUp,
      syncFrame,
      reset,
      cancel,
      getState: function () {
        return {
          mode,
          lastMaxDisplay,
          lastMaxUnit,
          lastAvgDisplay,
          lastAvgUnit,
          lastCountingUp,
          commitCount,
          isPending: rafId !== 0,
        };
      },
    };
  }

  return {
    formatSpeedReading,
    calculateRealMetrics,
    percentToRotation,
    evaluateGamingStability,
    smoothNumericValue,
    resolveRealConnectionInfo,
    shouldRenderGaugeFrame,
    createRafGaugeThrottler,
    computeCountUpFrame,
    animateStatCountUp,
    createStatCardsRafLoop,
  };
});

