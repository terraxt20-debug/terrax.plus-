<?php
/**
 * Server-Side Proxy for Official GameQuery.dev API (PHP / Apache Runtime)
 * Endpoint: POST https://api.gamequery.dev/v1/post/fetch
 * Keeps GAMEQUERY_API_KEY strictly on the server and normalizes responses for gaming.html.
 */

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$GAMEQUERY_API_KEY = '';
$GAMEQUERY_EMAIL = '';
$GAMEQUERY_TOKEN_TYPE = 'FREE';
$GAMEQUERY_DEFAULT_SERVERS = '';

if (file_exists(__DIR__ . '/gamequery_apikey.php')) {
    include_once __DIR__ . '/gamequery_apikey.php';
}

$envKey = getenv('GAMEQUERY_API_KEY') ?: getenv('GAMEQUERY_TOKEN');
$envEmail = getenv('GAMEQUERY_EMAIL');
$envType = getenv('GAMEQUERY_TOKEN_TYPE');
$envDefaults = getenv('GAMEQUERY_DEFAULT_SERVERS');

if (!empty($envKey)) {
    $GAMEQUERY_API_KEY = trim($envKey);
}
if (!empty($envEmail)) {
    $GAMEQUERY_EMAIL = trim($envEmail);
}
if (!empty($envType)) {
    $GAMEQUERY_TOKEN_TYPE = strtoupper(trim($envType)) === 'PRO' ? 'PRO' : 'FREE';
}
if (!empty($envDefaults)) {
    $GAMEQUERY_DEFAULT_SERVERS = trim($envDefaults);
}

$supportedProtocols = [
    ['game_id' => 'counterstrike2', 'labelEn' => 'Counter-Strike 2 (Source 2 / A2S)', 'labelAr' => 'Counter-Strike 2 (خوادم Source 2)', 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'counterstrike16', 'labelEn' => 'Counter-Strike 1.6 (GoldSrc / A2S)', 'labelAr' => 'Counter-Strike 1.6 (خوادم A2S)', 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'csgo', 'labelEn' => 'CS:GO (Source / A2S)', 'labelAr' => 'CS:GO (خوادم Source)', 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'rust', 'labelEn' => 'Rust (Source / A2S)', 'labelAr' => 'Rust (خوادم البقاء الرسمية والمجتمعية)', 'category' => 'br', 'defaultPort' => 28015],
    ['game_id' => 'minecraft', 'labelEn' => 'Minecraft (Java SLP)', 'labelAr' => 'Minecraft (خوادم Java)', 'category' => 'br', 'defaultPort' => 25565],
    ['game_id' => 'fivem', 'labelEn' => 'FiveM / GTA V RP (CitizenFX)', 'labelAr' => 'FiveM / GTA V RP (خوادم CitizenFX)', 'category' => 'br', 'defaultPort' => 30120],
    ['game_id' => 'arkse', 'labelEn' => 'ARK: Survival Evolved (A2S)', 'labelAr' => 'ARK: Survival Evolved (خوادم A2S)', 'category' => 'br', 'defaultPort' => 27015],
    ['game_id' => 'teamfortress2', 'labelEn' => 'Team Fortress 2 (Source / A2S)', 'labelAr' => 'Team Fortress 2 (خوادم Source)', 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'dayz', 'labelEn' => 'DayZ (Steam / A2S)', 'labelAr' => 'DayZ (خوادم البقاء)', 'category' => 'br', 'defaultPort' => 27016],
    ['game_id' => 'palworld', 'labelEn' => 'Palworld (Dedicated Server)', 'labelAr' => 'Palworld (خوادم مخصصة)', 'category' => 'br', 'defaultPort' => 8211],
    ['game_id' => 'left4dead2', 'labelEn' => 'Left 4 Dead 2 (Source / A2S)', 'labelAr' => 'Left 4 Dead 2 (خوادم Source)', 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'garrysmod', 'labelEn' => "Garry's Mod (Source / A2S)", 'labelAr' => "Garry's Mod (خوادم Source)", 'category' => 'fps', 'defaultPort' => 27015],
    ['game_id' => 'valheim', 'labelEn' => 'Valheim (A2S)', 'labelAr' => 'Valheim (خوادم A2S)', 'category' => 'br', 'defaultPort' => 2457],
    ['game_id' => 'terraria', 'labelEn' => 'Terraria', 'labelAr' => 'Terraria (خوادم مخصصة)', 'category' => 'br', 'defaultPort' => 7777],
];

$allowedGameIds = array_column($supportedProtocols, 'game_id');

if (empty($GAMEQUERY_API_KEY) || empty($GAMEQUERY_EMAIL)) {
    echo json_encode([
        'ok' => false,
        'configured' => false,
        'status' => 'unconfigured',
        'messageAr' => 'ربط GameQuery.dev جاهز على الخادم — لتفعيل الاستعلام المباشر عن خوادم الألعاب، أضف GAMEQUERY_API_KEY و GAMEQUERY_EMAIL في متغيرات بيئة الخادم الآمنة.',
        'messageEn' => 'GameQuery.dev server adapter is ready. Configure GAMEQUERY_API_KEY and GAMEQUERY_EMAIL in the server environment to enable live queries.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function gq_is_private_host($host) {
    $lower = strtolower(trim($host));
    if ($lower === 'localhost' || $lower === '0.0.0.0' || $lower === '::1' || strpos($lower, ':') !== false) {
        return true;
    }
    if (filter_var($lower, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return !filter_var(
            $lower,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }
    return !preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/', $lower);
}

$rawBody = file_get_contents('php://input');
$parsedBody = !empty($rawBody) ? json_decode($rawBody, true) : [];
$requestedServers = (is_array($parsedBody) && isset($parsedBody['servers']) && is_array($parsedBody['servers']))
    ? $parsedBody['servers']
    : [];

if (empty($requestedServers) && !empty($GAMEQUERY_DEFAULT_SERVERS)) {
    $parts = explode(',', $GAMEQUERY_DEFAULT_SERVERS);
    foreach ($parts as $part) {
        $item = trim($part);
        $atPos = strpos($item, '@');
        if ($atPos !== false && $atPos > 0) {
            $gId = strtolower(trim(substr($item, 0, $atPos)));
            $addr = trim(substr($item, $atPos + 1));
            $requestedServers[] = ['game_id' => $gId, 'servers' => [$addr]];
        }
    }
}

if (empty($requestedServers)) {
    echo json_encode([
        'ok' => true,
        'configured' => true,
        'status' => 'ready',
        'messageAr' => 'خدمة GameQuery.dev متصلة ومؤمّنة على الخادم. اختر لعبة مدعومة وأدخل عنوان الخادم (IP:Port) لفحص حالته الحية.',
        'messageEn' => 'GameQuery.dev is configured on the server. Select a supported game protocol and enter a server IP:Port to query live status.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$validatedGroups = [];
$totalCount = 0;

foreach ($requestedServers as $group) {
    if (!is_array($group)) continue;
    $gameId = isset($group['game_id']) ? strtolower(trim((string)$group['game_id'])) : '';
    if (!in_array($gameId, $allowedGameIds, true)) {
        http_response_code(400);
        echo json_encode([
            'ok' => false,
            'configured' => true,
            'status' => 'invalid_request',
            'messageAr' => 'اللعبة أو البروتوكول المطلوب غير مدعوم في قائمة GameQuery.dev المعتمدة.',
            'supportedProtocols' => $supportedProtocols,
            'results' => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $addrs = isset($group['servers']) && is_array($group['servers']) ? $group['servers'] : [];
    $cleanAddrs = [];
    foreach ($addrs as $addr) {
        $addrStr = trim((string)$addr);
        if (!preg_match('/^([^:\s\/]+):(\d{1,5})$/', $addrStr, $m)) {
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'configured' => true,
                'status' => 'invalid_request',
                'messageAr' => 'صيغة عنوان الخادم غير صالحة — استخدم الصيغة IP:Port.',
                'supportedProtocols' => $supportedProtocols,
                'results' => [],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $host = $m[1];
        $port = (int)$m[2];
        if ($port < 1 || $port > 65535 || gq_is_private_host($host)) {
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'configured' => true,
                'status' => 'invalid_request',
                'messageAr' => 'لا يُسمح بالاستعلام عن عناوين الشبكات المحلية أو الخاصة أو منافذ غير صالحة.',
                'supportedProtocols' => $supportedProtocols,
                'results' => [],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $totalCount++;
        if ($totalCount > 10) {
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'configured' => true,
                'status' => 'invalid_request',
                'messageAr' => 'الحد الأقصى للاستعلام الواحد هو 10 خوادم.',
                'supportedProtocols' => $supportedProtocols,
                'results' => [],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $cleanAddrs[] = strtolower($host) . ':' . $port;
    }
    if (!empty($cleanAddrs)) {
        $validatedGroups[] = ['game_id' => $gameId, 'servers' => array_values(array_unique($cleanAddrs))];
    }
}

$t0 = microtime(true);
$ch = curl_init('https://api.gamequery.dev/v1/post/fetch');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 6,
    CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'x-api-token: ' . $GAMEQUERY_API_KEY,
        'x-api-token-type: ' . $GAMEQUERY_TOKEN_TYPE,
        'x-api-token-email: ' . $GAMEQUERY_EMAIL,
    ],
    CURLOPT_POSTFIELDS => json_encode(['servers' => $validatedGroups]),
]);

$responseBody = curl_exec($ch);
$curlErrNo = curl_errno($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$apiResponseTimeMs = max(1, (int)round((microtime(true) - $t0) * 1000));

if ($curlErrNo === CURLE_OPERATION_TIMEDOUT) {
    http_response_code(504);
    echo json_encode([
        'ok' => false,
        'configured' => true,
        'status' => 'timeout',
        'apiResponseTimeMs' => $apiResponseTimeMs,
        'messageAr' => 'انتهت المهلة الزمنية للاتصال بخدمة GameQuery.dev (6 ثوانٍ). لا يؤثر ذلك على قياس سرعة الألعاب عبر LibreSpeed.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($responseBody === false || $httpCode === 0) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'configured' => true,
        'status' => 'upstream_error',
        'apiResponseTimeMs' => $apiResponseTimeMs,
        'messageAr' => 'تعذر الاتصال بخدمة GameQuery.dev حاليًا. يستمر فحص سرعة الإنترنت للألعاب عبر LibreSpeed بشكل طبيعي.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($httpCode === 401 || $httpCode === 403) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'configured' => true,
        'status' => 'unauthorized',
        'apiResponseTimeMs' => $apiResponseTimeMs,
        'messageAr' => 'رفضت خدمة GameQuery.dev المصادقة — يرجى التحقق من صلاحية مفتاح API والبريد الإلكتروني ونوع الحساب في إعدادات الخادم.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($httpCode === 429) {
    http_response_code(429);
    echo json_encode([
        'ok' => false,
        'configured' => true,
        'status' => 'rate_limited',
        'apiResponseTimeMs' => $apiResponseTimeMs,
        'messageAr' => 'تم الوصول إلى الحد الأقصى لحصة استخدام GameQuery.dev الحالية.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$decoded = json_decode($responseBody, true);
if ($httpCode < 200 || $httpCode >= 300 || !is_array($decoded)) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'configured' => true,
        'status' => 'upstream_error',
        'apiResponseTimeMs' => $apiResponseTimeMs,
        'messageAr' => 'تعذر استلام بيانات صالحة من خدمة GameQuery.dev.',
        'supportedProtocols' => $supportedProtocols,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawItems = isset($decoded['results']) && is_array($decoded['results']) ? $decoded['results'] : [];
$results = [];
foreach ($rawItems as $item) {
    if (!is_array($item)) continue;
    $gId = isset($item['game_id']) ? preg_replace('/[^a-z0-9_-]/i', '', strtolower((string)$item['game_id'])) : $validatedGroups[0]['game_id'];
    $addr = isset($item['address']) ? strip_tags((string)$item['address']) : $validatedGroups[0]['servers'][0];
    $online = !empty($item['online']);
    $probeLatency = isset($item['latency']) && is_numeric($item['latency']) ? (int)round($item['latency']) : null;
    $name = isset($item['name']) ? trim(strip_tags((string)$item['name'])) : null;
    $map = isset($item['map']) ? trim(strip_tags((string)$item['map'])) : null;
    $pOnline = isset($item['players']['online']) && is_numeric($item['players']['online']) ? (int)$item['players']['online'] : null;
    $pMax = isset($item['players']['max']) && is_numeric($item['players']['max']) ? (int)$item['players']['max'] : null;

    $results[] = [
        'game_id' => $gId,
        'address' => $addr,
        'online' => $online,
        'name' => $name ?: null,
        'map' => $map ?: null,
        'players' => ['online' => $pOnline, 'max' => $pMax],
        'probeLatencyMs' => $probeLatency,
        'probeLatencySource' => 'gamequery_worker_node',
        'apiResponseTimeMs' => $apiResponseTimeMs,
    ];
}

echo json_encode([
    'ok' => true,
    'configured' => true,
    'status' => empty($results) ? 'empty' : 'ok',
    'apiResponseTimeMs' => $apiResponseTimeMs,
    'messageAr' => empty($results)
        ? 'لم تُرجع خدمة GameQuery.dev بيانات للخادم المطلوب.'
        : 'تم جلب حالة خادم اللعبة بنجاح عبر GameQuery.dev.',
    'supportedProtocols' => $supportedProtocols,
    'results' => $results,
], JSON_UNESCAPED_UNICODE);
