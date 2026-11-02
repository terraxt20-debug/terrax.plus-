/*
	LibreSpeed - Stability Test Worker
	https://github.com/librespeed/speedtest/
	GNU LGPLv3 License
*/

// data reported to main thread
let testState = -1; // -1=idle, 0=starting, 1=running, 4=finished, 5=aborted
let currentPing = 0;
let avgPing = 0;
let minPing = -1;
let maxPing = 0;
let jitter = 0;
let packetLoss = 0; // failed request percentage
let elapsed = 0;
let progress = 0;

let pingData = []; // all ping data points {t: elapsedMs, ping: ms, lost: bool}
let lastReportedIndex = 0; // for delta delivery
let totalSamples = 0;
let failedSamples = 0;
let pingSum = 0;

let settings = {
  url_ping: "backend/empty.php",
  url_ping_external: "", // external URL to ping (uses fetch no-cors, e.g. "https://www.google.com/generate_204")
  duration: 60, // seconds
  ping_interval: 200, // minimum ms between pings to limit sample rate
  ping_timeout: 5000,
  ping_allowPerformanceApi: true,
  mpot: false
};

let xhr = null;
let startTime = 0;
let prevInstspd = 0;
let aborted = false;
let warmupDone = false;

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : new Date().getTime();
}

function url_sep(url) {
  return url.match(/\?/) ? "&" : "?";
}

this.addEventListener("message", function (e) {
  const params = e.data.split(" ");
  if (params[0] === "status") {
    // return current state with delta ping data
    const newData = pingData.slice(lastReportedIndex);
    lastReportedIndex = pingData.length;
    postMessage(
      JSON.stringify({
        testState: testState,
        currentPing: currentPing,
        avgPing: avgPing,
        minPing: minPing,
        maxPing: maxPing,
        jitter: jitter,
        packetLoss: packetLoss,
        elapsed: elapsed,
        duration: settings.duration,
        progress: progress,
        pingData: newData,
        totalSamples: totalSamples,
        failedSamples: failedSamples
      })
    );
  }
  if (params[0] === "start" && testState === -1) {
    testState = 0;
    try {
      let s = {};
      try {
        const ss = e.data.substring(6);
        if (ss) s = JSON.parse(ss);
      } catch (e) {
        console.warn("Error parsing settings JSON");
      }
      for (let key in s) {
        if (typeof settings[key] !== "undefined") settings[key] = s[key];
      }
    } catch (e) {
      console.warn("Error applying settings: " + e);
    }
    // start the stability test
    aborted = false;
    warmupDone = false;
    startTime = nowMs();
    testState = 1;
    doPing();
  }
  if (params[0] === "abort") {
    if (testState >= 4) return;
    aborted = true;
    testState = 5;
    if (xhr) {
      try {
        xhr.abort();
      } catch (e) {}
    }
  }
});

function recordPing(instspd) {
  // guard against 0ms pings
  if (instspd < 1) instspd = prevInstspd;
  if (instspd < 1) instspd = 1;

  totalSamples++;
  currentPing = parseFloat(instspd.toFixed(2));
  pingSum += instspd;
  avgPing = parseFloat((pingSum / (totalSamples - failedSamples)).toFixed(2));

  if (minPing === -1 || instspd < minPing) minPing = parseFloat(instspd.toFixed(2));
  if (instspd > maxPing) maxPing = parseFloat(instspd.toFixed(2));

  // jitter calculation (same weighted formula as speedtest_worker.js)
  if (totalSamples > 1 && prevInstspd > 0) {
    const instjitter = Math.abs(instspd - prevInstspd);
    if (totalSamples === 2) {
      jitter = instjitter;
    } else {
      jitter = instjitter > jitter ? jitter * 0.3 + instjitter * 0.7 : jitter * 0.8 + instjitter * 0.2;
    }
  }
  prevInstspd = instspd;

  // failed request percentage
  packetLoss = totalSamples > 0 ? parseFloat(((failedSamples / totalSamples) * 100).toFixed(2)) : 0;

  // record data point
  const now = nowMs();
  elapsed = (now - startTime) / 1000;
  pingData.push({
    t: elapsed,
    ping: parseFloat(instspd.toFixed(2)),
    jitter: parseFloat(jitter.toFixed(2)),
    lost: false
  });
}

function recordLoss() {
  const now = nowMs();
  totalSamples++;
  failedSamples++;
  packetLoss = parseFloat(((failedSamples / totalSamples) * 100).toFixed(2));
  elapsed = (now - startTime) / 1000;
  pingData.push({
    t: elapsed,
    ping: 0,
    jitter: parseFloat(jitter.toFixed(2)),
    lost: true
  });
}

// pace pings to avoid excessive sample rates on low-latency links
function schedulePing(rtt) {
  const delay = Math.max(0, settings.ping_interval - rtt);
  if (delay > 0) {
    setTimeout(doPing, delay);
  } else {
    doPing();
  }
}

function doPing() {
  if (aborted || testState >= 4) return;

  // check if duration exceeded
  const now = nowMs();
  elapsed = (now - startTime) / 1000;
  progress = Math.min(1, elapsed / settings.duration);
  if (elapsed >= settings.duration) {
    testState = 4;
    progress = 1;
    return;
  }

  // external ping mode: use fetch with no-cors
  if (settings.url_ping_external) {
    doPingExternal();
    return;
  }

  const pingUrl =
    settings.url_ping + url_sep(settings.url_ping) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random();
  let prevT = 0;
  let headersReceivedT = null;
  const currentXhr = new XMLHttpRequest();
  xhr = currentXhr;
  currentXhr.onreadystatechange = function () {
    if (currentXhr.readyState === 2 && headersReceivedT === null) {
      headersReceivedT = nowMs();
    }
  };
  currentXhr.onload = function () {
    if (aborted || testState >= 4) return;
    if (typeof currentXhr.status === "number" && currentXhr.status >= 400) {
      if (typeof currentXhr.onerror === "function") currentXhr.onerror();
      return;
    }
    const endT = headersReceivedT !== null ? headersReceivedT : nowMs();
    let instspd = endT - prevT;

    if (settings.ping_allowPerformanceApi && typeof performance !== "undefined") {
      try {
        let p = null;
        if (typeof performance.getEntriesByName === "function") {
          const byName = performance.getEntriesByName(pingUrl, "resource");
          if (byName && byName.length > 0) p = byName[byName.length - 1];
        }
        if (!p && typeof performance.getEntriesByType === "function") {
          const resources = performance.getEntriesByType("resource");
          for (let rIdx = resources.length - 1; rIdx >= 0; rIdx--) {
            if (resources[rIdx].name && resources[rIdx].name.indexOf(pingUrl) !== -1) {
              p = resources[rIdx];
              break;
            }
          }
        }
        if (!p && typeof performance.getEntries === "function") {
          const allEntries = performance.getEntries();
          if (allEntries && allEntries.length > 0) p = allEntries[allEntries.length - 1];
        }
        if (p) {
          let d = p.responseStart - p.requestStart;
          if (d <= 0) {
            const connOverhead =
              p.connectEnd > 0 && p.domainLookupStart >= 0 && p.connectEnd > p.domainLookupStart
                ? p.connectEnd - p.domainLookupStart
                : 0;
            d = connOverhead > 0 && p.duration > connOverhead ? p.duration - connOverhead : p.duration;
          }
          if (d > 0 && d < instspd) instspd = d;
        }
      } catch (e) {
        // Performance API not available, use estimate
      } finally {
        try {
          performance.clearResourceTimings();
        } catch (e) {}
      }
    }

    // Warm up the connection on the very first probe of normal runs (duration > 2s)
    // so initial DNS/TCP/TLS handshake latency does not skew minPing, avgPing, maxPing, or jitter
    if (!warmupDone && settings.duration > 2) {
      warmupDone = true;
      startTime = nowMs();
      doPing();
      return;
    }
    warmupDone = true;

    recordPing(instspd);
    schedulePing(instspd);
  };
  currentXhr.onerror = function () {
    if (aborted || testState >= 4) return;
    warmupDone = true;
    recordLoss();
    schedulePing(0);
  };
  currentXhr.ontimeout = currentXhr.onerror;
  currentXhr.open("GET", pingUrl, true);
  try {
    currentXhr.timeout = settings.ping_timeout;
  } catch (e) {}
  prevT = nowMs();
  currentXhr.send();
}

// ping an external host using fetch with no-cors (opaque response, but timing still works)
function doPingExternal() {
  const prevT = nowMs();
  const remainingMs = Math.max(1, settings.duration * 1000 - (prevT - startTime));
  const timeoutMs = Math.min(settings.ping_timeout, remainingMs);
  const url =
    settings.url_ping_external + (settings.url_ping_external.indexOf("?") >= 0 ? "&" : "?") + "r=" + Math.random();

  let timeoutId = null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const fetchOptions = { mode: "no-cors", cache: "no-store" };
  if (controller) fetchOptions.signal = controller.signal;

  const timeout = new Promise(function (_, reject) {
    timeoutId = setTimeout(function () {
      if (controller) controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });

  Promise.race([fetch(url, fetchOptions), timeout])
    .then(function () {
      if (timeoutId) clearTimeout(timeoutId);
      if (aborted || testState >= 4) return;
      let instspd = nowMs() - prevT;
      if (settings.ping_allowPerformanceApi && typeof performance !== "undefined") {
        try {
          if (typeof performance.getEntriesByName === "function") {
            const byName = performance.getEntriesByName(url, "resource");
            if (byName && byName.length > 0) {
              const p = byName[byName.length - 1];
              if (p && p.duration > 0 && p.duration < instspd) {
                instspd = p.duration;
              }
            }
          }
        } catch (e) {
        } finally {
          try {
            if (typeof performance.clearResourceTimings === "function") {
              performance.clearResourceTimings();
            }
          } catch (e) {}
        }
      }
      if (!warmupDone && settings.duration > 2) {
        warmupDone = true;
        startTime = nowMs();
        doPing();
        return;
      }
      warmupDone = true;
      recordPing(instspd);
      schedulePing(instspd);
    })
    .catch(function () {
      if (timeoutId) clearTimeout(timeoutId);
      if (aborted || testState >= 4) return;
      warmupDone = true;
      recordLoss();
      schedulePing(0);
    });
}
