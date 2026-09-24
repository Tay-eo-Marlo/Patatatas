<?php
/**
 * api/producer_crop_stocks.php — the real "seed catalog" data source.
 *
 * IMPORTANT schema note: `producer_crop_stocks.is_public` (tinyint 0/1) is the
 * only status-like column that actually exists on this table. It matches the
 * `old_status` / `current_status` values already present in the sample
 * producer_stock_logs rows ('Public' / 'Public'), so this endpoint treats
 * "status" as Public/Private visibility — NOT the Available/Low/Unavailable
 * badge the frontend derives client-side from stock_amount for display only.
 *
 * GET    /api/producer_crop_stocks.php                     → full catalog, joined
 * GET    /api/producer_crop_stocks.php?producer_id=1        → one producer's stock
 * GET    /api/producer_crop_stocks.php?public_only=1        → only is_public=1 rows
 * GET    /api/producer_crop_stocks.php?id=1                 → one stock row
 * POST   /api/producer_crop_stocks.php                      → create a new stock entry
 *        { crop_variety_id, producer_id, unit_id, stock_amount, unit_price, is_public }
 * PUT    /api/producer_crop_stocks.php?id=1                 → update quantity/price/visibility
 *        { action_type: "Exact"|"Added"|"Subtracted", quantity, unit_price, is_public,
 *          reason_for_change, user_id, user_email, update_done_by_fname, update_done_by_lname }
 *        Automatically writes a matching row into producer_stock_logs (old/new
 *        quantity, old/new price, old/new Public-Private status).
 * DELETE /api/producer_crop_stocks.php?id=1                 → delete a stock entry
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

const CATALOG_SELECT = "
    SELECT
        pcs.producer_crop_stock_id, pcs.crop_variety_id, pcs.producer_id, pcs.unit_id,
        pcs.stock_amount, pcs.unit_price, pcs.is_public, pcs.last_update_date,
        v.variety_name, v.variety_desc, v.crop_id,
        r.crop_name,
        p.producer_name, p.producer_desc,
        u.unit_size, u.unit_abbreviated, u.unit_unabbreviated
    FROM producer_crop_stocks pcs
    JOIN varieties  v ON v.variety_id  = pcs.crop_variety_id
    JOIN rootcrops  r ON r.crop_id     = v.crop_id
    JOIN producers  p ON p.producer_id = pcs.producer_id
    JOIN rootcrop_units u ON u.unit_id = pcs.unit_id
";

function attachGenerations(PDO $pdo, array $rows): array
{
    if (!$rows) return $rows;
    $varietyIds = array_unique(array_column($rows, 'crop_variety_id'));
    $in = implode(',', array_fill(0, count($varietyIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM variety_generations WHERE variety_id IN ($in) ORDER BY generation_classification");
    $stmt->execute(array_values($varietyIds));
    $genByVariety = [];
    foreach ($stmt->fetchAll() as $g) {
        $genByVariety[$g['variety_id']][] = $g;
    }
    foreach ($rows as &$row) {
        $row['generations'] = $genByVariety[$row['crop_variety_id']] ?? [];
    }
    return $rows;
}

/** Append one audit row to producer_stock_logs. $ctx = request body (user info). */
function writeStockLog(PDO $pdo, array $ctx, array $row, string $action,
                       int $oldQty, int $newQty, float $oldPrice, float $newPrice,
                       string $oldStatus, string $newStatus): void
{
    $log = $pdo->prepare('INSERT INTO producer_stock_logs
        (user_id, user_email, update_done_by_fname, update_done_by_lname, producer_id, producer_name,
         crop, crop_variety, unit_used, old_unit_price, current_unit_price, quantity_action_type,
         old_stock_quantity, current_stock_quantity, old_status, current_status, reason_for_change, update_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())');
    $log->execute([
        $ctx['user_id'] ?? 0, $ctx['user_email'] ?? '', $ctx['update_done_by_fname'] ?? '', $ctx['update_done_by_lname'] ?? '',
        $row['producer_id'], $row['producer_name'], $row['crop_name'], $row['variety_name'], $row['unit_unabbreviated'],
        $oldPrice, $newPrice, $action, $oldQty, $newQty, $oldStatus, $newStatus,
        $ctx['reason_for_change'] ?? '',
    ]);
}

/** Light ownership guard (see note below). */
function assertOwner(array $ctx, int $producerId): void
{
    if (isset($ctx['acting_producer_id']) && (int)$ctx['acting_producer_id'] !== $producerId) {
        respond(['error' => 'You can only modify your own stock entries.'], 403);
    }
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare(CATALOG_SELECT . ' WHERE pcs.producer_crop_stock_id = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) respond(['error' => 'Stock entry not found'], 404);
            respond(attachGenerations($pdo, [$row])[0]);
        }

        $where = [];
        $params = [];
        if (isset($_GET['producer_id'])) { $where[] = 'pcs.producer_id = ?'; $params[] = $_GET['producer_id']; }
        if (isset($_GET['public_only']) && $_GET['public_only'] == '1') { $where[] = 'pcs.is_public = 1'; }
        $sql = CATALOG_SELECT . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY v.variety_name';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        respond(attachGenerations($pdo, $stmt->fetchAll()));
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['crop_variety_id', 'producer_id', 'unit_id', 'stock_amount', 'unit_price']);
        assertOwner($d, (int)$d['producer_id']);
        $dup = $pdo->prepare('SELECT 1 FROM producer_crop_stocks WHERE crop_variety_id=? AND producer_id=? AND unit_id=?');
        $dup->execute([$d['crop_variety_id'], $d['producer_id'], $d['unit_id']]);
        if ($dup->fetch()) respond(['error' => 'You already have a stock entry for this variety and unit. Edit it instead.'], 409);

        $isPublic = isset($d['is_public']) ? (int)!!$d['is_public'] : 1;
        $stmt = $pdo->prepare('INSERT INTO producer_crop_stocks (crop_variety_id, producer_id, unit_id, stock_amount, unit_price, is_public, last_update_date) VALUES (?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$d['crop_variety_id'], $d['producer_id'], $d['unit_id'], $d['stock_amount'], $d['unit_price'], $isPublic]);
        $newId = (int)$pdo->lastInsertId();

        if (!empty($d['user_id'])) {
            $s = $pdo->prepare(CATALOG_SELECT . ' WHERE pcs.producer_crop_stock_id = ?');
            $s->execute([$newId]);
            $row = $s->fetch();
            $d['reason_for_change'] = $d['reason_for_change'] ?? 'New stock entry';
            writeStockLog($pdo, $d, $row, 'Exact', 0, (int)$d['stock_amount'], 0, (float)$d['unit_price'],
                          'Private', $isPublic ? 'Public' : 'Private');
        }
        respond(['producer_crop_stock_id' => $newId], 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['action_type', 'quantity', 'user_id', 'user_email', 'update_done_by_fname', 'update_done_by_lname']);

        $stmt = $pdo->prepare(CATALOG_SELECT . ' WHERE pcs.producer_crop_stock_id = ? FOR UPDATE');
        $pdo->beginTransaction();
        $stmt->execute([$_GET['id']]);
        $current = $stmt->fetch();
        if (!$current) { $pdo->rollBack(); respond(['error' => 'Stock entry not found'], 404); }
        if (isset($d['acting_producer_id']) && (int)$d['acting_producer_id'] !== (int)$current['producer_id']) {
            $pdo->rollBack();
            respond(['error' => 'You can only modify your own stock entries.'], 403);
        }
        $oldQty     = (int)$current['stock_amount'];
        $oldPrice   = (float)$current['unit_price'];
        $oldPublic  = (int)$current['is_public'];

        $qty = (float)$d['quantity'];
        switch ($d['action_type']) {
            case 'Exact':      $newQty = (int)round($qty); break;
            case 'Added':      $newQty = $oldQty + (int)round($qty); break;
            case 'Subtracted':
                $newQty = $oldQty - (int)round($qty);
                if ($newQty < 0) { $pdo->rollBack(); respond(['error' => 'Cannot subtract more than current stock (' . $oldQty . ')'], 422); }
                break;
            default:
                $pdo->rollBack();
                respond(['error' => 'action_type must be Exact, Added, or Subtracted'], 422);
        }

        $newPrice  = isset($d['unit_price']) ? (float)$d['unit_price'] : $oldPrice;
        $newPublic = isset($d['is_public']) ? (int)!!$d['is_public'] : $oldPublic;

        $upd = $pdo->prepare('UPDATE producer_crop_stocks SET stock_amount = ?, unit_price = ?, is_public = ?, last_update_date = NOW() WHERE producer_crop_stock_id = ?');
        $upd->execute([$newQty, $newPrice, $newPublic, $_GET['id']]);

        // Mirror the exact producer_stock_logs schema/sample data (status stored as 'Public'/'Private').
        $log = $pdo->prepare('INSERT INTO producer_stock_logs
            (user_id, user_email, update_done_by_fname, update_done_by_lname, producer_id, producer_name,
             crop, crop_variety, unit_used, old_unit_price, current_unit_price, quantity_action_type,
             old_stock_quantity, current_stock_quantity, old_status, current_status, reason_for_change, update_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $log->execute([
            $d['user_id'], $d['user_email'], $d['update_done_by_fname'], $d['update_done_by_lname'],
            $current['producer_id'], $current['producer_name'], $current['crop_name'], $current['variety_name'],
            $current['unit_unabbreviated'], $oldPrice, $newPrice, $d['action_type'],
            $oldQty, $newQty, $oldPublic ? 'Public' : 'Private', $newPublic ? 'Public' : 'Private',
            $d['reason_for_change'] ?? '',
        ]);

        $pdo->commit();
        respond([
            'updated' => true,
            'producer_crop_stock_id' => (int)$_GET['id'],
            'old_stock_quantity' => $oldQty, 'current_stock_quantity' => $newQty,
            'old_unit_price' => $oldPrice, 'current_unit_price' => $newPrice,
            'old_status' => $oldPublic ? 'Public' : 'Private', 'current_status' => $newPublic ? 'Public' : 'Private',
        ]);
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        $s = $pdo->prepare(CATALOG_SELECT . ' WHERE pcs.producer_crop_stock_id = ?');
        $s->execute([$_GET['id']]);
        $row = $s->fetch();
        if (!$row) respond(['deleted' => false], 404);
        assertOwner($d, (int)$row['producer_id']);

        $stmt = $pdo->prepare('DELETE FROM producer_crop_stocks WHERE producer_crop_stock_id = ?');
        $stmt->execute([$_GET['id']]);
        $d['reason_for_change'] = $d['reason_for_change'] ?? 'Stock entry removed';
        writeStockLog($pdo, $d, $row, 'Deleted', (int)$row['stock_amount'], 0,
                      (float)$row['unit_price'], (float)$row['unit_price'],
                      $row['is_public'] ? 'Public' : 'Private', 'Removed');
        respond(['deleted' => $stmt->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}
