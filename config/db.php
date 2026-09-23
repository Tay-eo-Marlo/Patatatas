<?php
/**
 * config/db.php
 * -------------------------------------------------------------
 * Single shared PDO connection for every api/*.php endpoint.
 *
 * Defaults match a stock XAMPP install (host=localhost, user=root,
 * empty password) per the capstone's Software Specifications table.
 * Override with environment variables if you deploy elsewhere
 * (e.g. Hostinger), so you never have to hardcode prod creds here.
 * -------------------------------------------------------------
 */

// ── Connection settings ────────────────────────────────────────
$DB_HOST = getenv('PATATATAS_DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('PATATATAS_DB_PORT') ?: '3306';
$DB_NAME = getenv('PATATATAS_DB_NAME') ?: 'rootcrops';
$DB_USER = getenv('PATATATAS_DB_USER') ?: 'root';
$DB_PASS = getenv('PATATATAS_DB_PASS') ?: '123';

// ── CORS (so the frontend can be opened from a different port/origin
//    during local dev, e.g. a live-server on :5500 hitting php -S :8000) ──
if (php_sapi_name() !== 'cli') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS;
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'error'   => 'Database connection failed.',
            'detail'  => $e->getMessage(),
            'hint'    => 'Check config/db.php credentials, or set PATATATAS_DB_* env vars.',
        ]);
        exit;
    }
    return $pdo;
}

/** Read the JSON body of a POST/PUT request as an associative array. */
function body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Send a JSON response and stop. */
function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Require the given keys to be present (and non-empty-string) in $data. */
function requireFields(array $data, array $fields): void
{
    $missing = [];
    foreach ($fields as $f) {
        if (!array_key_exists($f, $data) || $data[$f] === '' || $data[$f] === null) {
            $missing[] = $f;
        }
    }
    if ($missing) {
        respond(['error' => 'Missing required field(s): ' . implode(', ', $missing)], 422);
    }
}
