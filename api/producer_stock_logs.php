<?php
/**
 * api/producer_stock_logs.php — read-only audit trail.
 * Rows are written automatically by producer_crop_stocks.php on every
 * quantity/price/visibility change; this endpoint is for viewing them.
 *
 * GET /api/producer_stock_logs.php                    → most recent 100 logs
 * GET /api/producer_stock_logs.php?producer_id=1       → logs for one producer
 * GET /api/producer_stock_logs.php?crop_variety=Granola→ logs for one variety name
 */
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(['error' => 'Method not allowed. Logs are append-only via producer_crop_stocks.php.'], 405);
}

$pdo = db();
$where = [];
$params = [];
if (isset($_GET['producer_id'])) { $where[] = 'producer_id = ?'; $params[] = $_GET['producer_id']; }
if (isset($_GET['crop_variety'])) { $where[] = 'crop_variety = ?'; $params[] = $_GET['crop_variety']; }

$sql = 'SELECT * FROM producer_stock_logs' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY update_date DESC LIMIT 100';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
respond($stmt->fetchAll());
