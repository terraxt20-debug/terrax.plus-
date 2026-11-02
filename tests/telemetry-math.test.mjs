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

test('Yandex RTB Smart State-Driven Ad Engine integrates Network Isolation Lock, 30s/60s Stability refresh, and 4K Glassmorphic cards', async () => {
  const fs = await import('node:fs');
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const adSlotsJs = fs.readFileSync(new URL('../frontend/javascript/ad-slots.js', import.meta.url), 'utf8');
  const indexCss = fs.readFileSync(new URL('../frontend/styling/index.css', import.meta.url), 'utf8');
  const indexJs = fs.readFileSync(new URL('../frontend/javascript/index.js', import.meta.url), 'utf8');
  const yandexSmartAdTsx = fs.readFileSync(new URL('../src/components/YandexSmartAd.tsx', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // 1. Yandex RTB async script in <head>
  for (const html of [indexHtml, indexModernHtml, frontendIndexHtml, stabilityHtml, gamingHtml]) {
    assert.ok(html.includes('<script>window.yaContextCb=window.yaContextCb||[]</script>'));
    assert.ok(html.includes('<script src="https://yandex.ru/ads/system/context.js" async></script>'));
  }
  for (const markup of [indexModernHtml, frontendIndexHtml, stabilityHtml, gamingHtml, yandexSmartAdTsx]) {
    assert.ok(markup.includes('terrax-yan-card'));
  }

  // 2. Network Isolation Lock & Smart Refresh in ad-slots.js and YandexSmartAd.tsx
  assert.ok(adSlotsJs.includes('Ya.Context.AdvManager.render'));
  assert.ok(adSlotsJs.includes('برعاية تقنية • Terrax Partner'));
  assert.ok(adSlotsJs.includes('🛡️ وضع العزل الشبكي نشط لضمان دقة الفحص'));
  assert.ok(adSlotsJs.includes('onStabilityElapsedTick'));
  assert.ok(adSlotsJs.includes('onTestComplete'));
  assert.ok(adSlotsJs.includes('onTabChange'));

  assert.ok(yandexSmartAdTsx.includes('Ya.Context.AdvManager.render'));
  assert.ok(yandexSmartAdTsx.includes('برعاية تقنية • Terrax Partner'));
  assert.ok(yandexSmartAdTsx.includes('🛡️ وضع العزل الشبكي نشط لضمان دقة الفحص'));
  assert.ok(yandexSmartAdTsx.includes('30000'));
  assert.ok(yandexSmartAdTsx.includes('60000'));
  assert.ok(appTsx.includes('<YandexSmartAd'));

  // 3. Glassmorphic CSS rules
  assert.ok(indexCss.includes('rgba(11, 27, 50, 0.70)'));
  assert.ok(indexCss.includes('backdrop-filter: blur(12px)'));
  assert.ok(indexCss.includes('1px solid rgba(0, 210, 255, 0.25)'));
  assert.ok(indexCss.includes('border-radius: 14px'));
  assert.ok(indexCss.includes('min-height: 95px'));

  // 4. State-driven hooks in index.js, stability.html, and gaming.html
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.setTestingState(true)'));
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.onTestComplete("speed")'));
  assert.ok(indexJs.includes('TerraxSmartAdEngine?.onTabChange("speed")'));
  assert.ok(stabilityHtml.includes('onStabilityElapsedTick(data.elapsed)'));
  assert.ok(gamingHtml.includes('onTestComplete("gaming")'));

  // 5. Hybrid Adsterra Smartlink (2-second / AdBlocker fallback) & official Smartlink URL
  const officialSmartlink = 'https://asiafilm.org/4/f40a6dd77b401726a12dd304a72bafa5';
  assert.ok(adSlotsJs.includes(officialSmartlink));
  assert.ok(adSlotsJs.includes('YANDEX_FALLBACK_TIMEOUT_MS = 2000'));
  assert.ok(yandexSmartAdTsx.includes(officialSmartlink));
  assert.ok(yandexSmartAdTsx.includes('YANDEX_FALLBACK_TIMEOUT_MS = 2000'));
  assert.ok(appTsx.includes('ADSTERRA_SMARTLINK_URL'));

  for (const html of [indexModernHtml, frontendIndexHtml, stabilityHtml, gamingHtml]) {
    assert.ok(html.includes(officialSmartlink));
    assert.ok(html.includes('terrax-yan-sponsor-fallback'));
    assert.ok(!html.includes('عرض الشريك'));
    assert.ok(!html.includes('terrax-yan-direct-partner-link'));
  }

  assert.ok(!adSlotsJs.includes('عرض الشريك'));
  assert.ok(!yandexSmartAdTsx.includes('عرض الشريك'));
  assert.ok(!yandexSmartAdTsx.includes('terrax-yan-direct-partner-link'));
  assert.ok(appTsx.includes('YANDEX_SILENT_REFRESH_INTERVAL_MS = 30000'));
  assert.ok(appTsx.includes('refreshYandexAdUnits'));
  assert.ok(appTsx.includes('window.setInterval'));

  // Verify runtime behavior of TerraxSmartAdEngine (Network Isolation Lock & Smartlink constants)
  const adEngine = await import('../frontend/javascript/ad-slots.js');
  const engineApi = adEngine.default || globalThis.TerraxSmartAdEngine;
  assert.equal(engineApi.ADSTERRA_SMARTLINK_URL, officialSmartlink);
  assert.equal(engineApi.YANDEX_FALLBACK_TIMEOUT_MS, 2000);
  assert.equal(engineApi.AUTO_AD_ROTATION_INTERVAL_MS, 30000);

  engineApi.setTestingState(true);
  assert.equal(engineApi.getState().isTesting, true);
  assert.equal(engineApi.refreshAllSlots('blocked-during-test'), false);

  engineApi.setTestingState(false);
  assert.equal(engineApi.getState().isTesting, false);
  assert.equal(engineApi.refreshAllSlots('allowed-after-test'), true);
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

test('Comprehensive Smart Ad Architecture (adsConfig, HybridSmartAdCard, GamingRadarBoosterCard, and 4-location distribution map)', async () => {
  const fs = await import('node:fs');
  const officialSmartlink = 'https://asiafilm.org/4/f40a6dd77b401726a12dd304a72bafa5';

  // 1. Central adsConfig.ts
  const adsConfigTs = fs.readFileSync(new URL('../src/config/adsConfig.ts', import.meta.url), 'utf8');
  assert.ok(adsConfigTs.includes(officialSmartlink));
  assert.ok(adsConfigTs.includes('R-A-TERREX-SPEED-1'));
  assert.ok(adsConfigTs.includes('R-A-TERREX-GAME-1'));
  assert.ok(adsConfigTs.includes('R-A-TERREX-STAB-1'));
  assert.ok(adsConfigTs.includes('REFRESH_INTERVAL: 30'));
  assert.ok(adsConfigTs.includes('AUTO_REFRESH_SECONDS: 30'));

  // 2. HybridSmartAdCard.tsx
  const hybridSmartAdTsx = fs.readFileSync(new URL('../src/components/HybridSmartAdCard.tsx', import.meta.url), 'utf8');
  assert.ok(hybridSmartAdTsx.includes('Ya.Context.AdvManager.render'));
  assert.ok(hybridSmartAdTsx.includes('برعاية تقنية • Terrax Partner'));
  assert.ok(hybridSmartAdTsx.includes('🛡️ وضع العزل الشبكي نشط لضمان دقة الفحص'));
  assert.ok(hybridSmartAdTsx.includes('YANDEX_FALLBACK_TIMEOUT_MS = 2000'));
  assert.ok(hybridSmartAdTsx.includes('ADS_CONFIG.ADSTERRA_SMARTLINK'));

  // 3. GamingRadarBoosterCard.tsx
  const gamingBoosterTsx = fs.readFileSync(new URL('../src/components/GamingRadarBoosterCard.tsx', import.meta.url), 'utf8');
  assert.ok(gamingBoosterTsx.includes('Terrax Booster'));
  assert.ok(gamingBoosterTsx.includes('&lt; 55'));
  assert.ok(gamingBoosterTsx.includes('تحسين المسار مطلوب'));
  assert.ok(gamingBoosterTsx.includes('مسار فائق الاستقرار'));

  // 4. Location 1: Main Speed Screen (Below connection-type-card, above privacy-warning and start-button)
  const indexModernHtml = fs.readFileSync(new URL('../index-modern.html', import.meta.url), 'utf8');
  const frontendIndexHtml = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  for (const html of [indexModernHtml, frontendIndexHtml]) {
    const connPos = html.indexOf('id="connection-type-card"');
    const adPos = html.indexOf('data-terrax-yan-slot="speed-main"');
    const privacyPos = html.indexOf('id="privacy-warning"');
    const startPos = html.indexOf('id="start-button"');

    assert.ok(connPos !== -1 && adPos !== -1 && privacyPos !== -1 && startPos !== -1);
    assert.ok(connPos < adPos, 'Connection card must appear before ad card');
    assert.ok(adPos < privacyPos, 'Ad card must appear before privacy warning');
    assert.ok(privacyPos < startPos, 'Privacy warning must appear before start button');
  }

  const appConnPos = appTsx.indexOf('id="connection-type-card"');
  const appAdPos = appTsx.indexOf('<HybridSmartAdCard');
  const appStartPos = appTsx.indexOf('id="start-button"');
  assert.ok(appConnPos < appAdPos, 'React connection card must appear before HybridSmartAdCard');
  assert.ok(appAdPos < appStartPos, 'React HybridSmartAdCard must appear before start-button');

  // 5. Location 2: Gaming Screen (Top clickable sponsor, 6th booster card in radar grid, bottom ad)
  const gamingHtml = fs.readFileSync(new URL('../gaming.html', import.meta.url), 'utf8');
  const frontendGamingHtml = fs.readFileSync(new URL('../frontend/gaming.html', import.meta.url), 'utf8');

  for (const html of [gamingHtml, frontendGamingHtml]) {
    assert.ok(html.includes('id="gamingSponsorTag"'));
    assert.ok(html.includes('href="' + officialSmartlink + '"'));
    assert.ok(html.includes('id="gamingBoosterCard"'));
    assert.ok(html.includes('data-terrax-yan-slot="gaming-main"'));
    assert.ok(html.includes('Terrax Booster'));
    assert.ok(html.includes('&lt; 55ms'));
  }

  // 6. Location 3: Stability Screen (Ad card below start/reset buttons and above nav)
  const stabilityHtml = fs.readFileSync(new URL('../stability.html', import.meta.url), 'utf8');
  const frontendStabilityHtml = fs.readFileSync(new URL('../frontend/stability.html', import.meta.url), 'utf8');

  for (const html of [stabilityHtml, frontendStabilityHtml]) {
    const startBtnPos = html.indexOf('id="startBtn"');
    const adPos = html.indexOf('data-terrax-yan-slot="stability-main"');
    const navPos = html.indexOf('class="terrax-bottom-nav"');

    assert.ok(startBtnPos < adPos, 'Stability start button must appear before ad card');
    assert.ok(adPos < navPos, 'Stability ad card must appear before bottom nav');
  }

  // 7. Location 4: Usage Dialog (Horizontal booster banner below history table and before clear button)
  for (const html of [indexModernHtml, frontendIndexHtml, appTsx]) {
    assert.ok(html.includes('id="usage-dialog"'));
    assert.ok(html.includes('usage-booster-banner'));
    assert.ok(html.includes(officialSmartlink));
    const tablePos = html.indexOf('cyber-history-table');
    const boosterPos = html.indexOf('usage-booster-banner');
    const clearPos = html.indexOf('id="clear-history-btn"');
    assert.ok(tablePos < boosterPos, 'History table must appear before booster banner');
    assert.ok(boosterPos < clearPos, 'Booster banner must appear before clear history button');
  }
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

test('Automatic Ad Display Protocol: zero-click automatic initialization, inline ad frame mounting, zero popups, and multi-page slot coverage', async () => {
  const fs = await import('node:fs');

  const allHtmlPages = [
    '../index.html',
    '../index-modern.html',
    '../frontend/index.html',
    '../gaming.html',
    '../frontend/gaming.html',
    '../stability.html',
    '../frontend/stability.html',
  ];

  const adSlotHtmlPages = [
    '../index-modern.html',
    '../frontend/index.html',
    '../gaming.html',
    '../frontend/gaming.html',
    '../stability.html',
    '../frontend/stability.html',
  ];

  for (const relPath of allHtmlPages) {
    const content = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    // 1. Ad SDK script must be live in <head>, never trapped in an inert <template id="terrax-yandex-sdk-tpl">
    assert.ok(
      !content.includes('<template id="terrax-yandex-sdk-tpl">'),
      `${relPath} must not trap the ad script inside an inert <template>`
    );
    assert.ok(
      content.includes('<script src="https://yandex.ru/ads/system/context.js" async></script>'),
      `${relPath} must load context.js automatically in <head>`
    );
  }

  for (const relPath of adSlotHtmlPages) {
    const content = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    // 2. Primary ad slot must have data-auto-ad="true" and no manual click CTA text
    assert.ok(
      content.includes('data-auto-ad="true"'),
      `${relPath} must configure ad containers with data-auto-ad="true"`
    );
    assert.ok(
      !content.includes('تفعيل التسريع ⚡'),
      `${relPath} must not require manual click CTA text to display the ad`
    );
  }

  // 3. Verify central ad engine (frontend/javascript/ad-slots.js) supports R-A-TERREX-* block IDs, inline auto-frame, and zero popups
  const adSlotsJs = fs.readFileSync(new URL('../frontend/javascript/ad-slots.js', import.meta.url), 'utf8');
  assert.ok(!adSlotsJs.includes('isRealNumericBlockId = /^R-A-\\d+-\\d+$/'), 'ad-slots.js must not block R-A-TERREX-* block IDs');
  assert.ok(adSlotsJs.includes('function isValidConfiguredBlockId(blockId)'));
  assert.ok(adSlotsJs.includes('isNumericYandexBlockId'));
  assert.ok(adSlotsJs.includes('function mountAutomaticEmbeddedAdFrame(card, slotKey)'));
  assert.ok(adSlotsJs.includes('function bindZeroPopupGuard(el)'));
  assert.ok(adSlotsJs.includes('function cleanupAllSlots()'));
  assert.ok(adSlotsJs.includes('setupDialogAutoAdObserver()'));

  // 4. Verify React components and App.tsx
  const hybridAdTsx = fs.readFileSync(new URL('../src/components/HybridSmartAdCard.tsx', import.meta.url), 'utf8');
  const appTsx = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(hybridAdTsx.includes('ensureYandexContextScript()'));
  assert.ok(hybridAdTsx.includes('isNumericYandexBlockId'));
  assert.ok(hybridAdTsx.includes('terrax-auto-ad-frame'));
  assert.ok(appTsx.includes('data-terrax-yan-slot="usage-main"'));
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

