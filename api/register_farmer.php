<?php
require_once __DIR__ . '/../config/db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed'], 405);

$d = body();
requireFields($d, ['email', 'fname', 'lname', 'phone', 'location', 'password']);
if (strlen($d['password']) < 8) respond(['error' => 'Password must be at least 8 characters.'], 422);

$pdo = db();
$dup = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
$dup->execute([$d['email']]);
if ($dup->fetch()) respond(['error' => 'An account with this email already exists.'], 409);

try {
    $pdo->beginTransaction();
    $hash = password_hash($d['password'], PASSWORD_BCRYPT);
    $u = $pdo->prepare('INSERT INTO users (email, fname, lname, password) VALUES (?, ?, ?, ?)');
    $u->execute([$d['email'], $d['fname'], $d['lname'], $hash]);
    $userId = (int)$pdo->lastInsertId();
    $a = $pdo->prepare('INSERT INTO user_auth_level (user_id, auth_level) VALUES (?, 2)');
    $a->execute([$userId]);
    $p = $pdo->prepare('INSERT INTO user_profiles (user_id, phone, location) VALUES (?, ?, ?)');
    $p->execute([$userId, trim($d['phone']), trim($d['location'])]);
    $pdo->commit();
    respond(['user_id' => $userId, 'email' => $d['email'], 'fname' => $d['fname'], 'lname' => $d['lname'], 'role' => 'farmer'], 201);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(['error' => 'Could not create account: ' . $e->getMessage()], 500);
}