// ── RBAC STATE ─────────────────────────────────────────────
let currentRole = 'admin';

// ═══════════════════════════════════════════════════════════
// ── LIVE BACKEND INTEGRATION (rootcrops.sql + PHP API) ────────
// When this file is served through the PHP backend (php -S / XAMPP /
// Hostinger), the calls below fetch REAL data from MySQL and replace
// the offline demo data. Opened directly as a local file (file://),
// these fetches fail silently and the app keeps running on the demo
// arrays below exactly as before — so the file still previews fine
// on its own, but becomes a real full-stack app once you run the
// backend. See README.md for how to run it locally.
// ═══════════════════════════════════════════════════════════
const API_BASE = 'api/';
let usingLiveBackend = false;
let currentUser = null; // set by real login via api/auth.php: {user_id, email, fname, lname, role, producer_id, producer_name}

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error('API GET ' + path + ' failed: ' + res.status);
  return res.json();
}
async function apiSend(method, path, payload) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (method + ' ' + path + ' failed: ' + res.status));
  return data;
}

// crop_name (from rootcrops.sql) → the frontend's filter-chip type keys / emoji
function cropTypeKey(cropName) {
  const n = (cropName || '').toLowerCase();
  if (n.includes('sweet')) return 'sweet';
  if (n.includes('cassava')) return 'cassava';
  if (n.includes('taro')) return 'taro';
  if (n.includes('yam')) return 'yam';
  return 'potato';
}
function cropEmoji(cropName) {
  return { potato:'🥔', sweet:'🍠', cassava:'🪵', taro:'🌿', yam:'🟤' }[cropTypeKey(cropName)];
}
function colorForType(typeKey) {
  return { potato:'#E8F5E9', sweet:'#F3E5F5', cassava:'#FFF3E0', taro:'#E8F5E9', yam:'#EDE7F6' }[typeKey] || '#E8F5E9';
}
function formatDbDate(sqlDatetime) {
  if (!sqlDatetime) return '—';
  const d = new Date(sqlDatetime.replace(' ', 'T'));
  if (isNaN(d)) return sqlDatetime;
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
// Multi-generation badge row for DB-sourced varieties (variety_generations
// describes the whole breeding pipeline for a variety, not a single batch —
// see api/variety_generations.php doc comment — so a DB item can show several).
function genBadges(generations) {
  if (!generations || !generations.length) return '<span class="text-muted" style="font-size:10px;">No generation records yet</span>';
  return generations.map(g => genBadge('G' + g.generation_classification)).join(' ');
}

// Adapts one joined row from api/producer_crop_stocks.php into the shape the
// existing renderCatalog()/detail-modal code already knows how to draw.
function mapDbRowToSeed(row) {
  const typeKey = cropTypeKey(row.crop_name);
  const qtyNum = Number(row.stock_amount);
  return {
    name: row.variety_name,
    type: typeKey,
    emoji: cropEmoji(row.crop_name),
    scientific: row.variety_desc || row.crop_name,
    qty: qtyNum.toLocaleString() + ' ' + row.unit_abbreviated,
    qtyNum: qtyNum,
    unitLabel: row.unit_unabbreviated,
    status: qtyNum === 0 ? 'unavailable' : qtyNum < 20 ? 'low' : 'available',
    price: '₱' + Number(row.unit_price).toFixed(2) + '/' + row.unit_abbreviated,
    priceNum: Number(row.unit_price),
    supplier: row.producer_name,
    contact: row.producer_desc || 'Contact info not tracked for this producer in the current dataset',
    color: colorForType(typeKey),
    generations: row.generations || [],
    isPublic: !!row.is_public,
    lastUpdated: formatDbDate(row.last_update_date),
    // Live-DB identity fields, used by the write-path functions below to
    // know this card is backed by a real row (vs. the offline demo data).
    dbId: row.producer_crop_stock_id,
    cropVarietyId: row.crop_variety_id,
    producerId: row.producer_id,
    unitId: row.unit_id,
    unitAbbrev: row.unit_abbreviated,
  };
}

async function tryLoadLiveCatalog() {
  try {
    const rows = await apiGet('producer_crop_stocks.php');
    if (!Array.isArray(rows)) throw new Error('Unexpected response shape');
    const liveSeeds = rows.map(mapDbRowToSeed);
    // Prepend live rows and drop any earlier live rows from a previous
    // refresh, but keep the offline demo rows so the catalog isn't empty
    // while the real dataset (currently just Granola) is still small.
    for (let i = seeds.length - 1; i >= 0; i--) { if (seeds[i].dbId !== undefined) seeds.splice(i, 1); }
    seeds.unshift(...liveSeeds);
    usingLiveBackend = true;
    applyAdminFilter(); applyProducerFilter(); applyFarmerFilter(); applyPublicFilter(); renderProducerStock();
    showToast('🟢 Connected to live database — ' + liveSeeds.length + ' record(s) loaded from rootcrops.sql.');
  } catch (e) {
    usingLiveBackend = false;
    console.info('Live backend not reachable, staying in offline demo mode:', e.message);
  }
}

// ── SEED DATA (offline demo fallback — used until/unless the live
//    backend above successfully loads real rows) ──────────────────
// Each seed record carries a `generation` (G0/G1/G2) and `parentBatch` per the
// Capstone's Seed Hierarchy Constraint: a G1 record must trace to a parent G0 batch,
// and a G2 record must trace to a parent G1 batch. G0 (foundation/breeder-level
// stock) has no parent. `lastUpdated` satisfies the Data Currency Standard business
// rule — every inventory record must display when it was last touched.
let seeds = [
  { name:'Igorota', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'1,240 kg', qtyNum:1240, status:'available', price:'₱85/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#E8F5E9', generation:'G0', parentBatch:null, batchCode:'IGR-G0-0142', lastUpdated:'Mar 24, 2026' },
  { name:'Granola', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'186 kg', qtyNum:186, status:'low', price:'₱78/kg', supplier:'N. Compelio', contact:'+63 916 123 4567', color:'#FFF8E1', generation:'G1', parentBatch:'IGR-G0-0142', batchCode:'GRN-G1-0098', lastUpdated:'Mar 20, 2026' },
  { name:'Cosima', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'620 kg', qtyNum:620, status:'available', price:'₱82/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#E8F5E9', generation:'G0', parentBatch:null, batchCode:'COS-G0-0071', lastUpdated:'Mar 26, 2026' },
  { name:'Fina', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'48 kg', qtyNum:48, status:'unavailable', price:'₱90/kg', supplier:'L. Antonio', contact:'+63 918 765 4321', color:'#FFEBEE', generation:'G2', parentBatch:'GRN-G1-0098', batchCode:'FIN-G2-0203', lastUpdated:'Mar 21, 2026' },
  { name:'Mexican', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'310 kg', qtyNum:310, status:'available', price:'₱76/kg', supplier:'N. Compelio', contact:'+63 916 123 4567', color:'#E8F5E9', generation:'G1', parentBatch:'COS-G0-0071', batchCode:'MEX-G1-0056', lastUpdated:'Mar 18, 2026' },
  { name:'Violet Queen', type:'sweet', emoji:'🍠', scientific:'Ipomoea batatas', qty:'830 kg', qtyNum:830, status:'available', price:'₱45/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#F3E5F5', generation:'G0', parentBatch:null, batchCode:'VQ-G0-0033', lastUpdated:'Mar 27, 2026' },
  { name:'APO 1', type:'sweet', emoji:'🍠', scientific:'Ipomoea batatas', qty:'240 kg', qtyNum:240, status:'available', price:'₱40/kg', supplier:'N. Compelio', contact:'+63 916 123 4567', color:'#F3E5F5', generation:'G1', parentBatch:'VQ-G0-0033', batchCode:'APO-G1-0077', lastUpdated:'Mar 25, 2026' },
  { name:'Rayong 5', type:'cassava', emoji:'🪵', scientific:'Manihot esculenta', qty:'1,500 kg', qtyNum:1500, status:'available', price:'₱28/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#FFF3E0', generation:'G0', parentBatch:null, batchCode:'RAY-G0-0021', lastUpdated:'Mar 28, 2026' },
  { name:'Lakan 1', type:'taro', emoji:'🌿', scientific:'Colocasia esculenta', qty:'420 kg', qtyNum:420, status:'available', price:'₱55/kg', supplier:'S. Bokilis', contact:'+63 917 234 5678', color:'#E8F5E9', generation:'G0', parentBatch:null, batchCode:'LAK-G0-0015', lastUpdated:'Mar 28, 2026' },
  { name:'Purple Yam', type:'yam', emoji:'🟤', scientific:'Dioscorea alata', qty:'180 kg', qtyNum:180, status:'low', price:'₱65/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#EDE7F6', generation:'G1', parentBatch:'PY-G0-0011', batchCode:'PY-G1-0055', lastUpdated:'Mar 19, 2026' },
  { name:'Cosima B', type:'potato', emoji:'🥔', scientific:'Solanum tuberosum', qty:'290 kg', qtyNum:290, status:'available', price:'₱81/kg', supplier:'N. Compelio', contact:'+63 916 123 4567', color:'#E8F5E9', generation:'G2', parentBatch:'MEX-G1-0056', batchCode:'COSB-G2-0134', lastUpdated:'Mar 22, 2026' },
  { name:'White Flesh', type:'sweet', emoji:'🍠', scientific:'Ipomoea batatas', qty:'0 kg', qtyNum:0, status:'unavailable', price:'₱42/kg', supplier:'BSU-NPRCRTC', contact:'(074) 422-2435', color:'#FFEBEE', generation:'G1', parentBatch:'VQ-G0-0033', batchCode:'WF-G1-0044', lastUpdated:'Mar 15, 2026' },
];

// Generation badge helper — color-coded to reinforce the G0→G1→G2 lineage rule
function genBadge(g) {
  const map = {
    G0: '<span class="badge" style="background:#E3E0FF;color:#4C3FBF;" title="G0 — Foundation/breeder-level stock, no parent batch">🧬 G0</span>',
    G1: '<span class="badge" style="background:#DDEFFF;color:#1565C0;" title="G1 — First-generation daughter stock">🧬 G1</span>',
    G2: '<span class="badge" style="background:#FFE7D6;color:#B85C00;" title="G2 — Second-generation daughter stock">🧬 G2</span>',
  };
  return map[g] || '';
}

// Seed Hierarchy Constraint helpers — a G1 batch must link to a G0 parent,
// and a G2 batch must link to a G1 parent. G0 has no eligible parent.
function requiredParentGen(childGen) {
  return childGen === 'G1' ? 'G0' : childGen === 'G2' ? 'G1' : null;
}
function getEligibleParents(childGen) {
  const needGen = requiredParentGen(childGen);
  if (!needGen) return [];
  return seeds.filter(s => s.generation === needGen);
}
function renderParentOptions(selectEl, childGen, selectedCode) {
  const eligible = getEligibleParents(childGen);
  if (eligible.length === 0) {
    selectEl.innerHTML = '<option value="">No ' + requiredParentGen(childGen) + ' batches available yet</option>';
    return;
  }
  selectEl.innerHTML = eligible.map(p =>
    `<option value="${p.batchCode}" ${p.batchCode===selectedCode?'selected':''}>${p.batchCode} — ${p.name} (${p.generation})</option>`
  ).join('');
}
function toggleAddSeedParent() {
  const gen = document.getElementById('add-seed-generation').value;
  const group = document.getElementById('add-seed-parent-group');
  const sel = document.getElementById('add-seed-parent');
  if (gen === 'G0') { group.style.display = 'none'; return; }
  group.style.display = 'block';
  renderParentOptions(sel, gen, null);
}
function toggleEditSeedParent() {
  const gen = document.getElementById('edit-seed-generation').value;
  const group = document.getElementById('edit-seed-parent-group');
  const sel = document.getElementById('edit-seed-parent');
  if (gen === 'G0') { group.style.display = 'none'; return; }
  group.style.display = 'block';
  renderParentOptions(sel, gen, null);
}

// ── EXISTING GENERATION RECORDS (remove-from-database support) ─────
// A variety can have several saved generation rows (G0/G1/G2, one row each
// — see api/variety_generations.php doc comment). This lists whichever ones
// exist for the variety being edited and lets Admin delete any one of them
// with a real DELETE to variety_generations.php, same as Add/Edit writes.
function renderExistingGenerations(s) {
  const wrap = document.getElementById('edit-seed-existing-gens-wrap');
  const list = document.getElementById('edit-seed-existing-gens');
  if (!wrap || !list) return;
  if (!s.generations || s.cropVarietyId === undefined) {
    // Offline demo rows only track a single generation inline (no
    // per-record history to remove) — hide the section entirely.
    wrap.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  wrap.style.display = 'block';
  if (!s.generations.length) {
    list.innerHTML = '<div class="text-muted" style="font-size:11px;">No generation records saved yet.</div>';
    return;
  }
  list.innerHTML = s.generations.map(g => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--cream);border:1px solid var(--parchment);border-radius:8px;padding:6px 10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${genBadge('G' + g.generation_classification)}
        <span style="font-size:11px;color:var(--bark);">${g.generation_desc}</span>
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:transparent;padding:4px 8px;" onclick="deleteGenerationRecord(${g.variety_generation_id}, ${s.cropVarietyId})">🗑️ Remove</button>
    </div>`).join('');
}

async function deleteGenerationRecord(varietyGenerationId, cropVarietyId) {
  if (!usingLiveBackend) { showToast('⚠️ Removing generation records requires the live database backend.'); return; }
  try {
    await apiSend('DELETE', 'variety_generations.php?id=' + varietyGenerationId);
    showToast('✅ Generation record removed from the database.');
    await tryLoadLiveCatalog();
    const refreshed = seeds.find(x => x.cropVarietyId === cropVarietyId);
    if (refreshed) {
      renderExistingGenerations(refreshed);
    } else {
      const wrap = document.getElementById('edit-seed-existing-gens-wrap');
      if (wrap) wrap.style.display = 'none';
    }
  } catch (e) {
    showToast('⚠️ Could not remove generation record: ' + e.message);
  }
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function statusBadge(s) {
  if(s==='available') return '<span class="badge badge-available">● Available</span>';
  if(s==='low') return '<span class="badge badge-low">● Low Stock</span>';
  return '<span class="badge badge-unavailable">● Unavailable</span>';
}

// ── CATALOG RENDER (role-aware) ─────────────────────────────
function renderCatalog(data, gridId, role) {
  const g = document.getElementById(gridId);
  if(!g) return;

  if(data.length === 0) {
    g.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--muted);">
      <div style="font-size:36px;margin-bottom:12px;">🔍</div>
      <div style="font-size:14px;font-weight:600;color:var(--earth);">No varieties found</div>
      <div style="font-size:12px;margin-top:4px;">Try a different filter or search term.</div>
    </div>`;
    return;
  }

  g.innerHTML = data.map(s => {
    const sd = JSON.stringify(s).replace(/"/g,'&quot;');
    let footer = '';
    let clickFn = '';

    if(role === 'admin') {
      footer = `<div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();openEditSeed(${sd})">✏️ Edit Variety</button>
        ${s.dbId !== undefined ? `<button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();openLiveStockUpdate(${sd})">📦 Update Stock</button>` : ''}
      </div>`;
      clickFn = `openEditSeed(${sd})`;
    } else if(role === 'farmer') {
      if(s.status !== 'unavailable') {
        footer = `<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();openFarmerDetail(${sd})">ℹ️ Details</button>
          <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();addToCart('${s.name}')">🛒 Add to Cart</button>
        </div>`;
        clickFn = `openFarmerDetail(${sd})`;
      } else {
        footer = `<div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px;padding:6px;background:var(--cream);border-radius:6px;">Currently unavailable</div>`;
      }
    } else if(role === 'producer') {
      if (s.dbId !== undefined && currentUser && currentUser.producer_id === s.producerId) {
        footer = `<button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:8px;" onclick="event.stopPropagation();openLiveStockUpdate(${sd})">📦 Update My Stock</button>`;
        clickFn = `openLiveStockUpdate(${sd})`;
      } else {
        clickFn = `showToast('Browse-only view. Go to My Stock to update your own varieties.')`;
      }
    } else if(role === 'public') {
      if(s.status !== 'unavailable') {
        footer = `<div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;border-color:var(--parchment);" onclick="event.stopPropagation();openPublicDetail(${sd})">ℹ️ Details</button>
          <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();addToCart('${s.name}')">🛒 Add to Cart</button>
        </div>`;
        clickFn = `openPublicDetail(${sd})`;
      } else {
        footer = `<div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px;padding:6px;background:var(--cream);border-radius:6px;">Currently unavailable</div>`;
      }
    }

    return `
      <div class="seed-card" onclick="${clickFn}" style="${s.status==='unavailable'?'opacity:0.55;cursor:default;':''}">
        <div class="seed-card-img" style="background:${s.color}">${s.emoji}</div>
        <div class="seed-card-body">
          <div class="seed-card-name">${s.name}</div>
          <div class="seed-card-variety">${s.scientific}</div>
          <div class="seed-card-meta">
            ${statusBadge(s.status)}
            <span class="seed-card-qty font-mono">${s.qty}</span>
          </div>
          <div class="flex-between mt-1">
            <span class="text-muted" style="font-size:11px;">${s.supplier}</span>
            <span style="font-size:12px;font-weight:700;color:var(--bark);">${s.price}</span>
          </div>
          <div class="flex-between mt-1">
            ${s.generations ? genBadges(s.generations) : genBadge(s.generation)}
            <span class="text-muted" style="font-size:10px;">Updated ${s.lastUpdated}</span>
          </div>
          ${footer}
        </div>
      </div>`;
  }).join('');
}

// Public: Open seed detail modal (full info, no login required)
function openPublicDetail(s) {
  if(typeof s === 'string') s = JSON.parse(s);
  const statusColor = s.status==='available'?'var(--success)':s.status==='low'?'var(--warning)':'var(--danger)';
  document.getElementById('pub-seed-title').textContent = s.emoji + ' ' + s.name + ' — Seed Details';
  document.getElementById('pub-seed-body').innerHTML = `
    <div class="seed-detail-header">
      <div class="seed-detail-img" style="background:${s.color}">${s.emoji}</div>
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--earth);">${s.name}</div>
        <div style="font-style:italic;color:var(--muted);font-size:13px;">${s.scientific}</div>
        <div style="margin-top:8px;">${statusBadge(s.status)}</div>
      </div>
    </div>
    <div class="info-box">
      <div class="info-box-title">📦 Stock Information</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Current Stock</span><span class="font-mono" style="font-weight:700;color:${statusColor}">${s.qty}</span></div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Price per kg</span><span class="font-mono" style="font-weight:700;">${s.price}</span></div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Crop Type</span><span style="font-size:13px;font-weight:600;">${s.type.charAt(0).toUpperCase()+s.type.slice(1)}</span></div>
      <div class="flex-between"><span style="font-size:13px;">Last Updated</span><span style="font-size:12px;color:var(--muted);">${s.lastUpdated}</span></div>
    </div>
    <div class="info-box">
      <div class="info-box-title">🧬 Seed Generation</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Generation</span>${s.generations ? genBadges(s.generations) : genBadge(s.generation)}</div>
      ${s.generations ? '' : `<div class="flex-between"><span style="font-size:13px;">Parent Batch</span><span class="font-mono" style="font-size:12px;font-weight:600;">${s.parentBatch ? s.parentBatch : '— (Foundation / G0 stock)'}</span></div>`}
    </div>
    <div class="info-box">
      <div class="info-box-title">🏭 Supplier Contact</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Accredited Supplier</span><span style="font-size:13px;font-weight:700;">${s.supplier}</span></div>
      <div class="flex-between"><span style="font-size:13px;">Contact Number</span><span style="font-size:13px;font-weight:700;color:var(--sprout);">📞 ${s.contact}</span></div>
    </div>
    <div style="background:rgba(74,124,78,0.07);border:1.5px solid rgba(74,124,78,0.18);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--sprout);line-height:1.6;">
      💡 Ready to acquire this variety? Add it to your cart and check out online, or contact the supplier above directly to coordinate pickup.<br>
      <span style="color:var(--muted);">📞 (074) 422-2435 &nbsp;·&nbsp; Mon–Fri, 8AM–5PM</span>
    </div>
  `;
  openModal('modal-public-seed-detail');
}

// Farmer: Open seed detail modal
function openFarmerDetail(s) {
  if(typeof s === 'string') s = JSON.parse(s);
  document.getElementById('farmer-seed-detail-title').textContent = s.name + ' — Seed Details';
  const statusColor = s.status==='available'?'var(--success)':s.status==='low'?'var(--warning)':'var(--danger)';
  document.getElementById('farmer-seed-detail-body').innerHTML = `
    <div class="seed-detail-header">
      <div class="seed-detail-img" style="background:${s.color}">${s.emoji}</div>
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:20px;">${s.name}</div>
        <div style="font-style:italic;color:var(--muted);font-size:13px;">${s.scientific}</div>
        <div style="margin-top:8px;">${statusBadge(s.status)}</div>
      </div>
    </div>
    <div class="info-box">
      <div class="info-box-title">Stock Information</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Current Stock</span><span class="font-mono" style="font-weight:700;color:${statusColor}">${s.qty}</span></div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Price per kg</span><span class="font-mono" style="font-weight:700;">${s.price}</span></div>
      <div class="flex-between"><span style="font-size:13px;">Last Updated</span><span style="font-size:12px;color:var(--muted);">${s.lastUpdated}</span></div>
    </div>
    <div class="info-box">
      <div class="info-box-title">Seed Generation</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Generation</span>${s.generations ? genBadges(s.generations) : genBadge(s.generation)}</div>
      ${s.generations ? '' : `<div class="flex-between"><span style="font-size:13px;">Parent Batch</span><span class="font-mono" style="font-size:12px;font-weight:600;">${s.parentBatch ? s.parentBatch : '— (Foundation / G0 stock)'}</span></div>`}
    </div>
    <div class="info-box">
      <div class="info-box-title">Supplier Information</div>
      <div class="flex-between mb-2"><span style="font-size:13px;">Accredited Supplier</span><span style="font-size:13px;font-weight:700;">${s.supplier}</span></div>
      <div class="flex-between"><span style="font-size:13px;">Contact Number</span><span style="font-size:13px;font-weight:700;color:var(--sprout);">📞 ${s.contact}</span></div>
    </div>
    <div style="font-size:12px;color:var(--muted);background:var(--cream);border-radius:8px;padding:10px 14px;border:1px solid var(--parchment);">
      💡 Ready to acquire this variety? Add it to your cart and check out online, or contact the supplier directly to coordinate pickup.
    </div>
  `;
  openModal('modal-farmer-seed-detail');
}

// ── FILTER STATE ────────────────────────────────────────────
let adminFilter='all', producerFilter='all', farmerFilter='all', publicFilter='all';

function filterAdminChip(el,type){ document.querySelectorAll('#screen-admin-catalog .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); adminFilter=type; applyAdminFilter(); }
function filterProducerChip(el,type){ document.querySelectorAll('#screen-producer-catalog .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); producerFilter=type; applyProducerFilter(); }
function filterFarmerChip(el,type){ document.querySelectorAll('#screen-farmer-catalog .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); farmerFilter=type; applyFarmerFilter(); }
function filterPublicChip(el,type){ document.querySelectorAll('#screen-public .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); publicFilter=type; applyPublicFilter(); }

function applyAdminFilter(){
  const q=(document.getElementById('adminCatalogSearch')?.value||'').toLowerCase();
  renderCatalog(seeds.filter(s=>(adminFilter==='all'||s.type===adminFilter)&&(!q||s.name.toLowerCase().includes(q))),'adminCatalogGrid','admin');
}

function applyProducerFilter(){
  const q=(document.getElementById('producerCatalogSearch')?.value||'').toLowerCase();
  renderCatalog(seeds.filter(s=>(producerFilter==='all'||s.type===producerFilter)&&(!q||s.name.toLowerCase().includes(q))),'producerCatalogGrid','producer');
}

const isVisibleToBuyers = s => s.dbId === undefined || s.isPublic;

function applyFarmerFilter(){
  const q=(document.getElementById('farmerCatalogSearch')?.value||'').toLowerCase();
  renderCatalog(seeds.filter(s=>isVisibleToBuyers(s)&&(farmerFilter==='all'||s.type===farmerFilter)&&(!q||s.name.toLowerCase().includes(q))),'farmerCatalogGrid','farmer');
}

function applyPublicFilter(){
  const q=(document.getElementById('publicSearchInput')?.value||'').toLowerCase();
  renderCatalog(seeds.filter(s=>isVisibleToBuyers(s)&&(publicFilter==='all'||s.type===publicFilter)&&(!q||s.name.toLowerCase().includes(q)||s.scientific.toLowerCase().includes(q))),'publicCatalogGrid','public');
}

// ── ROLE SELECTION (login) ─────────────────────────────────
const roleHints = {
  admin: '🛡️ <strong>Admin:</strong> Full inventory access — manage all seed stock, varieties, suppliers, users &amp; reports.',
  producer: '🌱 <strong>Producer:</strong> Update stock quantities for your own farm\'s listed varieties.',
};
const roleEmails = {
  admin: 'admin@bsu.edu.ph',
  producer: 'nelio.compelio@farm.ph',
};

function selectRole(el, role) {
  document.querySelectorAll('#screen-login .role-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  currentRole = role;
  document.getElementById('role-hint').innerHTML = roleHints[role];
  document.getElementById('login-email').value = roleEmails[role];
}

async function loginWithRole() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.querySelector('#screen-login input[type="password"]').value;

  // Try a real login against the users table first (only works once a
  // backend is running and the email/password match a real bcrypt hash —
  // see README.md for the one seeded producer account + optional test admin).
  if (usingLiveBackend && email && password) {
    try {
      const user = await apiSend('POST', 'auth.php', { email, password });
      currentUser = user;
      showToast('✅ Signed in as ' + user.fname + ' ' + user.lname + ' (' + user.role + ') via live database.');
      if (user.role === 'admin') goToScreen('screen-admin-dashboard');
      else { goToScreen('screen-producer-dashboard'); applyProducerFilter(); }
      return;
    } catch (e) {
      // Falls through to the demo role-button navigation below so the UI
      // stays usable even with a wrong/unseeded login during a demo.
      showToast('ℹ️ No matching database account (' + e.message + ') — continuing in role-demo mode.');
    }
  }

  if(currentRole==='admin') goToScreen('screen-admin-dashboard');
  else if(currentRole==='producer') goToScreen('screen-producer-dashboard');
  else goToScreen('screen-public');
}

// ── NAVIGATION HELPERS ─────────────────────────────────────
function adminNav(screenId, el){
  if(el){ document.querySelectorAll('#'+screenId+' .nav-item').forEach(n=>n.classList.remove('active')); el.classList.add('active'); }
  goToScreen(screenId);
  if(screenId==='screen-admin-orders') renderAdminOrders();
}
function producerNav(screenId, el){
  if(el){ document.querySelectorAll('#'+screenId+' .nav-item').forEach(n=>n.classList.remove('active')); el.classList.add('active'); }
  goToScreen(screenId);
  if(screenId==='screen-producer-catalog') applyProducerFilter();
  if(screenId==='screen-producer-inventory') renderProducerStock();
}
function farmerNav(screenId, el){
  if(el){ document.querySelectorAll('#'+screenId+' .nav-item').forEach(n=>n.classList.remove('active')); el.classList.add('active'); }
  goToScreen(screenId);
  if(screenId==='screen-farmer-catalog') applyFarmerFilter();
  if(screenId==='screen-farmer-orders') renderFarmerOrders();
}

// ── SCREEN ROUTING ─────────────────────────────────────────
function goToScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if(t){ t.classList.add('active'); window.scrollTo(0,0); }
  if(id==='screen-admin-catalog') applyAdminFilter();
  if(id==='screen-producer-catalog') applyProducerFilter();
  if(id==='screen-farmer-catalog') applyFarmerFilter();
  if(id==='screen-public') applyPublicFilter();
}

// ── MODALS ─────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); });
});


// ── FORGOT PASSWORD ─────────────────────────────────────────
function submitForgotPassword() {
  var email = document.getElementById('fp-email').value.trim();
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.');
    return;
  }
  document.getElementById('fp-sent-email').textContent = email;
  document.getElementById('fp-form-view').style.display = 'none';
  document.getElementById('fp-success-view').style.display = 'block';
}
function resendFpEmail() {
  showToast('Reset link resent! Check your inbox.');
}

// ── CREATE ACCOUNT ───────────────────────────────────────────
var caRole = 'producer';
function selectCaRole(el, role) { caRole = role; } // kept for compat, no-op now
function toggleCaPassword() {
  var pw = document.getElementById('ca-password');
  var tog = document.getElementById('ca-pw-toggle');
  if (pw.type === 'password') { pw.type = 'text'; tog.textContent = '🙈'; }
  else { pw.type = 'password'; tog.textContent = '👁️'; }
}
function checkCaPwStrength() {
  var val = document.getElementById('ca-password').value;
  var bar = document.getElementById('ca-pw-bar');
  var lbl = document.getElementById('ca-pw-label');
  var str = document.getElementById('ca-pw-strength');
  if (!val) { str.style.display = 'none'; return; }
  str.style.display = 'block';
  var score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  var configs = [
    { pct:'25%', bg:'var(--danger)', label:'Weak' },
    { pct:'50%', bg:'var(--warning)', label:'Fair' },
    { pct:'75%', bg:'var(--harvest)', label:'Good' },
    { pct:'100%', bg:'var(--success)', label:'Strong' }
  ];
  var c = configs[Math.max(score - 1, 0)];
  bar.style.width = c.pct;
  bar.style.background = c.bg;
  lbl.textContent = c.label;
  lbl.style.color = c.bg;
}
function submitCreateAccount() {
  var fn = document.getElementById('ca-firstname').value.trim();
  var ln = document.getElementById('ca-lastname').value.trim();
  var em = document.getElementById('ca-email').value.trim();
  var ph = document.getElementById('ca-phone').value.trim();
  var loc = document.getElementById('ca-location').value.trim();
  var farm = document.getElementById('ca-farm').value.trim();
  var pw = document.getElementById('ca-password').value;
  var cpw = document.getElementById('ca-confirm-password').value;
  var terms = document.getElementById('ca-terms').checked;
  if (!fn || !ln) { showToast('Please enter your full name.'); return; }
  if (!em || !em.includes('@')) { showToast('Please enter a valid email address.'); return; }
  if (!ph) { showToast('Please enter your contact number.'); return; }
  if (!loc) { showToast('Please enter your municipality/location.'); return; }
  if (!farm) { showToast('Please enter your farm or organization name.'); return; }
  if (pw.length < 8) { showToast('Password must be at least 8 characters.'); return; }
  if (pw !== cpw) { showToast('Passwords do not match.'); return; }
  if (!terms) { showToast('Please agree to the Terms & Conditions.'); return; }
  document.getElementById('ca-form-view').style.display = 'none';
  document.getElementById('ca-success-view').style.display = 'block';
}


// ── SUPPLIER STOCK VIEWER ───────────────────────────────────
const supplierStockData = {
  'BSU-NPRCRTC': [
    {name:'Igorota',type:'Potato',emoji:'🥔',qty:'1,240 kg',price:'₱85/kg',status:'available'},
    {name:'Granola',type:'Potato',emoji:'🥔',qty:'186 kg',price:'₱78/kg',status:'low'},
    {name:'Cosima',type:'Potato',emoji:'🥔',qty:'620 kg',price:'₱82/kg',status:'available'},
    {name:'Fina',type:'Potato',emoji:'🥔',qty:'48 kg',price:'₱90/kg',status:'unavailable'},
    {name:'Mexican',type:'Potato',emoji:'🥔',qty:'310 kg',price:'₱76/kg',status:'available'},
    {name:'Violet Queen',type:'Sweet Potato',emoji:'🍠',qty:'830 kg',price:'₱45/kg',status:'available'},
    {name:'APO 1',type:'Sweet Potato',emoji:'🍠',qty:'240 kg',price:'₱40/kg',status:'available'},
    {name:'Rayong 5',type:'Cassava',emoji:'🪵',qty:'1,500 kg',price:'₱28/kg',status:'available'},
    {name:'Lakan 1',type:'Taro',emoji:'🌿',qty:'—',price:'₱55/kg',status:'unavailable'},
    {name:'Purple Yam',type:'Yam',emoji:'🟤',qty:'180 kg',price:'₱65/kg',status:'low'},
    {name:'White Flesh',type:'Sweet Potato',emoji:'🍠',qty:'0 kg',price:'₱42/kg',status:'unavailable'},
    {name:'Cosima B',type:'Potato',emoji:'🥔',qty:'36 kg',price:'₱81/kg',status:'unavailable'},
  ],
  'Nelio Compelio Farm': [
    {name:'Granola',type:'Potato',emoji:'🥔',qty:'186 kg',price:'₱78/kg',status:'low'},
    {name:'Mexican',type:'Potato',emoji:'🥔',qty:'110 kg',price:'₱76/kg',status:'low'},
    {name:'APO 1',type:'Sweet Potato',emoji:'🍠',qty:'90 kg',price:'₱40/kg',status:'low'},
    {name:'Cosima B',type:'Potato',emoji:'🥔',qty:'40 kg',price:'₱81/kg',status:'unavailable'},
    {name:'White Flesh',type:'Sweet Potato',emoji:'🍠',qty:'0 kg',price:'₱42/kg',status:'unavailable'},
  ],
  'Susan Bokilis Greenhouse': [
    {name:'Lakan 1',type:'Taro',emoji:'🌿',qty:'420 kg',price:'₱55/kg',status:'available'},
    {name:'Igorota',type:'Potato',emoji:'🥔',qty:'180 kg',price:'₱85/kg',status:'low'},
    {name:'Granola',type:'Potato',emoji:'🥔',qty:'90 kg',price:'₱78/kg',status:'low'},
    {name:'Violet Queen',type:'Sweet Potato',emoji:'🍠',qty:'40 kg',price:'₱45/kg',status:'unavailable'},
  ],
  'Antonio Family Farm': [
    {name:'Cosima',type:'Potato',emoji:'🥔',qty:'290 kg',price:'₱82/kg',status:'available'},
    {name:'Fina',type:'Potato',emoji:'🥔',qty:'0 kg',price:'₱90/kg',status:'unavailable'},
    {name:'Mexican',type:'Potato',emoji:'🥔',qty:'100 kg',price:'₱76/kg',status:'low'},
    {name:'APO 1',type:'Sweet Potato',emoji:'🍠',qty:'60 kg',price:'₱40/kg',status:'low'},
    {name:'Rayong 5',type:'Cassava',emoji:'🪵',qty:'800 kg',price:'₱28/kg',status:'available'},
    {name:'Purple Yam',type:'Yam',emoji:'🟤',qty:'—',price:'₱65/kg',status:'unavailable'},
  ],
  'Dangwa Highland Seeds': [
    {name:'Igorota',type:'Potato',emoji:'🥔',qty:'310 kg',price:'₱85/kg',status:'available'},
    {name:'Cosima',type:'Potato',emoji:'🥔',qty:'120 kg',price:'₱82/kg',status:'low'},
    {name:'Violet Queen',type:'Sweet Potato',emoji:'🍠',qty:'60 kg',price:'₱45/kg',status:'low'},
  ],
};
function openSupplierStock(name, location, contact, accred, statusText, varieties, totalStock) {
  document.getElementById('sstock-modal-title').textContent = '📦 ' + name + ' — Stock';
  document.getElementById('sstock-location').textContent = location;
  document.getElementById('sstock-contact').textContent = '📞 ' + contact;
  document.getElementById('sstock-accred').textContent = accred;
  const isActive = statusText.includes('Active');
  const isPending = statusText.includes('Pending');
  const statusBadgeHtml = isActive
    ? '<span class="badge badge-available">● Active</span>'
    : isPending
    ? '<span class="badge badge-low">● Pending Approval</span>'
    : '<span class="badge badge-unavailable">● Suspended</span>';
  const expiryNote = statusText.replace('Active · ','').replace('Active','').replace('Pending Approval','');
  document.getElementById('sstock-status').innerHTML = statusBadgeHtml + (expiryNote ? ' <span style="font-size:10px;color:var(--muted);">' + expiryNote + '</span>' : '');
  if (isPending) {
    document.getElementById('sstock-status').innerHTML += ' <span style="font-size:10px;color:var(--danger);">— not visible on public/farmer catalog until approved</span>';
  }
  document.getElementById('sstock-count').textContent = varieties;
  document.getElementById('sstock-total').textContent = totalStock;
  const data = supplierStockData[name] || [];
  const availCount = data.filter(s => s.status === 'available').length;
  document.getElementById('sstock-avail').textContent = availCount + ' / ' + data.length;
  const statusHtml = {
    available: '<span class="badge badge-available">● Available</span>',
    low: '<span class="badge badge-low">● Low Stock</span>',
    unavailable: '<span class="badge badge-unavailable">● Unavailable</span>',
  };
  const rows = data.map(s => `<tr>
    <td><span style="font-size:15px;margin-right:6px;">${s.emoji}</span><strong>${s.name}</strong></td>
    <td style="color:var(--muted);">${s.type}</td>
    <td class="font-mono">${s.qty}</td>
    <td style="font-weight:700;">${s.price}</td>
    <td>${statusHtml[s.status]}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="openSupplierStockEdit(${JSON.stringify(s).replace(/"/g,'&quot;')})">✏️ Edit</button></td>
  </tr>`).join('');
  document.getElementById('sstock-tbody').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No stock data found.</td></tr>';
  openModal('modal-supplier-stock');
}

// ── SUPPLIER APPROVAL (Admin Approval Requirement business rule) ───────────
// New / under-review suppliers stay "Pending" and cannot post inventory to the
// public/farmer catalogs until an Admin manually verifies and activates them.
function approveSupplier(btnEl, name) {
  const row = btnEl.closest('tr');
  const statusCell = row.querySelector('td:nth-child(6)');
  statusCell.innerHTML = '<span class="badge badge-available">● Active</span>';
  const actionsCell = row.querySelector('td:last-child .flex-gap');
  actionsCell.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="showToast('ℹ️ ${name} stock viewer requires backend integration in this demo.')">📦 View Stock</button><button class="btn btn-sm" style="background:rgba(243,156,18,0.1);color:var(--warning)" onclick="showToast('Supplier suspended. Their stock will be hidden from farmers.')">Suspend</button>`;
  showToast('✅ ' + name + ' approved & activated — can now post inventory to the catalog.');
}
function rejectSupplier(btnEl, name) {
  const row = btnEl.closest('tr');
  row.style.opacity = '0.4';
  const actionsCell = row.querySelector('td:last-child .flex-gap');
  actionsCell.innerHTML = '<span class="text-muted" style="font-size:11px;">Application rejected</span>';
  showToast('❌ ' + name + ' application rejected. Account will not be activated.');
}
function submitRegisterSupplier() {
  const verifyNow = document.getElementById('add-supplier-verify-now').checked;
  closeModal('modal-add-supplier');
  showToast(verifyNow
    ? '✅ Supplier registered & activated as Active — can post inventory immediately.'
    : 'ℹ️ Supplier registered as Pending. Approve from Supplier Management before they can post inventory.');
}

// ── PRODUCER PASSWORD ───────────────────────────────────────
function checkProdPwMatch() {
  const nw = document.getElementById('prod-pw-new')?.value || '';
  const cf = document.getElementById('prod-pw-confirm')?.value || '';
  const msg = document.getElementById('prod-pw-match-msg');
  if(!msg) return;
  if(!nw && !cf) { msg.style.display='none'; return; }
  msg.style.display = 'block';
  if(nw === cf) { msg.innerHTML = '✅ Passwords match'; msg.style.color = 'var(--success)'; }
  else { msg.innerHTML = '❌ Passwords do not match'; msg.style.color = 'var(--danger)'; }
}
function saveProdPassword() {
  const cur = document.getElementById('prod-pw-current')?.value || '';
  const nw = document.getElementById('prod-pw-new')?.value || '';
  const cf = document.getElementById('prod-pw-confirm')?.value || '';
  if(!cur) { showToast('Please enter your current password.'); return; }
  if(nw.length < 8) { showToast('New password must be at least 8 characters.'); return; }
  if(nw !== cf) { showToast('New passwords do not match.'); return; }
  document.getElementById('prod-pw-current').value = '';
  document.getElementById('prod-pw-new').value = '';
  document.getElementById('prod-pw-confirm').value = '';
  document.getElementById('prod-pw-match-msg').style.display = 'none';
  showToast('🔐 Password updated successfully!');
}

// ── FARMER PASSWORD ─────────────────────────────────────────
function checkFarmerPwMatch() {
  const nw = document.getElementById('farmer-pw-new')?.value || '';
  const cf = document.getElementById('farmer-pw-confirm')?.value || '';
  const msg = document.getElementById('farmer-pw-match-msg');
  if(!msg) return;
  if(!nw && !cf) { msg.style.display='none'; return; }
  msg.style.display = 'block';
  if(nw === cf) { msg.innerHTML = '✅ Passwords match'; msg.style.color = 'var(--success)'; }
  else { msg.innerHTML = '❌ Passwords do not match'; msg.style.color = 'var(--danger)'; }
}
function saveFarmerPassword() {
  const cur = document.getElementById('farmer-pw-current')?.value || '';
  const nw = document.getElementById('farmer-pw-new')?.value || '';
  const cf = document.getElementById('farmer-pw-confirm')?.value || '';
  if(!cur) { showToast('Please enter your current password.'); return; }
  if(nw.length < 8) { showToast('New password must be at least 8 characters.'); return; }
  if(nw !== cf) { showToast('New passwords do not match.'); return; }
  document.getElementById('farmer-pw-current').value = '';
  document.getElementById('farmer-pw-new').value = '';
  document.getElementById('farmer-pw-confirm').value = '';
  document.getElementById('farmer-pw-match-msg').style.display = 'none';
  showToast('🔐 Password updated successfully!');
}



// ── EDIT USER (Admin User Management) ───────────────────────
let editUserCurrentRole = 'admin';
function openEditUser(name, email, role, phone, location, farm, status) {
  editUserCurrentRole = role;
  document.getElementById('edit-user-label').textContent = name;
  document.getElementById('edit-user-name').value = name;
  document.getElementById('edit-user-email').value = email;
  document.getElementById('edit-user-phone').value = phone;
  document.getElementById('edit-user-location').value = location;
  document.getElementById('edit-user-status').value = status;
  document.getElementById('edit-user-farm').value = farm || '';
  document.getElementById('edit-user-pw').value = '';
  document.getElementById('edit-user-pw-confirm').value = '';
  // Set role buttons
  ['admin','producer','farmer'].forEach(r => {
    document.getElementById('edit-user-role-' + r).classList.toggle('selected', r === role);
  });
  document.getElementById('edit-user-farm-group').style.display = (role === 'producer' || role === 'farmer') ? 'block' : 'none';
  openModal('modal-edit-user');
}
function selectEditUserRole(el, role) {
  document.querySelectorAll('#modal-edit-user .role-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  editUserCurrentRole = role;
  document.getElementById('edit-user-farm-group').style.display = (role === 'producer' || role === 'farmer') ? 'block' : 'none';
}
function submitEditUser() {
  const name = document.getElementById('edit-user-name').value.trim();
  const email = document.getElementById('edit-user-email').value.trim();
  const phone = document.getElementById('edit-user-phone').value.trim();
  const location = document.getElementById('edit-user-location').value.trim();
  const pw = document.getElementById('edit-user-pw').value;
  const cpw = document.getElementById('edit-user-pw-confirm').value;
  if (!name) { showToast('Please enter a full name.'); return; }
  if (!email || !email.includes('@')) { showToast('Please enter a valid email address.'); return; }
  if (!phone) { showToast('Please enter a contact number.'); return; }
  if (!location) { showToast('Please enter a location.'); return; }
  if (pw && pw.length < 8) { showToast('New password must be at least 8 characters.'); return; }
  if (pw && pw !== cpw) { showToast('Passwords do not match.'); return; }
  closeModal('modal-edit-user');
  showToast('✅ User account updated successfully!');
}


let _editSeedOriginalName = null;
function openEditSeed(s) {
  if(typeof s === 'string') s = JSON.parse(s);
  _editSeedOriginalName = s.name;
  document.getElementById('edit-seed-name').value = s.name || '';
  document.getElementById('edit-seed-scientific').value = s.scientific || '';
  document.getElementById('edit-seed-qty').value = s.qtyNum || 0;
  document.getElementById('edit-seed-supplier').value = s.supplier || 'BSU-NPRCRTC';
  // Map type key to select value
  const typeMap = {potato:'Potato',sweet:'Sweet Potato',cassava:'Cassava',taro:'Taro',yam:'Yam'};
  document.getElementById('edit-seed-type').value = typeMap[s.type] || 'Potato';
  document.getElementById('edit-seed-status').value = s.status || 'available';
  // Parse price number from string like '₱85/kg'
  const priceNum = s.price ? s.price.replace('₱','').replace('/kg','') : '';
  document.getElementById('edit-seed-price').value = priceNum;
  document.getElementById('edit-seed-notes').value = '';
  // Generation / lineage
  const genSel = document.getElementById('edit-seed-generation');
  genSel.value = s.generation || 'G0';
  const group = document.getElementById('edit-seed-parent-group');
  if ((s.generation||'G0') === 'G0') {
    group.style.display = 'none';
  } else {
    group.style.display = 'block';
    renderParentOptions(document.getElementById('edit-seed-parent'), s.generation, s.parentBatch);
  }
  document.getElementById('edit-seed-last-updated').textContent = s.lastUpdated || '—';
  renderExistingGenerations(s);
  openModal('modal-edit-seed');
}

// ── Lookup/create caches so Add Variety works against real FK ids
//    even when the admin picks a crop type or supplier name that
//    doesn't exist in the DB yet (creates it on the fly, honestly,
//    via the real rootcrops.php / producers.php / rootcrop_units.php
//    CRUD endpoints — no fabricated client-side data). ─────────────
let _cropIdCache = null, _producerIdCache = null;
async function getOrCreateCropId(cropName) {
  if (!_cropIdCache) {
    const list = await apiGet('rootcrops.php');
    _cropIdCache = new Map(list.map(c => [c.crop_name.toLowerCase(), c.crop_id]));
  }
  const key = cropName.toLowerCase();
  if (_cropIdCache.has(key)) return _cropIdCache.get(key);
  const created = await apiSend('POST', 'rootcrops.php', { crop_name: cropName, crop_description: cropName });
  _cropIdCache.set(key, created.crop_id);
  return created.crop_id;
}
async function getOrCreateProducerId(producerName) {
  if (!_producerIdCache) {
    const list = await apiGet('producers.php');
    _producerIdCache = new Map(list.map(p => [p.producer_name.toLowerCase(), p.producer_id]));
  }
  const key = producerName.toLowerCase();
  if (_producerIdCache.has(key)) return _producerIdCache.get(key);
  // 'BSU-NPRCRTC' in the UI dropdown is the same organization as the
  // seeded 'NPRCRTC' producer row — reuse it instead of creating a duplicate.
  if (key.includes('nprcrtc') && _producerIdCache.has('nprcrtc')) return _producerIdCache.get('nprcrtc');
  const created = await apiSend('POST', 'producers.php', { producer_name: producerName, producer_desc: producerName + ' (added via Admin Catalog UI)' });
  _producerIdCache.set(key, created.producer_id);
  return created.producer_id;
}
async function getOrCreateUnitId(cropId) {
  const units = await apiGet('rootcrop_units.php?crop_id=' + cropId);
  if (units.length) return units[0].unit_id;
  const created = await apiSend('POST', 'rootcrop_units.php', {
    crop_id: cropId, unit_size: 'Standard', unit_abbreviated: 'pc', unit_unabbreviated: 'Standard Unit',
  });
  return created.unit_id;
}

async function submitAddSeed() {
  const gen = document.getElementById('add-seed-generation').value;
  if (gen !== 'G0') {
    const parentSel = document.getElementById('add-seed-parent');
    if (!parentSel.value) {
      showToast('⚠️ ' + gen + ' varieties require a valid ' + requiredParentGen(gen) + ' parent batch to be selected.');
      return;
    }
  }
  const varietyName = document.querySelector('#modal-add-seed input[placeholder="e.g. Igorota"]').value.trim();
  const cropType = document.querySelector('#modal-add-seed select').value;
  const scientific = document.querySelector('#modal-add-seed input[placeholder="e.g. Solanum tuberosum"]').value.trim();
  const initialStock = document.querySelector('#modal-add-seed input[type="number"][placeholder="0"]').value;
  const price = document.querySelector('#modal-add-seed input[placeholder="0.00"]').value;
  const supplier = document.querySelectorAll('#modal-add-seed select')[1].value;

  if (!varietyName) { showToast('⚠️ Please enter a variety name.'); return; }

  if (!usingLiveBackend) {
    closeModal('modal-add-seed');
    showToast('✅ Variety added to catalog as ' + gen + '! (offline demo — start the backend to persist this.)');
    return;
  }

  try {
    const cropId = await getOrCreateCropId(cropType);
    const variety = await apiSend('POST', 'varieties.php', { crop_id: cropId, variety_name: varietyName, variety_desc: scientific || varietyName });
    const genNum = gen === 'G0' ? 0 : gen === 'G1' ? 1 : 2;
    await apiSend('POST', 'variety_generations.php', { variety_id: variety.variety_id, generation_classification: genNum, generation_desc: gen + ' record added via Admin Catalog UI' });
    const producerId = await getOrCreateProducerId(supplier || 'BSU-NPRCRTC');
    const unitId = await getOrCreateUnitId(cropId);
    await apiSend('POST', 'producer_crop_stocks.php', {
      crop_variety_id: variety.variety_id, producer_id: producerId, unit_id: unitId,
      stock_amount: Number(initialStock) || 0, unit_price: Number(price) || 0, is_public: 1,
    });
    closeModal('modal-add-seed');
    showToast('✅ ' + varietyName + ' saved to the database as ' + gen + '!');
    await tryLoadLiveCatalog();
  } catch (e) {
    showToast('⚠️ Could not save to the database: ' + e.message);
  }
}

async function submitEditSeed() {
  const gen = document.getElementById('edit-seed-generation').value;
  if (gen !== 'G0') {
    const parentSel = document.getElementById('edit-seed-parent');
    if (!parentSel.value) {
      showToast('⚠️ ' + gen + ' varieties require a valid ' + requiredParentGen(gen) + ' parent batch to be selected.');
      return;
    }
  }
  const s = seeds.find(x => x.name === _editSeedOriginalName);

  if (s && s.dbId !== undefined && usingLiveBackend) {
    try {
      const varietyName = document.getElementById('edit-seed-name').value.trim();
      const scientific = document.getElementById('edit-seed-scientific').value.trim();
      const cropId = await getOrCreateCropId(document.getElementById('edit-seed-type').value);
      await apiSend('PUT', 'varieties.php?id=' + s.cropVarietyId, { crop_id: cropId, variety_name: varietyName, variety_desc: scientific || varietyName });
      const genNum = gen === 'G0' ? 0 : gen === 'G1' ? 1 : 2;
      await apiSend('POST', 'variety_generations.php', { variety_id: s.cropVarietyId, generation_classification: genNum, generation_desc: gen + ' record added via Edit Variety' });
      closeModal('modal-edit-seed');
      showToast('✅ ' + varietyName + ' updated in the database!');
      await tryLoadLiveCatalog();
    } catch (e) {
      showToast('⚠️ Could not update the database: ' + e.message);
    }
    return;
  }

  // Offline demo path — unchanged local-only behavior for the demo array.
  if (s) {
    s.generation = gen;
    s.parentBatch = gen === 'G0' ? null : document.getElementById('edit-seed-parent').value;
    s.lastUpdated = todayLabel();
  }
  closeModal('modal-edit-seed');
  showToast('✅ Seed variety updated successfully! (offline demo — start the backend to persist this.)');
  applyAdminFilter();
}

// ── EDIT INVENTORY ENTRY ────────────────────────────────────
let _editInvSeedName = null;
function openInventoryEdit(name, scientific, type, supplier, qty, price, status) {
  _editInvSeedName = name;
  document.getElementById('edit-inv-name-display').textContent = name;
  document.getElementById('edit-inv-type-display').textContent = type;
  document.getElementById('edit-inv-scientific-display').textContent = scientific;
  document.getElementById('edit-inv-supplier-display').textContent = supplier;
  document.getElementById('edit-inv-qty').value = qty;
  document.getElementById('edit-inv-price').value = price;
  document.getElementById('edit-inv-status').value = status === 'unavailable' ? 'unavailable' : status;
  document.getElementById('edit-inv-notes').value = '';
  syncInvStatusWithQty();
  openModal('modal-edit-inventory');
}

// Stock Status Logic business rule: quantity 0 → status is forced to Unavailable
// and locked so an admin can't manually override an out-of-stock record.
function syncInvStatusWithQty() {
  const qtyEl = document.getElementById('edit-inv-qty');
  const statusEl = document.getElementById('edit-inv-status');
  const note = document.getElementById('edit-inv-auto-note');
  const qty = Number(qtyEl.value);
  if (qtyEl.value !== '' && qty === 0) {
    statusEl.value = 'unavailable';
    statusEl.disabled = true;
    note.style.display = 'block';
  } else {
    statusEl.disabled = false;
    note.style.display = 'none';
  }
}

// ── EDIT SUPPLIER STOCK ENTRY ───────────────────────────────
function openSupplierStockEdit(s) {
  if (typeof s === 'string') s = JSON.parse(s);
  // Header info
  document.getElementById('edit-sstock-label').textContent = s.emoji + ' ' + s.name + ' — ' + s.type;
  // Read-only fields
  document.getElementById('edit-sstock-name').value = s.name;
  document.getElementById('edit-sstock-type').value = s.type;
  // Parse current qty number from string like '1,240 kg' or '—'
  const qtyNum = s.qty ? parseInt(s.qty.replace(/,/g,'').replace(' kg','')) : 0;
  document.getElementById('edit-sstock-current-qty').textContent = isNaN(qtyNum) ? '0 kg' : qtyNum.toLocaleString() + ' kg';
  document.getElementById('edit-sstock-qty').value = isNaN(qtyNum) ? 0 : qtyNum;
  // Parse price number from string like '₱85/kg'
  const priceNum = s.price ? s.price.replace('₱','').replace('/kg','') : '';
  document.getElementById('edit-sstock-price').value = priceNum;
  document.getElementById('edit-sstock-status').value = s.status || 'available';
  document.getElementById('edit-sstock-update-type').value = 'set';
  document.getElementById('edit-sstock-notes').value = '';
  // Store current qty for update-type calculation
  document.getElementById('edit-sstock-qty').dataset.currentQty = isNaN(qtyNum) ? 0 : qtyNum;
  document.getElementById('edit-sstock-auto-note').style.display = 'none';
  document.getElementById('edit-sstock-status').disabled = false;
  openModal('modal-edit-supplier-stock');
}

// Computes the resultant quantity for the selected Update Type, and — per the
// Stock Status Logic business rule — forces + locks status to Unavailable
// whenever that resultant quantity is 0.
function computeSupplierResultQty() {
  const type = document.getElementById('edit-sstock-update-type').value;
  const qtyEl = document.getElementById('edit-sstock-qty');
  const currentQty = Number(qtyEl.dataset.currentQty || 0);
  const entered = Number(qtyEl.value);
  if (qtyEl.value === '' || isNaN(entered)) return null;
  if (type === 'set') return entered;
  if (type === 'add') return currentQty + entered;
  return currentQty - entered; // subtract
}
function syncSupplierStatusWithQty() {
  const result = computeSupplierResultQty();
  const statusEl = document.getElementById('edit-sstock-status');
  const note = document.getElementById('edit-sstock-auto-note');
  if (result !== null && result <= 0) {
    statusEl.value = 'unavailable';
    statusEl.disabled = true;
    note.style.display = 'block';
  } else {
    statusEl.disabled = false;
    note.style.display = 'none';
  }
}

function submitSupplierStockEdit() {
  const qty = document.getElementById('edit-sstock-qty').value;
  const price = document.getElementById('edit-sstock-price').value;
  const updateType = document.getElementById('edit-sstock-update-type').value;
  const status = document.getElementById('edit-sstock-status').value;
  if (qty === '' || isNaN(qty) || Number(qty) < 0) {
    showToast('⚠️ Please enter a valid quantity (0 or more).');
    return;
  }
  if (price === '' || isNaN(price) || Number(price) < 0) {
    showToast('⚠️ Please enter a valid price per kg.');
    return;
  }
  const currentQty = Number(document.getElementById('edit-sstock-qty').dataset.currentQty || 0);
  const enteredQty = Number(qty);
  if (updateType === 'subtract' && enteredQty > currentQty) {
    showToast('⚠️ Cannot subtract more than current stock (' + currentQty.toLocaleString() + ' kg).');
    return;
  }
  const resultQty = computeSupplierResultQty();
  closeModal('modal-edit-supplier-stock');
  showToast(resultQty === 0 ? '✅ Stock entry updated — now Unavailable (0 kg).' : '✅ Stock entry updated successfully!');
}

// ── ADD USER (Admin User Management) ────────────────────────
let addUserRole = 'admin';
function selectAddUserRole(el, role) {
  document.querySelectorAll('#modal-add-user .role-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  addUserRole = role;
  document.getElementById('add-user-farm-group').style.display = role === 'producer' ? 'block' : 'none';
}
function submitAddUser() {
  const fn = document.getElementById('add-user-firstname').value.trim();
  const ln = document.getElementById('add-user-lastname').value.trim();
  const em = document.getElementById('add-user-email').value.trim();
  const ph = document.getElementById('add-user-phone').value.trim();
  const loc = document.getElementById('add-user-location').value.trim();
  const pw = document.getElementById('add-user-password').value;
  const cpw = document.getElementById('add-user-confirm-pw').value;
  if(!fn || !ln) { showToast('Please enter the user\'s full name.'); return; }
  if(!em || !em.includes('@')) { showToast('Please enter a valid email address.'); return; }
  if(!ph) { showToast('Please enter a contact number.'); return; }
  if(!loc) { showToast('Please enter a location.'); return; }
  if(pw.length < 8) { showToast('Password must be at least 8 characters.'); return; }
  if(pw !== cpw) { showToast('Passwords do not match.'); return; }
  if(addUserRole === 'producer') {
    const farm = document.getElementById('add-user-farm').value.trim();
    if(!farm) { showToast('Please enter the farm or organization name.'); return; }
  }
  closeModal('modal-add-user');
  showToast('✅ User account created and invitation email sent!');
  // Reset form
  ['add-user-firstname','add-user-lastname','add-user-email','add-user-phone','add-user-location','add-user-password','add-user-confirm-pw','add-user-farm','add-user-accred'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
}


function showToast(msg) {
  var t = document.getElementById('toast');
  var m = document.getElementById('toast-msg');
  var ic = document.getElementById('toast-icon');

  // Pick icon based on message prefix
  var icon = '✅';
  if (msg.startsWith('⚠️')) { icon = '⚠️'; msg = msg.replace('⚠️','').trim(); }
  else if (msg.startsWith('❌')) { icon = '❌'; msg = msg.replace('❌','').trim(); }
  else if (msg.startsWith('🔐')) { icon = '🔐'; msg = msg.replace('🔐','').trim(); }
  else if (msg.startsWith('ℹ️')) { icon = 'ℹ️'; msg = msg.replace('ℹ️','').trim(); }
  else if (msg.startsWith('✅')) { icon = '✅'; msg = msg.replace('✅','').trim(); }

  ic.textContent = icon;
  m.textContent = msg;

  // Clear any running timer
  if (t._hideTimer) clearTimeout(t._hideTimer);

  // Slide in from top
  t.style.transition = 'none';
  t.style.opacity = '0';
  t.style.transform = 'translateX(-50%) translateY(-12px)';

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      t.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  // Fade out after 2.6s
  t._hideTimer = setTimeout(function() {
    t.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 2600);
}

// ── PRODUCER: OPEN UPDATE STOCK MODAL (pre-filled) ──────────
let _pusCurrentQty = 0;
let _liveStockTarget = null; // set when the modal is opened against a real DB row (see openLiveStockUpdate)
const _pusEmojiMap = {'🥔 Potato':'🥔','🍠 Sweet Potato':'🍠','🌿 Taro':'🌿','🪵 Cassava':'🪵','🟤 Yam':'🟤'};

function openProducerUpdateStock(name, scientific, type, currentQty) {
  _liveStockTarget = null;
  _pusCurrentQty = currentQty;
  document.getElementById('pus-title-variety').textContent = name;
  document.getElementById('pus-emoji').textContent = _pusEmojiMap[type] || '🌱';
  document.getElementById('pus-name-display').textContent = name;
  document.getElementById('pus-scientific-display').textContent = scientific;
  document.getElementById('pus-type-display').textContent = type;
  document.getElementById('pus-current-qty-display').textContent = currentQty.toLocaleString();
  document.getElementById('pus-update-type').value = 'set';
  document.getElementById('pus-qty').value = '';
  document.getElementById('pus-remarks').value = '';
  const prev = document.getElementById('pus-preview');
  prev.style.display = 'none';
  openModal('modal-producer-update-stock');
}

// Opens the same modal, but against a REAL producer_crop_stocks row (Admin's
// "Update Stock" button and Producer's "Update My Stock" button on catalog
// cards for DB-backed varieties both call this). Reuses the exact same
// Set/Add/Subtract UI, but submitProducerUpdateStock() below routes the
// save through api/producer_crop_stocks.php instead of the local array.
function openLiveStockUpdate(s) {
  if (typeof s === 'string') s = JSON.parse(s);
  _liveStockTarget = s;
  _pusCurrentQty = s.qtyNum;
  document.getElementById('pus-title-variety').textContent = s.name;
  document.getElementById('pus-emoji').textContent = s.emoji;
  document.getElementById('pus-name-display').textContent = s.name;
  document.getElementById('pus-scientific-display').textContent = s.scientific;
  document.getElementById('pus-type-display').textContent = s.supplier + ' · ' + s.unitLabel;
  document.getElementById('pus-current-qty-display').textContent = s.qtyNum.toLocaleString() + ' ' + s.unitAbbrev;
  document.getElementById('pus-update-type').value = 'set';
  document.getElementById('pus-qty').value = '';
  document.getElementById('pus-remarks').value = '';
  document.getElementById('pus-preview').style.display = 'none';
  openModal('modal-producer-update-stock');
}

function recalcProducerQty() {
  const type = document.getElementById('pus-update-type').value;
  const qty = parseFloat(document.getElementById('pus-qty').value);
  const prev = document.getElementById('pus-preview');
  const prevText = document.getElementById('pus-preview-text');
  const unitLabel = _liveStockTarget ? _liveStockTarget.unitAbbrev : 'kg';
  if (isNaN(qty) || document.getElementById('pus-qty').value === '') { prev.style.display='none'; return; }
  let newQty;
  if (type === 'set') newQty = qty;
  else if (type === 'add') newQty = _pusCurrentQty + qty;
  else newQty = _pusCurrentQty - qty;
  const color = newQty < 200 ? 'rgba(192,57,43,0.08)' : 'rgba(74,124,78,0.08)';
  const border = newQty < 200 ? 'rgba(192,57,43,0.2)' : 'rgba(74,124,78,0.2)';
  const textColor = newQty < 200 ? 'var(--danger)' : 'var(--sprout)';
  const icon = newQty < 0 ? '❌' : newQty < 200 ? '⚠️' : '✅';
  prev.style.background = color;
  prev.style.borderColor = border;
  prev.style.color = textColor;
  prevText.textContent = (newQty < 0 ? 'Cannot subtract more than current stock'
    : newQty === 0 ? 'New stock will be 0 ' + unitLabel + ' — marked Unavailable'
    : 'New stock will be ' + newQty.toLocaleString() + ' ' + unitLabel);
  prev.querySelector('span').textContent = icon;
  prev.style.display = 'flex';
}

async function submitProducerUpdateStock() {
  const type = document.getElementById('pus-update-type').value;
  const qty = parseFloat(document.getElementById('pus-qty').value);
  const variety = document.getElementById('pus-name-display').textContent;
  const remarks = document.getElementById('pus-remarks').value.trim();
  if (isNaN(qty) || qty < 0) { showToast('⚠️ Please enter a valid quantity.'); return; }

  // ── Live-DB path: real PUT to producer_crop_stocks.php, which itself
  //    validates the subtract-below-zero rule server-side and writes the
  //    matching producer_stock_logs audit row. ─────────────────────────
  if (_liveStockTarget && usingLiveBackend) {
    const actionType = type === 'set' ? 'Exact' : type === 'add' ? 'Added' : 'Subtracted';
    const actor = currentUser || { user_id: 0, email: 'demo@patatatas.local', fname: 'Demo', lname: 'User' };
    try {
      const result = await apiSend('PUT', 'producer_crop_stocks.php?id=' + _liveStockTarget.dbId, {
        action_type: actionType, quantity: qty, reason_for_change: remarks || '(no reason given)',
        user_id: actor.user_id, user_email: actor.email,
        update_done_by_fname: actor.fname, update_done_by_lname: actor.lname,
        acting_producer_id: currentUser ? currentUser.producer_id : undefined,
      });
      closeModal('modal-producer-update-stock');
      showToast('✅ ' + variety + ' updated to ' + result.current_stock_quantity.toLocaleString() + ' ' + _liveStockTarget.unitAbbrev + ' in the database.');
      _liveStockTarget = null;
      await tryLoadLiveCatalog();
    } catch (e) {
      showToast('⚠️ ' + e.message);
    }
    return;
  }

  // ── Offline demo path — unchanged local-only behavior. ──────────────
  let newQty;
  if (type === 'set') newQty = qty;
  else if (type === 'add') newQty = _pusCurrentQty + qty;
  else newQty = _pusCurrentQty - qty;
  if (newQty < 0) { showToast('⚠️ Cannot subtract more than current stock (' + _pusCurrentQty.toLocaleString() + ' kg).'); return; }
  const s = seeds.find(x => x.name === variety);
  if (s) {
    s.qtyNum = newQty;
    s.qty = newQty.toLocaleString() + ' kg';
    s.status = newQty === 0 ? 'unavailable' : newQty < 200 ? 'low' : 'available';
    s.lastUpdated = todayLabel();
  }
  closeModal('modal-producer-update-stock');
  showToast(newQty === 0
    ? '✅ ' + variety + ' updated to 0 kg — auto-marked Unavailable. Admin notified. (offline demo)'
    : '✅ ' + variety + ' updated to ' + newQty.toLocaleString() + ' kg. Admin notified. (offline demo)');
}

// ═══ PRODUCER: MY STOCK (live DB) ═══════════════════════════
let _editStockTarget = null;
let _pasVarieties = [];

function actorInfo() {
  const a = currentUser || { user_id: 0, email: '', fname: '', lname: '' };
  return {
    user_id: a.user_id, user_email: a.email,
    update_done_by_fname: a.fname, update_done_by_lname: a.lname,
    acting_producer_id: a.producer_id || undefined,
  };
}
function findStockByDbId(id) { return seeds.find(x => x.dbId === id); }

function renderProducerStock() {
  const tbody = document.getElementById('producer-stock-tbody');
  // Only takes over from the static demo rows when logged in as a real producer.
  if (!tbody || !usingLiveBackend || !currentUser || !currentUser.producer_id) return;

  const mine = seeds.filter(s => s.dbId !== undefined && s.producerId === currentUser.producer_id);
  const title = document.getElementById('producer-stock-title');
  if (title) title.textContent = (currentUser.producer_name || 'My') + ' — My Varieties (' + mine.length + ')';

  if (!mine.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:28px;">No stock entries yet. Click “＋ Add Stock Entry” to list a variety.</td></tr>';
    return;
  }
  tbody.innerHTML = mine.map(s => `<tr>
    <td><strong>${s.name}</strong><br><span class="text-muted">${s.scientific}</span></td>
    <td>${s.emoji} ${s.type.charAt(0).toUpperCase() + s.type.slice(1)}</td>
    <td>${s.generations ? genBadges(s.generations) : ''}</td>
    <td class="font-mono" style="font-weight:700;">${s.qty}<br><span class="text-muted" style="font-size:10px;">${s.unitLabel}</span></td>
    <td class="font-mono">${s.price}</td>
    <td>${statusBadge(s.status)}</td>
    <td>${s.isPublic ? '<span class="badge badge-available">👁 Public</span>' : '<span class="badge badge-unavailable">🔒 Private</span>'}</td>
    <td class="text-muted">${s.lastUpdated}</td>
    <td><div class="flex-gap">
      <button class="btn btn-ghost btn-sm" onclick="openLiveStockUpdate(findStockByDbId(${s.dbId}))">Update Qty</button>
      <button class="btn btn-ghost btn-sm" onclick="openProducerEdit(${s.dbId})">✏️ Edit</button>
      <button class="btn btn-sm" style="background:rgba(192,57,43,0.1);color:var(--danger);" onclick="deleteProducerStock(${s.dbId})">🗑️ Delete</button>
    </div></td>
  </tr>`).join('');
}

// ── Edit price / visibility ─────────────────────────────────
function openProducerEdit(dbId) {
  const s = findStockByDbId(dbId);
  if (!s) return;
  _editStockTarget = s;
  document.getElementById('pes-title').textContent = s.name;
  document.getElementById('pes-price').value = s.priceNum;
  document.getElementById('pes-public').value = s.isPublic ? '1' : '0';
  document.getElementById('pes-remarks').value = '';
  openModal('modal-producer-edit-stock');
}
async function submitProducerEdit() {
  const s = _editStockTarget;
  if (!s) return;
  const price = parseFloat(document.getElementById('pes-price').value);
  if (isNaN(price) || price < 0) { showToast('⚠️ Please enter a valid price.'); return; }
  try {
    await apiSend('PUT', 'producer_crop_stocks.php?id=' + s.dbId, {
      ...actorInfo(),
      action_type: 'Exact', quantity: s.qtyNum,           // quantity unchanged
      unit_price: price,
      is_public: document.getElementById('pes-public').value === '1',
      reason_for_change: document.getElementById('pes-remarks').value.trim() || 'Price/visibility edit',
    });
    closeModal('modal-producer-edit-stock');
    showToast('✅ ' + s.name + ' updated in the database.');
    await tryLoadLiveCatalog();
  } catch (e) { showToast('⚠️ ' + e.message); }
}

// ── Delete ──────────────────────────────────────────────────
async function deleteProducerStock(dbId) {
  const s = findStockByDbId(dbId);
  if (!s) return;
  if (!confirm('Delete your stock entry for "' + s.name + '" (' + s.qty + ')?\nThis removes it from all catalogs. The change is kept in the stock log.')) return;
  try {
    await apiSend('DELETE', 'producer_crop_stocks.php?id=' + dbId, actorInfo());
    showToast('✅ ' + s.name + ' stock entry deleted.');
    await tryLoadLiveCatalog();
  } catch (e) { showToast('⚠️ ' + e.message); }
}

// ── Add stock entry for an existing variety ─────────────────
async function openProducerAddStock() {
  if (!usingLiveBackend || !currentUser || !currentUser.producer_id) {
    showToast('⚠️ Sign in as a producer on the live backend to add stock.'); return;
  }
  try {
    _pasVarieties = await apiGet('varieties.php');
    const sel = document.getElementById('pas-variety');
    sel.innerHTML = _pasVarieties.map(v => `<option value="${v.variety_id}">${v.variety_name} (${v.crop_name})</option>`).join('');
    document.getElementById('pas-qty').value = '';
    document.getElementById('pas-price').value = '';
    document.getElementById('pas-public').value = '1';
    await loadProducerAddUnits();
    openModal('modal-producer-add-stock');
  } catch (e) { showToast('⚠️ Could not load varieties: ' + e.message); }
}
async function loadProducerAddUnits() {
  const v = _pasVarieties.find(x => String(x.variety_id) === document.getElementById('pas-variety').value);
  const unitSel = document.getElementById('pas-unit');
  if (!v) { unitSel.innerHTML = ''; return; }
  const units = await apiGet('rootcrop_units.php?crop_id=' + v.crop_id);
  unitSel.innerHTML = units.length
    ? units.map(u => `<option value="${u.unit_id}">${u.unit_unabbreviated}</option>`).join('')
    : '<option value="">No units defined for this crop — ask Admin</option>';
}
async function submitProducerAddStock() {
  const varietyId = document.getElementById('pas-variety').value;
  const unitId = document.getElementById('pas-unit').value;
  const qty = parseInt(document.getElementById('pas-qty').value, 10);
  const price = parseFloat(document.getElementById('pas-price').value);
  if (!varietyId || !unitId) { showToast('⚠️ Please choose a variety and unit.'); return; }
  if (isNaN(qty) || qty < 0) { showToast('⚠️ Please enter a valid quantity.'); return; }
  if (isNaN(price) || price < 0) { showToast('⚠️ Please enter a valid price.'); return; }
  try {
    await apiSend('POST', 'producer_crop_stocks.php', {
      ...actorInfo(),
      crop_variety_id: Number(varietyId), producer_id: currentUser.producer_id, unit_id: Number(unitId),
      stock_amount: qty, unit_price: price,
      is_public: document.getElementById('pas-public').value === '1',
    });
    closeModal('modal-producer-add-stock');
    showToast('✅ Stock entry added to the database.');
    await tryLoadLiveCatalog();
  } catch (e) { showToast('⚠️ ' + e.message); }
}

// ═══════════════════════════════════════════════════════════
// ── ONLINE ORDERING & PAYMENT (Cart → Checkout → Orders) ──────
// Added per updated panel requirement: the system now supports
// online ordering and payment, in addition to the existing
// reference-only browsing flow. Everything below is still
// simulated in the browser — no real backend or payment gateway.
// ═══════════════════════════════════════════════════════════

let cart = []; // { name, qtyNum (kg requested), price (num), unit:'kg', emoji, supplier }
let orders = [
  // A couple of seed example orders so the Admin Orders / Farmer Orders
  // screens aren't empty on first load.
  {
    id: 'ORD-20260318-0142',
    customerName: 'Jose Compelio',
    customerRole: 'farmer',
    contact: '+63 912 345 6789',
    email: 'jose.compelio@farmer.ph',
    pickup: 'BSU-NPRCRTC — La Trinidad, Benguet',
    paymentMethod: 'gcash',
    paymentRef: 'GC-2026-0318-7741',
    items: [ { name:'Cosima', qtyNum:50, price:82, emoji:'🥔' } ],
    total: 4100,
    status: 'Paid - Awaiting Pickup',
    dateOrdered: 'Mar 18, 2026',
  },
  {
    id: 'ORD-20260310-0098',
    customerName: 'Maria Santos',
    customerRole: 'public',
    contact: '+63 998 111 2222',
    email: 'maria.santos@example.com',
    pickup: 'BSU-NPRCRTC — La Trinidad, Benguet',
    paymentMethod: 'cash',
    paymentRef: null,
    items: [ { name:'Rayong 5', qtyNum:100, price:28, emoji:'🪵' } ],
    total: 2800,
    status: 'Completed',
    dateOrdered: 'Mar 10, 2026',
  },
];

function parsePriceNum(priceStr) {
  return Number(String(priceStr).replace('₱','').replace('/kg','').replace(/,/g,'')) || 0;
}

function addToCart(seedName) {
  const s = seeds.find(x => x.name === seedName);
  if (!s) return;
  if (s.status === 'unavailable' || s.qtyNum <= 0) {
    showToast('⚠️ ' + seedName + ' is currently unavailable and cannot be ordered.');
    return;
  }
  const existing = cart.find(c => c.name === seedName);
  if (existing) {
    if (existing.qtyNum + 1 > s.qtyNum) { showToast('⚠️ Only ' + s.qtyNum.toLocaleString() + ' kg of ' + seedName + ' left in stock.'); return; }
    existing.qtyNum += 1;
  } else {
    cart.push({ name: s.name, qtyNum: 1, price: parsePriceNum(s.price), emoji: s.emoji, supplier: s.supplier });
  }
  updateCartBadges();
  showToast('🛒 Added ' + seedName + ' to cart.');
}

function removeFromCart(name) {
  cart = cart.filter(c => c.name !== name);
  updateCartBadges();
  renderCartModal();
}

function changeCartQty(name, newQty) {
  const item = cart.find(c => c.name === name);
  const s = seeds.find(x => x.name === name);
  if (!item || !s) return;
  newQty = Math.max(1, Math.min(Number(newQty) || 1, s.qtyNum));
  item.qtyNum = newQty;
  updateCartBadges();
  renderCartModal();
}

function cartCount() { return cart.reduce((sum, c) => sum + 1, 0); }
function cartTotal() { return cart.reduce((sum, c) => sum + (c.qtyNum * c.price), 0); }

function updateCartBadges() {
  const count = cartCount();
  ['public-cart-badge','farmer-cart-badge','farmer-cart-badge-2','farmer-cart-badge-3'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function openCart() {
  renderCartModal();
  openModal('modal-cart');
}

function renderCartModal() {
  const list = document.getElementById('cart-items-list');
  const empty = document.getElementById('cart-empty-state');
  const summary = document.getElementById('cart-summary');
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (cart.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    summary.style.display = 'none';
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = '0.5';
    checkoutBtn.style.cursor = 'not-allowed';
    return;
  }
  empty.style.display = 'none';
  summary.style.display = 'block';
  checkoutBtn.disabled = false;
  checkoutBtn.style.opacity = '1';
  checkoutBtn.style.cursor = 'pointer';
  list.innerHTML = cart.map(c => {
    const s = seeds.find(x => x.name === c.name);
    const maxQty = s ? s.qtyNum : c.qtyNum;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--parchment);">
        <div style="font-size:28px;">${c.emoji}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:var(--earth);">${c.name}</div>
          <div style="font-size:11px;color:var(--muted);">${c.supplier} · ₱${c.price}/kg · max ${maxQty.toLocaleString()} kg available</div>
        </div>
        <input type="number" min="1" max="${maxQty}" value="${c.qtyNum}" class="form-control" style="width:70px;padding:6px 8px;font-size:12px;" onchange="changeCartQty('${c.name}', this.value)">
        <div style="width:80px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--bark);">₱${(c.qtyNum*c.price).toLocaleString()}</div>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:transparent;" onclick="removeFromCart('${c.name}')">🗑️</button>
      </div>`;
  }).join('');
  document.getElementById('cart-total-display').textContent = '₱' + cartTotal().toLocaleString();
}

function togglePaymentRefField() {
  const method = document.getElementById('checkout-payment-method').value;
  document.getElementById('checkout-payment-ref-group').style.display = method === 'cash' ? 'none' : 'block';
}

function openCheckout() {
  if (cart.length === 0) { showToast('⚠️ Your cart is empty.'); return; }
  closeModal('modal-cart');
  document.getElementById('checkout-order-summary').innerHTML = cart.map(c =>
    `<div class="flex-between mb-2"><span style="font-size:13px;">${c.emoji} ${c.name} × ${c.qtyNum} kg</span><span class="font-mono" style="font-weight:600;">₱${(c.qtyNum*c.price).toLocaleString()}</span></div>`
  ).join('') + `<div style="border-top:1px solid var(--parchment);margin-top:8px;padding-top:8px;" class="flex-between"><strong style="font-size:14px;">Total</strong><strong class="font-mono" style="font-size:14px;color:var(--bark);">₱${cartTotal().toLocaleString()}</strong></div>`;
  document.getElementById('checkout-payment-method').value = 'cash';
  togglePaymentRefField();
  openModal('modal-checkout');
}

function submitCheckout() {
  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const email = document.getElementById('checkout-email').value.trim();
  const pickup = document.getElementById('checkout-pickup').value;
  const paymentMethod = document.getElementById('checkout-payment-method').value;
  const paymentRef = document.getElementById('checkout-payment-ref').value.trim();

  if (!name) { showToast('⚠️ Please enter your full name.'); return; }
  if (!phone) { showToast('⚠️ Please enter a contact number.'); return; }
  if (!email || !email.includes('@')) { showToast('⚠️ Please enter a valid email address.'); return; }
  if (paymentMethod !== 'cash' && !paymentRef) { showToast('⚠️ Please enter your payment reference number.'); return; }

  // Re-validate stock at checkout time (per catalog's live availability)
  for (const c of cart) {
    const s = seeds.find(x => x.name === c.name);
    if (!s || s.qtyNum < c.qtyNum) {
      showToast('⚠️ ' + c.name + ' no longer has enough stock. Please update your cart.');
      return;
    }
  }

  // Deduct ordered quantities from live stock (auto-unavailable at 0 stays enforced)
  cart.forEach(c => {
    const s = seeds.find(x => x.name === c.name);
    if (s) {
      s.qtyNum -= c.qtyNum;
      s.qty = s.qtyNum.toLocaleString() + ' kg';
      s.status = s.qtyNum === 0 ? 'unavailable' : s.qtyNum < 200 ? 'low' : 'available';
      s.lastUpdated = todayLabel();
    }
  });

  const orderId = 'ORD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Math.floor(Math.random()*9000)+1000);
  const order = {
    id: orderId,
    customerName: name,
    customerRole: (document.getElementById('screen-farmer-dashboard')?.classList.contains('active') || document.getElementById('screen-farmer-catalog')?.classList.contains('active') || document.getElementById('screen-farmer-orders')?.classList.contains('active')) ? 'farmer' : 'public',
    contact: phone,
    email: email,
    pickup: pickup,
    paymentMethod: paymentMethod,
    paymentRef: paymentMethod === 'cash' ? null : paymentRef,
    items: cart.map(c => ({ name:c.name, qtyNum:c.qtyNum, price:c.price, emoji:c.emoji })),
    total: cartTotal(),
    status: paymentMethod === 'cash' ? 'Pending Payment' : 'Pending Payment',
    dateOrdered: todayLabel(),
  };
  orders.unshift(order);

  // Show confirmation
  document.getElementById('confirm-order-id').textContent = order.id;
  document.getElementById('confirm-order-details').innerHTML = order.items.map(i =>
    `<div class="flex-between mb-2"><span style="font-size:13px;">${i.emoji} ${i.name} × ${i.qtyNum} kg</span><span class="font-mono">₱${(i.qtyNum*i.price).toLocaleString()}</span></div>`
  ).join('') + `<div style="border-top:1px solid var(--parchment);margin-top:8px;padding-top:8px;" class="flex-between"><strong>Total</strong><strong class="font-mono">₱${order.total.toLocaleString()}</strong></div>
  <div style="font-size:11px;color:var(--muted);margin-top:10px;">Pickup: <strong>${pickup}</strong><br>Payment: <strong>${paymentMethod === 'cash' ? 'Cash on Pickup' : paymentMethod.toUpperCase() + ' (Ref: ' + paymentRef + ')'}</strong><br>Status: <strong>${order.status}</strong></div>`;

  cart = [];
  updateCartBadges();
  closeModal('modal-checkout');
  openModal('modal-order-confirmation');
  applyPublicFilter();
  applyFarmerFilter();
  applyAdminFilter();
  applyProducerFilter();
  renderAdminOrders();
  renderFarmerOrders();

  // Reset checkout form
  ['checkout-name','checkout-phone','checkout-email','checkout-payment-ref'].forEach(id => { document.getElementById(id).value = ''; });
}

// ── FARMER: My Orders screen ────────────────────────────────
const orderStatusBadge = {
  'Pending Payment': '<span class="badge badge-low">● Pending Payment</span>',
  'Paid - Awaiting Pickup': '<span class="badge" style="background:#E3F2FD;color:#1565C0;">● Paid — Awaiting Pickup</span>',
  'Completed': '<span class="badge badge-available">● Completed</span>',
  'Cancelled': '<span class="badge badge-unavailable">● Cancelled</span>',
};
function renderFarmerOrders() {
  const el = document.getElementById('farmer-orders-list');
  if (!el) return;
  const myOrders = orders.filter(o => o.customerRole === 'farmer');
  if (myOrders.length === 0) {
    el.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:40px 24px;color:var(--muted);">
      <div style="font-size:36px;margin-bottom:10px;">🧾</div>
      <div style="font-size:14px;font-weight:600;color:var(--earth);">No orders yet</div>
      <div style="font-size:12px;margin-top:4px;">Orders you place from the catalog will show up here.</div>
    </div></div>`;
    return;
  }
  el.innerHTML = myOrders.map(o => `
    <div class="card mb-2">
      <div class="card-header">
        <span class="card-title font-mono" style="font-size:13px;">${o.id}</span>
        ${orderStatusBadge[o.status] || ''}
      </div>
      <div class="card-body">
        ${o.items.map(i => `<div class="flex-between mb-2"><span style="font-size:13px;">${i.emoji} ${i.name} × ${i.qtyNum} kg</span><span class="font-mono">₱${(i.qtyNum*i.price).toLocaleString()}</span></div>`).join('')}
        <div class="flex-between" style="border-top:1px solid var(--parchment);padding-top:8px;margin-top:4px;">
          <span class="text-muted" style="font-size:11px;">Placed ${o.dateOrdered} · Pickup: ${o.pickup}</span>
          <strong class="font-mono">₱${o.total.toLocaleString()}</strong>
        </div>
      </div>
    </div>`).join('');
}

// ── ADMIN: Order Management screen ──────────────────────────
function renderAdminOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  const statsEl = document.getElementById('admin-orders-stats');
  const badgeEls = document.querySelectorAll('.admin-orders-navbadge');
  const pendingCount = orders.filter(o => o.status === 'Pending Payment').length;
  badgeEls.forEach(b => b.textContent = pendingCount);
  if (!tbody) return;

  if (statsEl) {
    const totalOrders = orders.length;
    const paidCount = orders.filter(o => o.status === 'Paid - Awaiting Pickup').length;
    const completedCount = orders.filter(o => o.status === 'Completed').length;
    const revenue = orders.filter(o => o.status !== 'Cancelled').reduce((s,o)=>s+o.total,0);
    statsEl.innerHTML = `
      <div class="stat-card amber"><div class="stat-icon">🧾</div><div class="stat-value">${totalOrders}</div><div class="stat-label">Total Orders</div></div>
      <div class="stat-card sage"><div class="stat-icon">⏳</div><div class="stat-value">${pendingCount}</div><div class="stat-label">Pending Payment</div></div>
      <div class="stat-card blue"><div class="stat-icon">📦</div><div class="stat-value">${paidCount}</div><div class="stat-label">Awaiting Pickup</div></div>
      <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">₱${revenue.toLocaleString()}</div><div class="stat-label">Order Value (excl. cancelled)</div></div>
    `;
  }

  const filter = document.getElementById('admin-orders-status-filter')?.value || 'all';
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;">No orders match this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const itemsText = o.items.map(i => `${i.emoji} ${i.name} ×${i.qtyNum}kg`).join(', ');
    const paymentText = o.paymentMethod === 'cash' ? 'Cash on Pickup' : o.paymentMethod.toUpperCase() + (o.paymentRef ? ' · ' + o.paymentRef : '');
    let actions = '';
    if (o.status === 'Pending Payment') {
      actions = `<button class="btn btn-sm" style="background:rgba(74,124,78,0.12);color:var(--sprout);" onclick="markOrderStatus('${o.id}','Paid - Awaiting Pickup')">✅ Mark Paid</button>
                 <button class="btn btn-sm" style="background:rgba(192,57,43,0.1);color:var(--danger);" onclick="markOrderStatus('${o.id}','Cancelled')">Cancel</button>`;
    } else if (o.status === 'Paid - Awaiting Pickup') {
      actions = `<button class="btn btn-sm" style="background:rgba(41,128,185,0.12);color:var(--info);" onclick="markOrderStatus('${o.id}','Completed')">📦 Mark Picked Up</button>
                 <button class="btn btn-sm" style="background:rgba(192,57,43,0.1);color:var(--danger);" onclick="markOrderStatus('${o.id}','Cancelled')">Cancel</button>`;
    } else {
      actions = `<span class="text-muted" style="font-size:11px;">No actions</span>`;
    }
    return `<tr>
      <td class="font-mono text-sm">${o.id}</td>
      <td><strong>${o.customerName}</strong><br><span class="text-muted text-sm">${o.customerRole === 'farmer' ? '👨‍🌾 Farmer' : '🌐 Public'} · ${o.contact}</span></td>
      <td style="font-size:12px;max-width:220px;">${itemsText}</td>
      <td class="font-mono">₱${o.total.toLocaleString()}</td>
      <td style="font-size:12px;">${paymentText}</td>
      <td>${orderStatusBadge[o.status] || o.status}</td>
      <td class="text-muted text-sm">${o.dateOrdered}</td>
      <td><div class="flex-gap">${actions}</div></td>
    </tr>`;
  }).join('');
}

function markOrderStatus(orderId, newStatus) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  // Cancelling an order that hasn't been fulfilled restores the reserved stock
  if (newStatus === 'Cancelled' && o.status !== 'Cancelled') {
    o.items.forEach(i => {
      const s = seeds.find(x => x.name === i.name);
      if (s) {
        s.qtyNum += i.qtyNum;
        s.qty = s.qtyNum.toLocaleString() + ' kg';
        s.status = s.qtyNum === 0 ? 'unavailable' : s.qtyNum < 200 ? 'low' : 'available';
        s.lastUpdated = todayLabel();
      }
    });
    applyPublicFilter(); applyFarmerFilter(); applyAdminFilter(); applyProducerFilter();
  }
  o.status = newStatus;
  renderAdminOrders();
  renderFarmerOrders();
  showToast('✅ Order ' + orderId + ' marked as ' + newStatus + '.');
}

// ── INIT ─────────────────────────────────────────────────
applyAdminFilter();
applyProducerFilter();
applyFarmerFilter();
applyPublicFilter();
updateCartBadges();
renderAdminOrders();
renderFarmerOrders();
tryLoadLiveCatalog(); // no-op (silent) if no backend is running — see README.md
