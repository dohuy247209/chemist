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
  const bondColor = () => (window.ChemTheme ? window.ChemTheme.bondColor() : pal().ink);
  const atomDefaultColor = () => (window.ChemTheme ? window.ChemTheme.atomColor() : pal().ink);
  const textDefaultColor = () => (window.ChemTheme ? window.ChemTheme.textColor() : pal().ink);
  // Tách chữ, số và dấu để giữ nguyên nhãn tự do; số được vẽ dạng chỉ số dưới.
  function labelParts(elName) {
    const parts = []; const re = /([A-Za-zÀ-ỹ]+|\d+|[^A-Za-zÀ-ỹ\d]+)/g; let m;
    while ((m = re.exec(elName))) parts.push({ t: m[1], sub: /^\d+$/.test(m[1]) });
    return parts.length ? parts : [{ t: elName, sub: false }];
  }
  // Chỉ số dưới/ở trên: dùng dy (user-unit, TÍCH LŨY giữa các tspan) thay cho
  // baseline-shift — thuộc tính đó không nhất quán giữa các trình duyệt và khi
  // raster SVG xuất PNG qua <img> nên trang hiển thị có thể khác ảnh xuất ra.
  // dy tuyệt đối luôn cho cùng kết quả ở mọi nơi. Vì dy của tspan là cộng dồn,
  // mỗi tspan phải bù trừ phần tspan trước đã dịch: muốn đặt tại bậc `want`
  // thì dy = want − bậc đã dịch của tspan đứng trước.
  function scriptOffset(script, fontSize) {
    return (script === 'sub' ? 1 : -1) * Math.round(fontSize * 0.3);
  }
  function drawLabel(g, a, font) {
    const M = window.ChemModel;
    const shiny = document.getElementById('stage').classList.contains('shiny');
    const t = el('text', { x: a.x, y: a.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'class': 'atom-label', 'font-family': 'Arial, sans-serif', 'font-size': font, fill: a.color || M.elColor(a.el), stroke: shiny ? 'none' : pal().halo, 'stroke-width': shiny ? 0 : 4, 'paint-order': 'stroke', 'data-aid': a.id }, g);
    const parts = a.latex ? textTokens(a.el, true) : labelParts(a.el).map(part => ({ text: part.t, script: part.sub ? 'sub' : null }));
    let carry = 0;
    for (const p of parts) {
      const ts = el('tspan', {}, t);
      ts.textContent = p.text;
      let want = 0;
      if (p.script) {
        ts.setAttribute('font-size', Math.round(font * 0.7));
        want = scriptOffset(p.script, font);
      }
      const dy = want - carry;
      if (dy) ts.setAttribute('dy', dy);
      carry = want;
    }
    return t;
  }
  const LATEX_COMMANDS = {
    rightarrow: '→', to: '→', longrightarrow: '⟶', leftarrow: '←', longleftarrow: '⟵',
    leftrightarrow: '↔', rightleftharpoons: '⇌', gets: '←', pm: '±', times: '×',
    cdot: '·', Delta: 'Δ', alpha: 'α', beta: 'β', gamma: 'γ'
  };

  // Đọc nhóm {…} cân bằng bắt đầu tại source[i] === '{'.
  function readGroup(source, i) {
    let depth = 0;
    for (let k = i; k < source.length; k++) {
      if (source[k] === '\\') { k++; continue; }
      if (source[k] === '{') depth++;
      else if (source[k] === '}' && --depth === 0) return { value: source.slice(i + 1, k), next: k + 1 };
    }
    return { value: source.slice(i + 1), next: source.length };      // thiếu '}' → lấy đến hết chuỗi
  }

  function latexTokens(source) {
    const out = [];
    const push = (text, script) => { if (text) out.push(script ? { text, script } : { text }); };
    const pushAll = (tokens, script) => tokens.forEach(t => push(t.text, t.script || script));
    let i = 0;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '_' || ch === '^') {
        const kind = ch === '_' ? 'sub' : 'sup';
        i++;
        let raw = '';
        if (source[i] === '{') { const g = readGroup(source, i); raw = g.value; i = g.next; }
        else if (source[i] === '\\') { const m = source.slice(i).match(/^\\([A-Za-z]+|.)/); raw = m ? m[0] : ''; i += raw.length; }
        else if (i < source.length) raw = source[i++];
        pushAll(latexTokens(raw), kind);                              // \alpha, \mathrm{…} trong {…} đều đúng
      } else if (ch === '\\') {
        const m = source.slice(i + 1).match(/^[A-Za-z]+/);
        if (m) {
          const name = m[0];
          i += 1 + name.length;
          if (LATEX_COMMANDS[name]) push(LATEX_COMMANDS[name]);
          else {
            while (source[i] === ' ') i++;
            if (source[i] === '{') { const g = readGroup(source, i); i = g.next; pushAll(latexTokens(g.value)); }
            // lệnh lạ không có nhóm: bỏ qua, KHÔNG in tên lệnh
          }
          while (source[i] === ' ') i++;                              // TeX bỏ khoảng trắng sau tên lệnh
        } else {
          const sym = source[i + 1];
          i += 2;
          if (sym === undefined) break;
          if (sym === ',' || sym === ';' || sym === ':' || sym === ' ') push(' ');
          else if (sym !== '!') push(sym);                            // \% \$ \_ \{ \} \& \# → ký tự thật
        }
      } else if (ch === '{' || ch === '}') i++;
      else {
        const start = i++;
        while (i < source.length && !'_^\\{}'.includes(source[i])) i++;
        push(source.slice(start, i));
      }
    }
    return out;
  }
  function textTokens(value, latex) {
    if (!latex) return [{ text: value }];
    if (!value.includes('$')) return latexTokens(value);
    return value.split(/(\$[^$]*\$)/g).filter(Boolean).flatMap(part =>
      part[0] === '$' && part[part.length - 1] === '$'
        ? latexTokens(part.slice(1, -1))
        : [{ text: part }]);
  }
  function drawTextContent(element, value, latex, fontSize) {
    let carry = 0;
    for (const segment of textTokens(value, latex)) {
      const span = el('tspan', {}, element);
      span.textContent = segment.text;
      let want = 0;
      if (segment.script) {
        span.setAttribute('font-size', Math.round(fontSize * 0.7));
        want = scriptOffset(segment.script, fontSize);
      }
      const dy = want - carry;
      if (dy) span.setAttribute('dy', dy);
      carry = want;
    }
  }
  function drawArrow(world, annotation, ink) {
    const half = (annotation.width || 96) / 2, x1 = annotation.x - half, x2 = annotation.x + half;
    const head = 8, stroke = Math.max(1.5, (parseFloat(document.getElementById('optStroke').value) || 2.5) * 0.8);
    const line = (start, end, y) => {
      el('line', { x1: start, y1: y, x2: end - Math.sign(end - start) * head, y2: y, stroke: ink, 'stroke-width': stroke, 'stroke-linecap': 'round' }, world);
      const direction = Math.sign(end - start);
      const points = `${end},${y} ${end - direction * head},${y - head * 0.65} ${end - direction * head},${y + head * 0.65}`;
      el('polygon', { points, fill: ink }, world);
    };
    if (annotation.arrowType === 'equilibrium') {
      line(x1, x2, annotation.y - 3);
      line(x2, x1, annotation.y + 3);
    } else line(x1, x2, annotation.y);
    el('rect', {
      x: x1, y: annotation.y - 12, width: x2 - x1, height: 24,
      fill: 'transparent', class: 'hit', 'pointer-events': 'all', 'data-tid': annotation.id
    }, world);
    for (const [key, y, baseline] of [['above', annotation.y - 14, 'auto'], ['below', annotation.y + 19, 'auto']]) {
      if (!annotation[key]) continue;
      const label = el('text', {
        x: annotation.x, y, 'text-anchor': 'middle', 'dominant-baseline': baseline,
        'font-family': 'Arial, sans-serif', 'font-size': annotation.fontSize || 20,
        fill: ink, class: 'canvas-text', 'data-tid': annotation.id
      }, world);
      drawTextContent(label, annotation[key], annotation.latex, annotation.fontSize || 20);
    }
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
    // Ước bề rộng THẬT của nhãn: chỉ tính ký tự HIỂN THỊ. Nhãn LaTeX "H_{2}O"
    // dài 7 ký tự thô nhưng chỉ hiện "H2O" (3 ký tự, số co 0.7 cỡ chữ) — đo theo
    // s.length thô sẽ tạo khoảng hở quá lớn giữa đầu liên kết và nhãn.
    const units = a => {
      const parts = a.latex
        ? textTokens(a.el, true)
        : labelParts(a.el).map(part => ({ text: part.t, script: part.sub ? 'sub' : null }));
      let sum = 0;
      for (const part of parts) sum += part.text.length * (part.script ? 0.7 : 1);
      return sum;
    };
    const w = a => font * Math.min(4, Math.max(0.62, units(a) * 0.32));
    const result = [need(A) ? w(A) : 1.5, need(B) ? w(B) : 1.5];
    const maxTrim = length * 0.75;
    const total = result[0] + result[1];
    if (total > maxTrim) {
      const scale = maxTrim / total;
      result[0] *= scale;
      result[1] *= scale;
    }
    return result;
  }
  // Liên kết (A,B) có phải là cạnh của một vòng thơm không.
  // Ưu tiên dùng ring.atoms (chính xác) khi template cung cấp; nếu không, kiểm tra hình học.
  function bondInAromaticRing(a, b) {
    for (const g of window.ChemModel.S.rings) {
      if (!g.aromatic) continue;
      if (Array.isArray(g.atoms) && g.atoms.length && g.atoms.includes(a.id) && g.atoms.includes(b.id)) return true;
      const ra = Math.hypot(a.x - g.cx, a.y - g.cy);
      const rb = Math.hypot(b.x - g.cx, b.y - g.cy);
      if (Math.abs(ra - g.r) < 6 && Math.abs(rb - g.r) < 6) return true;
    }
    return false;
  }
  function drawBond(g, b, A, B, o, paint, fullLength) {
    const M = window.ChemModel;
    // Cạnh "trước" của Haworth (v.v.): vẽ nét đơn nhưng đậm hơn bình thường.
    if (b.bold && b.style !== 'wedge' && b.style !== 'hash' && b.order !== 2 && b.order !== 3) {
      const w = Math.max(3.2, o.stroke * 1.35);
      const grp = el('g', { 'data-bid': b.id }, g);
      el('line', { x1: r(A.x), y1: r(A.y), x2: r(B.x), y2: r(B.y), 'class': 'bond', stroke: b.color || paint || bondColor(), 'stroke-width': w, 'stroke-linecap': 'round' }, grp);
      el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, 'class': 'hit', 'stroke-width': 14, 'data-bid': b.id }, grp);
      return grp;
    }
    const w = o.stroke;
    const length = Math.hypot(B.x - A.x, B.y - A.y);
    const [tA, tB] = fullLength ? [0, 0] : trims(A, B, o.font, length);
    const G = bondGeom(A, B, tA, tB);
    const availableLength = Math.hypot(G.x2 - G.x1, G.y2 - G.y1);
    const grp = el('g', { 'data-bid': b.id }, g);
    const main = { 'class': 'bond', stroke: b.color || paint || bondColor(), 'stroke-width': w, 'stroke-linecap': 'round' };
    const off = Math.max(3.2, w + 2.2);
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
      el('polygon', { points: p, fill: b.color || paint || bondColor(), stroke: 'none' }, grp).setAttribute('style', 'stroke:none');
    } else if (b.style === 'hash') {
      const N = 7;
      for (let i = 1; i <= N; i++) {
        const s = i / (N + 1);
        const cx = G.x1 + (G.x2 - G.x1) * s, cy = G.y1 + (G.y2 - G.y1) * s;
        const hw = 1 + s * 5.5;
        el('line', Object.assign({ x1: cx + G.px * hw, y1: cy + G.py * hw, x2: cx - G.px * hw, y2: cy - G.py * hw }, main, { 'stroke-width': Math.max(1.6, w - 0.6) }), grp);
      }
    } else if ((b.order === 2 && !(o.circle && bondInAromaticRing(A, B))) || (b.arom && b.dbl && o.kekule && !o.circle)) {
      const side = parallelSide(G, b);
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
  function parallelSide(G, b) {
    if (b.dblSide !== 1 && b.dblSide !== -1) b.dblSide = b.cx != null ? sideSign(G, b) : 1;
    return b.dblSide;
  }
  const r = v => Math.round(v * 10) / 10;
  function renderAll(sel) {
    const M = window.ChemModel;
    const world = document.getElementById('world');
    while (world.firstChild) world.removeChild(world.firstChild);
    const o = currentOpts();
    const stageEl = document.getElementById('stage');
    const shiny = stageEl.classList.contains('shiny');
    const tint = stageEl.classList.contains('tint');
    const defs = (shiny || tint) ? el('defs', {}, world) : null;
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
    const defBondColor = bondColor();
    function gradientColor(color) {
      const from = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
      const to = defBondColor.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
      return '#' + from.map((channel, i) => Math.round(to[i] + (channel - to[i]) * shinyStrength)
        .toString(16).padStart(2, '0')).join('');
    }
    function addGradient(tag, attrs, colors, raw) {
      const id = `shinyGradient${gradientId++}`;
      const gradient = el(tag, Object.assign({ id, gradientUnits: 'userSpaceOnUse' }, attrs), defs);
      for (const [offset, color] of colors) el('stop', {
        offset,
        'stop-color': raw ? color : gradientColor(color)
      }, gradient);
      return `url(#${id})`;
    }
    function bondPaint(a, b) {
      const colorA = (window.ChemTheme && window.ChemTheme.bondTintForAtom) ? window.ChemTheme.bondTintForAtom(a) : defBondColor;
      const colorB = (window.ChemTheme && window.ChemTheme.bondTintForAtom) ? window.ChemTheme.bondTintForAtom(b) : defBondColor;
      if (colorA === defBondColor && colorB === defBondColor) return null;
      if (colorA === colorB) return colorA;
      const bondLength = parseFloat(document.getElementById('optBondLen').value) || 40;
      const relativeLength = M.dist(a, b) / bondLength;
      if (relativeLength > 0.9 && relativeLength < 1.1) {
        if (colorA === defBondColor) {
          if (!radialCache.has(b.id)) radialCache.set(b.id, addGradient('radialGradient', {
            cx: b.x, cy: b.y, r: bondLength
          }, [['20%', colorB], ['80%', defBondColor]]));
          return radialCache.get(b.id);
        }
        if (colorB === defBondColor) {
          if (!radialCache.has(a.id)) radialCache.set(a.id, addGradient('radialGradient', {
            cx: a.x, cy: a.y, r: bondLength
          }, [['20%', colorA], ['80%', defBondColor]]));
          return radialCache.get(a.id);
        }
      }
      return addGradient('linearGradient', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y
      }, [['20%', colorA], ['80%', colorB]]);
    }
    // Chế độ "tint": nửa liên kết gần nhóm chức/nguyên tử có màu lấy màu đó,
    // nửa còn lại giữ màu mặc định (hoặc màu đầu kia nếu đầu kia cũng có màu).
    // Cắt cứng tại giữa liên kết, dùng màu gốc (không pha trộng như shiny).
    function tintPaint(a, b) {
      const colorA = (window.ChemTheme && window.ChemTheme.bondTintForAtom) ? window.ChemTheme.bondTintForAtom(a) : defBondColor;
      const colorB = (window.ChemTheme && window.ChemTheme.bondTintForAtom) ? window.ChemTheme.bondTintForAtom(b) : defBondColor;
      if (colorA === defBondColor && colorB === defBondColor) return null;
      if (colorA === colorB) return colorA;
      return addGradient('linearGradient', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y
      }, [['0%', colorA], ['50%', colorA], ['50%', colorB], ['100%', colorB]], true);
    }
    // 1) Vòng thơm: reset trạng thái kép do vòng sinh ra (riêng liên kết đôi người vẽ giữ nguyên order).
    for (const b of M.S.bonds) if (b.dbl) { b.dbl = false; b.cx = undefined; b.cy = undefined; }
    for (const g of M.S.rings) {
      if (!g.aromatic) continue;
      if (o.circle) el('circle', { cx: g.cx, cy: g.cy, r: g.r * 0.52, fill: 'none', stroke: bondColor(), 'stroke-width': o.stroke * 0.8, 'class': 'arom-circle', 'data-ring-id': g.id }, world);
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
      if (!A || !B) continue;
      let paint = null, fullLength = false;
      if (!b.color) {
        if (shiny) { paint = bondPaint(A, B); fullLength = true; }
        else if (tint) paint = tintPaint(A, B);
      }
      drawBond(bondLayer, b, A, B, o, paint, fullLength);
    }
    const invalidValence = o.valenceCheck ? new Set(M.valenceViolations()) : new Set();
    // 3) Vùng chọn phải có màu nền rõ ràng vì trang tích hợp không nạp stylesheet SVG của engine.
    if (sel) {
      const selCol = (window.ChemEditor && window.ChemEditor.selectColor) ? window.ChemEditor.selectColor() : pal().blue;
      if (sel.type === 'atom') {
        const a = M.atom(sel.id);
        if (a) el('circle', { cx: a.x, cy: a.y, r: 15, class: 'sel-ring', fill: selCol, 'fill-opacity': 0.12, stroke: selCol, 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, world);
      }
      if (sel.type === 'bond') {
        const b = M.bond(sel.id);
        if (b) {
          const A = M.atom(b.a), B = M.atom(b.b);
          if (A && B) el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'sel-ring', fill: 'none', stroke: selCol, 'stroke-opacity': 0.35, 'stroke-width': 9, 'pointer-events': 'none' }, world);
        }
      }
      if (sel.type === 'box') el('rect', { x: sel.x, y: sel.y, width: sel.w, height: sel.h, class: 'sel-ring', fill: selCol, 'fill-opacity': 0.1, stroke: selCol, 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, world);
      if (sel.type === 'text') {
        const t = M.textItem(sel.id);
        if (t) {
          const width = t.type === 'arrow'
            ? Math.max(t.width || 96, Math.max((t.above || '').length, (t.below || '').length) * (t.fontSize || 20) * 0.6)
            : Math.max(t.fontSize || 20, t.text.length * (t.fontSize || 20) * 0.6);
          const height = t.type === 'arrow' ? (t.fontSize || 20) * 2 + 24 : (t.fontSize || 20);
          el('rect', { x: t.x - width / 2 - 4, y: t.y - height / 2 - 3, width: width + 8, height: height + 6, class: 'sel-ring', fill: selCol, 'fill-opacity': 0.08, stroke: selCol, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, world);
        }
      }
      if (sel.type === 'multi') {
        for (const id of sel.ids || []) {
          const a = M.atom(id);
          if (a) el('circle', { cx: a.x, cy: a.y, r: 15, class: 'sel-ring', fill: selCol, 'fill-opacity': 0.12, stroke: selCol, 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, world);
        }
        for (const id of sel.bondIds || []) {
          const b = M.bond(id);
          if (!b) continue;
          const A = M.atom(b.a), B = M.atom(b.b);
          if (A && B) el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'sel-ring', fill: 'none', stroke: selCol, 'stroke-opacity': 0.35, 'stroke-width': 9, 'pointer-events': 'none' }, world);
        }
        for (const id of sel.textIds || []) {
          const t = M.textItem(id);
          if (!t) continue;
          const width = t.type === 'arrow'
            ? Math.max(t.width || 96, Math.max((t.above || '').length, (t.below || '').length) * (t.fontSize || 20) * 0.6)
            : Math.max(t.fontSize || 20, t.text.length * (t.fontSize || 20) * 0.6);
          const height = t.type === 'arrow' ? (t.fontSize || 20) * 2 + 24 : (t.fontSize || 20);
          el('rect', { x: t.x - width / 2 - 4, y: t.y - height / 2 - 3, width: width + 8, height: height + 6, class: 'sel-ring', fill: selCol, 'fill-opacity': 0.08, stroke: selCol, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, world);
        }
      }
    }
    // 4) Nguyên tử: C trần vẽ chấm nhỏ; có nhãn vẽ chữ.
    for (const a of M.S.atoms) {
      if (invalidValence.has(a.id)) el('circle', {
        cx: a.x, cy: a.y, r: Math.max(13, o.font * 0.76),
        fill: 'none', stroke: '#eca0a0', 'stroke-width': 1.8,
        'stroke-dasharray': '3 2', 'pointer-events': 'none',
        class: 'valence-warning',
        'aria-label': `Invalid valence: ${a.el}`
      }, world);
      if (M.isBareCarbon(a)) el('circle', { cx: a.x, cy: a.y, r: Math.max(1.6, o.stroke * 0.75), 'class': 'atom-dot', fill: a.color || bondColor(), 'data-aid': a.id }, world);
      else drawLabel(world, a, o.font);
      el('circle', { cx: a.x, cy: a.y, r: 12, fill: 'rgba(0,0,0,0)', 'data-aid': a.id, style: 'pointer-events:all' }, world);
    }
    for (const t of M.S.texts) {
      if (t.type === 'arrow') {
        drawArrow(el('g', { 'data-tid': t.id }, world), t, textDefaultColor());
        continue;
      }
      const label = el('text', { x: t.x, y: t.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Arial, sans-serif', 'font-size': t.fontSize, fill: textDefaultColor(), class: 'canvas-text', 'data-tid': t.id }, world);
      drawTextContent(label, t.text, t.latex, t.fontSize || 20);
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
      circle: document.getElementById('optCircle').value === 'enabled',
      kekule: document.getElementById('optKekule').value === 'enabled',
      valenceCheck: document.getElementById('settingsValenceCheck').value === 'enabled'
    };
  }
  return { renderAll, drawLabel, currentOpts };
})();
