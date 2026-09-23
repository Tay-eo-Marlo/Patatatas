<?php
/**
 * api/rootcrop_units.php — CRUD for the `rootcrop_units` table.
 * GET    /api/rootcrop_units.php?crop_id=1   → list units for a crop (or all if omitted)
 * POST   /api/rootcrop_units.php             → create { crop_id, unit_size, unit_abbreviated, unit_unabbreviated }
 * PUT    /api/rootcrop_units.php?id=1        → update (same fields)
 * DELETE /api/rootcrop_units.php?id=1        → delete
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT * FROM rootcrop_units WHERE unit_id = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            $row ? respond($row) : respond(['error' => 'Unit not found'], 404);
        }
        if (isset($_GET['crop_id'])) {
            $stmt = $pdo->prepare('SELECT * FROM rootcrop_units WHERE crop_id = ? ORDER BY unit_id');
            $stmt->execute([$_GET['crop_id']]);
            respond($stmt->fetchAll());
        }
        respond($pdo->query('SELECT * FROM rootcrop_units ORDER BY crop_id, unit_id')->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['crop_id', 'unit_size', 'unit_abbreviated', 'unit_unabbreviated']);
        $stmt = $pdo->prepare('INSERT INTO rootcrop_units (crop_id, unit_size, unit_abbreviated, unit_unabbreviated) VALUES (?, ?, ?, ?)');
        $stmt->execute([$d['crop_id'], $d['unit_size'], $d['unit_abbreviated'], $d['unit_unabbreviated']]);
        respond(['unit_id' => (int)$pdo->lastInsertId()] + $d, 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['crop_id', 'unit_size', 'unit_abbreviated', 'unit_unabbreviated']);
        $stmt = $pdo->prepare('UPDATE rootcrop_units SET crop_id=?, unit_size=?, unit_abbreviated=?, unit_unabbreviated=? WHERE unit_id=?');
        $stmt->execute([$d['crop_id'], $d['unit_size'], $d['unit_abbreviated'], $d['unit_unabbreviated'], $_GET['id']]);
        respond(['updated' => $stmt->rowCount() > 0]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $stmt = $pdo->prepare('DELETE FROM rootcrop_units WHERE unit_id = ?');
        $stmt->execute([$_GET['id']]);
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
