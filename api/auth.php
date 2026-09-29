<?php
/**
 * api/auth.php — login against the real `users` table.
 *
 * POST /api/auth.php  { email, password }
 *   → 200 { user_id, email, fname, lname, auth_level, role, producer_id, producer_name }
 *   → 401 { error: "Invalid email or password" }
 *   → 403 { error: "..." } if the account has no assigned role
 *
 * Role mapping used by the frontend (documented here since the dumped schema
 * doesn't itself label auth_level values):
 *   auth_level 0 = Producer (tied to a row in user_producer_relation)
 *   auth_level 1 = BSU-NPRCRTC Admin
 *   auth_level 2 = Farmer (self-registered via api/register_farmer.php)
 */
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Method not allowed'], 405);
}

$d = body();
requireFields($d, ['email', 'password']);
$pdo = db();

$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$d['email']]);
$user = $stmt->fetch();

if (!$user || !password_verify($d['password'], $user['password'])) {
    respond(['error' => 'Invalid email or password'], 401);
}

$authStmt = $pdo->prepare('SELECT auth_level FROM user_auth_level WHERE user_id = ?');
$authStmt->execute([$user['user_id']]);
$authLevel = $authStmt->fetchColumn();
$authLevel = $authLevel === false ? null : (int)$authLevel;

if ($authLevel === null) {
    respond(['error' => 'This account has no assigned role. Contact BSU-NPRCRTC Admin.'], 403);
}

$role = $authLevel === 1 ? 'admin' : ($authLevel === 2 ? 'farmer' : 'producer');

$producer = null;
if ($role === 'producer') {
    $prodStmt = $pdo->prepare('
        SELECT p.producer_id, p.producer_name
        FROM user_producer_relation upr
        JOIN producers p ON p.producer_id = upr.producer_id
        WHERE upr.user_id = ?
    ');
    $prodStmt->execute([$user['user_id']]);
    $producer = $prodStmt->fetch();
}

respond([
    'user_id'        => (int)$user['user_id'],
    'email'          => $user['email'],
    'fname'          => $user['fname'],
    'lname'          => $user['lname'],
    'auth_level'     => $authLevel,
    'role'           => $role,
    'producer_id'    => $producer['producer_id'] ?? null,
    'producer_name'  => $producer['producer_name'] ?? null,
]);