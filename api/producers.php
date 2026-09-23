<?php
/**
 * api/producers.php — CRUD for the `producers` table.
 * GET    /api/producers.php          → list all producers
 * GET    /api/producers.php?id=1     → one producer
 * POST   /api/producers.php          → create { producer_name, producer_desc }
 * PUT    /api/producers.php?id=1     → update { producer_name, producer_desc }
 * DELETE /api/producers.php?id=1     → delete (cascades to producer_crop_stocks, user_producer_relation)
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT * FROM producers WHERE producer_id = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            $row ? respond($row) : respond(['error' => 'Producer not found'], 404);
        }
        respond($pdo->query('SELECT * FROM producers ORDER BY producer_name')->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['producer_name', 'producer_desc']);
        $stmt = $pdo->prepare('INSERT INTO producers (producer_name, producer_desc) VALUES (?, ?)');
        $stmt->execute([$d['producer_name'], $d['producer_desc']]);
        respond(['producer_id' => (int)$pdo->lastInsertId()] + $d, 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['producer_name', 'producer_desc']);
        $stmt = $pdo->prepare('UPDATE producers SET producer_name=?, producer_desc=? WHERE producer_id=?');
        $stmt->execute([$d['producer_name'], $d['producer_desc'], $_GET['id']]);
        respond(['updated' => $stmt->rowCount() > 0]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $stmt = $pdo->prepare('DELETE FROM producers WHERE producer_id = ?');
        $stmt->execute([$_GET['id']]);
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
