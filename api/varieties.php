<?php
/**
 * api/varieties.php — CRUD for the `varieties` table (Admin-only in the UI,
 * matching the "only Admins add new varieties" business rule).
 *
 * GET    /api/varieties.php                → list, joined with crop_name + alt names
 * GET    /api/varieties.php?id=3           → one variety, joined
 * GET    /api/varieties.php?crop_id=1      → varieties for one crop
 * POST   /api/varieties.php                → create { crop_id, variety_name, variety_desc }
 * PUT    /api/varieties.php?id=3           → update { crop_id, variety_name, variety_desc }
 * DELETE /api/varieties.php?id=3           → delete (cascades to alt names, generations, stocks)
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

function withAltNames(PDO $pdo, array $rows): array
{
    if (!$rows) return $rows;
    $ids = array_column($rows, 'variety_id');
    $in  = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT variety_id, alt_name FROM varieties_alt_names WHERE variety_id IN ($in)");
    $stmt->execute($ids);
    $altByVariety = [];
    foreach ($stmt->fetchAll() as $r) {
        $altByVariety[$r['variety_id']][] = $r['alt_name'];
    }
    foreach ($rows as &$row) {
        $row['alt_names'] = $altByVariety[$row['variety_id']] ?? [];
    }
    return $rows;
}

switch ($method) {
    case 'GET':
        $base = 'SELECT v.*, r.crop_name FROM varieties v JOIN rootcrops r ON r.crop_id = v.crop_id';
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("$base WHERE v.variety_id = ?");
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) respond(['error' => 'Variety not found'], 404);
            respond(withAltNames($pdo, [$row])[0]);
        }
        if (isset($_GET['crop_id'])) {
            $stmt = $pdo->prepare("$base WHERE v.crop_id = ? ORDER BY v.variety_name");
            $stmt->execute([$_GET['crop_id']]);
            respond(withAltNames($pdo, $stmt->fetchAll()));
        }
        respond(withAltNames($pdo, $pdo->query("$base ORDER BY v.variety_name")->fetchAll()));
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['crop_id', 'variety_name', 'variety_desc']);
        $stmt = $pdo->prepare('INSERT INTO varieties (crop_id, variety_name, variety_desc) VALUES (?, ?, ?)');
        $stmt->execute([$d['crop_id'], $d['variety_name'], $d['variety_desc']]);
        $newId = (int)$pdo->lastInsertId();
        if (!empty($d['alt_names']) && is_array($d['alt_names'])) {
            $ins = $pdo->prepare('INSERT INTO varieties_alt_names (variety_id, alt_name) VALUES (?, ?)');
            foreach ($d['alt_names'] as $alt) {
                if (trim($alt) !== '') $ins->execute([$newId, $alt]);
            }
        }
        respond(['variety_id' => $newId, 'crop_id' => $d['crop_id'], 'variety_name' => $d['variety_name'], 'variety_desc' => $d['variety_desc']], 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['crop_id', 'variety_name', 'variety_desc']);
        $stmt = $pdo->prepare('UPDATE varieties SET crop_id=?, variety_name=?, variety_desc=? WHERE variety_id=?');
        $stmt->execute([$d['crop_id'], $d['variety_name'], $d['variety_desc'], $_GET['id']]);
        respond(['updated' => $stmt->rowCount() > 0]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $stmt = $pdo->prepare('DELETE FROM varieties WHERE variety_id = ?');
        $stmt->execute([$_GET['id']]);
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
