<?php
require_once __DIR__ . '/../config/db.php';
$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        $sql = 'SELECT application_id, fname, lname, email, phone, location, farm_name, status,
                       admin_note, request_date, reviewed_date FROM producer_applications';
        $params = [];
        if (isset($_GET['status'])) { $sql .= ' WHERE status = ?'; $params[] = $_GET['status']; }
        $sql .= " ORDER BY (status = 'Pending') DESC, request_date DESC";
        $s = $pdo->prepare($sql); $s->execute($params);
        respond($s->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['fname', 'lname', 'email', 'phone', 'location', 'farm_name', 'password']);
        if (strlen($d['password']) < 8) respond(['error' => 'Password must be at least 8 characters.'], 422);
        $email = trim($d['email']);
        $u = $pdo->prepare('SELECT 1 FROM users WHERE email = ?'); $u->execute([$email]);
        if ($u->fetch()) respond(['error' => 'An account with this email already exists.'], 409);
        $p = $pdo->prepare("SELECT 1 FROM producer_applications WHERE email = ? AND status = 'Pending'");
        $p->execute([$email]);
        if ($p->fetch()) respond(['error' => 'An application with this email is already pending review.'], 409);

        $ins = $pdo->prepare('INSERT INTO producer_applications (fname, lname, email, phone, location, farm_name, password_hash)
                              VALUES (?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([trim($d['fname']), trim($d['lname']), $email, trim($d['phone']), trim($d['location']),
                       trim($d['farm_name']), password_hash($d['password'], PASSWORD_BCRYPT)]);
        respond(['application_id' => (int)$pdo->lastInsertId(), 'status' => 'Pending'], 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['action', 'reviewer_user_id']);
        $note = trim($d['admin_note'] ?? '');

        // Only an Admin (auth_level 1) may review
        $chk = $pdo->prepare('SELECT 1 FROM user_auth_level WHERE user_id = ? AND auth_level = 1');
        $chk->execute([$d['reviewer_user_id']]);
        if (!$chk->fetch()) respond(['error' => 'Only an Admin can review applications.'], 403);

        try {
            $pdo->beginTransaction();
            $s = $pdo->prepare('SELECT * FROM producer_applications WHERE application_id = ? FOR UPDATE');
            $s->execute([$_GET['id']]);
            $a = $s->fetch();
            if (!$a) { $pdo->rollBack(); respond(['error' => 'Application not found'], 404); }
            if ($a['status'] !== 'Pending') { $pdo->rollBack(); respond(['error' => 'This application was already ' . strtolower($a['status']) . '.'], 409); }

            if ($d['action'] === 'reject') {
                if ($note === '') { $pdo->rollBack(); respond(['error' => 'A reason is required to reject.'], 422); }
                $r = $pdo->prepare("UPDATE producer_applications SET status='Rejected', admin_note=?, reviewed_by_user_id=?, reviewed_date=NOW() WHERE application_id=?");
                $r->execute([$note, $d['reviewer_user_id'], $_GET['id']]);
                $pdo->commit();
                respond(['status' => 'Rejected']);
            }
            if ($d['action'] !== 'approve') { $pdo->rollBack(); respond(['error' => 'action must be approve or reject'], 422); }

            $dup = $pdo->prepare('SELECT 1 FROM users WHERE email = ?'); $dup->execute([$a['email']]);
            if ($dup->fetch()) { $pdo->rollBack(); respond(['error' => 'That email now belongs to an existing account. Reject this application.'], 409); }

            // 1) producer (the farm)
            $pr = $pdo->prepare('INSERT INTO producers (producer_name, producer_desc) VALUES (?, ?)');
            $pr->execute([$a['farm_name'], $a['farm_name'] . ' — ' . $a['location']]);
            $producerId = (int)$pdo->lastInsertId();
            // 2) user login
            $us = $pdo->prepare('INSERT INTO users (email, fname, lname, password) VALUES (?, ?, ?, ?)');
            $us->execute([$a['email'], $a['fname'], $a['lname'], $a['password_hash']]);
            $userId = (int)$pdo->lastInsertId();
            // 3) role = producer (0), link to farm, profile
            $pdo->prepare('INSERT INTO user_auth_level (user_id, auth_level) VALUES (?, 0)')->execute([$userId]);
            $pdo->prepare('INSERT INTO user_producer_relation (user_id, producer_id) VALUES (?, ?)')->execute([$userId, $producerId]);
            $pdo->prepare('INSERT INTO user_profiles (user_id, phone, location) VALUES (?, ?, ?)')->execute([$userId, $a['phone'], $a['location']]);

            $up = $pdo->prepare("UPDATE producer_applications SET status='Approved', admin_note=?, created_user_id=?, created_producer_id=?, reviewed_by_user_id=?, reviewed_date=NOW() WHERE application_id=?");
            $up->execute([$note, $userId, $producerId, $d['reviewer_user_id'], $_GET['id']]);
            $pdo->commit();
            respond(['status' => 'Approved', 'user_id' => $userId, 'producer_id' => $producerId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            respond(['error' => 'Could not process application: ' . $e->getMessage()], 500);
        }
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}