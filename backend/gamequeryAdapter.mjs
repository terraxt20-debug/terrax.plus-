/**
 * Server-Side Adapter & Validator for Official GameQuery.dev API Integration
 * Endpoint: POST https://api.gamequery.dev/v1/post/fetch
 * Authentication Headers:
 *   - Content-Type: application/json
 *   - x-api-token: <GAMEQUERY_API_KEY>
 *   - x-api-token-type: <GAMEQUERY_TOKEN_TYPE> ("FREE" | "PRO")
 *   - x-api-token-email: <GAMEQUERY_EMAIL>
 *
 * Security & Reliability Guarantees:
 * - Never exposes API credentials in responses, error messages, or logs.
 * - Validates game_id against officially supported GameQuery.dev protocols.
 * - Validates server ip:port targets and blocks private/loopback/internal addresses (SSRF protection).
 * - Enforces request timeout (6000ms), 30s response cache, and per-IP rate limiting.
 * - Explicitly separates GameQuery worker probe latency and API response time from LibreSpeed user Ping.
 */

export const GAMEQUERY_API_ENDPOINT = "https://api.gamequery.dev/v1/post/fetch";
export const GAMEQUERY_TIMEOUT_MS = 6000;
export const GAMEQUERY_CACHE_TTL_MS = 30000;
export const GAMEQUERY_MAX_SERVERS_PER_REQUEST = 10;
export const GAMEQUERY_RATE_LIMIT_WINDOW_MS = 60000;
export const GAMEQUERY_RATE_LIMIT_MAX_REQ = 15;

/**
 * Official GameQuery.dev supported game_id protocols exposed in the Gaming Test UI.
 * Closed matchmaking-only games (e.g. Valorant, EA FC, Fortnite) do not expose public query ports.
 */
export const SUPPORTED_GAMEQUERY_PROTOCOLS = Object.freeze([
  {
    game_id: "counterstrike2",
    labelEn: "Counter-Strike 2 (Source 2 / A2S)",
    labelAr: "Counter-Strike 2 (خوادم Source 2)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "counterstrike16",
    labelEn: "Counter-Strike 1.6 (GoldSrc / A2S)",
    labelAr: "Counter-Strike 1.6 (خوادم A2S)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "csgo",
    labelEn: "CS:GO (Source / A2S)",
    labelAr: "CS:GO (خوادم Source)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "rust",
    labelEn: "Rust (Source / A2S)",
    labelAr: "Rust (خوادم البقاء الرسمية والمجتمعية)",
    category: "br",
    defaultPort: 28015,
  },
  {
    game_id: "minecraft",
    labelEn: "Minecraft (Java SLP)",
    labelAr: "Minecraft (خوادم Java)",
    category: "br",
    defaultPort: 25565,
  },
  {
    game_id: "fivem",
    labelEn: "FiveM / GTA V RP (CitizenFX)",
    labelAr: "FiveM / GTA V RP (خوادم CitizenFX)",
    category: "br",
    defaultPort: 30120,
  },
  {
    game_id: "arkse",
    labelEn: "ARK: Survival Evolved (A2S)",
    labelAr: "ARK: Survival Evolved (خوادم A2S)",
    category: "br",
    defaultPort: 27015,
  },
  {
    game_id: "teamfortress2",
    labelEn: "Team Fortress 2 (Source / A2S)",
    labelAr: "Team Fortress 2 (خوادم Source)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "dayz",
    labelEn: "DayZ (Steam / A2S)",
    labelAr: "DayZ (خوادم البقاء)",
    category: "br",
    defaultPort: 27016,
  },
  {
    game_id: "palworld",
    labelEn: "Palworld (Dedicated Server)",
    labelAr: "Palworld (خوادم مخصصة)",
    category: "br",
    defaultPort: 8211,
  },
  {
    game_id: "left4dead2",
    labelEn: "Left 4 Dead 2 (Source / A2S)",
    labelAr: "Left 4 Dead 2 (خوادم Source)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "garrysmod",
    labelEn: "Garry's Mod (Source / A2S)",
    labelAr: "Garry's Mod (خوادم Source)",
    category: "fps",
    defaultPort: 27015,
  },
  {
    game_id: "valheim",
    labelEn: "Valheim (A2S)",
    labelAr: "Valheim (خوادم A2S)",
    category: "br",
    defaultPort: 2457,
  },
  {
    game_id: "terraria",
    labelEn: "Terraria",
    labelAr: "Terraria (خوادم مخصصة)",
    category: "br",
    defaultPort: 7777,
  },
]);

const SUPPORTED_PROTOCOL_SET = new Set(
  SUPPORTED_GAMEQUERY_PROTOCOLS.map((p) => p.game_id)
);

const responseCache = new Map();
const clientRateMap = new Map();

/**
 * Strip control characters and HTML tags from untrusted API strings.
 * @param {unknown} val
 * @param {number} [maxLen=120]
 */
export function sanitizeApiString(val, maxLen = 120) {
  if (val === null || val === undefined) return "";
  const str = String(val)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Check if an IPv4 address or hostname is private, loopback, link-local, or reserved (SSRF protection).
 * @param {string} host
 */
export function isPrivateOrReservedHost(host) {
  if (!host || typeof host !== "string") return true;
  const lower = host.trim().toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localhost") ||
    lower === "[::1]" ||
    lower === "::1" ||
    lower === "0.0.0.0" ||
    lower.includes(":")
  ) {
    return true;
  }

  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if ([a, b, c, d].some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return true;
    }
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  // Allow valid public domain names (e.g. play.example.com)
  const domainRegex = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  return !domainRegex.test(lower);
}

/**
 * Validate a single "host:port" game server address.
 * @param {unknown} rawAddress
 */
export function validateServerAddress(rawAddress) {
  if (typeof rawAddress !== "string") {
    return { valid: false, reason: "عنوان الخادم يجب أن يكون نصًا بصيغة IP:Port" };
  }
  const trimmed = rawAddress.trim();
  const match = trimmed.match(/^([^:\s/]+):(\d{1,5})$/);
  if (!match) {
    return { valid: false, reason: "صيغة عنوان الخادم غير صالحة — استخدم الصيغة IP:Port (مثال 185.25.180.1:27015)" };
  }
  const host = match[1];
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { valid: false, reason: "رقم المنفذ (Port) يجب أن يكون بين 1 و 65535" };
  }
  if (isPrivateOrReservedHost(host)) {
    return { valid: false, reason: "لا يُسمح بالاستعلام عن عناوين الشبكات المحلية أو الخاصة" };
  }
  return { valid: true, normalized: `${host.toLowerCase()}:${port}` };
}

/**
 * Parse GAMEQUERY_DEFAULT_SERVERS env string if formatted as "game_id@host:port,game_id@host:port"
 * or JSON array `[{"game_id":"counterstrike2","servers":["..."]}]`.
 * @param {string | undefined} rawEnv
 */
export function parseEnvDefaultServers(rawEnv) {
  if (!rawEnv || typeof rawEnv !== "string" || !rawEnv.trim()) {
    return [];
  }
  const trimmed = rawEnv.trim();
  try {
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback to comma-separated parsing
  }

  const byGame = new Map();
  const parts = trimmed.split(",");
  for (const part of parts) {
    const item = part.trim();
    if (!item) continue;
    const atIdx = item.indexOf("@");
    if (atIdx <= 0) continue;
    const gameId = item.slice(0, atIdx).trim().toLowerCase();
    const addr = item.slice(atIdx + 1).trim();
    if (!SUPPORTED_PROTOCOL_SET.has(gameId)) continue;
    const addrCheck = validateServerAddress(addr);
    if (!addrCheck.valid) continue;
    if (!byGame.has(gameId)) byGame.set(gameId, []);
    byGame.get(gameId).push(addrCheck.normalized);
  }

  return Array.from(byGame.entries()).map(([game_id, servers]) => ({
    game_id,
    servers,
  }));
}

/**
 * Validate and normalize requested server query groups before sending to GameQuery.dev.
 * @param {unknown} rawServersInput
 * @param {string} [envDefaultServers]
 */
export function validateAndNormalizeQueryPayload(rawServersInput, envDefaultServers = "") {
  let candidateGroups = rawServersInput;
  if (!Array.isArray(candidateGroups) || candidateGroups.length === 0) {
    candidateGroups = parseEnvDefaultServers(envDefaultServers);
  }

  if (!Array.isArray(candidateGroups) || candidateGroups.length === 0) {
    return {
      valid: false,
      emptyTargets: true,
      errorAr: "يرجى تحديد اللعبة وإدخال عنوان خادم صالح بصيغة IP:Port للاستعلام عبر GameQuery.dev.",
      errorEn: "Please select a supported game protocol and enter a valid IP:Port server address.",
      servers: [],
    };
  }

  const grouped = new Map();
  let totalCount = 0;

  for (const group of candidateGroups) {
    if (!group || typeof group !== "object") continue;
    const gameId = String(group.game_id || "").trim().toLowerCase();
    if (!SUPPORTED_PROTOCOL_SET.has(gameId)) {
      return {
        valid: false,
        emptyTargets: false,
        errorAr: `اللعبة أو البروتوكول (${sanitizeApiString(group.game_id, 40) || "غير معروف"}) غير مدعوم في قائمة استعلامات GameQuery.dev المعتمدة.`,
        errorEn: `Unsupported game_id protocol: ${sanitizeApiString(group.game_id, 40)}.`,
        servers: [],
      };
    }

    const rawAddrList = Array.isArray(group.servers)
      ? group.servers
      : typeof group.address === "string"
        ? [group.address]
        : [];

    for (const rawAddr of rawAddrList) {
      const check = validateServerAddress(rawAddr);
      if (!check.valid) {
        return {
          valid: false,
          emptyTargets: false,
          errorAr: check.reason,
          errorEn: "Invalid or disallowed server address (must be a public IP:Port).",
          servers: [],
        };
      }
      if (!grouped.has(gameId)) {
        grouped.set(gameId, new Set());
      }
      const set = grouped.get(gameId);
      if (!set.has(check.normalized)) {
        totalCount++;
        if (totalCount > GAMEQUERY_MAX_SERVERS_PER_REQUEST) {
          return {
            valid: false,
            emptyTargets: false,
            errorAr: `الحد الأقصى للاستعلام الواحد هو ${GAMEQUERY_MAX_SERVERS_PER_REQUEST} خوادم لحماية حصة API.`,
            errorEn: `Maximum ${GAMEQUERY_MAX_SERVERS_PER_REQUEST} servers per request allowed.`,
            servers: [],
          };
        }
        set.add(check.normalized);
      }
    }
  }

  const normalizedServers = Array.from(grouped.entries()).map(([game_id, addrSet]) => ({
    game_id,
    servers: Array.from(addrSet),
  }));

  if (normalizedServers.length === 0) {
    return {
      valid: false,
      emptyTargets: true,
      errorAr: "لم يتم العثور على عناوين خوادم صالحة للاستعلام.",
      errorEn: "No valid server addresses provided.",
      servers: [],
    };
  }

  return {
    valid: true,
    emptyTargets: false,
    servers: normalizedServers,
  };
}

/**
 * Normalize the raw JSON returned by GameQuery.dev (`POST /v1/post/fetch`).
 * Strictly distinguishes:
 * - `online`: server availability status reported by GameQuery.dev
 * - `probeLatencyMs`: latency measured by GameQuery's probe node (NOT the user's LibreSpeed Ping)
 * - `apiResponseTimeMs`: HTTP request duration to api.gamequery.dev
 *
 * @param {unknown} rawData
 * @param {Array<{game_id: string, servers: string[]}>} requestedGroups
 * @param {number} apiResponseTimeMs
 */
export function normalizeGameQueryResponse(rawData, requestedGroups, apiResponseTimeMs) {
  if (!rawData || typeof rawData !== "object") {
    return { validSchema: false, results: [] };
  }

  // Support both { results: [...] }, { data: [...] }, or direct keyed object structures
  let rawItems = [];
  if (Array.isArray(rawData.results)) {
    rawItems = rawData.results;
  } else if (Array.isArray(rawData.data)) {
    rawItems = rawData.data;
  } else if (Array.isArray(rawData.servers)) {
    rawItems = rawData.servers;
  } else if (Array.isArray(rawData)) {
    rawItems = rawData;
  } else {
    // Check if keyed by address or game_id
    for (const [k, v] of Object.entries(rawData)) {
      if (v && typeof v === "object" && ("online" in v || "players" in v || "name" in v || "map" in v)) {
        rawItems.push({ address: k, ...v });
      }
    }
  }

  const fallbackGameId =
    Array.isArray(requestedGroups) && requestedGroups[0]?.game_id
      ? requestedGroups[0].game_id
      : "unknown";
  const fallbackAddr =
    Array.isArray(requestedGroups) && requestedGroups[0]?.servers?.[0]
      ? requestedGroups[0].servers[0]
      : "";

  const normalizedResults = [];
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;

    const gameId = sanitizeApiString(item.game_id || item.gameId || fallbackGameId, 40).toLowerCase();
    const address = sanitizeApiString(item.address || item.ip || item.server || fallbackAddr, 80);
    const online =
      typeof item.online === "boolean"
        ? item.online
        : item.status === "online" || item.status === true || Number(item.online) === 1;

    const rawLatency = Number(item.latency ?? item.ping ?? item.rtt);
    const probeLatencyMs =
      Number.isFinite(rawLatency) && rawLatency >= 0 && rawLatency < 10000
        ? Math.round(rawLatency)
        : null;

    const name = sanitizeApiString(item.name || item.hostname || item.server_name || "", 100) || null;
    const map = sanitizeApiString(item.map || item.map_name || "", 60) || null;

    let playersOnline = null;
    let playersMax = null;
    if (item.players && typeof item.players === "object") {
      const pOn = Number(item.players.online ?? item.players.current ?? item.players.count);
      const pMx = Number(item.players.max ?? item.players.maxplayers ?? item.players.slots);
      if (Number.isFinite(pOn) && pOn >= 0) playersOnline = Math.round(pOn);
      if (Number.isFinite(pMx) && pMx >= 0) playersMax = Math.round(pMx);
    } else {
      const pOn = Number(item.players_online ?? item.numplayers ?? item.players);
      const pMx = Number(item.players_max ?? item.maxplayers);
      if (Number.isFinite(pOn) && pOn >= 0) playersOnline = Math.round(pOn);
      if (Number.isFinite(pMx) && pMx >= 0) playersMax = Math.round(pMx);
    }

    const protoMeta = SUPPORTED_GAMEQUERY_PROTOCOLS.find((p) => p.game_id === gameId);

    normalizedResults.push({
      game_id: gameId,
      gameLabelAr: protoMeta ? protoMeta.labelAr : gameId,
      gameLabelEn: protoMeta ? protoMeta.labelEn : gameId,
      address,
      online,
      name,
      map,
      players: {
        online: playersOnline,
        max: playersMax,
      },
      // Explicitly labeled as GameQuery probe node latency (NOT user's LibreSpeed Ping)
      probeLatencyMs,
      probeLatencySource: "gamequery_worker_node",
      apiResponseTimeMs: Math.max(1, Math.round(Number(apiResponseTimeMs) || 0)),
    });
  }

  return {
    validSchema: true,
    results: normalizedResults,
  };
}

/**
 * Simple per-IP sliding window rate limiter to protect the server's GameQuery API key.
 * @param {string} clientIp
 * @param {number} [nowMs]
 */
export function checkClientRateLimit(clientIp, nowMs = Date.now()) {
  const key = String(clientIp || "127.0.0.1").trim();
  const entry = clientRateMap.get(key);
  if (!entry || nowMs - entry.windowStart >= GAMEQUERY_RATE_LIMIT_WINDOW_MS) {
    clientRateMap.set(key, { windowStart: nowMs, count: 1 });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= GAMEQUERY_RATE_LIMIT_MAX_REQ) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((GAMEQUERY_RATE_LIMIT_WINDOW_MS - (nowMs - entry.windowStart)) / 1000)
    );
    return { allowed: false, retryAfterSec };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function clearGameQueryAdapterCache() {
  responseCache.clear();
  clientRateMap.clear();
}

/**
 * Execute a server-side GameQuery.dev API request with full validation, caching, timeout, and error mapping.
 *
 * @param {object} options
 * @param {unknown} [options.servers] - Requested server groups
 * @param {Record<string, string | undefined>} [options.env] - Environment variables (defaults to process.env)
 * @param {typeof fetch} [options.fetchImpl] - Fetch implementation (defaults to globalThis.fetch)
 * @param {string} [options.clientIp] - Client IP for rate limiting
 * @param {number} [options.timeoutMs] - Timeout in ms (defaults to 6000ms)
 * @param {boolean} [options.bypassCache] - Skip cache for testing
 */
export async function executeGameQueryFetch(options = {}) {
  const env = options.env || (typeof process !== "undefined" && process.env ? process.env : {});
  const fetchFn = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : GAMEQUERY_TIMEOUT_MS;

  const apiKey = String(env.GAMEQUERY_API_KEY || env.GAMEQUERY_TOKEN || "").trim();
  const apiEmail = String(env.GAMEQUERY_EMAIL || "").trim();
  const rawTokenType = String(env.GAMEQUERY_TOKEN_TYPE || "FREE").trim().toUpperCase();
  const tokenType = rawTokenType === "PRO" ? "PRO" : "FREE";
  const defaultServersRaw = String(env.GAMEQUERY_DEFAULT_SERVERS || "").trim();

  // 1. Check whether server-side credentials are configured
  if (!apiKey || !apiEmail) {
    return {
      httpStatus: 200,
      payload: {
        ok: false,
        configured: false,
        status: "unconfigured",
        messageAr:
          "ربط GameQuery.dev جاهز على الخادم — لتفعيل الاستعلام المباشر عن خوادم الألعاب، أضف GAMEQUERY_API_KEY و GAMEQUERY_EMAIL في متغيرات بيئة الخادم الآمنة.",
        messageEn:
          "GameQuery.dev server adapter is ready. Configure GAMEQUERY_API_KEY and GAMEQUERY_EMAIL in the server environment to enable live queries.",
        supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
        defaultServersConfigured: parseEnvDefaultServers(defaultServersRaw).length > 0,
        results: [],
      },
    };
  }

  // 2. Validate requested servers (or fall back to GAMEQUERY_DEFAULT_SERVERS)
  const validation = validateAndNormalizeQueryPayload(options.servers, defaultServersRaw);
  if (!validation.valid) {
    if (validation.emptyTargets) {
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          configured: true,
          status: "ready",
          messageAr:
            "خدمة GameQuery.dev متصلة ومؤمّنة على الخادم. اختر لعبة مدعومة وأدخل عنوان الخادم (IP:Port) لفحص حالته الحية.",
          messageEn:
            "GameQuery.dev is configured on the server. Select a supported game protocol and enter a server IP:Port to query live status.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }
    return {
      httpStatus: 400,
      payload: {
        ok: false,
        configured: true,
        status: "invalid_request",
        messageAr: validation.errorAr,
        messageEn: validation.errorEn,
        supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
        results: [],
      },
    };
  }

  // 3. Check 30s response cache before hitting rate limiter or upstream API
  const cacheKey = JSON.stringify(validation.servers);
  const nowMs = Date.now();
  if (!options.bypassCache && responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    if (cached && nowMs - cached.ts < GAMEQUERY_CACHE_TTL_MS) {
      return {
        httpStatus: 200,
        payload: {
          ...cached.payload,
          cached: true,
        },
      };
    }
    responseCache.delete(cacheKey);
  }

  // 4. Enforce per-IP rate limit
  const rateCheck = checkClientRateLimit(options.clientIp || "127.0.0.1", nowMs);
  if (!rateCheck.allowed) {
    return {
      httpStatus: 429,
      payload: {
        ok: false,
        configured: true,
        status: "rate_limited",
        retryAfterSec: rateCheck.retryAfterSec,
        messageAr: `تم تجاوز الحد المسموح به لطلبات فحص الخوادم مؤقتًا. يرجى الانتظار ${rateCheck.retryAfterSec} ثانية قبل المحاولة مجددًا.`,
        messageEn: `Rate limit reached. Please wait ${rateCheck.retryAfterSec}s before querying again.`,
        supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
        results: [],
      },
    };
  }

  // 5. Execute official POST https://api.gamequery.dev/v1/post/fetch request
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  try {
    const response = await fetchFn(GAMEQUERY_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-token": apiKey,
        "x-api-token-type": tokenType,
        "x-api-token-email": apiEmail,
      },
      body: JSON.stringify({ servers: validation.servers }),
      signal: controller.signal,
    });

    const elapsedMs =
      (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - t0;
    const apiResponseTimeMs = Math.max(1, Math.round(elapsedMs));

    if (response.status === 401 || response.status === 403) {
      return {
        httpStatus: 401,
        payload: {
          ok: false,
          configured: true,
          status: "unauthorized",
          apiResponseTimeMs,
          messageAr:
            "رفضت خدمة GameQuery.dev المصادقة — يرجى التحقق من صلاحية مفتاح API والبريد الإلكتروني ونوع الحساب (FREE أو PRO) في إعدادات الخادم.",
          messageEn:
            "GameQuery.dev authentication failed. Verify GAMEQUERY_API_KEY, GAMEQUERY_EMAIL, and GAMEQUERY_TOKEN_TYPE on the server.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    if (response.status === 429) {
      return {
        httpStatus: 429,
        payload: {
          ok: false,
          configured: true,
          status: "rate_limited",
          apiResponseTimeMs,
          messageAr:
            "تم الوصول إلى الحد الأقصى لحصة استخدام GameQuery.dev الحالية. يستمر فحص سرعة الألعاب عبر LibreSpeed بشكل طبيعي.",
          messageEn:
            "GameQuery.dev API quota/rate limit reached. LibreSpeed gaming test continues normally.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    if (!response.ok) {
      return {
        httpStatus: 502,
        payload: {
          ok: false,
          configured: true,
          status: "upstream_error",
          apiResponseTimeMs,
          messageAr: `تعذر جلب بيانات الخادم من GameQuery.dev (رمز الاستجابة ${response.status}). فحص سرعة الإنترنت للألعاب يعمل بشكل طبيعي.`,
          messageEn: `GameQuery.dev returned HTTP ${response.status}. LibreSpeed gaming test continues normally.`,
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    const rawText = await response.text();
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      return {
        httpStatus: 502,
        payload: {
          ok: false,
          configured: true,
          status: "upstream_error",
          apiResponseTimeMs,
          messageAr: "استلم الخادم استجابة غير صالحة من خدمة GameQuery.dev.",
          messageEn: "Received malformed JSON response from GameQuery.dev.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    const normalized = normalizeGameQueryResponse(
      parsedJson,
      validation.servers,
      apiResponseTimeMs
    );

    if (!normalized.validSchema || normalized.results.length === 0) {
      return {
        httpStatus: 200,
        payload: {
          ok: true,
          configured: true,
          status: "empty",
          apiResponseTimeMs,
          messageAr: "لم تُرجع خدمة GameQuery.dev بيانات للخادم المطلوب (قد يكون الخادم متوقفًا أو لا يستجيب لبروتوكول الاستعلام).",
          messageEn: "GameQuery.dev returned no results for the requested server.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    const successPayload = {
      ok: true,
      configured: true,
      status: "ok",
      cached: false,
      apiResponseTimeMs,
      messageAr: "تم جلب حالة خادم اللعبة بنجاح عبر GameQuery.dev.",
      messageEn: "Successfully retrieved live game server status via GameQuery.dev.",
      supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
      results: normalized.results,
    };

    responseCache.set(cacheKey, {
      ts: Date.now(),
      payload: successPayload,
    });

    return {
      httpStatus: 200,
      payload: successPayload,
    };
  } catch (err) {
    const isAbort =
      err &&
      (err.name === "AbortError" ||
        String(err.message || "").toLowerCase().includes("abort") ||
        String(err.message || "").toLowerCase().includes("timeout"));

    if (isAbort) {
      return {
        httpStatus: 504,
        payload: {
          ok: false,
          configured: true,
          status: "timeout",
          messageAr:
            "انتهت المهلة الزمنية للاتصال بخدمة GameQuery.dev (6 ثوانٍ). لا يؤثر ذلك على قياس سرعة الألعاب عبر LibreSpeed.",
          messageEn:
            "GameQuery.dev request timed out. LibreSpeed gaming speed test is unaffected.",
          supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
          results: [],
        },
      };
    }

    return {
      httpStatus: 502,
      payload: {
        ok: false,
        configured: true,
        status: "upstream_error",
        messageAr:
          "تعذر الاتصال بخدمة GameQuery.dev حاليًا. يستمر فحص سرعة الإنترنت للألعاب عبر LibreSpeed بشكل مستقل وطبيعي.",
        messageEn:
          "Unable to reach GameQuery.dev service. LibreSpeed gaming speed test continues normally.",
        supportedProtocols: SUPPORTED_GAMEQUERY_PROTOCOLS,
        results: [],
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
