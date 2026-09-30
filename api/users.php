<?php
/**
 * api/users.php — read/update a user's own profile (name, email, phone, location).
 * GET ?id=3
 * PUT ?id=3 { fname, lname, email, phone, location }
 */
require_once __DIR__ . '/../config/db.php';
$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);

switch ($method) {
    case 'GET':
        $u = $pdo->prepare('SELECT user_id, email, fname, lname FROM users WHERE user_id = ?');
        $u->execute([$_GET['id']]);
        $user = $u->fetch();
        if (!$user) respond(['error' => 'User not found'], 404);
        $p = $pdo->prepare('SELECT phone, location FROM user_profiles WHERE user_id = ?');
        $p->execute([$_GET['id']]);
        $prof = $p->fetch();
        respond($user + ['phone' => $prof['phone'] ?? '', 'location' => $prof['location'] ?? '']);
        break;

    case 'PUT':
        $d = body();
        requireFields($d, ['fname', 'lname', 'email']);
        $dup = $pdo->prepare('SELECT 1 FROM users WHERE email = ? AND user_id <> ?');
        $dup->execute([$d['email'], $_GET['id']]);
        if ($dup->fetch()) respond(['error' => 'That email is already used by another account.'], 409);

        $stmt = $pdo->prepare('UPDATE users SET fname = ?, lname = ?, email = ? WHERE user_id = ?');
        $stmt->execute([trim($d['fname']), trim($d['lname']), trim($d['email']), $_GET['id']]);

        $up = $pdo->prepare('INSERT INTO user_profiles (user_id, phone, location) VALUES (?, ?, ?)
                              ON DUPLICATE KEY UPDATE phone = VALUES(phone), location = VALUES(location)');
        $up->execute([$_GET['id'], trim($d['phone'] ?? ''), trim($d['location'] ?? '')]);

        respond(['updated' => true]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}