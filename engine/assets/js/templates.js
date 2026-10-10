'use strict';
/* templates.js — Thư viện mẫu: vòng no, arene, dị vòng, nhóm chức, phân tử mẫu.
   Fragment = { name, group, atoms:[{el,dx,dy}], bonds:[a,b,order?],
                ring?:{cx,cy,r,aromatic,dbl:[idx liên kết vẽ đôi]}, anchor?:idx } */
window.ChemTemplates = (() => {
  const R = 40, D = R * Math.sqrt(3);
  const ang = (i, n, rot) => -Math.PI / 2 + rot + 2 * Math.PI * i / n;

  function ringFrag(name, group, n, aromatic, rot, hetero, dbl, extra) {
    const atoms = [], bonds = [];
    rot = rot || 0;
    for (let i = 0; i < n; i++) {
      const a = ang(i, n, rot);
      atoms.push({ el: (hetero && hetero[i]) || 'C', dx: Math.cos(a) * R, dy: Math.sin(a) * R });
    }
    for (let i = 0; i < n; i++) bonds.push([i, (i + 1) % n, 1]);
    const frag = {
      name, group, atoms, bonds,
      ring: { cx: 0, cy: 0, r: R, aromatic, dbl: dbl || [], vertices: atoms.map((_, i) => i) }
    };
    if (extra) Object.assign(frag, extra);
    return frag;
  }
  function chainFrag(name, n, labels) {
    const atoms = []; let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      atoms.push({ el: (labels && labels[i]) || 'C', dx: x, dy: y });
      const a = (i % 2) ? 0 : Math.PI / 3;
      x += Math.cos(a) * R; y += Math.sin(a) * R;
    }
    const bonds = []; for (let i = 0; i < n - 1; i++) bonds.push([i, i + 1, 1]);
    return { name, group: 'mol', atoms, bonds, anchor: n - 1, anchorOffset: 0 };
  }
  function funcFrag(name, atoms, bonds, extra) {
    return Object.assign({ name, group: 'fun', atoms, bonds, anchor: 0, anchorOffset: 0 }, extra || {});
  }
  function phenolFrag() {
    const frag = ringFrag('Fenol', 'aro', 6, true, Math.PI / 6, null, [0, 2, 4], {
      anchor: 3,
      anchorOffset: ang(3, 6, Math.PI / 6)
    });
    const vertex = frag.atoms[0];
    frag.atoms.push({ el: 'OH', dx: vertex.dx * 2, dy: vertex.dy * 2 });
    frag.bonds.push([0, 6]);
    return frag;
  }

  const FRAGS = [
    { name: 'Cyclopropan', group: 'sat', snapVertices: true,
      atoms: [{ el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 6 }, { el: 'C', dx: R / 2, dy: -R * Math.sqrt(3) / 6 }, { el: 'C', dx: 0, dy: R * Math.sqrt(3) / 3 }],
      bonds: [[0, 1], [1, 2], [2, 0]],
      ring: { cx: 0, cy: 0, r: R / Math.sqrt(3), aromatic: false, vertices: [0, 1, 2] } },
    ringFrag('Cyclobutan', 'sat', 4, false, Math.PI / 4),
    ringFrag('Cyclopentan', 'sat', 5, false, 0),
    ringFrag('Cyclohexan', 'sat', 6, false, Math.PI / 6),
    { name: 'Chairs', group: 'sat', atoms: [{ el: 'C', dx: -R, dy: -R * .6 }, { el: 'C', dx: -R * .3, dy: -R }, { el: 'C', dx: R * .4, dy: -R * .6 }, { el: 'C', dx: R, dy: R * .1 }, { el: 'C', dx: R * .3, dy: R * .6 }, { el: 'C', dx: -R * .4, dy: R * .1 }], bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
    ringFrag('Benzen', 'aro', 6, true, Math.PI / 6, null, [0, 2, 4]),
    { name: 'Toluen', group: 'aro', atoms: [{ el: 'C', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'C', dx: R, dy: 0 }, { el: 'C', dx: R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R, dy: 0 }, { el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'C', dx: R * 2, dy: 0 }], bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6]], ring: { cx: 0, cy: 0, r: R, aromatic: true, dbl: [0, 2, 4], vertices: [0, 1, 2, 3, 4, 5] } },
    { name: 'Naftalen', group: 'aro',
      atoms: [{ el: 'C', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'C', dx: R, dy: 0 }, { el: 'C', dx: R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R, dy: 0 }, { el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 2 },
              { el: 'C', dx: R * 2, dy: 0 }, { el: 'C', dx: R * 2.5, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: R * 2, dy: R * Math.sqrt(3) }, { el: 'C', dx: R, dy: R * Math.sqrt(3) }],
      bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [6, 7], [7, 8], [8, 9], [9, 2]],
      rings: [{ cx: 0, cy: 0, r: R, aromatic: true, dbl: [0, 2, 4], vertices: [0, 1, 2, 3, 4, 5] }, { cx: R * 1.5, cy: R * Math.sqrt(3) / 2, r: R, aromatic: true, dbl: [7, 9], vertices: [1, 6, 7, 8, 9, 2] }] },
    phenolFrag(),
    ringFrag('Pyrrole (N)', 'het', 5, true, -Math.PI / 2, [0, 0, 0, 0, 'N'], [0, 2]),
    ringFrag('Furan (O)', 'het', 5, true, -Math.PI / 2, [0, 0, 0, 0, 'O'], [0, 2]),
    ringFrag('Thiophene (S)', 'het', 5, true, -Math.PI / 2, [0, 0, 0, 0, 'S'], [0, 2]),
    ringFrag('Piridine (N)', 'het', 6, true, Math.PI / 6, ['N', 0, 0, 0, 0, 0], [0, 2, 4]),
    ringFrag('Imidazole', 'het', 5, true, -Math.PI / 2, ['N', 0, 'N', 0, 0], [0, 3]),
    // ---- Nhóm chức ----
    funcFrag('–OH', [{ el: 'O', dx: 0, dy: 0 }, { el: 'H', dx: R, dy: 0 }], [[0, 1]]),
    funcFrag('–NH2', [{ el: 'N', dx: 0, dy: 0 }, { el: 'H', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'H', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1], [0, 2]]),
    funcFrag('–SH', [{ el: 'S', dx: 0, dy: 0 }, { el: 'H', dx: R, dy: 0 }], [[0, 1]]),
    funcFrag('=O', [{ el: 'O', dx: 0, dy: 0 }], [], { order: 2 }),
    funcFrag('=S', [{ el: 'S', dx: 0, dy: 0 }], [], { order: 2 }),
    funcFrag('–CHO', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'H', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    funcFrag('–COOH', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'OH', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    funcFrag('–COOCH3', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'O', dx: R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: R, dy: R * Math.sqrt(3) }], [[0, 1, 2], [0, 2], [2, 3]]),
    funcFrag('–NO2', [{ el: 'N⁺', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'O⁻', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    funcFrag('–CN', [{ el: 'C', dx: 0, dy: 0 }, { el: 'N', dx: R, dy: 0 }], [[0, 1, 3]]),
    funcFrag('–F', [{ el: 'F', dx: 0, dy: 0 }], []),
    funcFrag('–Cl', [{ el: 'Cl', dx: 0, dy: 0 }], []),
    funcFrag('–Br', [{ el: 'Br', dx: 0, dy: 0 }], []),
    funcFrag('–I', [{ el: 'I', dx: 0, dy: 0 }], []),
    funcFrag('–CH3', [{ el: 'C', dx: 0, dy: 0 }], []),
    // ---- Phân tử mẫu ----
    chainFrag('Etan (C2)', 2),
    chainFrag('Propan (C3)', 3),
    chainFrag('Butan (C4)', 4),
    chainFrag('Pentan (C5)', 5),
    { name: 'Etanol', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }, { el: 'O', dx: R * 2, dy: 0 }, { el: 'H', dx: R * 3, dy: 0 }], bonds: [[0, 1], [1, 2], [2, 3]] },
    { name: 'Axit axetic', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }, { el: 'O', dx: R * 1.5, dy: -R * Math.sqrt(3) / 2 }, { el: 'OH', dx: R * 1.5, dy: R * Math.sqrt(3) / 2 }], bonds: [[0, 1], [1, 2, 2], [1, 3]] },
    { name: 'Aceton', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'O', dx: R, dy: 0 }], bonds: [[0, 1], [0, 2], [0, 3, 2]] },
    { name: 'Ethen', group: 'mol', atoms: [{ el: 'C', dx: -R / 2, dy: 0 }, { el: 'C', dx: R / 2, dy: 0 }], bonds: [[0, 1, 2]] },
    { name: 'Etyne', group: 'mol', atoms: [{ el: 'C', dx: -R, dy: 0 }, { el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }], bonds: [[0, 1, 3], [1, 2, 3]] }
  ];

  const byName = n => FRAGS.find(f => f.name === n);
  // Ảnh thu nhỏ cho sidebar — tự dựng từ fragment.
  function thumb(frag) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-54 -36 108 72');
    const col = window.ChemModel.elColor;
    const ink = window.ChemTheme ? window.ChemTheme.palette().ink : '#202124';
    const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
    for (const bd of frag.bonds) {
      const A = frag.atoms[bd[0]], B = frag.atoms[bd[1]];
      if (!A || !B) continue;
      const dx = B.dx - A.dx, dy = B.dy - A.dy, L = Math.hypot(dx, dy) || 1;
      const px = -dy / L * 1.6, py = dx / L * 1.6;
      const add = (ox, oy) => svg.appendChild(mk('line', {
        x1: (A.dx + ox + dx * .12).toFixed(1), y1: (A.dy + oy + dy * .12).toFixed(1),
        x2: (B.dx + ox - dx * .12).toFixed(1), y2: (B.dy + oy - dy * .12).toFixed(1),
        stroke: ink, 'stroke-width': 1.6, 'stroke-linecap': 'round'
      }));
      if (bd[2] === 3) { add(-px * 2, -py * 2); add(0, 0); add(px * 2, py * 2); }
      else if (bd[2] === 2) { add(-px, -py); add(px, py); }
      else add(0, 0);
    }
    const rings = frag.rings || (frag.ring ? [frag.ring] : []);
    for (const rg of rings) {
      if (!rg.aromatic) continue;
      svg.appendChild(mk('circle', { cx: rg.cx, cy: rg.cy, r: rg.r * 0.5, fill: 'none', stroke: ink, 'stroke-width': 1.4 }));
    }
    frag.atoms.forEach(a => {
      if (a.el === 'C' && frag.atoms.length > 3) return;
      const t = mk('text', { x: a.dx, y: a.dy + 3.6, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Arial, sans-serif', fill: col(a.el) });
      t.textContent = a.el; svg.appendChild(t);
    });
    return svg;
  }

  function renderLibraries(filter) {
    const groups = { sat: 'tplSat', aro: 'tplAro', het: 'tplHet', fun: 'tplFun', mol: 'tplMol' };
    const q = (filter || '').trim().toLowerCase();
    for (const g in groups) {
      const host = document.getElementById(groups[g]);
      if (!host) continue;
      host.innerHTML = '';
      for (const f of FRAGS.filter(f => f.group === g)) {
        const englishName = window.ChemI18n ? window.ChemI18n.name(f.name) : f.name;
        if (q && !f.name.toLowerCase().includes(q) && !englishName.toLowerCase().includes(q)) continue;
        const b = document.createElement('button');
        b.className = 'tpl'; b.dataset.frag = f.name;
        b.appendChild(thumb(f));
        const s = document.createElement('span'); s.textContent = englishName;
        b.appendChild(s);
        host.appendChild(b);
      }
    }
  }

  return { FRAGS, byName, thumb, renderLibraries, R, D };
})();
