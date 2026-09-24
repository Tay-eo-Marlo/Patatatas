<?php
/**
 * api/variety_requests.php — producer "Request New Variety" workflow.
 *
 * GET    ?producer_id=1        → that producer's requests
 * GET    ?status=Pending       → filter by status (admin review queue)
 * GET                          → all requests (Pending first)
 * POST   { producer_id, requested_by_user_id, crop_id, variety_name, variety_desc,
 *          generation_classification (0|1|2), alt_names (comma separated, optional) }
 * PUT    ?id=5 { action: "approve"|"reject", reviewer_user_id, admin_note }
 *        approve → creates varieties + varieties_alt_names + variety_generations rows
 *        reject  → admin_note is required
 * DELETE ?id=5 { acting_producer_id }  → producer cancels their own PENDING request
 */
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

const REQ_SELECT = "
    SELECT vr.*, r.crop_name, p.producer_name
    FROM variety_requests vr
    JOIN rootcrops r ON r.crop_id = vr.crop_id
    JOIN producers p ON p.producer_id = vr.producer_id
";

switch ($method) {
    case 'GET':
        $where = []; $params = [];
        if (isset($_GET['producer_id'])) { $where[] = 'vr.producer_id = ?'; $params[] = $_GET['producer_id']; }
        if (isset($_GET['status']))      { $where[] = 'vr.status = ?';      $params[] = $_GET['status']; }
        $sql = REQ_SELECT . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
             . " ORDER BY (vr.status = 'Pending') DESC, vr.request_date DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        respond($stmt->fetchAll());
        break;

    case 'POST':
        $d = body();
        requireFields($d, ['producer_id', 'requested_by_user_id', 'crop_id', 'variety_name', 'variety_desc']);
        $name = trim($d['variety_name']);
        $gen  = isset($d['generation_classification']) ? (int)$d['generation_classification'] : 0;
        if ($gen < 0 || $gen > 2) respond(['error' => 'generation_classification must be 0, 1 or 2'], 422);

        $dup = $pdo->prepare('SELECT 1 FROM varieties WHERE crop_id = ? AND LOWER(variety_name) = LOWER(?)');
        $dup->execute([$d['crop_id'], $name]);
        if ($dup->fetch()) respond(['error' => '"' . $name . '" already exists in the catalog. Use Add Stock Entry to list it.'], 409);

        $pend = $pdo->prepare("SELECT 1 FROM variety_requests WHERE crop_id = ? AND LOWER(variety_name) = LOWER(?) AND status = 'Pending'");
        $pend->execute([$d['crop_id'], $name]);
        if ($pend->fetch()) respond(['error' => 'A pending request for "' . $name . '" already exists.'], 409);

        $ins = $pdo->prepare('INSERT INTO variety_requests
            (producer_id, requested_by_user_id, crop_id, variety_name, variety_desc, generation_classification, alt_names)
            VALUES (?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([$d['producer_id'], $d['requested_by_user_id'], $d['crop_id'], $name,
                       trim($d['variety_desc']), $gen, trim($d['alt_names'] ?? '')]);
        respond(['request_id' => (int)$pdo->lastInsertId(), 'status' => 'Pending'], 201);
        break;

    case 'PUT':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        requireFields($d, ['action', 'reviewer_user_id']);
        $note = trim($d['admin_note'] ?? '');

        try {
            $pdo->beginTransaction();
            $s = $pdo->prepare('SELECT * FROM variety_requests WHERE request_id = ? FOR UPDATE');
            $s->execute([$_GET['id']]);
            $req = $s->fetch();
            if (!$req) { $pdo->rollBack(); respond(['error' => 'Request not found'], 404); }
            if ($req['status'] !== 'Pending') { $pdo->rollBack(); respond(['error' => 'This request was already ' . strtolower($req['status']) . '.'], 409); }

            if ($d['action'] === 'reject') {
                if ($note === '') { $pdo->rollBack(); respond(['error' => 'A reason is required to reject a request.'], 422); }
                $u = $pdo->prepare("UPDATE variety_requests SET status='Rejected', admin_note=?, reviewed_by_user_id=?, reviewed_date=NOW() WHERE request_id=?");
                $u->execute([$note, $d['reviewer_user_id'], $_GET['id']]);
                $pdo->commit();
                respond(['status' => 'Rejected']);
            }

            if ($d['action'] !== 'approve') { $pdo->rollBack(); respond(['error' => 'action must be approve or reject'], 422); }

            // Re-check duplicate at approval time (another admin/producer may have added it meanwhile)
            $dup = $pdo->prepare('SELECT 1 FROM varieties WHERE crop_id = ? AND LOWER(variety_name) = LOWER(?)');
            $dup->execute([$req['crop_id'], $req['variety_name']]);
            if ($dup->fetch()) { $pdo->rollBack(); respond(['error' => 'A variety with this name already exists. Reject this request instead.'], 409); }

            $v = $pdo->prepare('INSERT INTO varieties (crop_id, variety_name, variety_desc) VALUES (?, ?, ?)');
            $v->execute([$req['crop_id'], $req['variety_name'], $req['variety_desc']]);
            $varietyId = (int)$pdo->lastInsertId();

            if ($req['alt_names'] !== '') {
                $alt = $pdo->prepare('INSERT INTO varieties_alt_names (variety_id, alt_name) VALUES (?, ?)');
                foreach (explode(',', $req['alt_names']) as $a) {
                    if (trim($a) !== '') $alt->execute([$varietyId, trim($a)]);
                }
            }

            $g = $pdo->prepare('INSERT INTO variety_generations (variety_id, generation_classification, generation_desc) VALUES (?, ?, ?)');
            $g->execute([$varietyId, $req['generation_classification'],
                         'G' . $req['generation_classification'] . ' record created from approved producer request #' . $req['request_id']]);

            $u = $pdo->prepare("UPDATE variety_requests SET status='Approved', admin_note=?, created_variety_id=?, reviewed_by_user_id=?, reviewed_date=NOW() WHERE request_id=?");
            $u->execute([$note, $varietyId, $d['reviewer_user_id'], $_GET['id']]);
            $pdo->commit();
            respond(['status' => 'Approved', 'variety_id' => $varietyId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            respond(['error' => 'Could not process request: ' . $e->getMessage()], 500);
        }
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) respond(['error' => 'Missing ?id='], 422);
        $d = body();
        $s = $pdo->prepare('SELECT * FROM variety_requests WHERE request_id = ?');
        $s->execute([$_GET['id']]);
        $req = $s->fetch();
        if (!$req) respond(['error' => 'Request not found'], 404);
        if (isset($d['acting_producer_id']) && (int)$d['acting_producer_id'] !== (int)$req['producer_id']) {
            respond(['error' => 'You can only cancel your own requests.'], 403);
        }
        if ($req['status'] !== 'Pending') respond(['error' => 'Only pending requests can be cancelled.'], 409);
        $del = $pdo->prepare('DELETE FROM variety_requests WHERE request_id = ?');
        $del->execute([$_GET['id']]);
        respond(['deleted' => $del->rowCount() > 0]);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}