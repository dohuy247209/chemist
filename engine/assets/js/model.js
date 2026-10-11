'use strict';
/* model.js — Mô hình dữ liệu phân tử: nguyên tử, liên kết, vòng thơm + undo/redo. */
window.ChemModel = (() => {
  const S = { atoms: [], bonds: [], rings: [], texts: [], seq: 1 };
  const hist = { undo: [], redo: [] };
  const listeners = [];
  const onChange = fn => listeners.push(fn);
  const emit = what => listeners.forEach(f => { try { f(what); } catch (e) { console.error(e); } });
  const snap = () => JSON.stringify({ a: S.atoms, b: S.bonds, r: S.rings, t: S.texts, s: S.seq });
  function restore(j) { const o = JSON.parse(j); S.atoms = o.a; S.bonds = o.b; S.rings = o.r || []; S.texts = o.t || []; S.seq = o.s; }
  // Mọi thay đổi phải bọc trong transact để hỗ trợ hoàn tác.
  function transact(fn, label) {
    hist.undo.push(snap()); if (hist.undo.length > 150) hist.undo.shift();
    hist.redo.length = 0; fn(); emit(label || 'change');
  }
  function undo() { if (!hist.undo.length) return false; hist.redo.push(snap()); restore(hist.undo.pop()); emit('undo'); return true; }
  function redo() { if (!hist.redo.length) return false; hist.undo.push(snap()); restore(hist.redo.pop()); emit('redo'); return true; }
  // Giao dịch cho thao tác kéo: bắt đầu chụp trạng thái, kết thúc bỏ nếu không đổi gì.
  let txDepth = 0, txUsed = false;
  function beginTx() {
    if (txDepth++ === 0) { hist.undo.push(snap()); txUsed = false; if (hist.undo.length > 150) hist.undo.shift(); }
  }
  function markTx() { txUsed = true; hist.redo.length = 0; }
  function endTx() {
    if (txDepth > 0 && --txDepth === 0 && !txUsed) hist.undo.pop();
    return txUsed;
  }

  const canUndo = () => hist.undo.length > 0, canRedo = () => hist.redo.length > 0;
  const clearHist = () => { hist.undo.length = 0; hist.redo.length = 0; };

  const atom = id => S.atoms.find(a => a.id === id);
  const bond = id => S.bonds.find(b => b.id === id);
  function addAtom(x, y, el) { const a = { id: S.seq++, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, el: el || 'C' }; S.atoms.push(a); return a; }
  function addText(x, y, value, fontSize, options) {
    const t = Object.assign({ id: S.seq++, x, y, text: value, fontSize: fontSize || 20, latex: false, type: 'text' }, options || {});
    S.texts.push(t);
    return t;
  }
  const textItem = id => S.texts.find(t => t.id === id);
  function removeText(id) { S.texts = S.texts.filter(t => t.id !== id); }
  function addBond(ai, bi, order, style, extra) {
    if (ai === bi) return null;
    const old = S.bonds.find(b => (b.a === ai && b.b === bi) || (b.a === bi && b.b === ai));
    if (old) return old;
    const b = Object.assign({ id: S.seq++, a: ai, b: bi, order: order || 1, style: style || 'solid', arom: false, dbl: false }, extra || {});
    S.bonds.push(b); return b;
  }
  function removeAtom(id) {
    const removed = atom(id);
    S.atoms = S.atoms.filter(a => a.id !== id);
    S.bonds = S.bonds.filter(b => b.a !== id && b.b !== id);
    S.rings = S.rings.filter(g => {
      if (g.atoms) return !g.atoms.includes(id);
      return !removed || Math.abs(Math.hypot(removed.x - g.cx, removed.y - g.cy) - g.r) >= 10;
    });
  }
  function removeBond(id) {
    const removed = bond(id);
    if (!removed) return;
    S.bonds = S.bonds.filter(b => b.id !== id);
    const hasEdge = (a, b) => S.bonds.some(edge =>
      (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)
    );
    S.rings = S.rings.filter(ring => {
      if (ring.atoms && ring.atoms.length >= 3) {
        return ring.atoms.every((atomId, i) =>
          hasEdge(atomId, ring.atoms[(i + 1) % ring.atoms.length])
        );
      }
      const a = atom(removed.a), b = atom(removed.b);
      if (!a || !b ||
          Math.abs(Math.hypot(a.x - ring.cx, a.y - ring.cy) - ring.r) >= 10 ||
          Math.abs(Math.hypot(b.x - ring.cx, b.y - ring.cy) - ring.r) >= 10) return true;
      const edgeLength = dist(a, b);
      return !Array.from({ length: 10 }, (_, i) => i + 3).some(vertices =>
        Math.abs(edgeLength - 2 * ring.r * Math.sin(Math.PI / vertices)) < 10
      );
    });
  }
  function cycleBondOrder(id) {
    const existing = bond(id);
    if (!existing) return null;
    existing.order = existing.order % 3 + 1;
    existing.style = 'solid';
    existing.dbl = false;
    existing.arom = false;
    delete existing.cx;
    delete existing.cy;
    delete existing.dblSide;
    return existing;
  }
  function setBondType(id, order, style) {
    const existing = bond(id);
    if (!existing) return null;
    existing.order = order;
    existing.style = style;
    existing.dbl = false;
    existing.arom = false;
    delete existing.cx;
    delete existing.cy;
    delete existing.dblSide;
    return existing;
  }
  function addRing(cx, cy, r, aromatic) { const g = { id: S.seq++, cx, cy, r, aromatic: !!aromatic }; S.rings.push(g); return g; }
  function clearAll() { S.atoms = []; S.bonds = []; S.rings = []; S.texts = []; }
  const neighbors = id => S.bonds.filter(b => b.a === id || b.b === id).map(b => b.a === id ? b.b : b.a);
  const degree = id => S.bonds.filter(b => b.a === id || b.b === id).length;
  const bondsOf = id => S.bonds.filter(b => b.a === id || b.b === id);
  const MAX_VALENCE = Object.freeze({
    H: 1, B: 3, C: 4, N: 3, 'N⁺': 4, 'N⁻': 3, O: 2, 'O⁺': 3, 'O⁻': 1,
    F: 1, Si: 4, P: 5, S: 6, Cl: 1, Se: 6, Br: 1, I: 1,
    OH: 1, NH2: 1, SH: 1, COOH: 1, CHO: 1, COOCH3: 1, NO2: 1, CH2OH: 1,
    CN: 1, OCH3: 1, CH3: 1, CH2: 1, NH: 1, NH3: 1, SO3H: 1,
    PO4: 1, SO2: 1, C2H5: 1
  });
  function valenceViolations() {
    const aromaticEdges = new Set();
    for (const ring of S.rings) {
      if (!ring.aromatic || !Array.isArray(ring.atoms) || ring.atoms.length < 3) continue;
      for (let i = 0; i < ring.atoms.length; i++) {
        const a = ring.atoms[i], b = ring.atoms[(i + 1) % ring.atoms.length];
        aromaticEdges.add(a < b ? `${a}:${b}` : `${b}:${a}`);
      }
    }
    const valence = new Map();
    for (const bond of S.bonds) {
      const aromatic = aromaticEdges.has(bond.a < bond.b
        ? `${bond.a}:${bond.b}`
        : `${bond.b}:${bond.a}`);
      const order = aromatic ? 1.5 : Math.max(1, Number(bond.order) || 1);
      valence.set(bond.a, (valence.get(bond.a) || 0) + order);
      valence.set(bond.b, (valence.get(bond.b) || 0) + order);
    }
    return S.atoms
      .filter(atom => MAX_VALENCE[atom.el] != null && (valence.get(atom.id) || 0) > MAX_VALENCE[atom.el])
      .map(atom => atom.id);
  }
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  function nearAtom(p, tol) { let best = null, bd = tol || 14; for (const a of S.atoms) { const d = dist(p, a); if (d < bd) { bd = d; best = a; } } return best; }
  function nearBond(p, tol) {
    const t = tol || 10; let best = null, bd = t;
    for (const b of S.bonds) {
      const A = atom(b.a), B = atom(b.b); if (!A || !B) continue;
      const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy; if (!L2) continue;
      let s = ((p.x - A.x) * vx + (p.y - A.y) * vy) / L2; s = Math.max(0, Math.min(1, s));
      const d = Math.hypot(p.x - (A.x + vx * s), p.y - (A.y + vy * s));
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // Thành phần liên thông chứa atomId (để kéo cả cụm).
  function component(atomId) {
    const seen = new Set([atomId]); const q = [atomId];
    while (q.length) { const n = q.pop(); for (const m of neighbors(n)) if (!seen.has(m)) { seen.add(m); q.push(m); } }
    return seen;
  }
  const ELCOLOR = { N: '#0b57d0', 'N⁺': '#0b57d0', O: '#d01818', 'O⁻': '#d01818', S: '#b58900', P: '#e8710a', F: '#1a7f37', Cl: '#1a7f37', Br: '#9334e6', I: '#9334e6' };
  // Màu nhãn theo giao diện hiện tại (xem theme.js); fallback bảng màu gốc.
  const elColor = el => {
    const T = window.ChemTheme;
    return T ? T.elColor(el) : (ELCOLOR[el] || '#202124');
  };
  const isBareCarbon = a => a.el === 'C' && degree(a.id) > 0;
  function serialize(space) { return JSON.stringify({ app: 'chemistry-workspace', v: 1, atoms: S.atoms, bonds: S.bonds, rings: S.rings, texts: S.texts }, null, space === undefined ? 2 : space); }
  function deserialize(j) {
    const o = JSON.parse(j);
    if (!o || typeof o !== 'object' || Array.isArray(o) ||
        !Array.isArray(o.atoms) || !Array.isArray(o.bonds)) {
      throw new Error('File không đúng định dạng');
    }
    const rings = o.rings === undefined ? [] : o.rings;
    const texts = o.texts === undefined ? [] : o.texts;
    if (!Array.isArray(rings) || !Array.isArray(texts)) throw new Error('File không đúng định dạng');
    const bonds = o.bonds.map(item => item && typeof item === 'object'
      ? Object.assign({ order: 1, style: 'solid', arom: false, dbl: false }, item)
      : item);

    const ids = new Set();
    const registerId = id => {
      if (!Number.isSafeInteger(id) || id < 1 || ids.has(id)) throw new Error('ID đối tượng không hợp lệ hoặc bị trùng');
      ids.add(id);
    };
    for (const atom of o.atoms) {
      if (!atom || typeof atom !== 'object' || !Number.isSafeInteger(atom.id) ||
          !Number.isFinite(atom.x) || !Number.isFinite(atom.y) ||
          typeof atom.el !== 'string' || !atom.el.trim()) throw new Error('Nguyên tử không hợp lệ');
      registerId(atom.id);
    }
    const atomIds = new Set(o.atoms.map(atom => atom.id));
    const bondIds = new Set();
    for (const item of bonds) {
      if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.id) ||
          !atomIds.has(item.a) || !atomIds.has(item.b) || item.a === item.b ||
          !Number.isInteger(item.order) || item.order < 1 || item.order > 3 ||
          !['solid', 'wedge', 'hash'].includes(item.style)) throw new Error('Liên kết không hợp lệ hoặc tham chiếu nguyên tử không tồn tại');
      registerId(item.id);
      bondIds.add(item.id);
    }
    for (const ring of rings) {
      if (!ring || typeof ring !== 'object' || !Number.isFinite(ring.cx) ||
          !Number.isFinite(ring.cy) || !Number.isFinite(ring.r) || ring.r <= 0) {
        throw new Error('Vòng không hợp lệ');
      }
      if (ring.id !== undefined) registerId(ring.id);
      if (ring.atoms !== undefined &&
          (!Array.isArray(ring.atoms) || ring.atoms.length < 3 || ring.atoms.some(id => !atomIds.has(id)))) {
        throw new Error('Vòng tham chiếu nguyên tử không tồn tại');
      }
      if (ring.dblIds !== undefined &&
          (!Array.isArray(ring.dblIds) || ring.dblIds.some(id => !bondIds.has(id)))) {
        throw new Error('Vòng tham chiếu liên kết không tồn tại');
      }
    }
    const normalizedTexts = texts.map(item => {
      if (!item || typeof item !== 'object') throw new Error('Chú thích không hợp lệ');
      const type = item.type || (item.arrowType || item.above || item.below ? 'arrow' : 'text');
      if (type !== 'text' && type !== 'arrow') throw new Error('Loại chú thích không hợp lệ');
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y) ||
          !Number.isFinite(item.fontSize || 20) || (item.fontSize || 20) <= 0) {
        throw new Error('Vị trí hoặc cỡ chữ của chú thích không hợp lệ');
      }
      registerId(item.id);
      if (type === 'arrow') {
        if (item.arrowType !== undefined && !['forward', 'equilibrium'].includes(item.arrowType)) {
          throw new Error('Loại mũi tên không hợp lệ');
        }
        if (item.width !== undefined && (!Number.isFinite(item.width) || item.width <= 0)) {
          throw new Error('Độ rộng mũi tên không hợp lệ');
        }
        if ((item.above !== undefined && typeof item.above !== 'string') ||
            (item.below !== undefined && typeof item.below !== 'string')) throw new Error('Nhãn mũi tên không hợp lệ');
        return Object.assign({ type, fontSize: 20, width: 96, arrowType: 'forward', above: '', below: '', latex: false }, item);
      }
      if (typeof item.text !== 'string') throw new Error('Nội dung chú thích không hợp lệ');
      return Object.assign({ type, fontSize: 20, latex: false }, item);
    });

    S.atoms = o.atoms;
    S.bonds = bonds;
    S.rings = rings;
    S.texts = normalizedTexts;
    let maxId = 0;
    for (const id of ids) maxId = Math.max(maxId, id);
    S.seq = maxId + 1;
    clearHist();
    emit('open');
  }
  function bbox(pad) {
    if (!S.atoms.length && !S.texts.length) return null; const p = pad == null ? 30 : pad;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const a of S.atoms) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x); y1 = Math.max(y1, a.y); }
    for (const t of S.texts) {
      if (t.type === 'arrow') {
        const width = t.width || 96, labelWidth = Math.max((t.above || '').length, (t.below || '').length) * (t.fontSize || 20) * 0.6;
        x0 = Math.min(x0, t.x - Math.max(width, labelWidth) / 2); x1 = Math.max(x1, t.x + Math.max(width, labelWidth) / 2);
        y0 = Math.min(y0, t.y - (t.above ? t.fontSize || 20 : 12)); y1 = Math.max(y1, t.y + (t.below ? t.fontSize || 20 : 12));
        continue;
      }
      const width = t.text.length * t.fontSize * 0.6;
      x0 = Math.min(x0, t.x - width / 2); y0 = Math.min(y0, t.y - t.fontSize / 2);
      x1 = Math.max(x1, t.x + width / 2); y1 = Math.max(y1, t.y + t.fontSize / 2);
    }
    return { x: x0 - p, y: y0 - p, w: Math.max(10, x1 - x0 + p * 2), h: Math.max(10, y1 - y0 + p * 2) };
  }
  return { S, onChange, emit, transact, undo, redo, beginTx, markTx, endTx, canUndo, canRedo, atom, bond, textItem, addAtom, addText, addBond, cycleBondOrder, setBondType, removeAtom, removeBond, removeText, addRing, clearAll, neighbors, degree, bondsOf, valenceViolations, dist, nearAtom, nearBond, component, elColor, isBareCarbon, serialize, deserialize, bbox };
})();
