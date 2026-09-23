<?php
/**
 * api/variety_generations.php — CRUD for `variety_generations`.
 *
 * Schema (exactly as defined in rootcrops.sql):
 *   variety_id                 int   (FK -> varieties.variety_id)
 *   variety_generation_id      int   (PK)
 *   generation_classification  int   (0 = foundation/breeder stock, 1 = first
 *                                      daughter generation, 2 = second daughter
 *                                      generation — mirrors the G0/G1/G2 seed
 *                                      hierarchy used across the UI)
 *   generation_desc            varchar(256)
 *
 * DUPLICATE PREVENTION: after running
 * sql/fix_variety_generations_duplicates.sql once, the database enforces a
 * UNIQUE constraint on (variety_id, generation_classification). POST below
 * is written as an upsert (INSERT ... ON DUPLICATE KEY UPDATE), so no matter
 * who calls this endpoint — this app, a script, phpMyAdmin — a second
 * "G0 for variety 2" can never become a duplicate row; it just updates the
 * existing one's description. This is automatic and needs no manual cleanup
 * after the one-time migration is applied.
 *
 * GET    /api/variety_generations.php?variety_id=3   → list generations for a variety
 * GET    /api/variety_generations.php                → list all
 * POST   /api/variety_generations.php                → create OR update-in-place { variety_id, generation_classification, generation_desc }
 * PUT    /api/variety_generations.php?id=1           → update by primary key (same fields)
 * DELETE /api/variety_generations.php?id=1           → delete
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        $base = 'SELECT g.*, v.variety_name FROM variety_generations g JOIN varieties v ON v.variety_id = g.variety_id';
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("$base WHERE g.variety_generation_id = ?");
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            $row ? respond($row) : respond(['error' => 'Generation record not found'], 404);
        }
        if (isset($_GET['variety_id'])) {
            $stmt = $pdo->prepare("$base WHERE g.variety_id = ? ORDER BY g.generation_classification");
            $stmt->execute([$_GET['variety_id']]);
            respond($stmt->fetchAll());
        }
        respond($pdo->query("$base ORDER BY v.variety_name, g.generation_classification")->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['variety_id', 'generation_classification', 'generation_desc']);
        // Upsert: if a row for this (variety_id, generation_classification) already
        // exists — enforced by the UNIQUE constraint added in
        // sql/fix_variety_generations_duplicates.sql — update its description
        // instead of erroring or creating a duplicate. This makes duplicate
        // prevention automatic for every caller (the app, curl, phpMyAdmin's
        // "Insert" tab, anything), not just the frontend's own pre-check.
        $stmt = $pdo->prepare('
            INSERT INTO variety_generations (variety_id, generation_classification, generation_desc)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE generation_desc = VALUES(generation_desc)
        ');
        $stmt->execute([$d['variety_id'], $d['generation_classification'], $d['generation_desc']]);
        $idStmt = $pdo->prepare('SELECT variety_generation_id FROM variety_generations WHERE variety_id = ? AND generation_classification = ?');
        $idStmt->execute([$d['variety_id'], $d['generation_classification']]);
        respond(['variety_generation_id' => (int)$idStmt->fetchColumn()] + $d, 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['variety_id', 'generation_classification', 'generation_desc']);
        $stmt = $pdo->prepare('UPDATE variety_generations SET variety_id=?, generation_classification=?, generation_desc=? WHERE variety_generation_id=?');
        $stmt->execute([$d['variety_id'], $d['generation_classification'], $d['generation_desc'], $_GET['id']]);
        respond(['updated' => $stmt->rowCount() > 0]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $stmt = $pdo->prepare('DELETE FROM variety_generations WHERE variety_generation_id = ?');
        $stmt->execute([$_GET['id']]);
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}