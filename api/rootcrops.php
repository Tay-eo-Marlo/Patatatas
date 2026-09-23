<?php
/**
 * api/rootcrops.php — CRUD for the `rootcrops` table.
 * GET    /api/rootcrops.php            → list all crops
 * GET    /api/rootcrops.php?id=1       → one crop
 * POST   /api/rootcrops.php            → create  { crop_name, crop_description }
 * PUT    /api/rootcrops.php?id=1       → update  { crop_name, crop_description }
 * DELETE /api/rootcrops.php?id=1       → delete (cascades to rootcrop_units, varieties)
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT * FROM rootcrops WHERE crop_id = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            $row ? respond($row) : respond(['error' => 'Crop not found'], 404);
        }
        respond($pdo->query('SELECT * FROM rootcrops ORDER BY crop_name')->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['crop_name', 'crop_description']);
        $stmt = $pdo->prepare('INSERT INTO rootcrops (crop_name, crop_description) VALUES (?, ?)');
        $stmt->execute([$d['crop_name'], $d['crop_description']]);
        respond(['crop_id' => (int)$pdo->lastInsertId(), 'crop_name' => $d['crop_name'], 'crop_description' => $d['crop_description']], 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['crop_name', 'crop_description']);
        $stmt = $pdo->prepare('UPDATE rootcrops SET crop_name = ?, crop_description = ? WHERE crop_id = ?');
        $stmt->execute([$d['crop_name'], $d['crop_description'], $_GET['id']]);
        respond(['updated' => $stmt->rowCount() > 0]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $stmt = $pdo->prepare('DELETE FROM rootcrops WHERE crop_id = ?');
        $stmt->execute([$_GET['id']]);
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
