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
  const pal = () => (window.ChemTheme ? window.ChemTheme.palette() : { ink: '#202124', halo: '#ffffff', canvas: '#ffffff' });
  // Tách chữ, số và dấu để giữ nguyên nhãn tự do; số được vẽ dạng chỉ số dưới.
  function labelParts(elName) {
    const parts = []; const re = /([A-Za-zÀ-ỹ]+|\d+|[^A-Za-zÀ-ỹ\d]+)/g; let m;
    while ((m = re.exec(elName))) parts.push({ t: m[1], sub: /^\d+$/.test(m[1]) });
    return parts.length ? parts : [{ t: elName, sub: false }];
  }
  function drawLabel(g, a, font) {
    const M = window.ChemModel;
    const shiny = document.getElementById('stage').classList.contains('shiny');
    const t = el('text', { x: a.x, y: a.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'atom-label', 'font-family': 'Arial, sans-serif', 'font-size': font, fill: a.color || M.elColor(a.el), stroke: shiny ? 'none' : pal().halo, 'stroke-width': shiny ? 0 : 4, 'paint-order': 'stroke', 'data-aid': a.id }, g);
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
  function drawBond(g, b, A, B, o, paint) {
    const M = window.ChemModel;
    const w = o.stroke;
    const length = Math.hypot(B.x - A.x, B.y - A.y);
    const [tA, tB] = paint ? [0, 0] : trims(A, B, o.font, length);
    const G = bondGeom(A, B, tA, tB);
    const availableLength = Math.hypot(G.x2 - G.x1, G.y2 - G.y1);
    const grp = el('g', { 'data-bid': b.id }, g);
    const main = { 'class': 'bond', stroke: paint || pal().ink, 'stroke-width': w, 'stroke-linecap': 'round' };
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
      el('polygon', { points: p, fill: paint || pal().ink, stroke: 'none' }, grp).setAttribute('style', 'stroke:none');
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
    const shiny = document.getElementById('stage').classList.contains('shiny');
    const defs = shiny ? el('defs', {}, world) : null;
    const radialCache = new Map();
    let bondMask = null;
    if (shiny) {
      const box = M.bbox(1000) || { x: -1000, y: -1000, w: 2000, h: 2000 };
      bondMask = el('mask', {
        id: 'shinyBondMask', maskUnits: 'userSpaceOnUse', x: box.x, y: box.y, width: box.w, height: box.h
      }, defs);
      el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: '#fff' }, bondMask);
      for (const a of M.S.atoms) {
        if (!M.isBareCarbon(a)) el('circle', {
          cx: a.x, cy: a.y, r: o.font * 0.75, fill: '#000'
        }, bondMask);
      }
    }
    const atomColor = atom => atom.color || M.elColor(atom.el);
    let gradientId = 0;
    const shinyStrength = (() => {
      const input = document.getElementById('optShinyIntensity');
      const p = parseFloat(input && input.value) || 100;
      return Math.min(1, Math.max(0.1, p / 100));
    })();
    function addGradient(tag, attrs, colors) {
      const id = `shinyGradient${gradientId++}`;
      const gradient = el(tag, Object.assign({ id, gradientUnits: 'userSpaceOnUse' }, attrs), defs);
      for (const [offset, color, opacity] of colors) {
        const stop = el('stop', {
          offset,
          'stop-color': color,
          'stop-opacity': String((opacity ?? 1) * shinyStrength)
        }, gradient);
        if (stop && offset === '20%') stop.setAttribute('stop-opacity', String((opacity ?? 1) * shinyStrength));
      }
      return `url(#${id})`;
    }
    function bondPaint(a, b) {
      const colorA = atomColor(a), colorB = atomColor(b);
      if (colorA === colorB) return colorA;
      const carbonColor = atomColor({ el: 'C' });
      const bondLength = parseFloat(document.getElementById('optBondLen').value) || 40;
      const relativeLength = M.dist(a, b) / bondLength;
      if (relativeLength > 0.9 && relativeLength < 1.1) {
        if (colorA === carbonColor) {
          if (!radialCache.has(b.id)) radialCache.set(b.id, addGradient('radialGradient', {
            cx: b.x, cy: b.y, r: bondLength
          }, [['20%', colorB, 0.2], ['80%', carbonColor, 0.8]]));
          return radialCache.get(b.id);
        }
        if (colorB === carbonColor) {
          if (!radialCache.has(a.id)) radialCache.set(a.id, addGradient('radialGradient', {
            cx: a.x, cy: a.y, r: bondLength
          }, [['20%', colorA, 0.2], ['80%', carbonColor, 0.8]]));
          return radialCache.get(a.id);
        }
      }
      return addGradient('linearGradient', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y
      }, [['20%', colorA, 0.2], ['80%', colorB, 0.8]]);
    }
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
    const bondLayer = shiny ? el('g', { mask: 'url(#shinyBondMask)' }, world) : world;
    for (const b of M.S.bonds) {
      const A = M.atom(b.a), B = M.atom(b.b);
      if (A && B) drawBond(bondLayer, b, A, B, o, shiny ? bondPaint(A, B) : null);
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
      if (sel.type === 'text') {
        const t = M.textItem(sel.id);
        if (t) {
          const width = Math.max(t.fontSize, t.text.length * t.fontSize * 0.6);
          el('rect', { x: t.x - width / 2 - 4, y: t.y - t.fontSize / 2 - 3, width: width + 8, height: t.fontSize + 6, class: 'sel-ring', fill: pal().blue, 'fill-opacity': 0.08, stroke: pal().blue, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, world);
        }
      }
    }
    // 4) Nguyên tử: C trần vẽ chấm nhỏ; có nhãn vẽ chữ.
    for (const a of M.S.atoms) {
      if (M.isBareCarbon(a)) el('circle', { cx: a.x, cy: a.y, r: Math.max(1.6, o.stroke * 0.75), 'class': 'atom-dot', fill: a.color || pal().ink, 'data-aid': a.id }, world);
      else drawLabel(world, a, o.font);
      el('circle', { cx: a.x, cy: a.y, r: 12, fill: 'rgba(0,0,0,0)', 'data-aid': a.id, style: 'pointer-events:all' }, world);
    }
    for (const t of M.S.texts) {
      const label = el('text', { x: t.x, y: t.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Arial, sans-serif', 'font-size': t.fontSize, fill: pal().ink, class: 'canvas-text', 'data-tid': t.id }, world);
      label.textContent = t.text;
    }
    ChemExport.refreshCodeView();
    const st = document.getElementById('stCount');
    if (st) st.textContent = window.ChemI18n && window.ChemI18n.language === 'en'
      ? `${M.S.atoms.length} atoms · ${M.S.bonds.length} bonds`
      : `${M.S.atoms.length} nguyên tử · ${M.S.bonds.length} liên kết`;
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
