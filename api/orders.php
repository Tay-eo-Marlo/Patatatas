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
        requireFields($d, ['customer_role', 'customer_name', 'contact', 'email', 'pickup_location', 'payment_method', 'items']);
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