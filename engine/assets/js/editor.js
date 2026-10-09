'use strict';
/* editor.js — Tương tác canvas: công cụ, chọn/kéo, vẽ liên kết, đặt mẫu, phím tắt. */
window.ChemEditor = (() => {
  const M = window.ChemModel;
  const st = {
    tool: 'select', el: 'C', order: 1, bstyle: 'solid',
    tpl: null, sel: null, snap: true, grid: true, gridType: 'square', gridOrientation: 'horizontal', space: false,
    view: { x: 0, y: 0, k: 1 }, drag: null, hover: null, changed: false
  };
  let stage, viewport, gridRect, overlay, wrap;

  // ---------- Toạ độ & hiển thị ----------
  function toWorld(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - st.view.x) / st.view.k, y: (e.clientY - r.top - st.view.y) / st.view.k };
  }
  function toggleGridOrientation() {
    if (st.gridType !== 'triangle') return;
    const angle = st.gridOrientation === 'horizontal' ? Math.PI / 2 : -Math.PI / 2;
    st.gridOrientation = st.gridOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    rotateAllComponents(angle);
    updateGrid();
  }
  function snapP(p) {
    if (!st.snap) return p;
    if (st.gridType !== 'triangle') return { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 };
    const vertical = st.gridOrientation === 'vertical';
    const source = vertical ? { x: p.y, y: -p.x } : p;
    const side = parseFloat(document.getElementById('optBondLen').value) || 40;
    const rowHeight = side * Math.sqrt(3) / 2;
    const nearRow = Math.round(source.y / rowHeight);
    let nearest = null, nearestDist = Infinity;
    for (let row = nearRow - 1; row <= nearRow + 1; row++) {
      const offset = Math.abs(row % 2) * side / 2;
      const y = row * rowHeight;
      const x = Math.round((source.x - offset) / side) * side + offset;
      const d = (x - source.x) ** 2 + (y - source.y) ** 2;
      if (d < nearestDist) { nearest = { x, y }; nearestDist = d; }
    }
    if (!nearest) return p;
    return vertical ? { x: -nearest.y, y: nearest.x } : nearest;
  }
  function orientTemplatePoint(x, y) {
    return st.gridType === 'triangle' && st.gridOrientation === 'vertical'
      ? { x: -y, y: x }
      : { x, y };
  }
  function updateGrid() {
    if (!gridRect) return;
    const pattern = document.getElementById('gridTriangle');
    const side = parseFloat(document.getElementById('optBondLen').value) || 40;
    const rowHeight = side * Math.sqrt(3) / 2;
    if (pattern) {
      pattern.setAttribute('width', side);
      pattern.setAttribute('height', rowHeight * 2);
      pattern.firstElementChild.setAttribute(
        'd',
        `M0 0H${side} M0 ${rowHeight}H${side} M0 ${rowHeight * 2}H${side} M0 0L${side / 2} ${rowHeight}L${side} 0 M0 ${rowHeight * 2}L${side / 2} ${rowHeight}L${side} ${rowHeight * 2}`
      );
      pattern.setAttribute('patternTransform', st.gridOrientation === 'vertical' ? 'rotate(90)' : '');
    }
    gridRect.setAttribute('fill', `url(#grid${st.gridType === 'triangle' ? 'Triangle' : ''})`);
    gridRect.style.display = st.grid ? '' : 'none';
    const button = document.getElementById('gridTypeBtn');
    if (button) {
      const triangle = st.gridType === 'triangle';
      button.textContent = triangle ? '△' : '▦';
      button.title = triangle ? 'Chuyển sang lưới vuông' : 'Chuyển sang lưới tam giác';
      button.setAttribute('aria-label', 'Loại lưới: ' + (triangle ? 'tam giác' : 'vuông'));
      button.setAttribute('aria-pressed', triangle ? 'true' : 'false');
      button.classList.toggle('active', triangle);
    }
    const orientationButton = document.getElementById('gridOrientationBtn');
    if (orientationButton) {
      const vertical = st.gridOrientation === 'vertical';
      orientationButton.hidden = st.gridType !== 'triangle';
      orientationButton.textContent = vertical ? '↔' : '↕';
      orientationButton.title = `Chuyển trục sang ${vertical ? 'nằm ngang' : 'nằm dọc'} và xoay cấu trúc 90°`;
      orientationButton.setAttribute('aria-label', `Trục lưới tam giác nằm ${vertical ? 'dọc' : 'ngang'}`);
      orientationButton.setAttribute('aria-pressed', vertical ? 'true' : 'false');
      orientationButton.classList.toggle('active', vertical);
    }
    updateGridStatus();
  }
  function updateGridStatus() {
    const s = document.getElementById('stSnap');
    if (s) s.textContent = `Lưới ${st.gridType === 'triangle' ? `tam giác (${st.gridOrientation === 'vertical' ? 'dọc' : 'ngang'})` : 'vuông'}: ${st.grid ? 'Bật' : 'Tắt'} · Bắt điểm: ${st.snap ? 'Bật' : 'Tắt'}`;
  }
  function applyView() {
    const v = st.view;
    const t = `translate(${v.x.toFixed(2)},${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`;
    viewport.setAttribute('transform', t);
    if (gridRect) gridRect.setAttribute('transform', t);
    const zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = Math.round(v.k * 100) + '%';
  }
  function redraw() {
    window.ChemRender.renderAll(st.sel);
    drawOverlay();
    const tb = document.getElementById('stTool');
    if (tb) tb.textContent = 'Công cụ: ' + toolName();
    if (st.onAfter) { try { st.onAfter(); } catch (e) { console.error(e); } }
  }
  function toolName() {
    return { select: 'Chọn', pan: 'Kéo khung', atom: 'Đặt nguyên tử (' + st.el + ')', bond: `Liên kết ${st.order > 1 ? ['','','đôi','ba'][st.order] : 'đơn'}${st.bstyle !== 'solid' ? ' · ' + st.bstyle : ''}`, erase: 'Tẩy', chain: 'Mạch zigzag' }[st.tool] || st.tool;
  }
  function clearOverlay() { while (overlay.firstChild) overlay.removeChild(overlay.firstChild); }
  function ov(tag, attrs, parent) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    (parent || overlay).appendChild(n); return n;
  }
  // Vẽ vùng chọn (multi) + ghost + hover lên lớp overlay.
  function drawOverlay() {
    clearOverlay();
    if (st.sel && st.sel.type === 'multi') for (const id of st.sel.ids) {
      const a = M.atom(id); if (a) ov('circle', { cx: a.x, cy: a.y, r: 15, class: 'sel-ring' });
    }
    if (st.sel && st.sel.type === 'atoms') for (const id of st.sel.ids) {
      const a = M.atom(id); if (a) ov('circle', { cx: a.x, cy: a.y, r: 15, class: 'sel-ring' });
    }
    if (st.drag) drawDragGhost();
    else if (st.tool === 'erase' && st.hover) drawHover();
    else if (st.tpl && st.hoverP) drawTplGhost();
  }
  function drawHover() {
    const h = st.hover;
    if (h.type === 'atom') { const a = M.atom(h.id); if (a) ov('circle', { cx: a.x, cy: a.y, r: 14, fill: 'none', stroke: '#d01818', 'stroke-width': 2, class: 'snapdot' }); }
    if (h.type === 'bond') {
      const b = M.bond(h.id); if (!b) return;
      const A = M.atom(b.a), B = M.atom(b.b); if (!A || !B) return;
      ov('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#d01818', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: .6 });
    }
  }
  function drawTplGhost() {
    const frag = window.ChemTemplates.byName(st.tpl); if (!frag || !st.hoverP) return;
    const p = snapP(st.hoverP);
    const rotation = st.gridType === 'triangle' && st.gridOrientation === 'vertical' ? ' rotate(90)' : '';
    const g = ov('g', { class: 'ghost', transform: `translate(${p.x},${p.y})${rotation}` });
    const thumb = window.ChemTemplates.thumb(frag);
    while (thumb.firstChild) g.appendChild(thumb.firstChild);
  }
  function drawDragGhost() {
    const d = st.drag;
    if (d.mode === 'bond' && d.cur) {
      const A = M.atom(d.from); if (!A) return;
      const g = ov('g', { class: 'ghost' });
      ov('line', { x1: A.x, y1: A.y, x2: d.cur.x, y2: d.cur.y, stroke: window.ChemTheme.palette().ink, 'stroke-width': 2.5 }, g);
      if (!d.onAtom) ov('circle', { cx: d.cur.x, cy: d.cur.y, r: 5, fill: window.ChemTheme.palette().blue }, g);
      ov('circle', { cx: d.cur.x, cy: d.cur.y, r: 4, fill: window.ChemTheme.palette().blue, class: 'snapdot' }, g);
    } else if (d.mode === 'box') {
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
      ov('rect', { x, y, width: Math.abs(d.x1 - d.x0), height: Math.abs(d.y1 - d.y0), fill: 'rgba(11,87,208,.1)', stroke: '#0b57d0', 'stroke-dasharray': '4 3' });
    } else if (d.mode === 'chain' && d.cur) {
      const pts = chainPoints(d.start, d.cur);
      ov('polyline', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: 'none', stroke: window.ChemTheme.palette().ink, 'stroke-width': 2.5, class: 'ghost' });
    }
  }
  function chainPoints(start, end) {
    const n = Math.max(2, Math.min(12, parseInt(document.getElementById('chainLen').value, 10) || 4));
    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const bl = M.S.atoms.length >= 0 ? (parseFloat(document.getElementById('optBondLen').value) || 40) : 40;
    const natural = (n - 1) * bl;
    const scale = Math.max(.5, Math.min(2, len / natural));
    const pts = [];
    for (let i = 0; i < n; i++) {
      let x = i * bl * scale, y = 0;
      if (i > 0) y = (i % 2 ? -1 : 1) * bl * scale * 0.5;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      pts.push({ x: start.x + x * ca - y * sa, y: start.y + x * sa + y * ca });
    }
    return pts;
  }
  function ringEdges(frag) {
    const rings = frag.rings || (frag.ring ? [frag.ring] : []);
    const edges = [];
    for (const ring of rings) {
      const vertices = ring.vertices || [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        const bondIndex = frag.bonds.findIndex(bond =>
          (bond[0] === a && bond[1] === b) || (bond[0] === b && bond[1] === a)
        );
        if (bondIndex >= 0) edges.push({ a, b, center: { x: ring.cx, y: ring.cy } });
      }
    }
    return edges;
  }
  function isCycleBond(target) {
    const seen = new Set([target.a]), queue = [target.a];
    while (queue.length) {
      const id = queue.shift();
      for (const bond of M.S.bonds) {
        if (bond.id === target.id) continue;
        const next = bond.a === id ? bond.b : bond.b === id ? bond.a : null;
        if (next === target.b) return true;
        if (next != null && !seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return false;
  }
  function nearCycleBond(p, tolerance) {
    let best = null, bestDistance = tolerance;
    for (const bond of M.S.bonds) {
      if (!isCycleBond(bond)) continue;
      const A = M.atom(bond.a), B = M.atom(bond.b);
      if (!A || !B) continue;
      const dx = B.x - A.x, dy = B.y - A.y, length2 = dx * dx + dy * dy;
      if (!length2) continue;
      const along = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / length2));
      const distance = Math.hypot(p.x - (A.x + along * dx), p.y - (A.y + along * dy));
      if (distance < bestDistance) { best = bond; bestDistance = distance; }
    }
    return best;
  }
  function fusionTransform(frag, p) {
    if (!(frag.ring || frag.rings)) return null;
    const target = nearCycleBond(p, Math.max(18, (parseFloat(document.getElementById('optBondLen').value) || 40) * 0.55));
    if (!target) return null;
    const A = M.atom(target.a), B = M.atom(target.b);
    if (!A || !B) return null;
    const targetLength = M.dist(A, B), sourceEdges = ringEdges(frag);
    if (!sourceEdges.length) return null;
    const bondNeighbors = [
      ...M.neighbors(A.id).filter(id => id !== B.id),
      ...M.neighbors(B.id).filter(id => id !== A.id)
    ].map(id => M.atom(id)).filter(Boolean);
    const neighborCenter = bondNeighbors.length
      ? { x: bondNeighbors.reduce((sum, a) => sum + a.x, 0) / bondNeighbors.length, y: bondNeighbors.reduce((sum, a) => sum + a.y, 0) / bondNeighbors.length }
      : null;
    let best = null;
    for (const edge of sourceEdges) {
      const sourceA = frag.atoms[edge.a], sourceB = frag.atoms[edge.b];
      const dx = sourceB.dx - sourceA.dx, dy = sourceB.dy - sourceA.dy;
      const sourceLength = Math.hypot(dx, dy);
      if (!sourceLength) continue;
      const scale = targetLength / sourceLength;
      if (scale < 0.65 || scale > 1.5) continue;
      for (const reverse of [false, true]) {
        const targetA = reverse ? B : A, targetB = reverse ? A : B;
        const angle = Math.atan2(targetB.y - targetA.y, targetB.x - targetA.x) - Math.atan2(dy, dx);
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const ox = targetA.x - scale * (cos * sourceA.dx - sin * sourceA.dy);
        const oy = targetA.y - scale * (sin * sourceA.dx + cos * sourceA.dy);
        let score = 0;
        if (neighborCenter) {
          const midX = (A.x + B.x) / 2, midY = (A.y + B.y) / 2;
          const occupiedSide = (B.x - A.x) * (neighborCenter.y - midY) - (B.y - A.y) * (neighborCenter.x - midX);
          const centerX = ox + scale * (cos * edge.center.x - sin * edge.center.y);
          const centerY = oy + scale * (sin * edge.center.x + cos * edge.center.y);
          const candidateSide = (B.x - A.x) * (centerY - midY) - (B.y - A.y) * (centerX - midX);
          score = occupiedSide ? -Math.sign(occupiedSide) * candidateSide : Math.abs(candidateSide);
        }
        if (!best || score > best.score) best = { ox, oy, cos, sin, scale, score };
      }
    }
    return best;
  }
  // ---------- Đặt mẫu ----------
  function placeTemplate(frag, p) {
    if (!frag) return;
    const bl = parseFloat(document.getElementById('optBondLen').value) || 40;
    const isRing = !!(frag.ring || frag.rings);
    const fusion = fusionTransform(frag, p);
    const position = fusion ? p : snapP(p);
    const near = (!isRing && frag.anchor != null) ? M.nearAtom(position, 20) : (isRing && frag.anchor != null ? M.nearAtom(position, 20) : null);
    let ox = position.x, oy = position.y;
    if (fusion) {
      ox = fusion.ox; oy = fusion.oy;
    } else if (near && isRing) {
      const ai = frag.anchor != null ? frag.anchor : 0;
      const anchor = orientTemplatePoint(frag.atoms[ai].dx, frag.atoms[ai].dy);
      ox = near.x - anchor.x; oy = near.y - anchor.y;
    } else if (near && !isRing) {
      const A = frag.anchor != null ? frag.atoms[frag.anchor] : frag.atoms[0];
      const anchor = orientTemplatePoint(A.dx, A.dy);
      let dx = p.x - near.x, dy = p.y - near.y, L = Math.hypot(dx, dy);
      if (L < 6) { dx = 1; dy = 0; L = 1; }
      ox = near.x + dx / L * bl - anchor.x; oy = near.y + dy / L * bl - anchor.y;
    } else if (isRing && !near) {
      // Đặt vòng lên atom sẵn có → hàn (fused): đưa một đỉnh của vòng khớp vào atom đó.
      const t0 = M.nearAtom(position, 16);
      if (t0) {
        // Chọn đỉnh sao cho tâm vòng mới nằm xa khu vực atom hiện có (tránh đè).
        const nbs = M.neighbors(t0.id).map(id => M.atom(id)).filter(Boolean);
        let lx = t0.x, ly = t0.y;
        if (nbs.length) {
          lx = nbs.reduce((s, a) => s + a.x, t0.x) / (nbs.length + 1);
          ly = nbs.reduce((s, a) => s + a.y, t0.y) / (nbs.length + 1);
        }
        let bv = frag.atoms[0], bd = -1;
        for (const v of frag.atoms) {
          const offset = orientTemplatePoint(v.dx, v.dy);
          const mx = t0.x - offset.x, my = t0.y - offset.y;
          const dd = Math.hypot(mx - lx, my - ly);
          if (dd > bd) { bd = dd; bv = v; }
        }
        const offset = orientTemplatePoint(bv.dx, bv.dy);
        ox = t0.x - offset.x; oy = t0.y - offset.y;
      } else {
        // Nhấn gần rìa (đỉnh vòng nằm sát atom) cũng hàn được.
        for (let i = 0; i < frag.atoms.length; i++) {
          const v = frag.atoms[i];
          const offset = orientTemplatePoint(v.dx, v.dy);
          const t = M.nearAtom({ x: position.x + offset.x, y: position.y + offset.y }, 10);
          if (t) { ox = t.x - offset.x; oy = t.y - offset.y; break; }
        }
      }
    } else if (frag.anchor != null) {
      const anchor = orientTemplatePoint(frag.atoms[frag.anchor].dx, frag.atoms[frag.anchor].dy);
      ox = position.x - anchor.x; oy = position.y - anchor.y;
    }

    M.transact(() => {
      const ids = frag.atoms.map(a => {
        const offset = orientTemplatePoint(a.dx, a.dy);
        const x = fusion ? ox + fusion.scale * (fusion.cos * a.dx - fusion.sin * a.dy) : offset.x + ox;
        const y = fusion ? oy + fusion.scale * (fusion.sin * a.dx + fusion.cos * a.dy) : offset.y + oy;
        const ex = M.nearAtom({ x, y }, 10);
        return ex ? ex.id : M.addAtom(x, y, a.el).id;
      });
      const bondIds = [];
      for (const bd of frag.bonds) {
        const b = M.addBond(ids[bd[0]], ids[bd[1]], bd[2] || 1, 'solid');
        if (b) bondIds.push(b.id);
      }
      const rings = frag.rings || (frag.ring ? [frag.ring] : []);
      for (const rg of rings) {
        const center = orientTemplatePoint(rg.cx, rg.cy);
        const cx = fusion ? ox + fusion.scale * (fusion.cos * rg.cx - fusion.sin * rg.cy) : ox + center.x;
        const cy = fusion ? oy + fusion.scale * (fusion.sin * rg.cx + fusion.cos * rg.cy) : oy + center.y;
        const g = M.addRing(cx, cy, rg.r * (fusion ? fusion.scale : 1), rg.aromatic);
        if (rg.dbl && rg.dbl.length) g.dblIds = rg.dbl.map(i => bondIds[i]).filter(Boolean);
      }
      if (near && !isRing) M.addBond(near.id, ids[frag.anchor != null ? frag.anchor : 0], frag.order || 1, 'solid');
    }, 'place');
    st.sel = null;
    setHint(fusion
      ? `Đã ghép "${frag.name}" với vòng hiện có qua một cạnh chung.`
      : 'Đã đặt mẫu "' + frag.name + '" — nhấn tiếp để đặt nữa hoặc Esc để thoát.');
  }
  // ---------- Xử lý chuột ----------
  function onDown(e) {
    if (e.button === 2) return;
    stage.focus();
    const p = toWorld(e);
    if (e.button === 1 || st.tool === 'pan' || st.space) {
      st.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (st.tpl) { placeTemplate(window.ChemTemplates.byName(st.tpl), p); st.tpl = null; syncTplButtons(); redraw(); return; }

    const hitA = M.nearAtom(p, 16), hitB = hitA ? null : M.nearBond(p, 9);
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}

    if (st.tool === 'select') {
      if (hitA) {
        st.sel = { type: 'atom', id: hitA.id };
        M.beginTx(); st.changed = false;
        st.drag = { mode: 'move', from: hitA.id, ids: Array.from(M.component(hitA.id)), last: p, moved: false };
      } else if (hitB) {
        st.sel = { type: 'bond', id: hitB.id };
        M.beginTx(); st.changed = false;
        st.drag = { mode: 'move', from: null, ids: [hitB.a, hitB.b], last: p, moved: false };
      } else {
        st.sel = null;
        st.drag = { mode: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      }
      redraw(); return;
    }
    if (st.tool === 'erase') { M.beginTx(); st.changed = false; st.drag = { mode: 'erase' }; eraseAt(p); return; }
    if (st.tool === 'chain') { st.drag = { mode: 'chain', start: snapP(p), cur: snapP(p) }; return; }
    // atom hoặc bond: kéo để nối liên kết.
    M.beginTx(); st.changed = false;
    let from = hitA;
    const createdFrom = !from;
    if (!from) {
      const start = snapP(p);
      from = M.addAtom(start.x, start.y, st.el);
      M.markTx();
    }
    st.drag = { mode: 'bond', from: from.id, start: p, cur: null, moved: false, onAtom: false, createdFrom };
    redraw();
  }
  function onMove(e) {
    const p = toWorld(e);
    document.getElementById('stPos').textContent = `x: ${Math.round(p.x)}, y: ${Math.round(p.y)}`;
    if (!st.drag) {
      if (st.tool === 'erase' || st.tpl) { st.hover = hitTest(p); st.hoverP = p; redraw(); }
      return;
    }
    const d = st.drag;
    if (d.mode === 'pan') { st.view.x = d.vx + (e.clientX - d.sx); st.view.y = d.vy + (e.clientY - d.sy); applyView(); return; }
    if (d.mode === 'box') { d.x1 = p.x; d.y1 = p.y; drawOverlay(); return; }
    if (d.mode === 'chain') { d.cur = snapP(p); drawOverlay(); return; }
    if (d.mode === 'erase') { eraseAt(p); return; }
    if (d.mode === 'move') {
      const dx = p.x - d.last.x, dy = p.y - d.last.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) {
        for (const id of d.ids) { const a = M.atom(id); if (a) { a.x = Math.round((a.x + dx) * 10) / 10; a.y = Math.round((a.y + dy) * 10) / 10; } }
        d.last = p; d.moved = true; M.markTx(); redraw();
      }
      return;
    }
    if (d.mode === 'bond') {
      const A = M.atom(d.from); if (!A) return;
      d.moved = true;
      const bl = parseFloat(document.getElementById('optBondLen').value) || 40;
      let target = snapP(p);
      const tgtA = M.nearAtom(p, 14);
      if (tgtA && tgtA.id !== d.from) { d.cur = { x: tgtA.x, y: tgtA.y }; d.onAtom = true; }
      else {
        d.onAtom = false;
        if (!e.shiftKey) { // bắt góc 30° để dễ vẽ vòng; Shift = tự do
          const dx = target.x - A.x, dy = target.y - A.y, L = Math.hypot(dx, dy);
          if (L > 4) {
            const step = Math.PI / 6;
            const base = st.gridType === 'triangle' && st.gridOrientation === 'vertical' ? Math.PI / 2 : 0;
            const rawAngle = Math.atan2(dy, dx);
            const ang = base + Math.round((rawAngle - base) / step) * step;
            const r = Math.max(4, Math.round(L / bl) * bl);
            target = { x: Math.round(A.x + Math.cos(ang) * r), y: Math.round(A.y + Math.sin(ang) * r) };
          }
        }
        d.cur = target;
      }
      drawOverlay();
    }
  }
  function onUp(e) {
    if (!st.drag) return;
    const d = st.drag; st.drag = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
    if (d.mode === 'pan') { redraw(); return; }
    if (d.mode === 'box') {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1);
      const y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      const ids = M.S.atoms.filter(a => a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1).map(a => a.id);
      st.sel = ids.length ? (ids.length === 1 ? { type: 'atom', id: ids[0] } : { type: 'multi', ids }) : null;
      redraw(); return;
    }
    if (d.mode === 'chain') {
      const pts = chainPoints(d.start, d.cur || d.start);
      M.transact(() => {
        const ids = pts.map(pt => { const q = M.nearAtom(pt, 10); return q ? q.id : M.addAtom(pt.x, pt.y, 'C').id; });
        for (let i = 0; i < ids.length - 1; i++) M.addBond(ids[i], ids[i + 1], 1, 'solid');
      }, 'chain');
      redraw(); return;
    }
    if (d.mode === 'erase') { M.endTx(); M.emit('change'); redraw(); return; }
    if (d.mode === 'move') { M.endTx(); if (d.moved) M.emit('change'); redraw(); return; }
    if (d.mode === 'bond') {
      const A = M.atom(d.from);
      if (A && d.moved && d.cur) {
        const hit = M.nearAtom(d.cur, 14);
        if (hit && hit.id !== d.from) { M.addBond(d.from, hit.id, st.order, st.bstyle); M.markTx(); }
        else if (M.dist(A, d.cur) > 6) {
          const na = M.addAtom(d.cur.x, d.cur.y, d.createdFrom ? 'C' : st.el);
          M.addBond(d.from, na.id, st.order, st.bstyle); M.markTx();
        }
      }
      M.endTx();
      M.emit('change');
      redraw();
    }
  }
  function hitTest(p) {
    const a = M.nearAtom(p, 16);
    if (a) return { type: 'atom', id: a.id };
    const b = M.nearBond(p, 9);
    return b ? { type: 'bond', id: b.id } : null;
  }
  function eraseAt(p) {
    const h = hitTest(p); if (!h) return;
    if (h.type === 'atom') { M.removeAtom(h.id); if (st.sel && st.sel.id === h.id) st.sel = null; }
    else M.removeBond(h.id);
    M.markTx(); st.changed = true; redraw();
  }
  // ---------- Phím tắt / lăn chuột ----------
  function onWheel(e) {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, st.view.k * Math.pow(1.0015, -e.deltaY));
  }
  function zoomAt(mx, my, k2) {
    if (!isFinite(k2) || !isFinite(mx) || !isFinite(my)) return;
    k2 = Math.max(0.2, Math.min(5, k2));
    const v = st.view;
    const wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k;
    v.k = k2; v.x = mx - wx * k2; v.y = my - wy * k2;
    applyView();
  }
  function zoomBtn(f) { const r = stage.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, st.view.k * f); }
  function fitView() {
    const box = M.bbox(50);
    const r = stage.getBoundingClientRect();
    if (!box) { st.view = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return; }
    const k = Math.max(0.2, Math.min(2, Math.min(r.width / box.w, r.height / box.h)));
    st.view.k = k;
    st.view.x = (r.width - box.w * k) / 2 - box.x * k;
    st.view.y = (r.height - box.h * k) / 2 - box.y * k;
    applyView();
  }
  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? M.redo() : M.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); M.redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); selectAll(); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (k === ' ') { st.space = true; stage.classList.add('panning'); e.preventDefault(); return; }
    const map = { v: 'select', h: 'pan', a: 'atom', e: 'erase', z: 'chain', b: 'bond' };
    if (map[k]) { setTool(map[k]); return; }
    if (k === '1') setBond(1, 'solid');
    else if (k === '2') setBond(2, 'solid');
    else if (k === '3') setBond(3, 'solid');
    else if (k === '4') setBond(1, 'wedge');
    else if (k === '5') setBond(1, 'hash');
    else if (k === 'g') toggleGrid();
    else if (k === 't') toggleGridType();
    else if (k === 'y') toggleGridOrientation();
    else if (k === 'r') rotateSelection(e.shiftKey ? -Math.PI / 6 : Math.PI / 6);
    else if (k === 'd') { if (window.ChemApp && ChemApp.actions['toggle-theme']) ChemApp.actions['toggle-theme'](); }
    else if (k === '0') fitView();
    else if (k === 'escape') { st.tpl = null; st.sel = null; syncTplButtons(); redraw(); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  }
  function onKeyUp(e) { if (e.key === ' ') { st.space = false; stage.classList.remove('panning'); } }
  function onDblClick(e) {
    const a = M.nearAtom(toWorld(e), 16); if (!a) return;
    const v = window.prompt('Ký hiệu nguyên tử hoặc nhóm chức (vd: C, Fe, NH2, OH):', a.el);
    if (v == null) return;
    const nv = v.trim();
    if (!nv) { window.ChemApp.toast('Ký hiệu hoặc tên nhóm không được để trống.'); return; }
    if (nv.length > 16) { window.ChemApp.toast('Tên nguyên tử/nhóm tối đa 16 ký tự.'); return; }
    M.transact(() => { a.el = nv; }, 'label');
    redraw();
  }
  // ---------- Thao tác chung ----------
  function setTool(t) {
    st.tool = t; st.tpl = null;
    document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    document.querySelectorAll('.bondbtn').forEach(b => {
      const active = t === 'bond' && +b.dataset.order === st.order && b.dataset.style === st.bstyle;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    stage.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    syncTplButtons(); redraw();
  }
  function setBond(order, style) {
    st.order = order; st.bstyle = style; st.tool = 'bond'; st.tpl = null;
    document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === 'bond'));
    document.querySelectorAll('.bondbtn').forEach(b => {
      const active = +b.dataset.order === order && b.dataset.style === style;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    stage.style.cursor = 'crosshair'; syncTplButtons(); redraw();
  }
  function setElement(el) {
    st.el = el;
    document.querySelectorAll('.atom').forEach(b => {
      const active = b.dataset.el === el;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    setTool('atom');
  }
  function setTemplate(name) {
    st.tpl = (st.tpl === name) ? null : name;
    if (st.tpl) { st.tool = 'select'; document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === 'select')); }
    syncTplButtons(); redraw();
    if (st.tpl) setHint('Nhấn lên khung vẽ để đặt "' + st.tpl + '". Nhấn mẫu lần nữa hoặc Esc để hủy.');
  }
  function syncTplButtons() {
    document.querySelectorAll('.tpl').forEach(b => b.classList.toggle('active', b.dataset.frag === st.tpl));
  }
  function selectAll() {
    if (!M.S.atoms.length) return;
    const ids = M.S.atoms.map(a => a.id);
    st.sel = ids.length === 1 ? { type: 'atom', id: ids[0] } : { type: 'multi', ids };
    redraw();
  }
  function deleteSel() {
    const s = st.sel; if (!s) return;
    M.transact(() => {
      if (s.type === 'atom') M.removeAtom(s.id);
      else if (s.type === 'bond') M.removeBond(s.id);
      else if (s.ids) s.ids.forEach(id => M.removeAtom(id));
    }, 'delete');
    st.sel = null; redraw();
  }
  function rotateSelection(angle) {
    if (!st.sel) return false;
    const selected = st.sel.type === 'atom' ? [st.sel.id]
      : st.sel.type === 'bond' ? [M.bond(st.sel.id)].filter(Boolean).flatMap(b => [b.a, b.b])
        : st.sel.ids || [];
    const ids = new Set();
    for (const id of selected) if (M.atom(id)) for (const atomId of M.component(id)) ids.add(atomId);
    const atoms = Array.from(ids).map(id => M.atom(id)).filter(Boolean);
    if (atoms.length < 2) return false;
    M.transact(() => rotateAtomGroup(atoms, angle), 'rotate');
    redraw();
    return true;
  }
  function rotateAtomGroup(atoms, angle) {
    if (atoms.length < 2) return;
    const center = {
      x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length,
      y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length
    };
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const rotate = p => {
      const x = p.x - center.x, y = p.y - center.y;
      return { x: center.x + cos * x - sin * y, y: center.y + sin * x + cos * y };
    };
    const rings = M.S.rings.filter(ring =>
      atoms.filter(atom => Math.abs(Math.hypot(atom.x - ring.cx, atom.y - ring.cy) - ring.r) < 10).length >= 3
    );
    for (const atom of atoms) Object.assign(atom, rotate(atom));
    for (const ring of rings) {
      const centerPoint = rotate({ x: ring.cx, y: ring.cy });
      ring.cx = centerPoint.x;
      ring.cy = centerPoint.y;
    }
  }
  function rotateAllComponents(angle) {
    const remaining = new Set(M.S.atoms.map(atom => atom.id));
    const groups = [];
    while (remaining.size) {
      const root = remaining.values().next().value;
      const ids = Array.from(M.component(root)).filter(id => remaining.has(id));
      ids.forEach(id => remaining.delete(id));
      const atoms = ids.map(id => M.atom(id)).filter(Boolean);
      if (atoms.length > 1) groups.push(atoms);
    }
    if (!groups.length) return;
    M.transact(() => groups.forEach(atoms => rotateAtomGroup(atoms, angle)), 'grid-orientation');
    redraw();
  }
  function toggleGrid() {
    st.grid = !st.grid;
    updateGrid();
  }
  function toggleGridType() {
    st.gridType = st.gridType === 'square' ? 'triangle' : 'square';
    updateGrid();
  }
  function toggleSnap() { st.snap = !st.snap; updateGridStatus(); }
  let hintTimer = null;
  function setHint(msg) {
    const h = document.getElementById('hint'); if (!h) return;
    h.textContent = msg; h.classList.remove('hide');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.add('hide'), 5000);
  }
  // ---------- Khởi tạo ----------
  function init() {
    stage = document.getElementById('stage');
    viewport = document.getElementById('viewport');
    gridRect = document.getElementById('gridRect');
    overlay = document.getElementById('overlay');
    updateGrid();
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDblClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    M.onChange(() => redraw());
    const r = stage.getBoundingClientRect();
    st.view.x = r.width / 2; st.view.y = r.height / 2;
    applyView(); redraw();
    setTimeout(() => setHint('Chào mừng! Nhấn mẫu ⬡ Benzen bên trái rồi nhấn vào khung vẽ.'), 400);
    setTimeout(() => { const h = document.getElementById('hint'); if (h) h.classList.add('hide'); }, 7000);
  }
  return {
    st, init, redraw, applyView, setTool, setBond, setElement, setTemplate,
    selectAll, deleteSel, rotateSelection, toggleGrid, toggleGridType, toggleGridOrientation, toggleSnap, updateGrid, zoomBtn, fitView, setHint, placeTemplate
  };
})();