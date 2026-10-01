<?php
/**
 * api/orders.php — real order records (Admin Order Management + Farmer My Orders).
 *
 * GET    ?user_id=3      → orders placed by that account (Farmer's own view)
 * GET    ?status=Pending Payment → filter by status
 * GET                    → all orders, newest first (Admin view)
 * POST   { user_id (nullable), customer_role, customer_name, contact, email,
 *          pickup_location, payment_method, payment_ref, items: [{variety_name, producer_name, quantity, unit_price}] }
 * PUT    ?id=ORD-xxx { status }   → Admin updates order status
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $o = $pdo->prepare('SELECT * FROM orders WHERE order_id = ?');
            $o->execute([$_GET['id']]);
            $order = $o->fetch();
            if (!$order) respond(['error' => 'Order not found'], 404);
            $i = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ?');
            $i->execute([$_GET['id']]);
            $order['items'] = $i->fetchAll();
            respond($order);
        }
        if (isset($_GET['producer_name'])) {
            $pn = $_GET['producer_name'];
            $q = $pdo->prepare('SELECT DISTINCT o.* FROM orders o
                                JOIN order_items oi ON oi.order_id = o.order_id
                                WHERE oi.producer_name = ? ORDER BY o.date_ordered DESC');
            $q->execute([$pn]);
            $rows = $q->fetchAll();
            if ($rows) {
                $ids = array_column($rows, 'order_id');
                $in  = implode(',', array_fill(0, count($ids), '?'));
                $it  = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($in) AND producer_name = ?");
                $it->execute(array_merge($ids, [$pn]));
                $by = [];
                foreach ($it->fetchAll() as $r) { $by[$r['order_id']][] = $r; }
                foreach ($rows as $k => $r) {
                    $rows[$k]['items'] = $by[$r['order_id']] ?? [];
                    $rows[$k]['my_subtotal'] = array_sum(array_map(fn($i) => $i['quantity'] * $i['unit_price'], $rows[$k]['items']));
                    unset($rows[$k]['payment_ref']);   // producers don't need payment details
                }
            }
            respond($rows);
        }
        $where = []; $params = [];
        if (isset($_GET['user_id'])) { $where[] = 'user_id = ?'; $params[] = $_GET['user_id']; }
        if (isset($_GET['status']))  { $where[] = 'status = ?';  $params[] = $_GET['status']; }
        $sql = 'SELECT * FROM orders' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY date_ordered DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();
        if ($orders) {
            $ids = array_column($orders, 'order_id');
            $in = implode(',', array_fill(0, count($ids), '?'));
            $i = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($in)");
            $i->execute($ids);
            $itemsByOrder = [];
            foreach ($i->fetchAll() as $row) { $itemsByOrder[$row['order_id']][] = $row; }
            foreach ($orders as &$o) { $o['items'] = $itemsByOrder[$o['order_id']] ?? []; }
        }
        respond($orders);
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['user_id', 'customer_role', 'customer_name', 'contact', 'email', 'pickup_location', 'payment_method', 'items']);
        $chk = $pdo->prepare('SELECT 1 FROM user_auth_level WHERE user_id = ? AND auth_level = 2');
        $chk->execute([$d['user_id']]);
        if (!$chk->fetch()) respond(['error' => 'Only a signed-in Farmer account can place orders.'], 403);
        $d['customer_role'] = 'farmer';
        if (!is_array($d['items']) || !count($d['items'])) respond(['error' => 'Order must contain at least one item.'], 422);
        if ($d['payment_method'] !== 'cash' && empty($d['payment_ref'])) respond(['error' => 'Payment reference is required for non-cash payments.'], 422);

        $total = 0;
        foreach ($d['items'] as $it) {
            if (empty($it['variety_name']) || !isset($it['quantity']) || !isset($it['unit_price'])) {
                respond(['error' => 'Each item needs variety_name, quantity, and unit_price.'], 422);
            }
            $total += (float)$it['quantity'] * (float)$it['unit_price'];
        }

        $orderId = 'ORD-' . date('Ymd') . '-' . str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $status = 'Pending Payment';

        try {
            $pdo->beginTransaction();
            $ins = $pdo->prepare('INSERT INTO orders
                (order_id, user_id, customer_role, customer_name, contact, email, pickup_location,
                 payment_method, payment_ref, total_amount, status, date_ordered)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
            $ins->execute([
                $orderId, $d['user_id'] ?? null, $d['customer_role'], $d['customer_name'], $d['contact'], $d['email'],
                $d['pickup_location'], $d['payment_method'], $d['payment_method'] === 'cash' ? null : $d['payment_ref'],
                $total, $status,
            ]);
            $itemIns = $pdo->prepare('INSERT INTO order_items (order_id, variety_name, producer_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)');
            foreach ($d['items'] as $it) {
                $itemIns->execute([$orderId, $it['variety_name'], $it['producer_name'] ?? '', $it['quantity'], $it['unit_price']]);
            }
            $pdo->commit();
            respond(['order_id' => $orderId, 'total_amount' => $total, 'status' => $status], 201);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            respond(['error' => 'Could not place order: ' . $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['status']);
        $allowed = ['Pending Payment', 'Paid - Awaiting Pickup', 'Completed', 'Cancelled'];
        if (!in_array($d['status'], $allowed, true)) respond(['error' => 'Invalid status.'], 422);
        $stmt = $pdo->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
        $stmt->execute([$d['status'], $_GET['id']]);
        if ($stmt->rowCount() === 0) respond(['error' => 'Order not found'], 404);
        respond(['updated' => true, 'status' => $d['status']]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}