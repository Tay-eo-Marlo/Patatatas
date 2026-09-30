<?php
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
        FROM user_producer_relation upr JOIN producers p ON p.producer_id = upr.producer_id
        WHERE upr.user_id = ?');
    $prodStmt->execute([$user['user_id']]);
    $producer = $prodStmt->fetch();
}

$profStmt = $pdo->prepare('SELECT phone, location FROM user_profiles WHERE user_id = ?');
$profStmt->execute([$user['user_id']]);
$profile = $profStmt->fetch();

respond([
    'user_id'        => (int)$user['user_id'],
    'email'          => $user['email'],
    'fname'          => $user['fname'],
    'lname'          => $user['lname'],
    'phone'          => $profile['phone'] ?? '',
    'location'       => $profile['location'] ?? '',
    'auth_level'     => $authLevel,
    'role'           => $role,
    'producer_id'    => $producer['producer_id'] ?? null,
    'producer_name'  => $producer['producer_name'] ?? null,
]);