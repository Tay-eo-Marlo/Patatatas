<?php
/**
 * api/register_farmer.php — self-service Farmer account creation.
 * Farmers get an instant active account (no admin approval step, unlike
 * Producers, who need BPI accreditation reviewed first).
 *
 * POST { email, fname, lname, password }
 *   → 201 { user_id, email, fname, lname, role: "farmer" }
 *   → 409 if the email is already registered
 */
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Method not allowed'], 405);
}

$d = body();
requireFields($d, ['email', 'fname', 'lname', 'password']);
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
    $pdo->commit();
    respond(['user_id' => $userId, 'email' => $d['email'], 'fname' => $d['fname'], 'lname' => $d['lname'], 'role' => 'farmer'], 201);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(['error' => 'Could not create account: ' . $e->getMessage()], 500);
}