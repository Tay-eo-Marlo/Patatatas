<?php
/**
 * api/change_password.php
 * POST { user_id, current_password, new_password }
 */
require_once __DIR__ . '/../config/db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed'], 405);

$d = body();
requireFields($d, ['user_id', 'current_password', 'new_password']);
if (strlen($d['new_password']) < 8) respond(['error' => 'New password must be at least 8 characters.'], 422);

$pdo = db();
$u = $pdo->prepare('SELECT password FROM users WHERE user_id = ?');
$u->execute([$d['user_id']]);
$row = $u->fetch();
if (!$row || !password_verify($d['current_password'], $row['password'])) {
    respond(['error' => 'Current password is incorrect.'], 401);
}
$hash = password_hash($d['new_password'], PASSWORD_BCRYPT);
$stmt = $pdo->prepare('UPDATE users SET password = ? WHERE user_id = ?');
$stmt->execute([$hash, $d['user_id']]);
respond(['updated' => true]);