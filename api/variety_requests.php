<?php
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
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare(REQ_SELECT . ' WHERE vr.request_id = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            $row ? respond($row) : respond(['error' => 'Request not found'], 404);
        }
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
            (producer_id, requested_by_user_id, crop_id, variety_name, variety_desc, generation_classification,
             alt_names, requested_unit_size, requested_unit_abbreviated, requested_unit_unabbreviated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([
            $d['producer_id'], $d['requested_by_user_id'], $d['crop_id'], $name, trim($d['variety_desc']), $gen,
            trim($d['alt_names'] ?? ''), trim($d['requested_unit_size'] ?? ''),
            trim($d['requested_unit_abbreviated'] ?? ''), trim($d['requested_unit_unabbreviated'] ?? ''),
        ]);
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

            // Admin can adjust these before finalizing the variety.
            $cropId   = isset($d['crop_id']) ? (int)$d['crop_id'] : (int)$req['crop_id'];
            $name     = isset($d['variety_name']) ? trim($d['variety_name']) : $req['variety_name'];
            $desc     = isset($d['variety_desc']) ? trim($d['variety_desc']) : $req['variety_desc'];
            $genNum   = isset($d['generation_classification']) ? (int)$d['generation_classification'] : (int)$req['generation_classification'];
            $unitSize   = trim($d['unit_size'] ?? $req['requested_unit_size']);
            $unitAbbr   = trim($d['unit_abbreviated'] ?? $req['requested_unit_abbreviated']);
            $unitFull   = trim($d['unit_unabbreviated'] ?? $req['requested_unit_unabbreviated']);
            if ($unitAbbr === '' || $unitFull === '') { $pdo->rollBack(); respond(['error' => 'A unit type (abbreviated + full name) is required to approve.'], 422); }

            $dup = $pdo->prepare('SELECT 1 FROM varieties WHERE crop_id = ? AND LOWER(variety_name) = LOWER(?)');
            $dup->execute([$cropId, $name]);
            if ($dup->fetch()) { $pdo->rollBack(); respond(['error' => 'A variety with this name already exists. Reject this request instead.'], 409); }

            // Find-or-create the unit for this crop.
            $uf = $pdo->prepare('SELECT unit_id FROM rootcrop_units WHERE crop_id = ? AND LOWER(unit_abbreviated) = LOWER(?)');
            $uf->execute([$cropId, $unitAbbr]);
            $unitId = $uf->fetchColumn();
            if ($unitId === false) {
                $uc = $pdo->prepare('INSERT INTO rootcrop_units (crop_id, unit_size, unit_abbreviated, unit_unabbreviated) VALUES (?, ?, ?, ?)');
                $uc->execute([$cropId, $unitSize ?: $unitAbbr, $unitAbbr, $unitFull]);
                $unitId = (int)$pdo->lastInsertId();
            }

            $v = $pdo->prepare('INSERT INTO varieties (crop_id, variety_name, variety_desc) VALUES (?, ?, ?)');
            $v->execute([$cropId, $name, $desc]);
            $varietyId = (int)$pdo->lastInsertId();

            if ($req['alt_names'] !== '') {
                $alt = $pdo->prepare('INSERT INTO varieties_alt_names (variety_id, alt_name) VALUES (?, ?)');
                foreach (explode(',', $req['alt_names']) as $a) { if (trim($a) !== '') $alt->execute([$varietyId, trim($a)]); }
            }

            $g = $pdo->prepare('INSERT INTO variety_generations (variety_id, generation_classification, generation_desc) VALUES (?, ?, ?)');
            $g->execute([$varietyId, $genNum, 'G' . $genNum . ' record created from approved producer request #' . $req['request_id']]);

            $u = $pdo->prepare("UPDATE variety_requests SET status='Approved', admin_note=?, created_variety_id=?, created_unit_id=?, reviewed_by_user_id=?, reviewed_date=NOW() WHERE request_id=?");
            $u->execute([$note, $varietyId, $unitId, $d['reviewer_user_id'], $_GET['id']]);
            $pdo->commit();
            respond(['status' => 'Approved', 'variety_id' => $varietyId, 'unit_id' => $unitId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            respond(['error' => 'Could not process request: ' . $e->getMessage()], 500);
        }
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}