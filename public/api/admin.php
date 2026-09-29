<?php
declare(strict_types=1);

// Same-origin OVH gateway for the administration panel. Credentials and the
// Supabase server key live in /.cudis-secrets.php, outside the public webroot.

header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

function reply(int $status, array $data): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function config(): array {
    $file = dirname(__DIR__, 2) . '/.cudis-secrets.php';
    if (!is_file($file)) reply(503, ['error' => 'La connexion admin OVH n’est pas configurée.']);
    $value = require $file;
    if (!is_array($value) || empty($value['admin_email']) || empty($value['admin_password_hash']) || empty($value['supabase_url']) || empty($value['supabase_secret_key'])) {
        reply(503, ['error' => 'La configuration admin OVH est incomplète.']);
    }
    return $value;
}

function same_origin(): bool {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return false;
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = explode(':', $_SERVER['HTTP_HOST'] ?? '', 2)[0];
    return is_string($originHost) && hash_equals(strtolower($requestHost), strtolower($originHost));
}

function rate_limit_login(): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash('sha256', $ip);
    $dir = sys_get_temp_dir() . '/cudis-admin-login';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $file = $dir . '/' . $key . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) return;
    flock($handle, LOCK_EX);
    $state = json_decode((string) stream_get_contents($handle), true);
    if (!is_array($state) || ($state['started'] ?? 0) < time() - 3600) $state = ['started' => time(), 'attempts' => 0];
    if (($state['attempts'] ?? 0) >= 10) {
        flock($handle, LOCK_UN);
        fclose($handle);
        reply(429, ['error' => 'Trop de tentatives. Réessayez dans une heure.']);
    }
    $state['attempts']++;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function require_admin(): array {
    if (empty($_SESSION['admin_email']) || ($_SESSION['expires_at'] ?? 0) < time()) {
        session_unset();
        session_destroy();
        reply(401, ['error' => 'Session expirée. Reconnectez-vous.']);
    }
    $_SESSION['expires_at'] = time() + 28800;
    return ['email' => (string) $_SESSION['admin_email']];
}

$config = config();
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('CUDIS_ADMIN');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');
session_start();

$action = $_GET['action'] ?? '';
if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') reply(200, require_admin());

if (in_array($action, ['login', 'logout', 'proxy'], true) && !same_origin()) {
    reply(403, ['error' => 'Origine de requête refusée.']);
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    rate_limit_login();
    $data = json_decode((string) file_get_contents('php://input'), true);
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    if (!hash_equals(strtolower((string) $config['admin_email']), $email) || !password_verify($password, (string) $config['admin_password_hash'])) {
        usleep(350000);
        reply(401, ['error' => 'E-mail ou mot de passe incorrect.']);
    }
    session_regenerate_id(true);
    $_SESSION['admin_email'] = (string) $config['admin_email'];
    $_SESSION['expires_at'] = time() + 28800;
    reply(200, ['email' => (string) $config['admin_email']]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_admin();
    $_SESSION = [];
    session_destroy();
    reply(200, ['ok' => true]);
}

if ($action !== 'proxy' || $_SERVER['REQUEST_METHOD'] !== 'POST') reply(404, ['error' => 'Route inconnue.']);
require_admin();

$targetMethod = strtoupper($_SERVER['HTTP_X_ADMIN_TARGET_METHOD'] ?? '');
$targetPath = $_SERVER['HTTP_X_ADMIN_TARGET_PATH'] ?? '';
$allowedMethod = in_array($targetMethod, ['GET', 'POST', 'PATCH', 'DELETE'], true);
$restAllowed = preg_match('~^/rest/v1/(members|programs|partners|resources|contact_submissions|assistant_knowledge)(\?.*)?$~', $targetPath) === 1;
$storageAllowed = preg_match('~^/storage/v1/object/(member-photos|partner-logos|resources)/[A-Za-z0-9._/-]+$~', $targetPath) === 1
    && !str_contains($targetPath, '..');
if (!$allowedMethod || (!$restAllowed && !$storageAllowed)) reply(403, ['error' => 'Cette opération admin n’est pas autorisée.']);

$url = rtrim((string) $config['supabase_url'], '/') . $targetPath;
$forwardHeaders = [
    'apikey: ' . $config['supabase_secret_key'],
    'Authorization: Bearer ' . $config['supabase_secret_key'],
];
foreach (['content-type', 'prefer', 'accept', 'range', 'content-range', 'x-upsert', 'cache-control'] as $name) {
    $value = $_SERVER['HTTP_X_ADMIN_' . strtoupper(str_replace('-', '_', $name))] ?? null;
    if ($name === 'content-type') $value = $_SERVER['CONTENT_TYPE'] ?? $value;
    if (is_string($value) && $value !== '') $forwardHeaders[] = $name . ': ' . $value;
}

$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_CUSTOMREQUEST => $targetMethod,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 45,
]);
if (!in_array($targetMethod, ['GET', 'HEAD'], true)) curl_setopt($curl, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
$response = curl_exec($curl);
if ($response === false) {
    error_log('CUDIS admin upstream error: ' . curl_error($curl));
    curl_close($curl);
    reply(502, ['error' => 'Le service de données est momentanément indisponible.']);
}
$status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
$headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
$contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
curl_close($curl);
$responseBody = substr($response, $headerSize);
http_response_code($status);
if ($contentType !== '') header('Content-Type: ' . $contentType);
foreach (['content-range', 'preference-applied', 'location', 'etag'] as $name) {
    if (preg_match('/^' . preg_quote($name, '/') . ':\s*(.+)$/im', substr($response, 0, $headerSize), $match)) header($name . ': ' . trim($match[1]));
}
echo $responseBody;
