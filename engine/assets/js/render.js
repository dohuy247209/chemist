'use strict';
/* render.js — Vẽ phân tử lên SVG: vòng thơm, liên kết, nhãn nguyên tử, vùng chọn. */
window.ChemRender = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // Bảng màu theo giao diện sáng/tối (đồng bộ với ChemTheme.palette và biến CSS --draw/--halo).
  const pal = () => (window.ChemTheme ? window.ChemTheme.palette() : { ink: '#202124', halo: '#ffffff' });
  // Tách chữ, số và dấu để giữ nguyên nhãn tự do; số được vẽ dạng chỉ số dưới.
  function labelParts(elName) {
    const parts = []; const re = /([A-Za-zÀ-ỹ]+|\d+|[^A-Za-zÀ-ỹ\d]+)/g; let m;
    while ((m = re.exec(elName))) parts.push({ t: m[1], sub: /^\d+$/.test(m[1]) });
    return parts.length ? parts : [{ t: elName, sub: false }];
  }
  function drawLabel(g, a, font) {
    const M = window.ChemModel;
    const t = el('text', { x: a.x, y: a.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'atom-label', 'font-family': 'Arial, sans-serif', 'font-size': font, fill: a.color || M.elColor(a.el), stroke: pal().halo, 'stroke-width': 4, 'paint-order': 'stroke', 'data-aid': a.id }, g);
    for (const p of labelParts(a.el)) {
      const ts = el('tspan', {}, t);
      ts.textContent = p.t;
      if (p.sub) { ts.setAttribute('font-size', Math.round(font * 0.72)); ts.setAttribute('dy', font * 0.22); }
    }
    return t;
  }
  function bondGeom(A, B, trimA, trimB) {
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    return { dx, dy, L, ux, uy, px, py, x1: A.x + ux * trimA, y1: A.y + uy * trimA, x2: B.x - ux * trimB, y2: B.y - uy * trimB };
  }
  // Độ co đầu liên kết khi gặp nhãn chữ (tránh nét đè lên chữ).
  function trims(A, B, font, length) {
    const M = window.ChemModel;
    const need = a => !M.isBareCarbon(a);
    const w = s => s.length > 2 ? font * Math.min(4, s.length * 0.32) : font * 0.62;
    const result = [need(A) ? w(A.el) : 1.5, need(B) ? w(B.el) : 1.5];
    const maxTrim = length * 0.75;
    const total = result[0] + result[1];
    if (total > maxTrim) {
      const scale = maxTrim / total;
      result[0] *= scale;
      result[1] *= scale;
    }
    return result;
  }
  function drawBond(g, b, A, B, o) {
    const M = window.ChemModel;
    const w = o.stroke;
    const length = Math.hypot(B.x - A.x, B.y - A.y);
    const [tA, tB] = trims(A, B, o.font, length);
    const G = bondGeom(A, B, tA, tB);
    const availableLength = Math.hypot(G.x2 - G.x1, G.y2 - G.y1);
    const grp = el('g', { 'data-bid': b.id }, g);
    const main = { 'class': 'bond', stroke: pal().ink, 'stroke-width': w, 'stroke-linecap': 'round' };
    const off = Math.max(3.2, w + 2.2);
    const useInner = (b.cx != null && (b.order === 2 || b.dbl));
    const parallelLine = (shift, side, length, width) => {
      const mx = (G.x1 + G.x2) / 2, my = (G.y1 + G.y2) / 2;
      const half = Math.min(length, availableLength) / 2;
      el('line', {
        x1: r(mx - G.ux * half + G.px * shift * side),
        y1: r(my - G.uy * half + G.py * shift * side),
        x2: r(mx + G.ux * half + G.px * shift * side),
        y2: r(my + G.uy * half + G.py * shift * side),
        ...main, 'stroke-width': width
      }, grp);
    };
    if (b.style === 'wedge') {
      const w0 = 1.6, w1 = 6.5;
      const p = `${G.x1 + G.px * w0},${G.y1 + G.py * w0} ${G.x2 + G.px * w1},${G.y2 + G.py * w1} ${G.x2 - G.px * w1},${G.y2 - G.py * w1} ${G.x1 - G.px * w0},${G.y1 - G.py * w0}`;
      // Không gắn class="bond": CSS #world .bond{fill:none} sẽ làm mất hình wedge.
      el('polygon', { points: p, fill: pal().ink, stroke: 'none' }, grp).setAttribute('style', 'stroke:none');
    } else if (b.style === 'hash') {
      const N = 7;
      for (let i = 1; i <= N; i++) {
        const s = i / (N + 1);
        const cx = G.x1 + (G.x2 - G.x1) * s, cy = G.y1 + (G.y2 - G.y1) * s;
        const hw = 1 + s * 5.5;
        el('line', Object.assign({ x1: cx + G.px * hw, y1: cy + G.py * hw, x2: cx - G.px * hw, y2: cy - G.py * hw }, main, { 'stroke-width': Math.max(1.6, w - 0.6) }), grp);
      }
    } else if (b.order === 2 || (b.arom && b.dbl && o.kekule && !o.circle)) {
      const side = useInner ? sideSign(G, b) : 1;
      el('line', Object.assign({ x1: r(G.x1), y1: r(G.y1), x2: r(G.x2), y2: r(G.y2) }, main), grp);
      parallelLine(off, side, availableLength * 0.76, Math.max(1.25, w * 0.72));
    } else if (b.order === 3) {
      el('line', Object.assign({ x1: r(G.x1), y1: r(G.y1), x2: r(G.x2), y2: r(G.y2) }, main), grp);
      parallelLine(off / 1.5, -1, availableLength * 0.76, Math.max(1.25, w * 0.72));
      parallelLine(off / 1.5, 1, availableLength * 0.76, Math.max(1.25, w * 0.72));
    } else {
      el('line', Object.assign({ x1: r(G.x1), y1: r(G.y1), x2: r(G.x2), y2: r(G.y2) }, main), grp);
    }
    // Nét vô hình rộng để dễ nhấn chọn.
    el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, 'class': 'hit', 'stroke-width': 14, 'data-bid': b.id }, grp);
    return grp;
  }
  function sideSign(G, b) {
    const mx = (G.x1 + G.x2) / 2, my = (G.y1 + G.y2) / 2;
    const d = (b.cx - mx) * G.px + (b.cy - my) * G.py;
    return d >= 0 ? 1 : -1;
  }
  const r = v => Math.round(v * 10) / 10;
  function renderAll(sel) {
    const M = window.ChemModel;
    const world = document.getElementById('world');
    while (world.firstChild) world.removeChild(world.firstChild);
    const o = currentOpts();
    // 1) Vòng thơm: reset trạng thái kép do vòng sinh ra (riêng liên kết đôi người vẽ giữ nguyên order).
    for (const b of M.S.bonds) if (b.dbl) { b.dbl = false; b.cx = undefined; b.cy = undefined; }
    for (const g of M.S.rings) {
      if (!g.aromatic) continue;
      if (o.circle) el('circle', { cx: g.cx, cy: g.cy, r: g.r * 0.52, fill: 'none', stroke: pal().ink, 'stroke-width': o.stroke * 0.8, 'class': 'arom-circle' }, world);
      else if (o.kekule && g.dblIds) {
        for (const id of g.dblIds) {
          const b = M.bond(id);
          if (b && b.order === 1 && b.style === 'solid') { b.dbl = true; b.arom = true; b.cx = g.cx; b.cy = g.cy; }
        }
      }
    }
    // 2) Liên kết.
    for (const b of M.S.bonds) {
      const A = M.atom(b.a), B = M.atom(b.b);
      if (A && B) drawBond(world, b, A, B, o);
    }
    // 3) Vùng chọn phải có màu nền rõ ràng vì trang tích hợp không nạp stylesheet SVG của engine.
    if (sel) {
      if (sel.type === 'atom') {
        const a = M.atom(sel.id);
        if (a) el('circle', { cx: a.x, cy: a.y, r: 15, class: 'sel-ring', fill: pal().blue, 'fill-opacity': 0.12, stroke: pal().blue, 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, world);
      }
      if (sel.type === 'bond') {
        const b = M.bond(sel.id);
        if (b) {
          const A = M.atom(b.a), B = M.atom(b.b);
          if (A && B) el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'sel-ring', fill: 'none', stroke: pal().blue, 'stroke-opacity': 0.35, 'stroke-width': 9, 'pointer-events': 'none' }, world);
        }
      }
      if (sel.type === 'box') el('rect', { x: sel.x, y: sel.y, width: sel.w, height: sel.h, class: 'sel-ring', fill: pal().blue, 'fill-opacity': 0.1, stroke: pal().blue, 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, world);
    }
    // 4) Nguyên tử: C trần vẽ chấm nhỏ; có nhãn vẽ chữ.
    for (const a of M.S.atoms) {
      if (M.isBareCarbon(a)) el('circle', { cx: a.x, cy: a.y, r: Math.max(1.6, o.stroke * 0.75), 'class': 'atom-dot', fill: a.color || pal().ink, 'data-aid': a.id }, world);
      else drawLabel(world, a, o.font);
      el('circle', { cx: a.x, cy: a.y, r: 12, fill: 'rgba(0,0,0,0)', 'data-aid': a.id, style: 'pointer-events:all' }, world);
    }
    ChemExport.refreshCodeView();
    const st = document.getElementById('stCount');
    if (st) st.textContent = `${M.S.atoms.length} nguyên tử · ${M.S.bonds.length} liên kết`;
  }
  function currentOpts() {
    const v = id => document.getElementById(id).value;
    return {
      stroke: parseFloat(v('optStroke')) || 2.5,
      font: parseFloat(v('optFont')) || 20,
      circle: document.getElementById('optCircle').checked,
      kekule: document.getElementById('optKekule').checked
    };
  }
  return { renderAll, drawLabel, currentOpts };
})();
