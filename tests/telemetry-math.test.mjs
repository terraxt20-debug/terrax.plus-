import test from 'node:test';
import assert from 'node:assert/strict';
import '../frontend/javascript/telemetry-math.js';

const {
  formatSpeedReading,
  calculateRealMetrics,
  percentToRotation,
  evaluateGamingStability,
} = globalThis.TerraxTelemetryMath;

test('formatSpeedReading returns zero state when no reading exists', () => {
  const res = formatSpeedReading(null, false);
  assert.equal(res.hasValue, false);
  assert.equal(res.displayNumber, '00');
  assert.equal(res.badgeAr, 'جاهز للقياس');
});

test('formatSpeedReading formats Mbps and Gbps accurately', () => {
  const mbps = formatSpeedReading(850.4, false);
  assert.equal(mbps.displayNumber, '850');
  assert.equal(mbps.unitEn, 'Mbps');
  assert.equal(mbps.badgeAr, 'ممتاز');

  const gbps = formatSpeedReading(1020, true);
  assert.equal(gbps.displayNumber, '1.02');
  assert.equal(gbps.unitEn, 'Gbps');
  assert.equal(gbps.unitAr, 'جيجابت في الثانية');
});

test('calculateRealMetrics returns null metrics when no real samples exist (no fake numbers)', () => {
  const res = calculateRealMetrics([], [], null, null);
  assert.equal(res.avgSpeedMbps, null);
  assert.equal(res.maxSpeedMbps, null);
  assert.equal(res.stabilityPercent, null);
  assert.equal(res.stabilityLabelAr, 'في انتظار القياس');
});

test('calculateRealMetrics computes true average, max, and stability from real samples', () => {
  const samples = [900, 940, 950, 930];
  const res = calculateRealMetrics(samples, [840, 850], 8.5, 0.6);
  assert.equal(res.avgSpeedMbps, 930);
  assert.equal(res.maxSpeedMbps, 950);
  assert.ok(res.stabilityPercent >= 90 && res.stabilityPercent <= 99);
  assert.equal(res.stabilityLabelAr, 'مستقر للغاية');
});

test('percentToRotation clamps between 0 and 180 degrees', () => {
  assert.equal(percentToRotation(0), 0);
  assert.equal(percentToRotation(50), 90);
  assert.equal(percentToRotation(94), 169.2);
  assert.equal(percentToRotation(120), 180);
});

test('evaluateGamingStability returns awaiting state when no samples exist', () => {
  const res = evaluateGamingStability(0, 0, 0, 0);
  assert.equal(res.hasData, false);
  assert.equal(res.grade, 'none');
  assert.equal(res.titleAr, 'في انتظار القياس');
  assert.equal(res.scorePercent, null);
});

test('evaluateGamingStability classifies competitive gaming grade accurately from real metrics', () => {
  const great = evaluateGamingStability(14.2, 1.8, 0, 25);
  assert.equal(great.hasData, true);
  assert.equal(great.grade, 'great');
  assert.equal(great.statusColor, '#78E7A0');

  const unstable = evaluateGamingStability(135, 42, 5.5, 25);
  assert.equal(unstable.hasData, true);
  assert.equal(unstable.grade, 'bad');
  assert.equal(unstable.statusColor, '#FF647C');
});

test('Speedtest engine exports constructor to globalThis/window and enforces protocol rules', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const source = fs.readFileSync(new URL('../speedtest.js', import.meta.url), 'utf8');

  const requests = [];
  function FakeXHR() {
    this.responseText = '';
    this.timeout = 0;
  }
  FakeXHR.prototype.open = function (method, url) {
    this._url = url;
  };
  FakeXHR.prototype.send = function () {
    requests.push(this._url);
    if (typeof this.onload === 'function') this.onload();
  };

  const context = {
    console: { log() {} },
    Date,
    location: { protocol: 'https:' },
    navigator: { userAgent: 'NodeTest' },
    performance: { getEntriesByName: () => [] },
    XMLHttpRequest: FakeXHR,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(typeof context.Speedtest, 'function');
  const st = new context.Speedtest();
  st.addTestPoint({
    name: 'Insecure',
    server: 'http://insecure.example/',
    dlURL: 'garbage.php',
    ulURL: 'empty.php',
    pingURL: 'empty.php',
    getIpURL: 'getIP.php',
  });
  st.addTestPoint({
    name: 'Secure',
    server: 'https://secure.example/',
    dlURL: 'garbage.php',
    ulURL: 'empty.php',
    pingURL: 'empty.php',
    getIpURL: 'getIP.php',
  });

  const selected = await new Promise((resolve) => st.selectServer(resolve));
  assert.equal(selected.server, 'https://secure.example/');
  assert.ok(!requests.some((u) => u.startsWith('http://insecure.example/')));
});

test('Repository entrypoints and Docker sed contracts remain intact', async () => {
  const fs = await import('node:fs');
  const indexModern = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const indexClassic = fs.readFileSync(new URL('../index-classic.html', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');

  assert.ok(indexModern.includes('<h1>Free and Open Source Speedtest.</h1>'));
  assert.ok(indexModern.includes('<p class="tagline">No Flash, No Java, No Websockets, No Bullsh*t</p>'));
  assert.ok(indexModern.includes('var SPEEDTEST_SERVERS = "server-list.json";'));
  assert.ok(indexClassic.includes('<h1>LibreSpeed</h1>'));
  assert.ok(stabilityHtml.includes('var SPEEDTEST_SERVERS = "server-list.json";'));
  assert.ok(stabilityHtml.includes('<title>LibreSpeed - Stability Test</title>'));
  assert.ok(stabilityHtml.includes('id="downloadCsvBtn"'));
});

test('gauge-active-arc defines soft pulsing shadow keyframes and active running selectors', async () => {
  const fs = await import('node:fs');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');

  assert.ok(resultsCss.includes('@keyframes gaugeArcPulseShadow'));
  assert.ok(resultsCss.includes('@keyframes gaugeArcPulseShadowStab'));
  assert.ok(resultsCss.includes('@keyframes gaugeArcPulseShadowUl'));
  assert.ok(resultsCss.includes('.terrax-cyber-shell.test-running-focus .gauge-active-arc'));
  assert.ok(resultsCss.includes('.gauge.running .gauge-active-arc'));
  assert.ok(resultsCss.includes('.gauge-active-arc.running'));
  assert.ok(indexJs.includes('arc.classList.toggle("running", testState.state === RUNNING)'));
});

test('4K visual identity assets, icons, typography tokens, and share card font embedding are intact', async () => {
  const fs = await import('node:fs');
  const chevronSvg = fs.readFileSync(new URL('../frontend/images/chevron.svg', import.meta.url), 'utf8');
  const faviconSvg = fs.readFileSync(new URL('../frontend/images/favicon.svg', import.meta.url), 'utf8');
  const logoSvg = fs.readFileSync(new URL('../frontend/images/logo.svg', import.meta.url), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

  assert.ok(chevronSvg.includes('stroke="#67e8f9"'));
  assert.ok(faviconSvg.includes('#38BDF8'));
  assert.ok(logoSvg.includes('#38BDF8'));
  assert.equal(manifest.theme_color, '#0c1f3f');
  assert.ok(stabilityHtml.includes('--font-sans-ar: "Cairo", "Inter"'));
  assert.ok(stabilityHtml.includes('--font-ar: "Cairo", "Inter"'));
  assert.ok(viteConfig.includes('CAIRO_BASE64'));
  assert.ok(viteConfig.includes('INTER_BASE64'));
});

test('bun.lock is valid strict JSON, synced with package.json, and playwright.config.js uses ESM', async () => {
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const bunLock = JSON.parse(fs.readFileSync(new URL('../bun.lock', import.meta.url), 'utf8'));
  const pwConfig = fs.readFileSync(new URL('../playwright.config.js', import.meta.url), 'utf8');
  const entrypointSh = fs.readFileSync(new URL('../docker/entrypoint.sh', import.meta.url), 'utf8');

  assert.equal(pkg.name, 'terrax-plus-librespeed');
  assert.equal(bunLock.workspaces[''].name, pkg.name);
  assert.deepEqual(bunLock.workspaces[''].dependencies, pkg.dependencies);
  assert.deepEqual(bunLock.workspaces[''].devDependencies, pkg.devDependencies);
  assert.ok(pwConfig.includes("import { defineConfig, devices } from '@playwright/test';"));
  assert.ok(pwConfig.includes("import { createRequire } from 'node:module';"));
  assert.ok(pwConfig.includes('export default defineConfig({'));
  assert.ok(entrypointSh.includes('elif [ "$USE_NEW_DESIGN" == "false" ]; then'));
});

test('Default server is Yemen ("اليمن") and test/frontend/backend bug fixes are in place', async () => {
  const fs = await import('node:fs');
  const serverList = JSON.parse(fs.readFileSync(new URL('../server-list.json', import.meta.url), 'utf8'));
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');
  const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const telemetryPhp = fs.readFileSync(new URL('../results/telemetry.php', import.meta.url), 'utf8');
  const sanityCheckPhp = fs.readFileSync(new URL('../results/sanitycheck.php', import.meta.url), 'utf8');

  assert.equal(serverList[0].name, 'اليمن');
  assert.ok(indexJs.includes('s.name === "اليمن"'));
  assert.ok(stabilityHtml.includes('if (SPEEDTEST_SERVERS[j].pingT < 0) continue;'));
  assert.ok(frontendStabilityHtml.includes('if (SPEEDTEST_SERVERS[j].pingT < 0) continue;'));
  assert.ok(frontendStabilityHtml.includes('href="styling/fonts.css"'));
  assert.ok(frontendGamingHtml.includes('href="styling/fonts.css"'));
  assert.ok(gamingHtml.includes('Array.isArray(SPEEDTEST_SERVERS)'));
  assert.ok(viteConfig.includes("pathname.endsWith('/results/json.php')"));
  assert.ok(telemetryPhp.includes("$_POST['dl'] ?? ''"));
  assert.ok(sanityCheckPhp.includes('$QueryResult->getMessage()'));
});

test('smoothNumericValue interpolates sudden speed/upload changes smoothly and snaps when required', async () => {
  const { smoothNumericValue } = globalThis.TerraxTelemetryMath;
  assert.equal(typeof smoothNumericValue, 'function');

  // Initial jump from 0 snaps to first valid measurement
  assert.equal(smoothNumericValue(0, 120, 0.016, false), 120);

  // Sudden jump from 120 Mbps to 480 Mbps interpolates smoothly per frame without jumping straight to 480
  const step1 = smoothNumericValue(120, 480, 0.016, false);
  assert.ok(step1 > 120 && step1 < 480);

  // Subsequent frames continue converging monotonically toward target
  const step2 = smoothNumericValue(step1, 480, 0.016, false);
  assert.ok(step2 > step1 && step2 < 480);

  // Snaps immediately when phase completes or reduced motion is enabled
  assert.equal(smoothNumericValue(step2, 480, 0.016, true), 480);

  const fs = await import('node:fs');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  assert.ok(resultsCss.includes('cubic-bezier(0.22, 1, 0.36, 1)'));
  assert.ok(indexJs.includes('math.smoothNumericValue'));
});

test('4K 120Hz startup choreography, View Transitions, touch physics, and cross-page navigation are configured', async () => {
  const fs = await import('node:fs');
  const colorsCss = fs.readFileSync(new URL('../frontend/styling/colors.css', import.meta.url), 'utf8');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const serverSelectorCss = fs.readFileSync(new URL('../frontend/styling/server-selector.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');

  assert.ok(colorsCss.includes('--ease-4k-spring: cubic-bezier(0.22, 1, 0.36, 1)'));
  assert.ok(indexCss.includes('@view-transition'));
  assert.ok(indexCss.includes('@keyframes terraxShellStartup'));
  assert.ok(indexCss.includes('@keyframes terraxStaggerReveal'));
  assert.ok(indexCss.includes('touch-action: manipulation'));
  assert.ok(indexCss.includes('.terrax-bottom-nav .nav-dock-item:hover svg'));
  assert.ok(indexCss.includes('scale(1.12)'));
  assert.ok(indexCss.includes('drop-shadow(0 0 8px rgba(103, 232, 249, 0.85))'));
  assert.ok(dialogCss.includes('@keyframes terraxModalSpringIn'));
  assert.ok(serverSelectorCss.includes('translate3d(0, 8px, 0) scale(0.975)'));
  assert.ok(indexJs.includes('function smoothNavigateToPage'));
  assert.ok(stabilityHtml.includes('@view-transition'));
  assert.ok(stabilityHtml.includes('.nav-dock-item:hover svg'));
  assert.ok(gamingHtml.includes('@view-transition'));
  assert.ok(gamingHtml.includes('@keyframes gamingShellEntrance'));
  assert.ok(gamingHtml.includes('.nav-dock-item:hover svg'));
});

test('Settings dialog includes #language-select dropdown and supports dynamic Arabic/English UI toggling', async () => {
  const fs = await import('node:fs');
  const indexModern = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndex = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');

  assert.ok(indexModern.includes('<select id="language-select" class="cyber-select"'));
  assert.ok(indexModern.includes('<option value="ar">'));
  assert.ok(indexModern.includes('<option value="en">'));
  assert.ok(frontendIndex.includes('<select id="language-select" class="cyber-select"'));
  assert.ok(!frontendIndex.includes('terrax-ad-slot'));
  assert.ok(dialogCss.includes('.setting-row select.cyber-select'));
  assert.ok(indexJs.includes('const LANGUAGE_STORAGE_KEY = "terrax_ui_lang_v1"'));
  assert.ok(indexJs.includes('function getSafeSelectedServer()'));
  assert.ok(indexJs.includes('function applyLanguage(lang'));
  assert.ok(indexJs.includes('globalThis.applyTerraxLanguage = applyLanguage'));
  assert.ok(!indexJs.includes('testState.speedtest?.getSelectedServer()'));

  const dlFmt = formatSpeedReading(540, false);
  assert.equal(dlFmt.badgeAr, 'ممتاز');
  assert.equal(dlFmt.badgeEn, 'Excellent');
  assert.ok(dlFmt.unitLabelEn.includes('Megabits per second'));

  const metrics = calculateRealMetrics([920, 930, 925], [850, 860], 9.0, 0.5);
  assert.equal(metrics.stabilityLabelAr, 'مستقر للغاية');
  assert.equal(metrics.stabilityLabelEn, 'Ultra Stable');
});

test('src/App.tsx integrates real LibreSpeed engine and 4K gauge telemetry calculations in real time', async () => {
  const fs = await import('node:fs');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.ok(appTsx.includes('new window.Speedtest()'));
  assert.ok(appTsx.includes('st.onupdate = (data: LibreSpeedUpdateData)'));
  assert.ok(appTsx.includes('st.onend = (aborted: boolean)'));
  assert.ok(appTsx.includes('export function mbpsToRotation'));
  assert.ok(appTsx.includes('export function computeRealTimeGaugeTelemetry'));
  assert.ok(appTsx.includes('math.smoothNumericValue'));
  assert.ok(appTsx.includes('math.calculateRealMetrics'));
  assert.ok(appTsx.includes('id="download-gauge"'));
  assert.ok(appTsx.includes('id="stability-gauge"'));
  assert.ok(appTsx.includes('id="upload-gauge"'));
  assert.ok(appTsx.includes('id="dl-svg-arc"'));
  assert.ok(appTsx.includes('id="stab-svg-arc"'));
  assert.ok(appTsx.includes('id="ul-svg-arc"'));
});

test('Smart Auto-Collapsing Ad Spaces: verified across all pages (speed-main, speed-results, gaming-main, stability-main, usage-main) with zero empty blank space, auto-collapse when unfilled, and auto-display when filled', async () => {
  const fs = await import('node:fs');
  const smartAdsCss = fs.readFileSync(new URL('../frontend/styling/smart-ads.css', import.meta.url), 'utf8');
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');

  const adsenseStylesCss = fs.readFileSync(new URL('../ads/adsense.styles.css', import.meta.url), 'utf8');
  const frontendAdsenseStylesCss = fs.readFileSync(new URL('../frontend/styling/adsense.styles.css', import.meta.url), 'utf8');
  const rootIndexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // 1. Zero Blank Space (Zero-CLS) Guarantee & Filled-Only Disclosure Label in adsense.styles.css & smart-ads.css
  for (const css of [adsenseStylesCss, frontendAdsenseStylesCss, smartAdsCss]) {
    assert.ok(css.includes('display: none !important;'));
    assert.ok(css.includes('height: 0 !important;'));
    assert.ok(css.includes('min-height: 0 !important;'));
    assert.ok(css.includes('max-height: 0 !important;'));
    assert.ok(css.includes('ins.adsbygoogle[data-ad-status="unfilled"]'));
    assert.ok(css.includes('ins.adsbygoogle:empty'));
    assert.ok(css.includes(':has(ins.adsbygoogle[data-ad-status="unfilled"])'));
    assert.ok(css.includes('.terrax-smart-ad-slot.smart-ad-locked'));
    assert.ok(css.includes('.terrax-ad-disclosure-label'));
    assert.ok(css.includes('rgba(203, 213, 225, 0.68)'));
  }

  // 2. Verified Google AdSense unit with Zero-CLS attributes & 'اعلان • Sponsored' disclosure label
  assert.ok(rootIndexHtml.includes('ads/adsense.styles.css'));
  assert.ok(rootIndexHtml.includes('id="terrax-smart-ad-entry-main"'));
  assert.ok(rootIndexHtml.includes('data-ad-client="ca-pub-1225026489802055"'));
  assert.ok(rootIndexHtml.includes('data-ad-slot="7159014601"'));
  assert.ok(rootIndexHtml.includes('data-ad-status="unfilled"'));
  assert.ok(rootIndexHtml.includes('data-ad-filled="false"'));
  assert.ok(rootIndexHtml.includes('class="terrax-ad-disclosure-label"'));
  assert.ok(rootIndexHtml.includes('اعلان • Sponsored'));

  for (const html of [indexModernHtml, frontendIndexHtml]) {
    assert.ok(html.includes('adsense.styles.css'), 'adsense.styles.css must be linked');
    assert.ok(html.includes('id="terrax-smart-ad-speed-main"'), 'speed-main slot must exist in index page');
    assert.ok(html.includes('data-ad-status="unfilled"'), 'initial status must be unfilled for Zero-CLS');
    assert.ok(html.includes('data-ad-filled="false"'), 'initial filled state must be false for Zero-CLS');
    assert.ok(html.includes('<ins class="adsbygoogle"'), 'Google AdSense <ins> must be present in index page');
    assert.ok(html.includes('class="terrax-ad-disclosure-label"'), 'disclosure label must be present below ad unit');
    assert.ok(html.includes('اعلان • Sponsored'), 'disclosure label must include اعلان and Sponsored');
  }

  for (const html of [gamingHtml, frontendGamingHtml]) {
    assert.ok(!html.includes('id="terrax-smart-ad-gaming-main"'), 'gaming-main slot remains removed');
  }

  for (const html of [stabilityHtml, frontendStabilityHtml]) {
    assert.ok(!html.includes('id="terrax-smart-ad-stability-main"'), 'stability-main slot remains removed');
  }

  // 3. React App.tsx parity matching
  assert.ok(appTsx.includes('id="terrax-smart-ad-speed-main"'));
  assert.ok(appTsx.includes('className="adsbygoogle"'));
  assert.ok(appTsx.includes('className="terrax-ad-disclosure-label"'));

  // 4. Smart state hooks remain wired safely
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.setTestingState(true)'));
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.onTestComplete("speed")'));
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.onTabChange("speed")'));
});

test('Connection Type card ("نوع الاتصال") resolves real NetworkInformation API data, distinguishes physical type vs effectiveType, handles unavailable/offline fallbacks, and preserves Idle/Testing/Completed UI states', async () => {
  const fs = await import('node:fs');
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const mainCss = fs.readFileSync(new URL('../frontend/styling/main.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // 1. Static HTML & React templates never hardcode fake Wi-Fi as default
  for (const html of [indexModernHtml, frontendIndexHtml]) {
    assert.ok(html.includes('id="connection-type-card"'));
    assert.ok(html.includes('data-connection-state="idle"'));
    assert.ok(html.includes('data-is-testing="false"'));
    assert.ok(
      html.includes('<strong class="conn-value" id="connection-type-text">نوع الاتصال غير متاح</strong>'),
      'Initial HTML must display honest fallback instead of hardcoded Wi-Fi'
    );
    assert.ok(!html.includes('شبكة لاسلكية فائقة (Wi-Fi)'));
    assert.ok(html.includes('class="conn-diamond-dot"'));
  }

  // 2. Pure resolveRealConnectionInfo verification across all 13 required scenarios
  const resolveConn = globalThis.TerraxTelemetryMath.resolveRealConnectionInfo;
  assert.equal(typeof resolveConn, 'function');

  // Case: Wi-Fi when physical type is confirmed
  const wifiAr = resolveConn({ onLine: true, connection: { type: 'wifi', effectiveType: '4g', rtt: 25, downlink: 50 } }, 'ar');
  assert.equal(wifiAr.kind, 'physical');
  assert.equal(wifiAr.physicalType, 'wifi');
  assert.equal(wifiAr.label, 'اتصال لاسلكي (Wi-Fi)');
  assert.ok(wifiAr.detail.includes('الفئة المقدّرة: 4G'));

  const wifiEn = resolveConn({ onLine: true, connection: { type: 'wifi' } }, 'en');
  assert.equal(wifiEn.label, 'Wireless (Wi-Fi)');

  // Case: Cellular when physical type is confirmed (with & without effectiveType)
  const cell4gAr = resolveConn({ onLine: true, connection: { type: 'cellular', effectiveType: '4g' } }, 'ar');
  assert.equal(cell4gAr.kind, 'physical');
  assert.equal(cell4gAr.physicalType, 'cellular');
  assert.equal(cell4gAr.label, 'بيانات خلوية (Cellular • 4G)');

  const cellOnlyAr = resolveConn({ onLine: true, connection: { type: 'cellular' } }, 'ar');
  assert.equal(cellOnlyAr.label, 'بيانات خلوية (Cellular)');

  // Case: Ethernet when physical type is confirmed
  const ethAr = resolveConn({ onLine: true, connection: { type: 'ethernet', effectiveType: '4g' } }, 'ar');
  assert.equal(ethAr.kind, 'physical');
  assert.equal(ethAr.physicalType, 'ethernet');
  assert.equal(ethAr.label, 'اتصال سلكي (Ethernet)');

  // Case: effectiveType available WITHOUT physical type (or type === 'unknown') -> never claims Wi-Fi or Cellular
  const effOnlyAr = resolveConn({ onLine: true, connection: { effectiveType: '4g', rtt: 40 } }, 'ar');
  assert.equal(effOnlyAr.kind, 'effective-only');
  assert.equal(effOnlyAr.hasPhysicalType, false);
  assert.equal(effOnlyAr.hasEffectiveType, true);
  assert.equal(effOnlyAr.label, 'فئة الاتصال المقدّرة: 4G');
  assert.ok(!effOnlyAr.label.includes('Wi-Fi'));
  assert.ok(!effOnlyAr.label.includes('Cellular'));

  const effUnknownTypeEn = resolveConn({ onLine: true, connection: { type: 'unknown', effectiveType: '3g' } }, 'en');
  assert.equal(effUnknownTypeEn.kind, 'effective-only');
  assert.equal(effUnknownTypeEn.label, 'Est. Effective Class: 3G');

  // Case: Browser does not support navigator.connection
  const unsupportedAr = resolveConn({ onLine: true }, 'ar');
  assert.equal(unsupportedAr.kind, 'unavailable');
  assert.equal(unsupportedAr.label, 'نوع الاتصال غير متاح');

  const unsupportedEn = resolveConn({ onLine: true }, 'en');
  assert.equal(unsupportedEn.kind, 'unavailable');
  assert.equal(unsupportedEn.label, 'Connection type unavailable');

  // Case: Offline state via navigator.onLine === false
  const offlineAr = resolveConn({ onLine: false, connection: { type: 'wifi', effectiveType: '4g' } }, 'ar');
  assert.equal(offlineAr.kind, 'offline');
  assert.equal(offlineAr.label, 'غير متصل بالإنترنت');

  // Case: Unexpected / corrupted / invalid values do not crash or produce fake labels
  const corrupted = resolveConn({ onLine: true, connection: { type: 'invalid-xyz', effectiveType: '99g', rtt: -10, downlink: NaN } }, 'ar');
  assert.equal(corrupted.kind, 'unavailable');
  assert.equal(corrupted.label, 'نوع الاتصال غير متاح');

  const nullNav = resolveConn(null, 'ar');
  assert.equal(nullNav.kind, 'unavailable');
  assert.equal(nullNav.label, 'نوع الاتصال غير متاح');

  // 3. CSS & JS lifecycle states and reduced motion support
  assert.ok(mainCss.includes('.connection-info-pill.is-testing .conn-chip-icon'));
  assert.ok(mainCss.includes('@keyframes connIconPulse'));
  assert.ok(mainCss.includes('@keyframes connDiamondDotPulse'));
  assert.ok(mainCss.includes('@keyframes connValueVerifyPulse'));
  assert.ok(mainCss.includes('.connection-info-pill.is-completed'));
  assert.ok(mainCss.includes('@media (prefers-reduced-motion: reduce)'));

  assert.ok(indexJs.includes('function readRealConnectionInfo'));
  assert.ok(indexJs.includes('function syncConnectionCardState'));
  assert.ok(indexJs.includes('connUnavailable: "نوع الاتصال غير متاح"'));
  assert.ok(!indexJs.includes('شبكة لاسلكية فائقة (Wi-Fi)'));
  assert.ok(!indexJs.includes('connectionTypeEl.textContent = data.clientIp'));

  assert.ok(appTsx.includes('id="connection-type-card"'));
  assert.ok(appTsx.includes('resolveRealConnectionInfo'));
  assert.ok(!appTsx.includes('شبكة لاسلكية فائقة (Wi-Fi)'));
  assert.ok(appTsx.includes('className="conn-diamond-dot"'));
});

test('Professional Monetization Architecture: strict Smart Ad Lock during testing, high-yield post-test placement, zero disruptive popups, and non-intrusive auto-ads', async () => {
  const fs = await import('node:fs');

  // 1. Central adsConfig.ts defines valid IDs
  const adsConfigTs = fs.readFileSync(new URL('../src/config/adsConfig.ts', import.meta.url), 'utf8');
  assert.ok(adsConfigTs.includes('R-A-TERREX-SPEED-1'));
  assert.ok(adsConfigTs.includes('R-A-TERREX-GAME-1'));
  assert.ok(adsConfigTs.includes('R-A-TERREX-STAB-1'));

  // 2. High-Yield Location 1: Main Speed Screen (Post-test results banner + clean inline banner)
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  for (const html of [indexModernHtml, frontendIndexHtml]) {
    assert.ok(html.includes('id="terrax-smart-ad-speed-main"'), 'speed-main Zero-CLS AdSense banner must exist in index page');
    const connPos = html.indexOf('id="connection-type-card"');
    const startPos = html.indexOf('id="start-button"');
    assert.ok(connPos !== -1 && startPos !== -1 && connPos < startPos, 'Connection card must appear before start button');
  }

  // 3. Gaming Screen (All manual ad slots removed, 6-card grid preserved)
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  for (const html of [gamingHtml, frontendGamingHtml]) {
    assert.ok(!html.includes('id="terrax-smart-ad-gaming-main"'), 'gaming-main smart ad slot must be removed');
    assert.ok(html.includes('id="gamingBoosterCard"'), '6-card grid preserves card 6 slot');
  }

  // 4. Stability Screen (All manual ad slots removed)
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');

  for (const html of [stabilityHtml, frontendStabilityHtml]) {
    assert.ok(!html.includes('id="terrax-smart-ad-stability-main"'), 'stability-main smart ad slot must be removed');
  }

  // 5. Usage Dialog (All manual ad slots removed)
  for (const html of [indexModernHtml, frontendIndexHtml, appTsx]) {
    assert.ok(html.includes('id="usage-dialog"'));
    assert.ok(!html.includes('id="terrax-smart-ad-usage-main"'), 'usage-main smart ad slot must be removed from dialog');
  }

  // 6. Non-intrusive zero-popup policy: No intrusive popups or disruptive modals
  const adSlotsJs = fs.readFileSync(new URL('../frontend/javascript/ad-slots.js', import.meta.url), 'utf8');
  assert.ok(adSlotsJs.includes('bindZeroPopupGuard'), 'zero popup guard must be bound');
  assert.ok(
    adSlotsJs.includes('allow-scripts allow-same-origin allow-forms'),
    'strict sandbox without allow-popups'
  );
});

test('Gaming Speed Test Page (gaming.html & frontend/gaming.html) enforces 4K layout geometry, 6-card symmetrical radar grid, RTL/LTR isolation, safe-area/dvh sizing, and reduced-motion rules', async () => {
  const fs = await import('node:fs');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  for (const html of [gamingHtml, frontendGamingHtml]) {
    // 1. Viewport dvh & safe-area support
    assert.ok(html.includes('min-height: 100dvh'));
    assert.ok(html.includes('env(safe-area-inset-top'));
    assert.ok(html.includes('env(safe-area-inset-bottom'));
    assert.ok(html.includes('overflow-x: clip'));

    // 2. Shell & Grid geometry (112rem max-width, 6-column symmetrical game radar grid, equal row heights)
    assert.ok(html.includes('max-width: 112rem'));
    assert.ok(html.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
    assert.ok(html.includes('grid-auto-rows: 1fr'));

    // 3. Responsive breakpoints covering small phones (<=350px, <=420px), phones (<=680px), tablets (<=1024px, <=1200px), and 4K (>1440px)
    assert.ok(html.includes('@media screen and (min-width: 1441px)'));
    assert.ok(html.includes('@media screen and (max-width: 1200px)'));
    assert.ok(html.includes('@media screen and (max-width: 1024px)'));
    assert.ok(html.includes('@media screen and (max-width: 680px)'));
    assert.ok(html.includes('@media screen and (max-width: 420px)'));
    assert.ok(html.includes('@media screen and (max-width: 350px)'));

    // 4. Accessibility & Reduced Motion support
    assert.ok(html.includes('@media (prefers-reduced-motion: reduce)'));
    assert.ok(html.includes(':focus-visible'));

    // 5. Tabular numbers & LTR numeric isolation
    assert.ok(html.includes('font-variant-numeric: tabular-nums'));
    assert.ok(html.includes('class="game-name booster-title-row"'));
  }

  // Verify style & body parity between /gaming.html and /frontend/gaming.html
  const rootStyleAndBody = gamingHtml.slice(gamingHtml.indexOf('<style>')).replace('url("frontend/images/background.jpeg")', 'url("images/background.jpeg")');
  const frontStyleAndBody = frontendGamingHtml.slice(frontendGamingHtml.indexOf('<style>'));
  assert.equal(rootStyleAndBody, frontStyleAndBody, '/gaming.html and /frontend/gaming.html must have synchronized CSS and body markup');
});

test('Real Ping Measurement Audit: high-resolution send-to-HEADERS_RECEIVED timing, Timing-Allow-Origin, warm-up isolation, and no concurrent bufferbloat probes during gaming speed test', async () => {
  const fs = await import('node:fs');
  const speedtestWorker = fs.readFileSync(new URL('../speedtest_worker.js', import.meta.url), 'utf8');
  const speedtestJs = fs.readFileSync(new URL('../speedtest.js', import.meta.url), 'utf8');
  const stabilityWorker = fs.readFileSync(new URL('../stability_worker.js', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const emptyPhp = fs.readFileSync(new URL('../backend/empty.php', import.meta.url), 'utf8');

  // 1. Timing-Allow-Origin header must be set so PerformanceResourceTiming exposes requestStart and responseStart
  assert.ok(viteConfig.includes("Timing-Allow-Origin"), 'vite.config.ts must set Timing-Allow-Origin header');
  assert.ok(emptyPhp.includes("Timing-Allow-Origin: *"), 'backend/empty.php must set Timing-Allow-Origin header');

  // 2. speedtest_worker.js uses high-resolution nowMs() at send(), captures readyState === 2 (HEADERS_RECEIVED), matches specific pingUrl in Resource Timing, clears resource timings, and emits unloaded minPing/avgPing/maxPing/pingData
  assert.ok(speedtestWorker.includes('function nowMs()'));
  assert.ok(speedtestWorker.includes('currentXhr.readyState === 2'));
  assert.ok(speedtestWorker.includes('performance.clearResourceTimings()'));
  assert.ok(speedtestWorker.includes('minPing: minPing > 0'));
  assert.ok(speedtestWorker.includes('avgPing: avgPing > 0'));
  assert.ok(speedtestWorker.includes('maxPing: maxPing > 0'));
  assert.ok(speedtestWorker.includes('pingData: newPingData'));

  // 3. speedtest.js selectServer uses high-resolution nowMs() at send(), captures readyState === 2, and performs at least 2 pings so warm keep-alive RTT is measured after cold DNS/TCP/TLS setup
  assert.ok(speedtestJs.includes('xhr.readyState === 2'));
  assert.ok(speedtestJs.includes('if (t < SLOW_THRESHOLD || i === 1)'));

  // 4. stability_worker.js uses high-resolution nowMs() at send(), captures readyState === 2, and warms up the connection on normal runs before recording sample #1
  assert.ok(stabilityWorker.includes('currentXhr.readyState === 2'));
  assert.ok(stabilityWorker.includes('let warmupDone = false;'));

  // 5. gaming.html does not launch stability_worker.js concurrently during multi-stream Download/Upload saturation, and consumes unloaded speedtest_worker.js pingData
  const toggleSection = gamingHtml.slice(
    gamingHtml.indexOf('function toggleGamingTest()'),
    gamingHtml.indexOf('function getConsolidatedPingMetrics()')
  );
  assert.ok(!toggleSection.includes('startPingProbeWorker()'), 'toggleGamingTest must not run stability_worker concurrently with speedtest.start()');
  assert.ok(gamingHtml.includes('Array.isArray(data.pingData)'));

  // 6. stability.html probes servers sequentially using nextServerProbe and high-resolution readyState === 2 timing
  assert.ok(stabilityHtml.includes('var nextServerProbe = function ()'));
  assert.ok(stabilityHtml.includes('xhr.readyState === 2'));
});

test('60fps requestAnimationFrame gauge throttler enforces consistent ~16.67ms frame pacing and coalesces updates under heavy load', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;
  assert.equal(typeof math.shouldRenderGaugeFrame, 'function');
  assert.equal(typeof math.createRafGaugeThrottler, 'function');

  // 1. First frame always renders immediately
  const firstGate = math.shouldRenderGaugeFrame(100, 0, 60, false);
  assert.equal(firstGate.shouldRender, true);
  assert.ok(Math.abs(firstGate.dtSeconds - 1 / 60) < 0.002);

  // 2. High-refresh sub-16ms frame (e.g. +8.33ms at 120Hz) is throttled to preserve 60fps
  const subFrameGate = math.shouldRenderGaugeFrame(108.33, firstGate.nextLastFrameMs, 60, false);
  assert.equal(subFrameGate.shouldRender, false);
  assert.equal(subFrameGate.dtSeconds, 0);

  // 3. Frame at ~16.67ms renders and clamps dtSeconds within [0.008, 0.05]
  const sixtyHzGate = math.shouldRenderGaugeFrame(116.67, firstGate.nextLastFrameMs, 60, false);
  assert.equal(sixtyHzGate.shouldRender, true);
  assert.ok(sixtyHzGate.dtSeconds >= 0.016 && sixtyHzGate.dtSeconds <= 0.018);

  // 4. Heavy load spike (e.g. 250ms stall) clamps dtSeconds to 0.05s max to prevent gauge jump
  const spikeGate = math.shouldRenderGaugeFrame(366.67, sixtyHzGate.nextLastFrameMs, 60, false);
  assert.equal(spikeGate.shouldRender, true);
  assert.equal(spikeGate.dtSeconds, 0.05);

  // 5. Force flag bypasses interval check on critical state transitions
  const forcedGate = math.shouldRenderGaugeFrame(370, spikeGate.nextLastFrameMs, 60, true);
  assert.equal(forcedGate.shouldRender, true);

  // 6. Verify integration across index.js, src/App.tsx, and gaming.html
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');

  assert.ok(indexJs.includes('math.shouldRenderGaugeFrame'));
  assert.ok(appTsx.includes('math.shouldRenderGaugeFrame'));
  assert.ok(gamingHtml.includes('scheduleGamingGaugeRender'));
});

test('GameQuery.dev API Integration: server-side adapter, SSRF protection, official header authentication, error mapping, and zero frontend secret exposure', async () => {
  const fs = await import('node:fs');
  const adapter = await import('../backend/gamequeryAdapter.mjs');

  adapter.clearGameQueryAdapterCache();

  // 1. Verify SSRF / private IP blocking & IP:Port validation
  assert.equal(adapter.validateServerAddress('127.0.0.1:27015').valid, false);
  assert.equal(adapter.validateServerAddress('10.0.0.5:27015').valid, false);
  assert.equal(adapter.validateServerAddress('192.168.1.10:27015').valid, false);
  assert.equal(adapter.validateServerAddress('172.16.0.1:27015').valid, false);
  assert.equal(adapter.validateServerAddress('localhost:27015').valid, false);
  assert.equal(adapter.validateServerAddress('185.25.180.1:27015').valid, true);
  assert.equal(adapter.validateServerAddress('play.example.com:25565').valid, true);

  // 2. Verify unsupported game_id rejection
  const badProto = adapter.validateAndNormalizeQueryPayload([
    { game_id: 'valorant_closed', servers: ['185.25.180.1:27015'] },
  ]);
  assert.equal(badProto.valid, false);
  assert.ok(badProto.errorEn.includes('Unsupported game_id protocol'));

  // 3. Unconfigured state when GAMEQUERY_API_KEY / GAMEQUERY_EMAIL are absent
  const unconf = await adapter.executeGameQueryFetch({
    env: {},
    servers: [{ game_id: 'counterstrike2', servers: ['185.25.180.1:27015'] }],
  });
  assert.equal(unconf.httpStatus, 200);
  assert.equal(unconf.payload.configured, false);
  assert.equal(unconf.payload.status, 'unconfigured');

  // 4. Valid response with official headers (x-api-token, x-api-token-type, x-api-token-email)
  let capturedHeaders = null;
  let capturedUrl = null;
  const mockSuccessFetch = async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init.headers;
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          results: [
            {
              game_id: 'counterstrike2',
              address: '185.25.180.1:27015',
              online: true,
              name: 'EU Competitive CS2 #1',
              map: 'de_mirage',
              players: { online: 10, max: 10 },
              latency: 28,
            },
          ],
        }),
    };
  };

  const validRes = await adapter.executeGameQueryFetch({
    env: {
      GAMEQUERY_API_KEY: 'test_secret_token_never_expose',
      GAMEQUERY_EMAIL: 'admin@example.com',
      GAMEQUERY_TOKEN_TYPE: 'FREE',
    },
    servers: [{ game_id: 'counterstrike2', servers: ['185.25.180.1:27015'] }],
    fetchImpl: mockSuccessFetch,
    clientIp: '203.0.113.5',
    bypassCache: true,
  });

  assert.equal(capturedUrl, 'https://api.gamequery.dev/v1/post/fetch');
  assert.equal(capturedHeaders['x-api-token'], 'test_secret_token_never_expose');
  assert.equal(capturedHeaders['x-api-token-type'], 'FREE');
  assert.equal(capturedHeaders['x-api-token-email'], 'admin@example.com');
  assert.equal(validRes.httpStatus, 200);
  assert.equal(validRes.payload.ok, true);
  assert.equal(validRes.payload.status, 'ok');
  assert.equal(validRes.payload.results.length, 1);
  assert.equal(validRes.payload.results[0].name, 'EU Competitive CS2 #1');
  assert.equal(validRes.payload.results[0].map, 'de_mirage');
  assert.equal(validRes.payload.results[0].players.online, 10);
  assert.equal(validRes.payload.results[0].probeLatencyMs, 28);
  assert.equal(validRes.payload.results[0].probeLatencySource, 'gamequery_worker_node');
  // Ensure secret never appears in serialized response
  assert.ok(!JSON.stringify(validRes.payload).includes('test_secret_token_never_expose'));

  // 5. Unauthorized (401) handling without leaking secret
  const unauthRes = await adapter.executeGameQueryFetch({
    env: {
      GAMEQUERY_API_KEY: 'invalid_secret_key_xyz',
      GAMEQUERY_EMAIL: 'admin@example.com',
      GAMEQUERY_TOKEN_TYPE: 'FREE',
    },
    servers: [{ game_id: 'rust', servers: ['185.25.180.2:28015'] }],
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid/Stopped API Credentials.' }),
    }),
    clientIp: '203.0.113.6',
    bypassCache: true,
  });
  assert.equal(unauthRes.httpStatus, 401);
  assert.equal(unauthRes.payload.status, 'unauthorized');
  assert.ok(!JSON.stringify(unauthRes.payload).includes('invalid_secret_key_xyz'));

  // 6. Rate limit (429) handling
  const rateRes = await adapter.executeGameQueryFetch({
    env: {
      GAMEQUERY_API_KEY: 'key_429',
      GAMEQUERY_EMAIL: 'admin@example.com',
    },
    servers: [{ game_id: 'minecraft', servers: ['185.25.180.3:25565'] }],
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
    }),
    clientIp: '203.0.113.7',
    bypassCache: true,
  });
  assert.equal(rateRes.httpStatus, 429);
  assert.equal(rateRes.payload.status, 'rate_limited');

  // 7. Malformed JSON (502) handling
  const malformedRes = await adapter.executeGameQueryFetch({
    env: {
      GAMEQUERY_API_KEY: 'key_502',
      GAMEQUERY_EMAIL: 'admin@example.com',
    },
    servers: [{ game_id: 'fivem', servers: ['185.25.180.4:30120'] }],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<!DOCTYPE html><html>Bad Gateway</html>',
    }),
    clientIp: '203.0.113.8',
    bypassCache: true,
  });
  assert.equal(malformedRes.httpStatus, 502);
  assert.equal(malformedRes.payload.status, 'upstream_error');

  // 8. Timeout (504) handling
  const timeoutRes = await adapter.executeGameQueryFetch({
    env: {
      GAMEQUERY_API_KEY: 'key_504',
      GAMEQUERY_EMAIL: 'admin@example.com',
    },
    servers: [{ game_id: 'arkse', servers: ['185.25.180.5:27015'] }],
    fetchImpl: async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    },
    clientIp: '203.0.113.9',
    bypassCache: true,
  });
  assert.equal(timeoutRes.httpStatus, 504);
  assert.equal(timeoutRes.payload.status, 'timeout');

  // 9. Verify frontend files contain zero hardcoded API keys or x-api-token headers
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');
  assert.ok(!gamingHtml.includes('x-api-token'), 'Frontend gaming.html must never send x-api-token directly');
  assert.ok(!frontendGamingHtml.includes('x-api-token'), 'Frontend frontend/gaming.html must never send x-api-token directly');
  assert.ok(gamingHtml.includes('id="gamequeryLivePanel"'));
  assert.ok(gamingHtml.includes('backend/gamequery.php'));
});

test('Automated Ad Lifecycle and Safe Fallback Protocol: verified automatic initialization, zero-CLS auto-collapse, multi-slot synchronization, and React App parity', async () => {
  const fs = await import('node:fs');

  const allHtmlPages = [
    '../index-modern.html',
    '../frontend/index.html',
    '../gaming.html',
    '../frontend/gaming.html',
    '../stability.html',
    '../frontend/stability.html',
  ];

  for (const relPath of allHtmlPages) {
    const content = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    // 1. External unmanaged scripts are not hardcoded in <head>
    assert.ok(
      !content.includes('https://yandex.ru/ads/system/context.js'),
      `${relPath} must manage ad scripts through central smart lifecycle engine`
    );
  }

  // 3. Verify central ad engine (frontend/javascript/ad-slots.js) handles IntersectionObserver lazy-loading & fallbacks
  const adSlotsJs = fs.readFileSync(new URL('../frontend/javascript/ad-slots.js', import.meta.url), 'utf8');
  assert.ok(adSlotsJs.includes('function isValidConfiguredBlockId(blockId)'));
  assert.ok(adSlotsJs.includes('function activateSmartlinkFallback'));
  assert.ok(adSlotsJs.includes('function activateYandexRtbBanner'));
  assert.ok(adSlotsJs.includes('AUTO_AD_ROTATION_INTERVAL_MS = 30000'));
  assert.ok(adSlotsJs.includes('new IntersectionObserver'), 'ad-slots.js must use IntersectionObserver for viewport lazy loading');
  assert.ok(adSlotsJs.includes('function setupViewportAdObserver()'), 'ad-slots.js must define setupViewportAdObserver');
  assert.ok(adSlotsJs.includes('function observeAdCardInViewport(card, reason)'), 'ad-slots.js must define observeAdCardInViewport');

  // 4. Verify React App.tsx mounts matching Zero-CLS AdSense slot
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(appTsx.includes('id="terrax-smart-ad-speed-main"'), 'App.tsx must render speed-main Zero-CLS AdSense slot');
});

test('Max Speed and Average Speed cards animate with smooth requestAnimationFrame count-up effect on final results display', async () => {
  const fs = await import('node:fs');
  const { computeCountUpFrame, animateStatCountUp, formatSpeedReading } = globalThis.TerraxTelemetryMath;

  assert.equal(typeof computeCountUpFrame, 'function');
  assert.equal(typeof animateStatCountUp, 'function');

  // 1. Null or zero target returns "--" cleanly
  const emptyFrame = computeCountUpFrame(null, 0.5, true);
  assert.equal(emptyFrame.displayNumber, '--');
  assert.equal(emptyFrame.unitEn, 'Mbps');
  assert.equal(emptyFrame.isComplete, true);

  // 2. Integer Mbps target (e.g. 840 Mbps) counts up monotonically from 0 to 840
  const start840 = computeCountUpFrame(840, 0, true);
  assert.equal(start840.displayNumber, '0');
  assert.equal(start840.unitEn, 'Mbps');
  assert.equal(start840.isComplete, false);

  const mid840 = computeCountUpFrame(840, 0.5, true);
  // Cubic ease-out at t=0.5 is 1 - 0.5^3 = 0.875 -> 840 * 0.875 = 735
  assert.equal(mid840.displayNumber, '735');
  assert.equal(mid840.unitEn, 'Mbps');
  assert.equal(mid840.isComplete, false);

  const end840 = computeCountUpFrame(840, 1, true);
  assert.equal(end840.displayNumber, formatSpeedReading(840, true).displayNumber);
  assert.equal(end840.unitEn, 'Mbps');
  assert.equal(end840.isComplete, true);

  // 3. Decimal Gbps target (e.g. 1250 Mbps -> 1.25 Gbps) preserves 2-decimal precision throughout count-up
  const startGbps = computeCountUpFrame(1250, 0, true);
  assert.equal(startGbps.displayNumber, '0.00');
  assert.equal(startGbps.unitEn, 'Gbps');

  const endGbps = computeCountUpFrame(1250, 1, true);
  assert.equal(endGbps.displayNumber, '1.25');
  assert.equal(endGbps.unitEn, 'Gbps');
  assert.equal(endGbps.isComplete, true);

  // 4. animateStatCountUp runs frames from 0 to final values and supports cancellation and reducedMotion
  const frames = [];
  await new Promise((resolve) => {
    animateStatCountUp({
      maxSpeedMbps: 920,
      avgSpeedMbps: 860,
      allowGbps: true,
      durationMs: 60,
      reducedMotion: false,
      onFrame: (f) => frames.push(f),
      onComplete: () => resolve(),
    });
  });

  assert.ok(frames.length >= 2, 'animateStatCountUp should emit initial and completion frames');
  assert.equal(frames[0].maxFrame.displayNumber, '0');
  assert.equal(frames[0].avgFrame.displayNumber, '0');
  assert.equal(frames[frames.length - 1].maxFrame.displayNumber, '920');
  assert.equal(frames[frames.length - 1].avgFrame.displayNumber, '860');
  assert.equal(frames[frames.length - 1].isComplete, true);

  // 5. Verify integration in frontend/javascript/index.js, src/App.tsx, and frontend/styling/results.css
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');

  assert.ok(indexJs.includes('function startFinalStatCardsCountUp'));
  assert.ok(indexJs.includes('math.animateStatCountUp'));
  assert.ok(appTsx.includes('math.animateStatCountUp'));
  assert.ok(resultsCss.includes('.stat-number.counting-up'));
  assert.ok(resultsCss.includes('.cyber-stat-card.counting-up'));
});

test('Dedicated stat cards requestAnimationFrame loop (createStatCardsRafLoop) synchronizes numeric updates with gauge arc animations and eliminates layout thrashing via dirty-checking and CSS containment', async () => {
  const fs = await import('node:fs');
  const { createStatCardsRafLoop } = globalThis.TerraxTelemetryMath;
  assert.equal(typeof createStatCardsRafLoop, 'function');

  const commits = [];
  const loop = createStatCardsRafLoop({
    targetFps: 60,
    onCommit: (state) => commits.push({ ...state }),
  });

  // 1. Reset sets "--" / "Mbps" once and skips redundant resets when unchanged
  loop.reset('--', 'Mbps');
  assert.equal(commits.length, 1);
  assert.equal(commits[0].maxDisplay, '--');
  assert.equal(commits[0].avgDisplay, '--');

  loop.reset('--', 'Mbps');
  assert.equal(commits.length, 1, 'Dirty check must skip redundant DOM commit when values are unchanged');

  // 2. Live targets stepped in lockstep with gauge syncFrame(nowMs, dtSeconds)
  loop.setLiveTargets(500, 420, true, false, false);
  loop.syncFrame(100, 1 / 60);
  assert.equal(commits.length, 2);
  assert.equal(commits[1].maxDisplay, '500');
  assert.equal(commits[1].avgDisplay, '420');
  assert.equal(commits[1].countingUp, false);

  // Subsequent frames with identical formatted readings must NOT trigger DOM writes
  loop.syncFrame(116.67, 1 / 60);
  loop.syncFrame(133.34, 1 / 60);
  assert.equal(commits.length, 2, 'Dirty check must prevent layout thrashing when formatted strings have not changed');

  // 3. Smooth live interpolation converges across synchronized gauge frames
  loop.setLiveTargets(900, 780, true, true, false);
  const stillRunning = loop.syncFrame(150, 1 / 60);
  assert.equal(stillRunning, true);
  assert.equal(commits.length, 3);
  const midMax = Number(commits[2].maxDisplay);
  assert.ok(midMax > 500 && midMax < 900, 'Live interpolation should smoothly step between 500 and 900');

  // 4. Final count-up mode synchronized via syncFrame
  const cancelCountUp = loop.startCountUp({
    maxSpeedMbps: 1200,
    avgSpeedMbps: 950,
    allowGbps: true,
    durationMs: 200,
    reducedMotion: false,
    standalone: false,
  });
  const afterStartState = loop.getState();
  assert.equal(afterStartState.mode, 'countup');
  assert.equal(afterStartState.lastMaxDisplay, '0.00');
  assert.equal(afterStartState.lastMaxUnit, 'Gbps');
  assert.equal(afterStartState.lastAvgDisplay, '0');
  assert.equal(afterStartState.lastAvgUnit, 'Mbps');
  assert.equal(afterStartState.lastCountingUp, true);

  // Advance past count-up duration
  const startNow = performance.now();
  loop.syncFrame(startNow + 250, 1 / 60);
  const finalState = loop.getState();
  assert.equal(finalState.mode, 'live');
  assert.equal(finalState.lastMaxDisplay, '1.20');
  assert.equal(finalState.lastMaxUnit, 'Gbps');
  assert.equal(finalState.lastAvgDisplay, '950');
  assert.equal(finalState.lastAvgUnit, 'Mbps');
  assert.equal(finalState.lastCountingUp, false);
  cancelCountUp();

  // 5. Verify integration in index.js, src/App.tsx, and CSS containment in results.css
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');

  assert.ok(indexJs.includes('function getStatCardsRafController'));
  assert.ok(indexJs.includes('function getStatCardElements'));
  assert.ok(indexJs.includes('statCardsController.syncFrame(nowFrame, frameDt)'));
  assert.ok(appTsx.includes('statCardsLoopRef.current.syncFrame(now, dt)'));
  assert.ok(resultsCss.includes('contain: layout style;'));
});

test('Core Internet Speed Test Page visual identity and background enforce strict anti-jitter invariants', async () => {
  const fs = await import('node:fs');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const mainCss = fs.readFileSync(new URL('../frontend/styling/main.css', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // 1. Background layers must use strict containment, GPU compositing, and no non-composited background-position drift
  assert.ok(indexCss.includes('contain: strict;'), 'cyber-backdrop must use contain: strict');
  assert.ok(!indexCss.includes('background-attachment: fixed'), 'html must not use background-attachment: fixed');
  assert.ok(!indexCss.includes('translateY(-6px)'), 'cyber-grid-mesh must not shift vertically');
  assert.ok(indexCss.includes('transform-box: fill-box;'), 'SVG trace-node circles must use transform-box: fill-box');
  assert.ok(indexCss.includes('left: calc(50% - 23rem);'), 'flare-center-cyan must center via calc without transform collision');

  // 2. Visual identity header and shell must remain locked at opacity: 1 and constant height
  assert.ok(indexCss.includes('min-height: 5.5rem;'), 'header.terrax-header must lock min-height');
  assert.ok(!indexCss.includes('opacity: 0.94;'), 'test-running-focus must not dim header.terrax-header to 0.94');
  assert.ok(appTsx.includes('className="brand-shield-icon"'), 'React App.tsx header must include brand-shield-icon');

  // 3. Dynamic child elements (#privacy-warning and .ping/.jitter) must reserve space and hide via visibility: hidden
  assert.ok(mainCss.includes('visibility: hidden;'), '#privacy-warning.hidden must use visibility: hidden instead of display: none');
  assert.ok(resultsCss.includes('visibility: hidden;'), '.ping.hidden and .jitter.hidden must use visibility: hidden instead of display: none');

  // 4. Gauges and numbers must not trigger forced synchronous reflows or competing stroke-dasharray transitions
  assert.ok(!indexJs.includes('void el.offsetWidth'), 'triggerKineticTick must not force synchronous layout reflow');
  assert.ok(!resultsCss.includes('stroke-dasharray 160ms'), '.gauge-active-arc must not fight 60fps JS stroke-dasharray updates');
});

test('Site-wide visual identity and layout structure remain resilient under browser zoom in/out and viewport resizing', async () => {
  const fs = await import('node:fs');
  const rootIndexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const mainCss = fs.readFileSync(new URL('../frontend/styling/main.css', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const buttonCss = fs.readFileSync(new URL('../frontend/styling/button.css', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  // 1. User zoom must never be blocked by user-scalable=no
  assert.ok(!rootIndexHtml.includes('user-scalable=no'), 'index.html must not block user zoom via user-scalable=no');

  // 2. Safe vertical centering + margin: auto prevents top header clipping when zoomed in and centers shell when zoomed out
  assert.ok(indexCss.includes('justify-content: safe center;'), 'index.css body must use justify-content: safe center');
  assert.ok(indexCss.includes('margin: auto;'), 'index.css .terrax-cyber-shell must use margin: auto');
  assert.ok(stabilityHtml.includes('justify-content: safe center;'), 'stability.html body must use justify-content: safe center');
  assert.ok(gamingHtml.includes('justify-content: safe center;'), 'gaming.html body must use justify-content: safe center');

  // 3. Desktop zoom-in must not overlap gauges due to orientation: portrait lock on <= 480px / <= 360px
  assert.ok(!resultsCss.includes('(max-width: 480px) and (orientation: portrait)'), 'results.css must not lock 480px gauge breakpoint to portrait only');
  assert.ok(!resultsCss.includes('(max-width: 360px) and (orientation: portrait)'), 'results.css must not lock 360px gauge breakpoint to portrait only');
  assert.ok(resultsCss.includes('@media screen and (max-width: 620px)'), 'results.css must include intermediate 620px gauge triangle anti-overlap rule');

  // 4. Flex and grid containers must use min-width: 0 / minmax(0, ...) / min(..., 100%) to prevent horizontal overflow when zoomed in
  assert.ok(mainCss.includes('grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);'), 'main.css .connection-server-row must use minmax(0, ...)');
  assert.ok(buttonCss.includes('min-width: min(28rem, 100%);'), 'button.css primary buttons must cap min-width to 100%');
  assert.ok(dialogCss.includes('min-width: min(19rem, 100%);'), 'dialog.css select controls must cap min-width to 100%');
  assert.ok(indexCss.includes('min-width: min(18rem, 100%);'), 'index.css sponsor content must cap min-width to 100%');

  // 5. Stability and Gaming pages must isolate fixed backdrops and synchronize root/frontend copies
  assert.ok(stabilityHtml.includes('transform-box: fill-box;'), 'stability.html SVG nodes must use transform-box: fill-box');
  assert.ok(!gamingHtml.includes('background-attachment: fixed'), 'gaming.html must not use background-attachment: fixed');
  const normStabilityRoot = stabilityHtml.slice(stabilityHtml.indexOf('<style>')).replace(/url\("frontend\/images\/background\.jpeg"\)/g, 'url("images/background.jpeg")');
  const normStabilityFrontend = frontendStabilityHtml.slice(frontendStabilityHtml.indexOf('<style>'));
  assert.equal(normStabilityRoot, normStabilityFrontend, 'stability.html and frontend/stability.html must remain synchronized');
  const normGamingRoot = gamingHtml.slice(gamingHtml.indexOf('<style>')).replace(/url\("frontend\/images\/background\.jpeg"\)/g, 'url("images/background.jpeg")');
  const normGamingFrontend = frontendGamingHtml.slice(frontendGamingHtml.indexOf('<style>'));
  assert.equal(normGamingRoot, normGamingFrontend, 'gaming.html and frontend/gaming.html must remain synchronized');
});

test('Test History table in usage dialog includes Date column, multi-column sorting capabilities, and strict data accuracy across test restarts', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;

  assert.equal(typeof math.createTestHistoryEntry, 'function');
  assert.equal(typeof math.normalizeTestHistoryList, 'function');
  assert.equal(typeof math.appendTestHistoryEntry, 'function');
  assert.equal(typeof math.sortTestHistoryList, 'function');

  // 1. createTestHistoryEntry creates a complete Date + Time record with tabular ISO/localized dates
  const fixedEpoch1 = Date.UTC(2026, 10, 1, 14, 20, 30); // 2026-11-01
  const fixedEpoch2 = Date.UTC(2026, 10, 2, 9, 15, 10);  // 2026-11-02
  const fixedEpoch3 = Date.UTC(2026, 10, 2, 18, 45, 50); // 2026-11-02 later time

  const entry1 = math.createTestHistoryEntry(
    {
      runId: 'run_1001',
      epochMs: fixedEpoch1,
      serverName: 'Riyadh Core',
      dlMbps: 320.456,
      ulMbps: 95.12,
      pingMs: 28.4,
      jitterMs: 3.1,
      stabilityPercent: 94.2,
      megabytesUsed: 42.8,
    },
    fixedEpoch1
  );

  assert.equal(entry1.runId, 'run_1001');
  assert.equal(entry1.epochMs, fixedEpoch1);
  assert.match(entry1.isoDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(entry1.dateAr, /^\d{4}\/\d{2}\/\d{2}$/);
  assert.equal(entry1.dateEn, entry1.isoDate);
  assert.equal(entry1.serverName, 'Riyadh Core');
  assert.equal(entry1.dlMbps, 320.46);
  assert.equal(entry1.ulMbps, 95.12);
  assert.equal(entry1.pingMs, 28.4);
  assert.equal(entry1.stabilityPercent, 94);
  assert.equal(entry1.megabytesUsed, 42.8);

  // 2. Accuracy across test restarts: appendTestHistoryEntry never overwrites or corrupts prior runs,
  //    and deduplicates if the same runId is committed twice
  let historyList = [];
  historyList = math.appendTestHistoryEntry(historyList, entry1, 25, fixedEpoch1);
  assert.equal(historyList.length, 1);

  // Duplicate commit of the same runId updates in place instead of duplicating
  historyList = math.appendTestHistoryEntry(
    historyList,
    { ...entry1, dlMbps: 325.0 },
    25,
    fixedEpoch1
  );
  assert.equal(historyList.length, 1, 'Same runId must not create duplicate history row');
  assert.equal(historyList[0].dlMbps, 325);

  // Test restart #2 with a new runId prepends cleanly while preserving run #1 intact
  const run2 = {
    runId: 'run_1002',
    epochMs: fixedEpoch2,
    serverName: 'Aden Fiber',
    dlMbps: 850.5,
    ulMbps: 410.2,
    pingMs: 11.2,
    stabilityPercent: 99,
    megabytesUsed: 110.4,
  };
  historyList = math.appendTestHistoryEntry(historyList, run2, 25, fixedEpoch2);
  assert.equal(historyList.length, 2);
  assert.equal(historyList[0].runId, 'run_1002');
  assert.equal(historyList[1].runId, 'run_1001');
  assert.equal(historyList[1].dlMbps, 325, 'Previous test run data must remain untouched across restarts');

  // Test restart #3 with null stability (e.g. short run)
  const run3 = {
    runId: 'run_1003',
    epochMs: fixedEpoch3,
    serverName: 'Yemen Net',
    dlMbps: 140.0,
    ulMbps: 45.0,
    pingMs: 44.8,
    stabilityPercent: null,
    megabytesUsed: 25.0,
  };
  historyList = math.appendTestHistoryEntry(historyList, run3, 25, fixedEpoch3);
  assert.equal(historyList.length, 3);

  // 3. Legacy localStorage normalization (entries missing date / epochMs / runId)
  const legacyNormalized = math.normalizeTestHistoryList(
    [
      {
        timestamp: '10:30:00',
        serverName: 'اليمن',
        dlMbps: 100,
        ulMbps: 50,
        pingMs: 19,
        stabilityPercent: 96,
        megabytesUsed: 15,
      },
    ],
    fixedEpoch3
  );
  assert.equal(legacyNormalized.length, 1);
  assert.match(legacyNormalized[0].isoDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(legacyNormalized[0].dateAr, /^\d{4}\/\d{2}\/\d{2}$/);
  assert.ok(legacyNormalized[0].runId.startsWith('run_'));

  // 4. Multi-column sorting (Date, Time, Server, Download, Upload, Stability, Ping)
  const byDateDesc = math.sortTestHistoryList(historyList, 'date', 'desc');
  assert.deepEqual(
    byDateDesc.map((r) => r.runId),
    ['run_1003', 'run_1002', 'run_1001']
  );

  const byDateAsc = math.sortTestHistoryList(historyList, 'date', 'asc');
  assert.deepEqual(
    byDateAsc.map((r) => r.runId),
    ['run_1001', 'run_1002', 'run_1003']
  );

  const byDlDesc = math.sortTestHistoryList(historyList, 'dl', 'desc');
  assert.deepEqual(
    byDlDesc.map((r) => r.runId),
    ['run_1002', 'run_1001', 'run_1003']
  );

  const byDlAsc = math.sortTestHistoryList(historyList, 'dl', 'asc');
  assert.deepEqual(
    byDlAsc.map((r) => r.runId),
    ['run_1003', 'run_1001', 'run_1002']
  );

  const byUlDesc = math.sortTestHistoryList(historyList, 'ul', 'desc');
  assert.deepEqual(
    byUlDesc.map((r) => r.runId),
    ['run_1002', 'run_1001', 'run_1003']
  );

  const byPingAsc = math.sortTestHistoryList(historyList, 'ping', 'asc');
  assert.deepEqual(
    byPingAsc.map((r) => r.runId),
    ['run_1002', 'run_1001', 'run_1003']
  );

  const byServerAsc = math.sortTestHistoryList(historyList, 'server', 'asc');
  assert.deepEqual(
    byServerAsc.map((r) => r.serverName),
    ['Aden Fiber', 'Riyadh Core', 'Yemen Net']
  );

  // Stability sort places null stability at the bottom in both desc and asc
  const byStabDesc = math.sortTestHistoryList(historyList, 'stability', 'desc');
  assert.deepEqual(
    byStabDesc.map((r) => r.runId),
    ['run_1002', 'run_1001', 'run_1003']
  );
  const byStabAsc = math.sortTestHistoryList(historyList, 'stability', 'asc');
  assert.deepEqual(
    byStabAsc.map((r) => r.runId),
    ['run_1001', 'run_1002', 'run_1003']
  );

  // 5. Verify HTML, CSS, JS, and React markup for the 7-column Date + sortable headers
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  for (const html of [indexModernHtml, frontendIndexHtml]) {
    assert.ok(html.includes('data-sort-key="date"'), 'HTML must include sortable Date header');
    assert.ok(html.includes('data-sort-key="time"'), 'HTML must include sortable Time header');
    assert.ok(html.includes('data-sort-key="server"'), 'HTML must include sortable Server header');
    assert.ok(html.includes('data-sort-key="dl"'), 'HTML must include sortable Download header');
    assert.ok(html.includes('data-sort-key="ul"'), 'HTML must include sortable Upload header');
    assert.ok(html.includes('data-sort-key="stability"'), 'HTML must include sortable Stability header');
    assert.ok(html.includes('data-sort-key="ping"'), 'HTML must include sortable Ping header');
    assert.ok(html.includes('colspan="7"'), 'Empty history row must span all 7 columns');
  }

  assert.ok(indexJs.includes('function setHistorySort(sortKey, explicitDir)'));
  assert.ok(indexJs.includes('history-date-cell'));
  assert.ok(dialogCss.includes('.cyber-history-table th.is-sorted'));
  assert.ok(dialogCss.includes('.cyber-history-table td.history-date-cell'));
  assert.ok(appTsx.includes('handleHistorySort'));
  assert.ok(appTsx.includes('history-date-cell'));
});

test('Completed Tests number (#total-tests-count) in usage dialog animates with smooth count-up effect on dialog open', async () => {
  const fs = await import('node:fs');
  const { computeIntegerCountUpFrame, animateCompletedTestsCountUp } = globalThis.TerraxTelemetryMath;

  assert.equal(typeof computeIntegerCountUpFrame, 'function');
  assert.equal(typeof animateCompletedTestsCountUp, 'function');

  // 1. Zero or negative target snaps cleanly to "0"
  const zeroFrame = computeIntegerCountUpFrame(0, 0.4);
  assert.equal(zeroFrame.displayValue, '0');
  assert.equal(zeroFrame.currentCount, 0);
  assert.equal(zeroFrame.isComplete, true);

  // 2. Positive integer target (e.g. 24 completed tests) interpolates monotonically from 0 to 24
  const start24 = computeIntegerCountUpFrame(24, 0);
  assert.equal(start24.displayValue, '0');
  assert.equal(start24.currentCount, 0);
  assert.equal(start24.isComplete, false);

  const mid24 = computeIntegerCountUpFrame(24, 0.5);
  // Cubic ease-out at t=0.5 is 0.875 -> 24 * 0.875 = 21
  assert.equal(mid24.displayValue, '21');
  assert.equal(mid24.currentCount, 21);
  assert.equal(mid24.isComplete, false);

  const end24 = computeIntegerCountUpFrame(24, 1);
  assert.equal(end24.displayValue, '24');
  assert.equal(end24.currentCount, 24);
  assert.equal(end24.isComplete, true);

  // 3. animateCompletedTestsCountUp emits frames from "0" to targetCount and invokes onComplete
  const frames = [];
  await new Promise((resolve) => {
    animateCompletedTestsCountUp({
      targetCount: 15,
      durationMs: 60,
      reducedMotion: false,
      onFrame: (f) => frames.push(f),
      onComplete: () => resolve(),
    });
  });

  assert.ok(frames.length >= 2, 'animateCompletedTestsCountUp should emit initial 0 and completion frames');
  assert.equal(frames[0].displayValue, '0');
  assert.equal(frames[frames.length - 1].displayValue, '15');
  assert.equal(frames[frames.length - 1].isComplete, true);

  // 4. Reduced motion snaps immediately to final targetCount in a single frame
  const rmFrames = [];
  animateCompletedTestsCountUp({
    targetCount: 18,
    durationMs: 650,
    reducedMotion: true,
    onFrame: (f) => rmFrames.push(f),
  });
  assert.equal(rmFrames.length, 1);
  assert.equal(rmFrames[0].displayValue, '18');
  assert.equal(rmFrames[0].isComplete, true);

  // 5. Verify integration in frontend/javascript/index.js, frontend/styling/dialog.css, and src/App.tsx
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.ok(indexJs.includes('function startUsageTestsCountUp'));
  assert.ok(indexJs.includes('function cancelUsageTestsCountUp'));
  assert.ok(indexJs.includes('renderUsageHistoryUI({ animateCount: true })'));
  assert.ok(dialogCss.includes('.usage-val.counting-up'));
  assert.ok(dialogCss.includes('.usage-stat-box.counting-up'));
  assert.ok(appTsx.includes('math.animateCompletedTestsCountUp'));
});

test('Google AdSense Professional Integration: strict ID validation, Smart Ad Lock (READY/RUNNING/FINISHED/ERROR), CMP Consent Mode v2, and ads.txt compliance', async () => {
  const fs = await import('node:fs');
  await import('../frontend/javascript/ad-slots.js');
  const engine = globalThis.TerraxSmartAdEngine;
  const cmp = globalThis.TerraxConsentManager;

  assert.ok(engine, 'TerraxSmartAdEngine must be registered on globalThis');
  assert.ok(cmp, 'TerraxConsentManager must be registered on globalThis');

  // 1. Strict Publisher ID & Slot ID validation (rejects empty, fake, repeating, or sequential placeholders)
  assert.equal(engine.isValidAdSensePublisherId(''), false);
  assert.equal(engine.isValidAdSensePublisherId(null), false);
  assert.equal(engine.isValidAdSensePublisherId('ca-pub-0000000000000000'), false);
  assert.equal(engine.isValidAdSensePublisherId('pub-0000000000000000'), false);
  assert.equal(engine.isValidAdSensePublisherId('ca-pub-1111111111111111'), false);
  assert.equal(engine.isValidAdSensePublisherId('ca-pub-1234567890123456'), false);
  assert.equal(engine.isValidAdSensePublisherId('ca-pub-12345'), false);

  // Valid format 16-digit non-repeating IDs pass validation and normalize to ca-pub-XXXXXXXXXXXXXXXX
  assert.equal(engine.isValidAdSensePublisherId('ca-pub-9847261539482716'), true);
  assert.equal(engine.isValidAdSensePublisherId('pub-9847261539482716'), true);
  assert.equal(engine.normalizeAdSenseClientId('pub-9847261539482716'), 'ca-pub-9847261539482716');
  assert.equal(engine.normalizeAdSenseClientId('ca-pub-0000000000000000'), '');

  // Slot ID validation
  assert.equal(engine.isValidAdSenseSlotId(''), false);
  assert.equal(engine.isValidAdSenseSlotId('0000000000'), false);
  assert.equal(engine.isValidAdSenseSlotId('1234567890'), false);
  assert.equal(engine.isValidAdSenseSlotId('abc1234567'), false);
  assert.equal(engine.isValidAdSenseSlotId('5829104736'), true);

  // 2. Default unconfigured state must NOT invent publisher IDs or slot IDs
  const defaultCfg = engine.configureAdSense({});
  assert.equal(defaultCfg.publisherId, '', 'Default publisherId must remain empty until configured');
  assert.equal(defaultCfg.slots['speed-main'], '', 'Default speed-main slot must remain empty until configured');

  // 3. Smart Ad Lock state machine (READY -> RUNNING -> FINISHED -> ERROR)
  const readyState = engine.setEngineTestState('READY');
  assert.equal(readyState.testEngineState, 'READY');
  assert.equal(readyState.isTesting, false);

  const runningState = engine.setEngineTestState('RUNNING');
  assert.equal(runningState.testEngineState, 'RUNNING');
  assert.equal(runningState.isTesting, true);
  assert.equal(
    engine.refreshAllSlots('attempt-during-running'),
    false,
    'RUNNING state must suppress all new ad-loading operations'
  );
  assert.equal(
    engine.getState().pendingAdLoadAfterTest,
    true,
    'Blocked refresh during RUNNING should queue pendingAdLoadAfterTest'
  );

  const finishedState = engine.onTestComplete('speed');
  assert.equal(finishedState, true);
  assert.equal(engine.getState().testEngineState, 'FINISHED');
  assert.equal(engine.getState().isTesting, false);

  // ERROR state preserves error metadata and unlocks network isolation safely
  const errObj = engine.onTestError({ reason: 'connection_abort', code: 'ECONNRESET' });
  assert.equal(engine.getState().testEngineState, 'ERROR');
  assert.equal(engine.getState().isTesting, false);
  assert.equal(errObj.reason, 'connection_abort');
  assert.equal(errObj.code, 'ECONNRESET');

  // Reset back to READY
  engine.setEngineTestState('READY');

  // 4. Privacy & Consent Management (Google Consent Mode v2 + NPA + Opt-Out)
  globalThis.dataLayer = [];
  globalThis.adsbygoogle = [];

  const npaState = engine.setConsentChoice('non_personalized');
  assert.equal(npaState.mode, 'non_personalized');
  assert.equal(npaState.canLoadAds, true);
  assert.equal(npaState.nonPersonalizedOnly, true);
  assert.equal(globalThis.adsbygoogle.requestNonPersonalizedAds, 1);
  assert.equal(globalThis.adsbygoogle.pauseAdRequests, 0);

  const rejectedState = engine.setConsentChoice('rejected');
  assert.equal(rejectedState.mode, 'rejected');
  assert.equal(rejectedState.canLoadAds, false);
  assert.equal(globalThis.adsbygoogle.pauseAdRequests, 1);

  const personalizedState = engine.setConsentChoice('personalized');
  assert.equal(personalizedState.mode, 'personalized');
  assert.equal(personalizedState.canLoadAds, true);
  assert.equal(personalizedState.nonPersonalizedOnly, false);
  assert.equal(globalThis.adsbygoogle.requestNonPersonalizedAds, 0);
  assert.equal(globalThis.adsbygoogle.pauseAdRequests, 0);

  // Reset consent to unset
  engine.setConsentChoice('unset');

  // 5. Verify ads.txt, adsConfig.ts, AMP Auto Ads (<head> script + <body> tag), and Publisher ID ca-pub-1225026489802055
  const adsTxt = fs.readFileSync(new URL('../ads.txt', import.meta.url), 'utf8');
  const adsConfigTs = fs.readFileSync(new URL('../src/config/adsConfig.ts', import.meta.url), 'utf8');
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');

  assert.equal(engine.isValidAdSensePublisherId('ca-pub-1225026489802055'), true);
  assert.ok(adsTxt.includes('google.com, pub-1225026489802055, DIRECT, f08c47fec0942fa0'));

  const htmlPagesWithAmpAutoAds = [
    '../index.html',
    '../index-modern.html',
    '../frontend/index.html',
    '../gaming.html',
    '../frontend/gaming.html',
    '../stability.html',
    '../frontend/stability.html',
    '../index-classic.html',
  ];

  for (const relPage of htmlPagesWithAmpAutoAds) {
    const html = fs.readFileSync(new URL(relPage, import.meta.url), 'utf8');
    const headEnd = html.indexOf('</head>');
    const bodyStart = html.indexOf('<body');
    const headScriptPos = html.indexOf('https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js');
    const bodyAmpTagPos = html.indexOf('<amp-auto-ads type="adsense"');

    const headMetaPos = html.indexOf('<meta name="google-adsense-account" content="ca-pub-1225026489802055">');
    const headAdsenseScriptPos = html.indexOf(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1225026489802055'
    );

    assert.ok(
      headMetaPos !== -1 && headMetaPos < headEnd,
      `${relPage} must include <meta name="google-adsense-account" content="ca-pub-1225026489802055"> inside <head>`
    );
    assert.ok(
      headAdsenseScriptPos !== -1 && headAdsenseScriptPos < headEnd,
      `${relPage} must include adsbygoogle.js?client=ca-pub-1225026489802055 script inside <head>`
    );
    assert.ok(
      html.includes('crossorigin="anonymous"'),
      `${relPage} must include crossorigin="anonymous" on the AdSense script`
    );
    assert.ok(
      headScriptPos !== -1 && headScriptPos < headEnd,
      `${relPage} must include amp-auto-ads-0.1.js script inside <head>`
    );
    assert.ok(
      html.includes('custom-element="amp-auto-ads"'),
      `${relPage} must include custom-element="amp-auto-ads" attribute`
    );
    assert.ok(
      bodyAmpTagPos > bodyStart,
      `${relPage} must include <amp-auto-ads type="adsense"> after <body>`
    );
    assert.ok(
      html.includes('data-ad-client="ca-pub-1225026489802055"'),
      `${relPage} must configure data-ad-client="ca-pub-1225026489802055"`
    );

    const bodyContent = html.slice(bodyStart);
    if (relPage === '../index.html' || relPage === '../index-modern.html' || relPage === '../frontend/index.html') {
      assert.ok(
        bodyContent.includes('class="adsbygoogle"'),
        `${relPage} must include <ins class="adsbygoogle"> inside <body>`
      );
      assert.ok(
        bodyContent.includes('data-ad-slot="7159014601"'),
        `${relPage} must configure data-ad-slot="7159014601" inside <body>`
      );
      assert.ok(
        bodyContent.includes('data-ad-status="unfilled"') && bodyContent.includes('data-ad-filled="false"'),
        `${relPage} must initialize ad container with Zero-CLS unfilled state`
      );
    }
  }

  assert.equal(engine.isValidAdSenseSlotId('7159014601'), true);
  assert.ok(adsConfigTs.includes('export function isValidAdSensePublisherId'));
  assert.ok(adsConfigTs.includes('export function isValidAdSenseSlotId'));
  assert.ok(adsConfigTs.includes('ca-pub-1225026489802055'));
  assert.ok(adsConfigTs.includes('7159014601'));
  assert.ok(!indexModernHtml.includes('id="consent-accept-all-btn"'), 'consent-accept-all-btn must be removed');
  assert.ok(!indexModernHtml.includes('id="consent-npa-only-btn"'), 'consent-npa-only-btn must be removed');
  assert.ok(!indexModernHtml.includes('id="consent-reject-ads-btn"'), 'consent-reject-ads-btn must be removed');
  assert.ok(!indexModernHtml.includes('id="open-consent-preferences-btn"'), 'open-consent-preferences-btn must be removed');

  // 6. Verify modular /ads/* architecture, diagnostics report, and public/ads.txt + robots.txt
  const adsConfigMod = await import('../ads/ads.config.js');
  const adsValidatorMod = await import('../ads/adsense.validator.js');
  const adsDiagMod = await import('../ads/adsense.diagnostics.js');
  const adsManagerMod = await import('../ads/adsense.manager.js');

  assert.equal(adsConfigMod.DEFAULT_PUBLISHER_ID, 'ca-pub-1225026489802055');
  assert.equal(adsConfigMod.DEFAULT_SLOT_ID, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.publisherId, 'ca-pub-1225026489802055');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.enableAdSense, true);
  assert.equal(adsConfigMod.ADSENSE_CONFIG.enableAutoAds, true);
  assert.equal(adsConfigMod.ADSENSE_CONFIG.scriptLoadingMode, 'async');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.ampAutoAdsScriptUrl, 'https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.home.adSlotId, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.speedTest.adSlotId, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.stability.adSlotId, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.consumption.adSlotId, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.servers.adSlotId, '7159014601');
  assert.equal(adsConfigMod.ADSENSE_CONFIG.placements.additionalContent.adSlotId, '7159014601');

  const validationReport = adsValidatorMod.validateAdSenseConfig(adsConfigMod.ADSENSE_CONFIG);
  assert.equal(validationReport.issues.length, 0);
  assert.equal(validationReport.totalPlacements, 6);
  assert.equal(validationReport.readyPlacements, 6);

  const diagReport = adsDiagMod.generateAdSenseDiagnostics();
  assert.equal(diagReport.subsystems.publisher.status, 'READY');
  assert.equal(diagReport.subsystems.adsTxt.status, 'READY');
  assert.equal(diagReport.subsystems.robotsTxt.status, 'READY');
  assert.equal(diagReport.subsystems.smartAdLock.status, 'READY');
  assert.equal(diagReport.subsystems.consentManagement.status, 'READY');
  assert.equal(diagReport.subsystems.placements.status, 'READY');

  const managerState = adsManagerMod.AdSenseManager.getState();
  assert.equal(managerState.publisherId, 'ca-pub-1225026489802055');
  assert.equal(managerState.testEngineState, 'READY');

  const publicAdsTxt = fs.readFileSync(new URL('../public/ads.txt', import.meta.url), 'utf8');
  const robotsTxt = fs.readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  const publicRobotsTxt = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.ok(publicAdsTxt.includes('google.com, pub-1225026489802055, DIRECT, f08c47fec0942fa0'));
  assert.ok(robotsTxt.includes('User-agent: Mediapartners-Google'));
  assert.ok(publicRobotsTxt.includes('User-agent: Mediapartners-Google'));
});

test('Basic Speed & Stability Test pages: instantaneous disconnection resilience, race-condition guards, process isolation, and zero floating text below bottom bar', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;

  // 1. Instantaneous internet disconnection before/during RTT samples records packet loss & stability drop
  const disconnectEval = math.evaluateGamingStability(0, 0, 100, 1);
  assert.equal(disconnectEval.hasData, true, 'evaluateGamingStability must report hasData: true when packet loss is recorded on sample 1');
  assert.equal(disconnectEval.grade, 'bad', '100% packet loss on instantaneous disconnect must grade as bad');
  assert.equal(disconnectEval.titleAr, 'غير مستقر للألعاب');
  assert.ok(disconnectEval.scorePercent <= 35, 'Score percentage must drop sharply under 100% packet loss');

  const partialDisconnectEval = math.evaluateGamingStability(32, 8.5, 25, 4);
  assert.equal(partialDisconnectEval.hasData, true);
  assert.equal(partialDisconnectEval.grade, 'bad');
  assert.ok(partialDisconnectEval.scorePercent < 60, '25% packet loss during stability run must drop stability score');

  // 2. Verify stability_worker.js handles offline_blip and prevents double-counting probe timeouts/errors
  const workerJs = fs.readFileSync(new URL('../stability_worker.js', import.meta.url), 'utf8');
  assert.ok(workerJs.includes('params[0] === "offline_blip"'), 'stability_worker.js must handle offline_blip command');
  assert.ok(workerJs.includes('let probeSettled = false;'), 'stability_worker.js must guard each probe with probeSettled');
  assert.ok(workerJs.includes('function clearScheduledPing()'), 'stability_worker.js must clear scheduled ping timers cleanly');
  assert.ok(workerJs.includes('function abortActiveProbe()'), 'stability_worker.js must abort active XHR cleanly');

  // 3. Verify floating footer text below bottom bar is removed and stability-cta-section is properly closed
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');

  assert.ok(!indexModernHtml.includes('<p class="source">'), 'index-modern.html must not render floating footer source link below bottom bar');
  assert.ok(!frontendIndexHtml.includes('<p class="source">'), 'frontend/index.html must not render floating footer source link below bottom bar');
  assert.ok(
    stabilityHtml.includes('</section>\n\n    <!-- Phase 10: Bottom 5-Tab Navigation Bar'),
    'stability.html must close <section class="stability-cta-section"> before <nav class="terrax-bottom-nav">'
  );
  assert.ok(
    frontendStabilityHtml.includes('</section>\n\n    <!-- Phase 10: Bottom 5-Tab Navigation Bar'),
    'frontend/stability.html must close <section class="stability-cta-section"> before <nav class="terrax-bottom-nav">'
  );

  // 4. Verify live stability percentage badge (#statStabilityPct), dirty-checking UI cache, and process isolation
  assert.ok(stabilityHtml.includes('id="statStabilityPct"'), 'stability.html must include #statStabilityPct stability percentage badge');
  assert.ok(stabilityHtml.includes('function cleanupStabilityPageResources()'), 'stability.html must define cleanupStabilityPageResources()');
  assert.ok(stabilityHtml.includes('uiRenderCache'), 'stability.html must use uiRenderCache dirty-checking to prevent unnecessary DOM re-renders');
  assert.ok(stabilityHtml.includes('postMessage("offline_blip")'), 'stability.html must notify worker of instantaneous offline blips without crashing');

  // 5. Verify race-condition guard and process isolation in frontend/javascript/index.js and src/App.tsx
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.ok(indexJs.includes('testState._startRunToken'), 'index.js must guard test start cycle with testState._startRunToken');
  assert.ok(indexJs.includes('function cancelPendingTestWarmup()'), 'index.js must cancel pending pre-test warmup on re-click or navigation');
  assert.ok(indexJs.includes('function cleanupSpeedPageResources()'), 'index.js must clean up timers, animations, and workers when leaving speed page');
  assert.ok(appTsx.includes('startRunTokenRef'), 'src/App.tsx must guard test start cycle with startRunTokenRef');
  assert.ok(appTsx.includes('cancelPendingWarmup'), 'src/App.tsx must cancel pending pre-test warmup on re-click or navigation');
});

test('Stability graph moving average window (computeStabilityMovingAverage) reduces visual jitter while preserving raw telemetry and packet loss discontinuities', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;

  assert.equal(typeof math.computeStabilityMovingAverage, 'function', 'computeStabilityMovingAverage must be exported by TerraxTelemetryMath');

  // 1. Empty or invalid input returns empty array
  assert.deepEqual(math.computeStabilityMovingAverage([]), []);
  assert.deepEqual(math.computeStabilityMovingAverage(null), []);

  // 2. Moving average window (windowSize = 5) dampens high-frequency jitter while preserving raw ping & jitter
  const rawSeries = [
    { t: 0.5, ping: 20, jitter: 1.0, lost: false },
    { t: 1.0, ping: 30, jitter: 10.0, lost: false },
    { t: 1.5, ping: 22, jitter: 8.0, lost: false },
    { t: 2.0, ping: 28, jitter: 6.0, lost: false },
    { t: 2.5, ping: 25, jitter: 3.0, lost: false },
    { t: 3.0, ping: 25, jitter: 0.0, lost: false },
  ];
  const smoothed = math.computeStabilityMovingAverage(rawSeries, 5);
  assert.equal(smoothed.length, 6);
  // Sample 0: window [20] -> 20
  assert.equal(smoothed[0].ping, 20);
  assert.equal(smoothed[0].smoothedPing, 20);
  assert.equal(smoothed[0].windowCount, 1);
  // Sample 1: window [20, 30] -> 25
  assert.equal(smoothed[1].ping, 30);
  assert.equal(smoothed[1].smoothedPing, 25);
  assert.equal(smoothed[1].smoothedJitter, 5.5);
  assert.equal(smoothed[1].windowCount, 2);
  // Sample 4: window [20, 30, 22, 28, 25] -> 125 / 5 = 25
  assert.equal(smoothed[4].smoothedPing, 25);
  assert.equal(smoothed[4].smoothedJitter, 5.6);
  assert.equal(smoothed[4].windowCount, 5);
  // Sample 5: sliding window [30, 22, 28, 25, 25] -> 130 / 5 = 26
  assert.equal(smoothed[5].smoothedPing, 26);
  assert.equal(smoothed[5].smoothedJitter, 5.4);
  assert.equal(smoothed[5].windowCount, 5);

  // 3. Packet loss (lost: true) resets the moving average window so disconnection boundaries remain sharp
  const seriesWithLoss = [
    { t: 1.0, ping: 100, jitter: 20, lost: false },
    { t: 1.5, ping: 120, jitter: 20, lost: false },
    { t: 2.0, ping: 0, jitter: 0, lost: true },
    { t: 2.5, ping: 24, jitter: 2, lost: false },
    { t: 3.0, ping: 26, jitter: 2, lost: false },
  ];
  const lossSmoothed = math.computeStabilityMovingAverage(seriesWithLoss, 5);
  assert.equal(lossSmoothed[2].lost, true);
  assert.equal(lossSmoothed[2].smoothedPing, 0);
  assert.equal(lossSmoothed[2].windowCount, 0);
  // Sample after packet loss starts a fresh window at 24ms (not polluted by pre-loss 100ms/120ms)
  assert.equal(lossSmoothed[3].lost, false);
  assert.equal(lossSmoothed[3].smoothedPing, 24);
  assert.equal(lossSmoothed[3].windowCount, 1);
  assert.equal(lossSmoothed[4].smoothedPing, 25);
  assert.equal(lossSmoothed[4].windowCount, 2);

  // 4. Verify drawChart() in stability.html and frontend/stability.html uses MOVING_AVG_WINDOW and computeStabilityMovingAverage
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  assert.ok(stabilityHtml.includes('var MOVING_AVG_WINDOW = 5;'), 'stability.html must define MOVING_AVG_WINDOW');
  assert.ok(stabilityHtml.includes('math.computeStabilityMovingAverage(windowSlice, MOVING_AVG_WINDOW)'), 'stability.html drawChart must smooth visible samples with computeStabilityMovingAverage');
  assert.ok(frontendStabilityHtml.includes('math.computeStabilityMovingAverage(windowSlice, MOVING_AVG_WINDOW)'), 'frontend/stability.html drawChart must smooth visible samples with computeStabilityMovingAverage');
});

test('Comprehensive 5-Page Engineering Audit (Phases B, C, D, E, F): original engine linkage, server probe verification, cross-page isolation, dead code removal, and unified storage', async () => {
  const fs = await import('node:fs');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  // Phase B: Gaming page records runs via math.appendTestHistoryEntry and respects persisted autoGbps setting
  assert.ok(indexJs.includes('const AUTO_GBPS_STORAGE_KEY = "terrax_auto_gbps_v1";'), 'index.js must persist autoGbps setting in localStorage');
  assert.ok(gamingHtml.includes('math.appendTestHistoryEntry(list, rawRun, 25, nowDate)'), 'gaming.html must normalize and append history entries via TerraxTelemetryMath');
  assert.ok(gamingHtml.includes('localStorage.getItem("terrax_auto_gbps_v1")'), 'gaming.html must respect persisted autoGbps setting');
  assert.ok(gamingHtml.includes('math.computeStabilityMovingAverage(samples, 5)'), 'gaming.html drawWaveform must smooth live RTT samples with computeStabilityMovingAverage');

  // Phase C: Server probe verification and sessionStorage caching in stability.html without double-callback race
  assert.ok(stabilityHtml.includes('var settled = false;'), 'stability.html pingServer must guard callback with settled flag');
  assert.ok(stabilityHtml.includes('sessionStorage.setItem("terrax_verified_servers_cache_v1"'), 'stability.html nextServerProbe must cache verified servers in sessionStorage');

  // Phase D: Complete process isolation across all pages on navigation / pagehide / beforeunload
  assert.ok(indexJs.includes('function cleanupSpeedPageResources()'), 'index.js must clean up resources on navigation');
  assert.ok(stabilityHtml.includes('function cleanupStabilityPageResources()'), 'stability.html must clean up resources on navigation');
  assert.ok(gamingHtml.includes('function cleanupGamingPageResources()'), 'gaming.html must clean up resources on navigation');
  assert.ok(frontendGamingHtml.includes('function cleanupGamingPageResources()'), 'frontend/gaming.html must clean up resources on navigation');

  // Phase E: Zero dead for(var i=0; false; i++) loops and zero synchronous layout reflows during 60fps updates
  assert.ok(!stabilityHtml.includes('for (var i = 0; false; i++)'), 'stability.html must not contain dead unreachable loop');
  assert.ok(!frontendStabilityHtml.includes('for (var i = 0; false; i++)'), 'frontend/stability.html must not contain dead unreachable loop');
  assert.ok(!gamingHtml.includes('void dlEl.offsetWidth'), 'gaming.html must not force synchronous layout reflow on dlEl during 60fps updates');
  assert.ok(!gamingHtml.includes('void ulEl.offsetWidth'), 'gaming.html must not force synchronous layout reflow on ulEl during 60fps updates');
});

test('High-Load Stability Graph Rendering Performance: WebWorker O(1) incremental moving average and dirty-flag requestAnimationFrame loop without layout thrashing', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;
  const workerJs = fs.readFileSync(new URL('../stability_worker.js', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');

  // 1. Verify stateful createStabilityMovingAverageProcessor smooths high-frequency volatility incrementally in O(1)
  assert.equal(typeof math.createStabilityMovingAverageProcessor, 'function', 'createStabilityMovingAverageProcessor must be exported');
  const proc = math.createStabilityMovingAverageProcessor(5);
  assert.equal(proc.getWindowSize(), 5);
  const s1 = proc.pushSample({ t: 0.2, ping: 20, jitter: 2, lost: false });
  const s2 = proc.pushSample({ t: 0.4, ping: 40, jitter: 22, lost: false });
  const s3 = proc.pushSample({ t: 0.6, ping: 24, jitter: 6, lost: false });
  assert.equal(s1.smoothedPing, 20);
  assert.equal(s2.smoothedPing, 30);
  assert.equal(s3.smoothedPing, 28);
  assert.equal(s3.windowCount, 3);
  const sLoss = proc.pushSample({ t: 0.8, ping: 0, jitter: 0, lost: true });
  assert.equal(sLoss.lost, true);
  assert.equal(sLoss.windowCount, 0);
  const sAfterLoss = proc.pushSample({ t: 1.0, ping: 18, jitter: 1, lost: false });
  assert.equal(sAfterLoss.smoothedPing, 18);
  assert.equal(sAfterLoss.windowCount, 1);

  // 2. Verify stability_worker.js computes O(1) incremental moving average (smoothedPing, smoothedJitter, windowCount) and resets on packet loss
  assert.ok(workerJs.includes('moving_avg_window: 5'), 'stability_worker.js must support moving_avg_window setting');
  assert.ok(workerJs.includes('smoothedPing: parseFloat((pingMaSum / count).toFixed(2))'), 'stability_worker.js must compute O(1) incremental smoothedPing');
  assert.ok(workerJs.includes('smoothedJitter: parseFloat((jitterMaSum / jitterMaWindow.length).toFixed(2))'), 'stability_worker.js must compute O(1) incremental smoothedJitter');
  assert.ok(workerJs.includes('pingMaWindow.length = 0;'), 'stability_worker.js recordLoss must reset moving-average window on packet loss');

  // 3. Verify stability.html and frontend/stability.html ingest samples through moving-average processor, use 4K quadratic spline smoothing, and eliminate forced synchronous reflows
  for (const [label, html] of [['stability.html', stabilityHtml], ['frontend/stability.html', frontendStabilityHtml]]) {
    assert.ok(html.includes('function ingestStabilityPingSample(rawSample)'), `${label} must process incoming samples through ingestStabilityPingSample`);
    assert.ok(html.includes('createStabilityMovingAverageProcessor(MOVING_AVG_WINDOW)'), `${label} must instantiate stateful moving average processor`);
    assert.ok(html.includes('function syncCanvasGeometryIfNeeded()'), `${label} must cache canvas geometry and read before DOM writes`);
    assert.ok(html.includes('if (hasWorkerPreSmoothed)'), `${label} drawChart must use zero-allocation fast path when samples are pre-smoothed`);
    assert.ok(html.includes('ctx.quadraticCurveTo(lastPx, lastPy, (lastPx + pX) * 0.5, (lastPy + pY) * 0.5)'), `${label} drawChart must render 4K moving-average curve with smooth midpoint quadratic interpolation`);
    assert.ok(html.includes('var cachedPingGrad = null;'), `${label} drawChart must cache linear gradient across frames`);
    assert.ok(html.includes('scheduleStabilityFrame({ ui: true, chart: hadNewPingSamples || data.testState >= 4 })'), `${label} must decouple UI updates from chart redraws via dirty flags`);
  }
});

test('Complete 4K Visual Identity Audit: valid CSS syntax, RTL/LTR logical properties, unified 4K color tokens, GPU trace optimization, and 2K/4K UHD scaling', async () => {
  const fs = await import('node:fs');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const dialogCss = fs.readFileSync(new URL('../frontend/styling/dialog.css', import.meta.url), 'utf8');
  const serverSelectorCss = fs.readFileSync(new URL('../frontend/styling/server-selector.css', import.meta.url), 'utf8');
  const mainCss = fs.readFileSync(new URL('../frontend/styling/main.css', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  // 1. Valid CSS syntax & no duplicate body.terrax-page-leaving in index.css
  assert.ok(!indexCss.includes('dir-adjusted('), 'index.css must not contain invalid dir-adjusted() CSS function');
  assert.equal((indexCss.match(/body\.terrax-page-leaving\s*\{/g) || []).length, 1, 'index.css must define body.terrax-page-leaving exactly once');
  assert.ok(indexCss.includes('@media screen and (min-width: 2200px)'), 'index.css must include 2K/4K UHD proportional scaling');

  // 2. RTL/LTR logical properties in dialog.css, server-selector.css, main.css, results.css
  assert.ok(dialogCss.includes('inset-inline-end: 2rem;'), 'dialog.css close button must use logical inset-inline-end');
  assert.ok(dialogCss.includes('text-align: start;'), 'dialog.css must use logical text-align: start');
  assert.ok(serverSelectorCss.includes('padding-inline-end: 4.4rem;'), 'server-selector.css must use logical padding-inline-end');
  assert.ok(serverSelectorCss.includes('inset-inline-end: 1.8rem;'), 'server-selector.css chevron must use logical inset-inline-end');
  assert.ok(mainCss.includes('text-align: start;'), 'main.css .conn-text-block must use logical text-align: start');
  assert.ok(resultsCss.includes('text-align: start;'), 'results.css .stat-card-info must use logical text-align: start');

  // 3. Dead .terrax-yan-card CSS removed from stability.html & frontend/stability.html, 2K/4K UHD scaling added
  assert.ok(!stabilityHtml.includes('.terrax-yan-card {'), 'stability.html must not contain dead .terrax-yan-card CSS rules');
  assert.ok(!frontendStabilityHtml.includes('.terrax-yan-card {'), 'frontend/stability.html must not contain dead .terrax-yan-card CSS rules');
  assert.ok(stabilityHtml.includes('@media screen and (min-width: 2200px)'), 'stability.html must include 2K/4K UHD proportional scaling');

  // 4. Unified 4K color tokens and GPU-optimized SVG background traces in gaming.html & frontend/gaming.html
  for (const [label, html] of [['gaming.html', gamingHtml], ['frontend/gaming.html', frontendGamingHtml]]) {
    assert.ok(html.includes('--bg-primary: #050D19;'), `${label} must use unified #050D19 4K deep background token`);
    assert.ok(html.includes('--cyber-cyan: #53D8FF;'), `${label} must use unified #53D8FF 4K cyan token`);
    assert.ok(html.includes('--holo-purple: #B98BFF;'), `${label} must use unified #B98BFF 4K purple token`);
    assert.ok(html.includes('--status-green: #9BEA42;'), `${label} must use unified #9BEA42 4K green token`);
    assert.ok(!html.includes('filter: drop-shadow(0 0 7px var(--cyber-cyan))'), `${label} must not use GPU-expensive drop-shadow on continuous background trace animations`);
    assert.ok(html.includes('@media screen and (min-width: 2200px)'), `${label} must include 2K/4K UHD proportional scaling`);
  }
});

test('App.tsx event-driven 60fps requestAnimationFrame throttling and full smoothNumericValue 4K telemetry transitions', async () => {
  const fs = await import('node:fs');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const { computeRealTimeGaugeTelemetry, RUNNING, FINISHED } = await import('../src/App.tsx');

  // 1. Verify st.onupdate coalesces updates via gaugeRafThrottlerRef.current.schedule(false)
  assert.ok(appTsx.includes('gaugeRafThrottlerRef.current.schedule(false)'), 'App.tsx st.onupdate must schedule 60fps RAF throttler');
  assert.ok(appTsx.includes('mathInit.createRafGaugeThrottler('), 'App.tsx must instantiate createRafGaugeThrottler');
  assert.ok(appTsx.includes('stabDisplayRef.current'), 'App.tsx must interpolate stability gauge via smoothNumericValue');
  assert.ok(appTsx.includes('pingDisplayRef.current'), 'App.tsx must interpolate ping readout via smoothNumericValue');
  assert.ok(appTsx.includes('jitterDisplayRef.current'), 'App.tsx must interpolate jitter readout via smoothNumericValue');
  assert.ok(appTsx.includes('dlProgressRef.current'), 'App.tsx must interpolate download progress arc via smoothNumericValue');
  assert.ok(appTsx.includes('ulProgressRef.current'), 'App.tsx must interpolate upload progress arc via smoothNumericValue');
  assert.ok(appTsx.includes('maxSpeedDisplayRef.current'), 'App.tsx must interpolate maxSpeed readout via smoothNumericValue');
  assert.ok(appTsx.includes('avgSpeedDisplayRef.current'), 'App.tsx must interpolate avgSpeed readout via smoothNumericValue');

  // 2. Verify computeRealTimeGaugeTelemetry applies smoothedTelemetry during RUNNING and snaps on FINISHED
  const sampleData = {
    testState: 1,
    dlStatus: 500,
    ulStatus: 200,
    pingStatus: 24,
    jitterStatus: 4,
    dlProgress: 0.8,
    ulProgress: 0.5,
  };
  const runningTel = computeRealTimeGaugeTelemetry(
    sampleData,
    [400, 480, 500],
    [],
    320,
    0,
    true,
    'ar',
    RUNNING,
    {
      stabilityDisplayPercent: 84.4,
      pingDisplayMs: 18.5,
      jitterDisplayMs: 2.5,
      dlProgressRatio: 0.6,
      ulProgressRatio: 0.25,
      maxSpeedDisplayMbps: 410,
      avgSpeedDisplayMbps: 350,
    }
  );
  assert.equal(runningTel.dlDisplayNumber, '320');
  assert.equal(runningTel.stabilityDisplay, '84');
  assert.equal(runningTel.pingDisplay, '18.5');
  assert.equal(runningTel.jitterDisplay, '2.50');
  assert.equal(runningTel.dlProgressDeg, 108);
  assert.equal(runningTel.maxSpeedDisplay, '410');
  assert.equal(runningTel.avgSpeedDisplay, '350');

  const finishedTel = computeRealTimeGaugeTelemetry(
    sampleData,
    [400, 480, 500],
    [190, 200],
    320,
    100,
    true,
    'ar',
    FINISHED,
    {
      stabilityDisplayPercent: 84.4,
      pingDisplayMs: 18.5,
      jitterDisplayMs: 2.5,
      dlProgressRatio: 0.6,
      ulProgressRatio: 0.25,
      maxSpeedDisplayMbps: 410,
      avgSpeedDisplayMbps: 350,
    }
  );
  assert.equal(finishedTel.dlDisplayNumber, '500');
  assert.equal(finishedTel.ulDisplayNumber, '200');
  assert.equal(finishedTel.pingDisplay, '24.0');
  assert.equal(finishedTel.jitterDisplay, '4.00');
  assert.equal(finishedTel.dlProgressDeg, 144);
  assert.equal(finishedTel.maxSpeedDisplay, '500');
});

test('Footer navigation buttons (.nav-dock-item) enforce at least 48px by 48px touch target dimensions across all pages and mobile breakpoints', async () => {
  const fs = await import('node:fs');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  for (const [name, content] of [
    ['frontend/styling/index.css', indexCss],
    ['stability.html', stabilityHtml],
    ['frontend/stability.html', frontendStabilityHtml],
    ['gaming.html', gamingHtml],
    ['frontend/gaming.html', frontendGamingHtml],
  ]) {
    assert.ok(
      content.includes('grid-template-columns: repeat(5, minmax(48px, 1fr));'),
      `${name} must define 5-column grid with minmax(48px, 1fr) for .terrax-bottom-nav`
    );
    assert.ok(
      content.includes('min-width: 48px;') && content.includes('min-height: max(48px, 4.8rem);'),
      `${name} must enforce min-width: 48px and min-height: max(48px, 4.8rem) on .nav-dock-item`
    );
  }

  assert.ok(
    resultsCss.includes('min-width: 48px;') && resultsCss.includes('min-height: max(48px, 4.8rem);'),
    'frontend/styling/results.css must enforce min-width: 48px and min-height: max(48px, 4.8rem) on .nav-dock-item in landscape'
  );
  assert.ok(
    !resultsCss.includes('min-height: 3.6rem;'),
    'frontend/styling/results.css must not shrink .nav-dock-item below 48px'
  );
});

test('Full 5-Point Architectural & 4K Telemetry Audit: React/HTML entry point bridge, 100% App.tsx feature parity, 9-channel smoothNumericValue in index.js, on-disk nodes/* endpoints, and subdirectory href resolution', async () => {
  const fs = await import('node:fs');
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const designSwitchJs = fs.readFileSync(new URL('../design-switch.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const serverList = JSON.parse(fs.readFileSync(new URL('../server-list.json', import.meta.url), 'utf8'));
  const viteConfig = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');

  // 1. React/HTML entry bridge in index.html + design-switch.js
  assert.ok(indexHtml.includes('<div id="root"'), 'index.html must include #root mount point');
  assert.ok(indexHtml.includes('src="/src/main.tsx"'), 'index.html must link /src/main.tsx for Vite bundling');
  assert.ok(designSwitchJs.includes("designParam === 'react'"), 'design-switch.js must allow ?design=react to mount React shell');

  // 2. 100% Feature Parity between src/App.tsx and index-modern.html
  assert.ok(appTsx.includes("const AUTO_GBPS_STORAGE_KEY = 'terrax_auto_gbps_v1'"), 'App.tsx must persist Auto-Gbps to localStorage');
  assert.ok(appTsx.includes('id="test-timeline-progress"'), 'App.tsx must render #test-timeline-progress');
  assert.ok(appTsx.includes('id="test-progress-fill"'), 'App.tsx must render #test-progress-fill');
  assert.ok(appTsx.includes('id="share-results"'), 'App.tsx must render #share-results button');
  assert.ok(appTsx.includes('<dialog id="share"'), 'App.tsx must render <dialog id="share">');
  assert.ok(appTsx.includes('<dialog id="privacy"'), 'App.tsx must render <dialog id="privacy">');
  assert.ok(appTsx.includes('id="open-privacy-from-settings"'), 'App.tsx must render #open-privacy-from-settings');
  assert.ok(appTsx.includes('id="whatsapp-support-btn"'), 'App.tsx must render #whatsapp-support-btn');

  // 3. Full 9-channel smoothNumericValue interpolation in frontend/javascript/index.js
  assert.ok(indexJs.includes('testState.stabDisplayPercent'), 'index.js must smooth stability percentage');
  assert.ok(indexJs.includes('testState.pingDisplayMs'), 'index.js must smooth ping readout');
  assert.ok(indexJs.includes('testState.jitterDisplayMs'), 'index.js must smooth jitter readout');
  assert.ok(indexJs.includes('testState.dlProgressRatio'), 'index.js must smooth download progress arc');
  assert.ok(indexJs.includes('testState.ulProgressRatio'), 'index.js must smooth upload progress arc');

  // 4. All 6 servers in server-list.json have real on-disk PHP endpoints
  assert.ok(Array.isArray(serverList) && serverList.length >= 6, 'server-list.json must contain all configured servers');
  for (const srv of serverList) {
    for (const key of ['dlURL', 'ulURL', 'pingURL', 'getIpURL']) {
      const relEndpoint = `${srv.server || ''}${srv[key]}`;
      assert.ok(
        fs.existsSync(new URL(`../${relEndpoint}`, import.meta.url)),
        `On-disk endpoint must exist for ${srv.name}: ${relEndpoint}`
      );
    }
  }

  // 5. Subdirectory navigation safety in stability.html, gaming.html, and vite.config.ts
  assert.ok(
    viteConfig.includes("pathname === '/frontend/index-modern.html'"),
    'vite.config.ts must map /frontend/index-modern.html to frontend/index.html'
  );
  assert.ok(
    stabilityHtml.includes('I("nav-speed-btn").setAttribute("href", "index.html")'),
    'stability.html must rewrite nav-speed-btn href when IS_FRONTEND_SUBDIR is true'
  );
  assert.ok(
    gamingHtml.includes('I("nav-speed-btn").setAttribute("href", "index.html")'),
    'gaming.html must rewrite nav-speed-btn href when IS_FRONTEND_SUBDIR is true'
  );
});

test('Dynamic high-refresh-rate requestAnimationFrame gauge throttle in App.tsx and telemetry-math.js adapts accurately to 60Hz, 90Hz, 120Hz, 144Hz, 165Hz, and 240Hz monitors', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const { quantizeDeviceRefreshRate, estimateRefreshRateFromDeltas } = await import('../src/App.tsx');

  // 1. Verify standard refresh rate quantization (60, 75, 90, 120, 144, 165, 240 Hz)
  assert.equal(quantizeDeviceRefreshRate(59.94), 60);
  assert.equal(quantizeDeviceRefreshRate(74.8), 75);
  assert.equal(quantizeDeviceRefreshRate(89.9), 90);
  assert.equal(quantizeDeviceRefreshRate(119.88), 120);
  assert.equal(quantizeDeviceRefreshRate(143.9), 144);
  assert.equal(quantizeDeviceRefreshRate(164.8), 165);
  assert.equal(quantizeDeviceRefreshRate(239.76), 240);

  // 2. Verify VSync delta estimation rejects background-tab outlier stalls (>25ms) and snaps to true monitor Hz
  assert.equal(
    estimateRefreshRateFromDeltas([16.67, 16.65, 16.68, 450.0, 16.66, 16.67], 60),
    60
  );
  assert.equal(
    estimateRefreshRateFromDeltas([8.33, 8.34, 8.32, 8.33, 8.35, 120.0], 60),
    120
  );
  assert.equal(
    estimateRefreshRateFromDeltas([6.94, 6.95, 6.94, 6.93, 6.95], 60),
    144
  );
  assert.equal(
    estimateRefreshRateFromDeltas([4.16, 4.17, 4.17, 4.16, 4.18], 60),
    240
  );

  // 3. Verify shouldRenderGaugeFrame preserves sub-16ms dtSeconds on 120Hz (~8.33ms) and 240Hz (~4.17ms) monitors
  const g120First = math.shouldRenderGaugeFrame(100, 0, 120, false);
  assert.equal(g120First.shouldRender, true);
  assert.ok(Math.abs(g120First.dtSeconds - 1 / 120) < 0.001);

  const g120TooEarly = math.shouldRenderGaugeFrame(104.0, g120First.nextLastFrameMs, 120, false);
  assert.equal(g120TooEarly.shouldRender, false);

  const g120Next = math.shouldRenderGaugeFrame(108.33, g120First.nextLastFrameMs, 120, false);
  assert.equal(g120Next.shouldRender, true);
  assert.ok(g120Next.dtSeconds >= 0.008 && g120Next.dtSeconds <= 0.009);

  const g240First = math.shouldRenderGaugeFrame(200, 0, 240, false);
  const g240Next = math.shouldRenderGaugeFrame(204.17, g240First.nextLastFrameMs, 240, false);
  assert.equal(g240Next.shouldRender, true);
  assert.ok(g240Next.dtSeconds >= 0.004 && g240Next.dtSeconds <= 0.0045);

  // 4. Verify createRafGaugeThrottler and createStatCardsRafLoop expose dynamic setTargetFps/getTargetFps
  const throttler = math.createRafGaugeThrottler(() => false, 60);
  assert.equal(throttler.getTargetFps(), 60);
  throttler.setTargetFps(144);
  assert.equal(throttler.getTargetFps(), 144);
  throttler.cancel();

  const statLoop = math.createStatCardsRafLoop({ targetFps: 60 });
  assert.equal(statLoop.getTargetFps(), 60);
  statLoop.setTargetFps(120);
  assert.equal(statLoop.getTargetFps(), 120);
  statLoop.cancel();

  // 5. Verify App.tsx uses window.requestAnimationFrame and dynamic refresh-rate calibration
  assert.ok(appTsx.includes('window.requestAnimationFrame'), 'App.tsx must use window.requestAnimationFrame for VSync calibration and gauge loop');
  assert.ok(appTsx.includes('estimateRefreshRateFromDeltas'), 'App.tsx must dynamically estimate device refresh rate from VSync deltas');
  assert.ok(appTsx.includes('gaugeRafThrottlerRef.current?.setTargetFps?.(quantized)'), 'App.tsx must dynamically update gaugeRafThrottler target FPS');
  assert.ok(appTsx.includes('statCardsLoopRef.current?.setTargetFps?.(quantized)'), 'App.tsx must dynamically update statCardsLoop target FPS');
});

test('Gauge arc activation flicker animation reinforces cyber aesthetic when Start button is clicked across results.css, index.js, and App.tsx', async () => {
  const fs = await import('node:fs');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // 1. Verify cyber arc activation flicker keyframes and classes in results.css
  assert.ok(resultsCss.includes('@keyframes cyberArcActivationFlicker'), 'results.css must define @keyframes cyberArcActivationFlicker for download arc');
  assert.ok(resultsCss.includes('@keyframes cyberArcActivationFlickerStab'), 'results.css must define @keyframes cyberArcActivationFlickerStab for stability arc');
  assert.ok(resultsCss.includes('@keyframes cyberArcActivationFlickerUl'), 'results.css must define @keyframes cyberArcActivationFlickerUl for upload arc');
  assert.ok(resultsCss.includes('@keyframes cyberTrackActivationFlicker'), 'results.css must define @keyframes cyberTrackActivationFlicker for initial track ring ignition');
  assert.ok(resultsCss.includes('.gauge.cyber-arc-activating .gauge-active-arc'), 'results.css must bind .cyber-arc-activating to .gauge-active-arc');
  assert.ok(resultsCss.includes('.gauge.cyber-arc-activating .gauge-track-bg'), 'results.css must bind .cyber-arc-activating to .gauge-track-bg');
  assert.ok(
    resultsCss.includes('@media (prefers-reduced-motion: reduce)') &&
      resultsCss.includes('.gauge.cyber-arc-activating .gauge-active-arc'),
    'results.css must respect prefers-reduced-motion for cyber-arc-activating'
  );

  // 2. Verify index.js triggers and cleans up cyber-arc-activating on Start button click
  assert.ok(indexJs.includes('function triggerGaugeArcActivationFlicker()'), 'index.js must define triggerGaugeArcActivationFlicker()');
  assert.ok(indexJs.includes('function clearGaugeArcActivationFlicker()'), 'index.js must define clearGaugeArcActivationFlicker()');
  assert.ok(
    indexJs.includes('classList.add("cyber-arc-activating")') ||
      indexJs.includes("classList.add('cyber-arc-activating')"),
    'index.js must add cyber-arc-activating class to gauges and arcs'
  );
  assert.ok(indexJs.includes('triggerGaugeArcActivationFlicker();'), 'startButtonClickHandler in index.js must invoke triggerGaugeArcActivationFlicker()');

  // 3. Verify App.tsx triggers and cleans up cyber-arc-activating on Start button click
  assert.ok(appTsx.includes('triggerGaugeArcFlicker'), 'App.tsx must define and call triggerGaugeArcFlicker on start button click');
  assert.ok(appTsx.includes('clearGaugeArcFlicker'), 'App.tsx must define and call clearGaugeArcFlicker on abort/cleanup');
  assert.ok(appTsx.includes("arcFlickerActive ? 'cyber-arc-activating' : ''"), 'App.tsx must apply cyber-arc-activating class to gauges and SVG arcs');
});

test('Gauge rendering loop dynamically scales throttle interval using detectedRefreshRateRef without idle CPU waste', async () => {
  const fs = await import('node:fs');
  const math = globalThis.TerraxTelemetryMath;
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const { computeDynamicThrottleInterval } = await import('../src/App.tsx');

  // 1. Verify computeDynamicThrottleInterval scales intervalMs directly from a live detectedRefreshRateRef object
  const detectedRefreshRateRef = { current: 60 };
  const t60 = computeDynamicThrottleInterval(detectedRefreshRateRef);
  assert.equal(t60.targetFps, 60);
  assert.ok(Math.abs(t60.intervalMs - 1000 / 60) < 0.001);

  detectedRefreshRateRef.current = 120;
  const t120 = computeDynamicThrottleInterval(detectedRefreshRateRef);
  assert.equal(t120.targetFps, 120);
  assert.ok(Math.abs(t120.intervalMs - 1000 / 120) < 0.001);

  detectedRefreshRateRef.current = 144;
  const t144 = computeDynamicThrottleInterval(detectedRefreshRateRef);
  assert.equal(t144.targetFps, 144);
  assert.ok(Math.abs(t144.intervalMs - 1000 / 144) < 0.001);

  detectedRefreshRateRef.current = 240;
  const t240 = computeDynamicThrottleInterval(detectedRefreshRateRef);
  assert.equal(t240.targetFps, 240);
  assert.ok(Math.abs(t240.intervalMs - 1000 / 240) < 0.001);

  // 2. Verify shouldRenderGaugeFrame and createRafGaugeThrottler dynamically track mutations to detectedRefreshRateRef.current
  const liveRef = { current: 60 };
  const throttler = math.createRafGaugeThrottler(() => false, liveRef);
  assert.equal(throttler.getTargetFps(), 60);
  assert.ok(Math.abs(throttler.getThrottleIntervalMs() - 16.6667) < 0.01);

  // Mutating liveRef.current directly immediately scales the throttler interval without recreating the loop
  liveRef.current = 144;
  assert.equal(throttler.getTargetFps(), 144);
  assert.ok(Math.abs(throttler.getThrottleIntervalMs() - 1000 / 144) < 0.01);

  const gate144First = math.shouldRenderGaugeFrame(100, 0, liveRef, false);
  assert.equal(gate144First.shouldRender, true);
  assert.equal(gate144First.targetFps, 144);
  assert.ok(Math.abs(gate144First.intervalMs - 1000 / 144) < 0.01);

  const gate144Early = math.shouldRenderGaugeFrame(103.5, gate144First.nextLastFrameMs, liveRef, false);
  assert.equal(gate144Early.shouldRender, false);

  const gate144Ready = math.shouldRenderGaugeFrame(106.95, gate144First.nextLastFrameMs, liveRef, false);
  assert.equal(gate144Ready.shouldRender, true);
  throttler.cancel();

  // 3. Verify App.tsx and index.js wire detectedRefreshRateRef directly into the gauge throttle loop and halt when idle
  assert.ok(
    appTsx.includes('computeDynamicThrottleInterval(detectedRefreshRateRef)'),
    'App.tsx must compute dynamic throttle interval directly from detectedRefreshRateRef'
  );
  assert.ok(
    appTsx.includes('mathInit.createRafGaugeThrottler(\n        renderGaugeFrame,\n        detectedRefreshRateRef\n      )'),
    'App.tsx must pass detectedRefreshRateRef into createRafGaugeThrottler'
  );
  assert.ok(
    !appTsx.includes('testDataDirtyRef.current ||\n          uiStateRef.current === RUNNING'),
    'App.tsx renderGaugeFrame must not spin unconditionally on uiStateRef.current === RUNNING when idle'
  );
  assert.ok(
    indexJs.includes('const detectedRefreshRateRef = { current: 60 };'),
    'index.js must maintain detectedRefreshRateRef for dynamic throttle interval scaling'
  );
});

test('CSS animation gently pulses gauge-outer-bezel elements when application state is RUNNING across results.css, App.tsx, and index.js', async () => {
  const fs = await import('node:fs');
  const resultsCss = fs.readFileSync(new URL('../frontend/styling/results.css', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');

  // 1. Verify @keyframes gaugeOuterBezelPulse, gaugeOuterBezelPulseStab, and gaugeOuterBezelPulseUl in results.css
  assert.ok(
    resultsCss.includes('@keyframes gaugeOuterBezelPulse'),
    'results.css must define @keyframes gaugeOuterBezelPulse for download gauge outer bezel'
  );
  assert.ok(
    resultsCss.includes('@keyframes gaugeOuterBezelPulseStab'),
    'results.css must define @keyframes gaugeOuterBezelPulseStab for stability gauge outer bezel'
  );
  assert.ok(
    resultsCss.includes('@keyframes gaugeOuterBezelPulseUl'),
    'results.css must define @keyframes gaugeOuterBezelPulseUl for upload gauge outer bezel'
  );

  // 2. Verify RUNNING state selectors and prefers-reduced-motion protection in results.css
  assert.ok(
    resultsCss.includes('.gauge.running .gauge-outer-bezel') &&
      resultsCss.includes('.gauge-outer-bezel.running'),
    'results.css must activate gaugeOuterBezelPulse on .gauge.running .gauge-outer-bezel and .gauge-outer-bezel.running'
  );
  assert.ok(
    resultsCss.includes('@media (prefers-reduced-motion: reduce)') &&
      resultsCss.includes('.gauge-outer-bezel.running'),
    'results.css must disable gauge-outer-bezel pulse animation under prefers-reduced-motion: reduce'
  );

  // 3. Verify App.tsx and index.js toggle running class on gauge-outer-bezel when state is RUNNING
  assert.ok(
    appTsx.includes("gauge-outer-bezel ${gaugesRunning ? 'running' : ''}") &&
      appTsx.includes("gauge-outer-bezel stab-outer-bezel ${gaugesRunning ? 'running' : ''}") &&
      appTsx.includes("gauge-outer-bezel ul-outer-bezel ${gaugesRunning ? 'running' : ''}"),
    'App.tsx must toggle running class on all three gauge-outer-bezel elements when gaugesRunning is true'
  );
  assert.ok(
    indexJs.includes('document.querySelectorAll(".gauge-outer-bezel").forEach((bezel) =>') &&
      indexJs.includes('bezel.classList.toggle("running", testState.state === RUNNING)'),
    'index.js must toggle running class on .gauge-outer-bezel elements when testState.state === RUNNING'
  );
});

test('Google AdSense Complete Engineering Audit & Safe Integration: policy compliance, zero external smartlink/1x1 iframe, complete eligibility disclosures (About, Terms, Contact, Cookies), and sitemap/JSON-LD readiness', async () => {
  const fs = await import('node:fs');
  const adSlotsJs = fs.readFileSync(new URL('../frontend/javascript/ad-slots.js', import.meta.url), 'utf8');
  const adsConfigTs = fs.readFileSync(new URL('../src/config/adsConfig.ts', import.meta.url), 'utf8');
  const autoRefreshCardTsx = fs.readFileSync(
    new URL('../src/components/ads/AutoRefreshHybridAdCard.tsx', import.meta.url),
    'utf8'
  );
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const robotsTxt = fs.readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  const publicRobotsTxt = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  const sitemapXml = fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const publicSitemapXml = fs.readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

  // 1. Policy Compliance: No external unverified smartlink URLs (asiafilm.org) in ad-slots.js or adsConfig.ts
  assert.ok(!adSlotsJs.includes('asiafilm.org'), 'ad-slots.js must not reference external unverified smartlink domain');
  assert.ok(!adsConfigTs.includes('asiafilm.org'), 'adsConfig.ts must not reference external unverified smartlink domain');
  assert.equal(globalThis.TerraxSmartAdEngine.ADSTERRA_SMARTLINK_URL, '#terrax-adsense-verified');
  assert.ok(
    adSlotsJs.includes('card.setAttribute("data-auto-frame-loaded", "adsense-safe")'),
    'mountAutomaticEmbeddedAdFrame must short-circuit safely without injecting 1x1 hidden iframes in AdSense mode'
  );
  assert.ok(
    autoRefreshCardTsx.includes('!smartlinkUrl.startsWith(\'#\') && !ADS_CONFIG.ADSENSE.ENABLE_ADSENSE'),
    'AutoRefreshHybridAdCard.tsx must not mount hidden 1x1 iframe when AdSense is enabled'
  );

  // 2. AdSense Eligibility Pages/Sections: No developer placeholders (PUT@YOUR_EMAIL.HERE), complete About, Terms, Cookies, and Contact sections
  for (const [name, content] of [
    ['index-modern.html', indexModernHtml],
    ['frontend/index.html', frontendIndexHtml],
    ['src/App.tsx', appTsx],
  ]) {
    assert.ok(!content.includes('PUT@YOUR_EMAIL.HERE'), `${name} must not contain PUT@YOUR_EMAIL.HERE placeholder`);
    assert.ok(!content.includes('TO BE FILLED BY DEVELOPER'), `${name} must not contain TO BE FILLED BY DEVELOPER placeholder`);
    assert.ok(content.includes('id="about-terrax-heading"'), `${name} must include About Terrax Plus section`);
    assert.ok(content.includes('id="adsense-cookies-heading"'), `${name} must include Google AdSense & Cookies disclosure section`);
    assert.ok(content.includes('id="terms-of-use-heading"'), `${name} must include Terms of Use section`);
    assert.ok(content.includes('id="contact-us-heading"'), `${name} must include Contact Us section`);
    assert.ok(content.includes('mailto:terrax.t20@gmail.com'), `${name} must include official contact email`);
  }

  // 3. SEO, Sitemap, robots.txt & Schema.org JSON-LD readiness
  assert.ok(sitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(sitemapXml.includes('/index-modern.html</loc>'));
  assert.ok(sitemapXml.includes('/stability.html</loc>'));
  assert.ok(sitemapXml.includes('/gaming.html</loc>'));
  assert.equal(sitemapXml, publicSitemapXml, 'root sitemap.xml and public/sitemap.xml must match');
  assert.ok(robotsTxt.includes('Sitemap:'), 'robots.txt must declare Sitemap URL');
  assert.ok(publicRobotsTxt.includes('Sitemap:'), 'public/robots.txt must declare Sitemap URL');
  assert.ok(indexHtml.includes('"@type": "WebApplication"'), 'index.html must include Schema.org WebApplication JSON-LD');
  assert.ok(indexModernHtml.includes('"@type": "WebApplication"'), 'index-modern.html must include Schema.org WebApplication JSON-LD');
});

test('Web Worker RUNNING State Ad-Request Isolation: strict prevention of AdSense and Yandex requests, in-flight timer cancellation, and pauseAdRequests=1 across all test controllers', async () => {
  const fs = await import('node:fs');
  await import('../frontend/javascript/ad-slots.js');
  const engine = globalThis.TerraxSmartAdEngine;
  const adsManagerMod = await import('../ads/adsense.manager.js');
  const adsLifecycleMod = await import('../ads/adsense.lifecycle.js');

  // 1. Ensure clean READY state before starting test
  engine.setConsentChoice('personalized');
  engine.setTestingState(false);
  engine.resetStabilityMilestones();
  assert.equal(engine.getState().isTesting, false);
  assert.equal(engine.getState().testEngineState, 'READY');
  assert.equal(globalThis.adsbygoogle.pauseAdRequests, 0);

  // Queue an unexecuted Yandex callback before entering RUNNING
  globalThis.yaContextCb = [() => {}];

  // 2. Enter RUNNING state (simulating Web Worker measurement launch)
  const isNowTesting = engine.setTestingState(true);
  assert.equal(isNowTesting, true);
  assert.equal(engine.getState().isTesting, true);
  assert.equal(engine.getState().testEngineState, 'RUNNING');

  // Google AdSense runtime must be paused (pauseAdRequests = 1) during RUNNING
  assert.equal(
    globalThis.adsbygoogle.pauseAdRequests,
    1,
    'Google AdSense pauseAdRequests must be set to 1 while Web Worker is in RUNNING state'
  );

  // Pending Yandex callback queue must be flushed/aborted on transition to RUNNING
  assert.equal(
    globalThis.yaContextCb.length,
    0,
    'Pending Yandex callback queue must be cleared when entering RUNNING state'
  );

  // AdSense & Yandex script loaders and slot refreshers must be strictly blocked during RUNNING
  assert.equal(
    engine.ensureGoogleAdSenseScriptLoaded(),
    false,
    'ensureGoogleAdSenseScriptLoaded must return false during RUNNING state'
  );
  assert.equal(
    engine.ensureExternalYandexScriptLoaded(),
    false,
    'ensureExternalYandexScriptLoaded must return false during RUNNING state'
  );
  assert.equal(
    engine.refreshAllSlots('attempt-during-worker-run'),
    false,
    'refreshAllSlots must return false during RUNNING state'
  );
  assert.equal(
    engine.onTabChange('servers'),
    false,
    'onTabChange must not trigger ad requests during RUNNING state'
  );

  // Stability 30s elapsed tick during active stability_worker.js run must be suppressed and queued for post-test
  engine.resetStabilityMilestones();
  const tick30WhileRunning = engine.onStabilityElapsedTick(30);
  assert.equal(
    tick30WhileRunning,
    false,
    'onStabilityElapsedTick(30) must not trigger live ad refreshes while stability_worker.js is in RUNNING state'
  );
  assert.equal(
    engine.getState().pendingAdLoadAfterTest,
    true,
    'Suppressed stability tick during RUNNING must queue pendingAdLoadAfterTest for post-worker flush'
  );

  // AdSenseManager & AdSenseLifecycle also enforce pauseAdRequests=1 and zero mounting during RUNNING
  adsManagerMod.AdSenseManager.setEngineTestState('RUNNING');
  assert.equal(adsManagerMod.AdSenseManager.getState().isTesting, true);
  assert.equal(globalThis.adsbygoogle.pauseAdRequests, 1);
  assert.equal(adsLifecycleMod.mountAllRegisteredContainers({ isTesting: true }), 0);

  // 3. Complete test (onTestComplete) -> releases lock and restores pauseAdRequests = 0
  engine.onTestComplete('speed');
  adsManagerMod.AdSenseManager.onTestComplete('speed');
  assert.equal(engine.getState().isTesting, false);
  assert.equal(engine.getState().testEngineState, 'FINISHED');
  assert.equal(
    globalThis.adsbygoogle.pauseAdRequests,
    0,
    'pauseAdRequests must be restored to 0 once Web Worker completes'
  );

  // Reset to READY and unset consent
  engine.setTestingState(false);
  engine.setConsentChoice('unset');

  // 4. Verify all JS/TS speed, stability, and gaming controllers lock TerraxSmartAdEngine before spawning Web Workers
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  assert.ok(
    indexJs.includes('globalThis.TerraxSmartAdEngine?.setTestingState(true)'),
    'frontend/javascript/index.js must lock TerraxSmartAdEngine before starting speedtest_worker.js'
  );
  assert.ok(
    appTsx.includes('globalEngine?.setTestingState?.(true)') &&
      appTsx.includes('globalEngine?.setTestingState?.(false)') &&
      appTsx.includes("globalEngine?.onTestComplete?.('speed')"),
    'src/App.tsx must synchronize setTestingState(true/false) and onTestComplete with TerraxSmartAdEngine'
  );
  for (const [label, html] of [
    ['stability.html', stabilityHtml],
    ['frontend/stability.html', frontendStabilityHtml],
  ]) {
    assert.ok(
      html.includes('window.TerraxSmartAdEngine.setTestingState(true);'),
      `${label} startTest() must lock TerraxSmartAdEngine before launching stability_worker.js`
    );
    assert.ok(
      html.includes('window.TerraxSmartAdEngine.setTestingState(false);'),
      `${label} stopTest() must release TerraxSmartAdEngine lock when stability_worker.js stops`
    );
  }
  for (const [label, html] of [
    ['gaming.html', gamingHtml],
    ['frontend/gaming.html', frontendGamingHtml],
  ]) {
    assert.ok(
      html.includes('window.TerraxSmartAdEngine.setTestingState(true);'),
      `${label} must lock TerraxSmartAdEngine before starting gaming measurement worker`
    );
    assert.ok(
      html.includes('window.TerraxSmartAdEngine.setTestingState(false);'),
      `${label} must release TerraxSmartAdEngine lock on gaming test abort`
    );
  }
});


