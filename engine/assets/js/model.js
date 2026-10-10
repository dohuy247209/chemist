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
  function addText(x, y, value, fontSize) { const t = { id: S.seq++, x, y, text: value, fontSize: fontSize || 20 }; S.texts.push(t); return t; }
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
  function removeBond(id) { S.bonds = S.bonds.filter(b => b.id !== id); }
  function addRing(cx, cy, r, aromatic) { const g = { id: S.seq++, cx, cy, r, aromatic: !!aromatic }; S.rings.push(g); return g; }
  function clearAll() { S.atoms = []; S.bonds = []; S.rings = []; S.texts = []; }
  const neighbors = id => S.bonds.filter(b => b.a === id || b.b === id).map(b => b.a === id ? b.b : b.a);
  const degree = id => S.bonds.filter(b => b.a === id || b.b === id).length;
  const bondsOf = id => S.bonds.filter(b => b.a === id || b.b === id);
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
  function serialize() { return JSON.stringify({ app: 'chemistry-workspace', v: 1, atoms: S.atoms, bonds: S.bonds, rings: S.rings, texts: S.texts }, null, 2); }
  function deserialize(j) { const o = JSON.parse(j); if (!o.atoms || !o.bonds) throw new Error('File không đúng định dạng'); S.atoms = o.atoms; S.bonds = o.bonds; S.rings = o.rings || []; S.texts = o.texts || []; S.seq = Math.max(0, ...S.atoms.map(a => a.id), ...S.bonds.map(b => b.id), ...S.rings.map(r => r.id || 0), ...S.texts.map(t => t.id || 0)) + 1; clearHist(); emit('open'); }
  function bbox(pad) {
    if (!S.atoms.length && !S.texts.length) return null; const p = pad == null ? 30 : pad;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const a of S.atoms) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x); y1 = Math.max(y1, a.y); }
    for (const t of S.texts) {
      const width = t.text.length * t.fontSize * 0.6;
      x0 = Math.min(x0, t.x - width / 2); y0 = Math.min(y0, t.y - t.fontSize / 2);
      x1 = Math.max(x1, t.x + width / 2); y1 = Math.max(y1, t.y + t.fontSize / 2);
    }
    return { x: x0 - p, y: y0 - p, w: Math.max(10, x1 - x0 + p * 2), h: Math.max(10, y1 - y0 + p * 2) };
  }
  return { S, onChange, emit, transact, undo, redo, beginTx, markTx, endTx, canUndo, canRedo, atom, bond, textItem, addAtom, addText, addBond, removeAtom, removeBond, removeText, addRing, clearAll, neighbors, degree, bondsOf, dist, nearAtom, nearBond, component, elColor, isBareCarbon, serialize, deserialize, bbox };
})();
