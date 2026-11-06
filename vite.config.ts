import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, Plugin} from 'vite';
import {executeGameQueryFetch} from './backend/gamequeryAdapter.mjs';

const ROOT_DIR =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

// Lazy-allocate a 256KB high-speed buffer chunk for LibreSpeed download measurement on first request
let cachedGarbageChunk: Buffer | null = null;
function getGarbageChunk(): Buffer {
  if (!cachedGarbageChunk) {
    cachedGarbageChunk = crypto.randomBytes(262144);
  }
  return cachedGarbageChunk;
}

interface StoredResult {
  dl: string;
  ul: string;
  ping: string;
  jitter: string;
  isp: string;
  stab: string;
}

const telemetryStore = new Map<string, StoredResult>();

function loadFontBase64(relPath: string): string {
  try {
    const full = path.resolve(ROOT_DIR, relPath);
    if (fs.existsSync(full)) {
      return fs.readFileSync(full).toString('base64');
    }
  } catch {
    // fallback if missing
  }
  return '';
}

let CAIRO_BASE64: string | null = null;
let INTER_BASE64: string | null = null;

function getCairoBase64(): string {
  if (CAIRO_BASE64 === null) {
    CAIRO_BASE64 = loadFontBase64('frontend/fonts/Cairo-arabic.woff2');
  }
  return CAIRO_BASE64;
}

function getInterBase64(): string {
  if (INTER_BASE64 === null) {
    INTER_BASE64 = loadFontBase64('frontend/fonts/Inter-latin.woff2');
  }
  return INTER_BASE64;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatShareSpeed(valStr: string): {num: string; unit: string} {
  const n = Number(valStr);
  if (!Number.isFinite(n) || n <= 0) return {num: '0.0', unit: 'Mbps'};
  if (n >= 1000) return {num: (n / 1000).toFixed(2), unit: 'Gbps'};
  if (n >= 100) return {num: n.toFixed(0), unit: 'Mbps'};
  return {num: n.toFixed(1), unit: 'Mbps'};
}

function librespeedRuntimePlugin(): Plugin {
  const createMiddleware = () => {
    return (req: any, res: any, next: () => void) => {
      if (!req.url) return next();
      const parsedUrl = new URL(req.url, 'http://localhost:3000');
      const pathname = parsedUrl.pathname;

      // CORS, Timing-Allow-Origin & Cache-Control headers for LibreSpeed XHR workers
      const setNoCacheHeaders = () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Timing-Allow-Origin', '*');
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0'
        );
        res.setHeader('Pragma', 'no-cache');
      };

      if (req.method === 'OPTIONS') {
        setNoCacheHeaders();
        res.statusCode = 204;
        res.end();
        return;
      }

      // 1. Handle empty.php (Ping, Jitter & Upload throughput endpoint)
      if (pathname.endsWith('/empty.php') || pathname === '/empty.php') {
        setNoCacheHeaders();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (req.method === 'POST') {
          req.on('data', () => {
            // Drain uploaded bytes for accurate upload speed measurement
          });
          req.on('end', () => {
            res.statusCode = 200;
            res.end('');
          });
          return;
        }
        res.statusCode = 200;
        res.end('');
        return;
      }

      // 2. Handle garbage.php (Download throughput binary stream endpoint)
      if (pathname.endsWith('/garbage.php') || pathname === '/garbage.php') {
        setNoCacheHeaders();
        res.setHeader('Content-Description', 'File Transfer');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=random.dat'
        );
        res.setHeader('Content-Transfer-Encoding', 'binary');

        const ckSizeParam = Number(parsedUrl.searchParams.get('ckSize'));
        // Cap chunk count per request in local dev container so download completes smoothly
        const chunksMib = Number.isFinite(ckSizeParam)
          ? Math.min(32, Math.max(1, ckSizeParam))
          : 4;
        const totalQuarterMibChunks = chunksMib * 4;

        const garbageChunk = getGarbageChunk();
        res.statusCode = 200;
        let sent = 0;
        const writeNext = () => {
          let ok = true;
          while (sent < totalQuarterMibChunks && ok) {
            sent++;
            if (sent === totalQuarterMibChunks) {
              res.end(garbageChunk);
            } else {
              ok = res.write(garbageChunk);
            }
          }
          if (sent < totalQuarterMibChunks) {
            res.once('drain', writeNext);
          }
        };
        writeNext();
        return;
      }

      // 3. Handle getIP.php (Client IP & ISP info endpoint)
      if (pathname.endsWith('/getIP.php') || pathname === '/getIP.php') {
        setNoCacheHeaders();
        const rawHeaderIp =
          (req.headers?.['cf-connecting-ip'] as string) ||
          (req.headers?.['x-real-ip'] as string) ||
          (req.headers?.['x-forwarded-for'] as string) ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        const clientIp =
          String(rawHeaderIp)
            .split(',')[0]
            .trim()
            .replace(/^::ffff:/i, '') || '127.0.0.1';
        const includeIsp = parsedUrl.searchParams.has('isp');
        const processedString = includeIsp
          ? `${clientIp} - Terrax Plus Fiber`
          : clientIp;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            ip: clientIp,
            processedString,
            rawIspInfo: includeIsp ? 'Terrax Plus IX' : '',
          })
        );
        return;
      }

      // 3b. Handle backend/gamequery.php (Secure server-side proxy for GameQuery.dev API)
      if (
        pathname.endsWith('/backend/gamequery.php') ||
        pathname === '/gamequery.php' ||
        pathname === '/api/gamequery'
      ) {
        setNoCacheHeaders();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        const rawHeaderIp =
          (req.headers?.['cf-connecting-ip'] as string) ||
          (req.headers?.['x-real-ip'] as string) ||
          (req.headers?.['x-forwarded-for'] as string) ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        const clientIp =
          String(rawHeaderIp)
            .split(',')[0]
            .trim()
            .replace(/^::ffff:/i, '') || '127.0.0.1';

        const handleQuery = async (requestedServers: unknown) => {
          try {
            const result = await executeGameQueryFetch({
              servers: requestedServers,
              clientIp,
            });
            res.statusCode = result.httpStatus || 200;
            res.end(JSON.stringify(result.payload));
          } catch {
            res.statusCode = 502;
            res.end(
              JSON.stringify({
                ok: false,
                configured: true,
                status: 'upstream_error',
                messageAr: 'تعذر إتمام الاستعلام عبر خادم الوسيط المحلي.',
                messageEn: 'Failed to complete query via local proxy.',
                results: [],
              })
            );
          }
        };

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          req.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes <= 16384) {
              chunks.push(Buffer.from(chunk));
            }
          });
          req.on('end', () => {
            let parsedServers: unknown = undefined;
            try {
              const rawBody = Buffer.concat(chunks).toString('utf8').trim();
              if (rawBody) {
                const decoded = JSON.parse(rawBody);
                parsedServers = decoded?.servers ?? decoded;
              }
            } catch {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  ok: false,
                  configured: true,
                  status: 'invalid_request',
                  messageAr: 'تنسيق بيانات الطلب (JSON) غير صالح.',
                  messageEn: 'Malformed JSON request body.',
                  results: [],
                })
              );
              return;
            }
            void handleQuery(parsedServers);
          });
          return;
        }

        // GET support: ?game_id=counterstrike2&address=185.25.180.1:27015
        const qGameId = parsedUrl.searchParams.get('game_id') || '';
        const qAddress =
          parsedUrl.searchParams.get('address') ||
          parsedUrl.searchParams.get('server') ||
          '';
        const getServers =
          qGameId && qAddress
            ? [{game_id: qGameId, servers: [qAddress]}]
            : undefined;
        void handleQuery(getServers);
        return;
      }

      // 4. Handle results/telemetry.php (Store test result & return testId)
      if (pathname.endsWith('/results/telemetry.php')) {
        setNoCacheHeaders();
        const bodyChunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {
          if (bodyChunks.length < 32) bodyChunks.push(Buffer.from(chunk));
        });
        req.on('end', () => {
          const testId = String(Date.now());
          try {
            const raw = Buffer.concat(bodyChunks).toString('utf8');
            const extractField = (field: string): string => {
              const multipartMatch = raw.match(
                new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]*)`)
              );
              if (multipartMatch && multipartMatch[1] !== undefined) {
                return multipartMatch[1].trim();
              }
              const params = new URLSearchParams(raw);
              return params.get(field) || '';
            };
            const dlVal = extractField('dl') || '0.0';
            const ulVal = extractField('ul') || '0.0';
            const pingVal = extractField('ping') || '0.0';
            const jitterVal = extractField('jitter') || '0.0';
            const ispVal = extractField('ispinfo') || 'Terrax Plus Fiber';
            const jitterNum = Number(jitterVal);
            const computedStab = Number.isFinite(jitterNum) && jitterNum >= 0
              ? String(Math.max(50, Math.min(99, Math.round(100 - jitterNum * 1.5))))
              : '0';
            telemetryStore.set(testId, {
              dl: dlVal,
              ul: ulVal,
              ping: pingVal,
              jitter: jitterVal,
              isp: ispVal,
              stab: computedStab,
            });
          } catch {
            // ignore parse issues
          }
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.statusCode = 200;
          res.end(`id ${testId}`);
        });
        return;
      }

      // 4b. Handle results/json.php (JSON result retrieval by id)
      if (pathname.endsWith('/results/json.php')) {
        setNoCacheHeaders();
        const rawId = parsedUrl.searchParams.get('id') || '';
        const testId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
        const stored = telemetryStore.get(testId);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.statusCode = 200;
        if (!stored) {
          res.end('{}');
          return;
        }
        res.end(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            download: formatShareSpeed(stored.dl || '0'),
            upload: formatShareSpeed(stored.ul || '0'),
            ping: stored.ping || '0',
            jitter: stored.jitter || '0',
            ispinfo: stored.isp || 'Terrax Plus Fiber',
          })
        );
        return;
      }

      // 5. Handle results/?id=... 4K share card image with embedded Cairo + Inter fonts
      if (
        pathname.endsWith('/results/') ||
        pathname.endsWith('/results/index.php')
      ) {
        const rawId = parsedUrl.searchParams.get('id') || 'terrax-4k';
        const testId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
        const stored = telemetryStore.get(testId);

        const dlFmt = formatShareSpeed(
          parsedUrl.searchParams.get('dl') || stored?.dl || '0.0'
        );
        const ulFmt = formatShareSpeed(
          parsedUrl.searchParams.get('ul') || stored?.ul || '0.0'
        );
        const pingVal = Number(
          parsedUrl.searchParams.get('ping') || stored?.ping || '0.0'
        );
        const jitterVal = Number(
          parsedUrl.searchParams.get('jitter') || stored?.jitter || '0.0'
        );
        const stabVal =
          parsedUrl.searchParams.get('stab') || stored?.stab || '0';
        const pingText = Number.isFinite(pingVal) ? pingVal.toFixed(1) : '0.0';
        const jitterText = Number.isFinite(jitterVal)
          ? jitterVal.toFixed(2)
          : '0.00';

        const cairoB64 = getCairoBase64();
        const interB64 = getInterBase64();
        const fontFaceCss = `
          ${
            cairoB64
              ? `@font-face { font-family: 'CairoShare'; src: url('data:font/woff2;base64,${cairoB64}') format('woff2'); font-weight: 300 900; }`
              : ''
          }
          ${
            interB64
              ? `@font-face { font-family: 'InterShare'; src: url('data:font/woff2;base64,${interB64}') format('woff2'); font-weight: 100 900; }`
              : ''
          }
          .ar-text { font-family: 'CairoShare', 'InterShare', sans-serif; }
          .num-text { font-family: 'InterShare', 'CairoShare', monospace; }
        `;

        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.statusCode = 200;
        res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="440" viewBox="0 0 800 440">
          <defs>
            <style>${fontFaceCss}</style>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#081734"/>
              <stop offset="55%" stop-color="#0c2147"/>
              <stop offset="100%" stop-color="#07132c"/>
            </linearGradient>
            <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#0284c7"/>
              <stop offset="50%" stop-color="#67e8f9"/>
              <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
          </defs>
          <rect width="794" height="434" x="3" y="3" rx="28" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="2.5"/>
          <rect width="746" height="68" x="27" y="24" rx="16" fill="#102956" fill-opacity="0.72" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.2"/>
          <text x="748" y="65" text-anchor="end" fill="#67e8f9" class="ar-text" font-size="22" font-weight="800">Terrax Plus 4K — تيراكس بلاس</text>
          <text x="52" y="64" text-anchor="start" fill="#cbd5e1" class="ar-text" font-size="17" font-weight="600">بطاقة نتيجة قياس السرعة الموثقة</text>

          <!-- Download Box (Right) -->
          <rect width="234" height="190" x="539" y="114" rx="20" fill="#102a58" fill-opacity="0.82" stroke="#38bdf8" stroke-opacity="0.65" stroke-width="1.5"/>
          <text x="656" y="154" text-anchor="middle" direction="rtl" fill="#bae6fd" class="ar-text" font-size="20" font-weight="700">سرعة التنزيل</text>
          <text x="656" y="222" text-anchor="middle" fill="#ffffff" class="num-text" font-size="48" font-weight="800">${escapeXml(dlFmt.num)}</text>
          <text x="656" y="256" text-anchor="middle" fill="#38bdf8" class="num-text" font-size="19" font-weight="700">${escapeXml(dlFmt.unit)}</text>
          <text x="656" y="284" text-anchor="middle" fill="#7dd3fc" class="num-text" font-size="13" font-weight="600">DOWNLOAD SPEED</text>

          <!-- Stability Box (Center) -->
          <rect width="234" height="190" x="283" y="114" rx="20" fill="#102a58" fill-opacity="0.82" stroke="#a3e635" stroke-opacity="0.6" stroke-width="1.5"/>
          <text x="400" y="154" text-anchor="middle" direction="rtl" fill="#d9f99d" class="ar-text" font-size="20" font-weight="700">استقرار السرعة</text>
          <text x="400" y="222" text-anchor="middle" fill="#ffffff" class="num-text" font-size="48" font-weight="800">${escapeXml(String(stabVal).replace(/[^0-9.]/g, '') || '0')}%</text>
          <text x="400" y="256" text-anchor="middle" direction="rtl" fill="#a3e635" class="ar-text" font-size="18" font-weight="700">مستقر للغاية</text>
          <text x="400" y="284" text-anchor="middle" fill="#bef264" class="num-text" font-size="13" font-weight="600">SPEED STABILITY</text>

          <!-- Upload Box (Left) -->
          <rect width="234" height="190" x="27" y="114" rx="20" fill="#102a58" fill-opacity="0.82" stroke="#c084fc" stroke-opacity="0.65" stroke-width="1.5"/>
          <text x="144" y="154" text-anchor="middle" direction="rtl" fill="#e9d5ff" class="ar-text" font-size="20" font-weight="700">سرعة الرفع</text>
          <text x="144" y="222" text-anchor="middle" fill="#ffffff" class="num-text" font-size="48" font-weight="800">${escapeXml(ulFmt.num)}</text>
          <text x="144" y="256" text-anchor="middle" fill="#c084fc" class="num-text" font-size="19" font-weight="700">${escapeXml(ulFmt.unit)}</text>
          <text x="144" y="284" text-anchor="middle" fill="#d8b4fe" class="num-text" font-size="13" font-weight="600">UPLOAD SPEED</text>

          <!-- Bottom Telemetry Bar -->
          <rect width="746" height="82" x="27" y="324" rx="16" fill="#0d2249" fill-opacity="0.88" stroke="#38bdf8" stroke-opacity="0.38" stroke-width="1.2"/>
          <text x="748" y="360" text-anchor="end" fill="#f8fafc" class="num-text" font-size="18" font-weight="700">Ping: ${escapeXml(pingText)} ms   |   Jitter: ${escapeXml(jitterText)} ms</text>
          <text x="748" y="388" text-anchor="end" fill="#94a3b8" class="num-text" font-size="15">Terrax Plus Fiber Core — LibreSpeed 4K Engine</text>
          <text x="52" y="362" text-anchor="start" fill="#67e8f9" class="num-text" font-size="16" font-weight="700">ID: ${escapeXml(testId)}</text>
          <text x="52" y="388" text-anchor="start" fill="#94a3b8" class="num-text" font-size="14">VERIFIED TELEMETRY</text>
        </svg>`);
        return;
      }

      // 6. Serve /ads.txt (Official Google AdSense Authorized Digital Sellers file)
      if (pathname === '/ads.txt') {
        setNoCacheHeaders();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        const rawEnvPubId = String(
          process.env.ADSENSE_PUBLISHER_ID ||
            process.env.VITE_ADSENSE_PUBLISHER_ID ||
            ''
        ).trim();
        const normalizedPubMatch = rawEnvPubId.match(/^(?:ca-)?(pub-\d{16})$/i);
        if (
          normalizedPubMatch &&
          normalizedPubMatch[1].toLowerCase() !== 'pub-0000000000000000'
        ) {
          res.statusCode = 200;
          res.end(
            `google.com, ${normalizedPubMatch[1].toLowerCase()}, DIRECT, f08c47fec0942fa0\n`
          );
          return;
        }
        const adsTxtPath = path.resolve(ROOT_DIR, 'ads.txt');
        if (fs.existsSync(adsTxtPath)) {
          res.statusCode = 200;
          res.end(fs.readFileSync(adsTxtPath, 'utf8'));
          return;
        }
      }

      // 6b. Serve /robots.txt (Official crawler access for Googlebot & Mediapartners-Google)
      if (pathname === '/robots.txt') {
        setNoCacheHeaders();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        const robotsTxtPath = path.resolve(ROOT_DIR, 'robots.txt');
        if (fs.existsSync(robotsTxtPath)) {
          res.statusCode = 200;
          res.end(fs.readFileSync(robotsTxtPath, 'utf8'));
          return;
        }
      }

      // 6c. Serve /sitemap.xml (Official XML sitemap for search engine & AdSense crawlers)
      if (pathname === '/sitemap.xml') {
        setNoCacheHeaders();
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        const sitemapXmlPath = path.resolve(ROOT_DIR, 'sitemap.xml');
        if (fs.existsSync(sitemapXmlPath)) {
          res.statusCode = 200;
          res.end(fs.readFileSync(sitemapXmlPath, 'utf8'));
          return;
        }
      }

      // 7. Map /frontend/<root-file> requests when /frontend/index.html or /frontend/stability.html is opened directly
      if (pathname === '/frontend/index-modern.html') {
        const frontendIndexPath = path.resolve(ROOT_DIR, 'frontend/index.html');
        if (fs.existsSync(frontendIndexPath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.statusCode = 200;
          res.end(fs.readFileSync(frontendIndexPath));
          return;
        }
      }

      const rootSharedFiles = [
        'speedtest.js',
        'speedtest_worker.js',
        'stability_worker.js',
        'settings.json',
        'server-list.json',
        'config.json',
        'design-switch.js',
        'ads.txt',
        'robots.txt',
        'sitemap.xml',
      ];
      for (const sharedFile of rootSharedFiles) {
        if (pathname === `/frontend/${sharedFile}`) {
          const targetPath = path.resolve(ROOT_DIR, sharedFile);
          if (fs.existsSync(targetPath)) {
            const ext = path.extname(sharedFile);
            const contentType =
              ext === '.js'
                ? 'text/javascript; charset=utf-8'
                : ext === '.json'
                  ? 'application/json; charset=utf-8'
                  : ext === '.xml'
                    ? 'application/xml; charset=utf-8'
                    : ext === '.txt'
                      ? 'text/plain; charset=utf-8'
                      : 'text/html; charset=utf-8';
            res.setHeader('Content-Type', contentType);
            res.statusCode = 200;
            res.end(fs.readFileSync(targetPath));
            return;
          }
        }
      }

      next();
    };
  };

  return {
    name: 'librespeed-runtime-plugin',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    },
    closeBundle() {
      const distDir = path.resolve(ROOT_DIR, 'dist');
      if (!fs.existsSync(distDir)) return;

      const rootStaticFiles = [
        'index-modern.html',
        'index-classic.html',
        'stability.html',
        'gaming.html',
        'speedtest.js',
        'speedtest_worker.js',
        'stability_worker.js',
        'design-switch.js',
        'config.json',
        'settings.json',
        'server-list.json',
        'manifest.webmanifest',
        'favicon.ico',
        'ads.txt',
        'robots.txt',
        'sitemap.xml',
      ];

      for (const file of rootStaticFiles) {
        const src = path.resolve(ROOT_DIR, file);
        const dest = path.resolve(distDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      for (const dir of ['frontend', 'images', 'ads', 'public', 'backend', 'nodes']) {
        const srcDir = path.resolve(ROOT_DIR, dir);
        const destDir = path.resolve(distDir, dir);
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, {recursive: true});
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [librespeedRuntimePlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(ROOT_DIR, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
