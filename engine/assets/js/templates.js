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
  // Định nghĩa đường ở dạng DATA thuần (độc lập layout) để dựng được cả
  // bản khung phẳng lẫn Haworth. substituents: [chỉ số đỉnh, nhãn, hướng]
  //   hướng: -1 = lên (ra trước, α), 1 = xuống (ra sau, β).
  function sugarDef(name, ringSize, oxygenIndex, substituents, rotation) {
    return { name, ringSize, oxygenIndex, substituents, rotation: rotation || 0 };
  }
  // Dựng fragment đường theo layout:
  //   'flat'    (mặc định, Cách 1): nhóm chức hướng ra ngoài theo bán kính;
  //             liên kết nối = wedge (lên/ra trước) hoặc hash (xuống/ra sau).
  //   'haworth' (Cách 2): vòng nghiêng (flatten), cạnh trước đậm, nhóm chức thẳng đứng.
  function buildSugar(def, layout) {
    const n = def.ringSize, rot = def.rotation;
    const haworth = layout === 'haworth';
    // Haworth: vòng nghiêng vừa phải. FLAT quá nhỏ (<0.6) khiến nhóm chức
    // thẳng đứng (dài R) trùng tọa độ đỉnh đối diện → nhóm bị đè/mất.
    const FLAT = 0.8;
    const atoms = [], bonds = [], verts = [];
    for (let i = 0; i < n; i++) {
      const a = ang(i, n, rot);
      const vx = Math.cos(a) * R;
      const vy = Math.sin(a) * R * (haworth ? FLAT : 1);
      verts.push({ x: vx, y: vy });
      atoms.push({ el: i === def.oxygenIndex ? 'O' : 'C', dx: vx, dy: vy });
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const midY = (verts[i].y + verts[j].y) / 2;
      // Ở Haworth, cạnh nằm ở nửa dưới vòng là "cạnh trước" (gần người xem) → vẽ đậm.
      const front = haworth && midY > 2;
      bonds.push(front ? [i, j, 1, 'solid', { bold: true }] : [i, j, 1]);
    }
    // Nhóm các nhóm chức theo đỉnh để xử lý trường hợp MỘT đỉnh có nhiều nhóm
    // (ví dụ fructose: C1 có cả –CH2OH và –OH). Nếu để chồng sẽ trùng toạ độ → mất nhóm.
    const byVertex = new Map();
    for (const [atomIndex, el, side] of def.substituents) {
      if (!byVertex.has(atomIndex)) byVertex.set(atomIndex, []);
      byVertex.get(atomIndex).push({ el, side });
    }
    for (const [atomIndex, list] of byVertex) {
      const v = verts[atomIndex];
      const k = list.length;
      list.forEach((item, m) => {
        const { el, side } = item;
        const groupIndex = atoms.length;
        if (haworth) {
          // Thẳng đứng; nếu nhiều nhóm cùng đỉnh CÙNG hướng thì lệch ngang để tách.
          const sameDir = list.filter(x => (x.side < 0) === (side < 0)).length;
          const dirIdx = list.slice(0, m).filter(x => (x.side < 0) === (side < 0)).length;
          const xOff = sameDir > 1 ? (dirIdx - (sameDir - 1) / 2) * R * 0.95 : 0;
          atoms.push({ el, dx: v.x + xOff, dy: v.y + (side < 0 ? -R : R) });
          bonds.push([atomIndex, groupIndex, 1]);
        } else {
          // Hướng ra ngoài theo bán kính; nhiều nhóm cùng đỉnh thì chia đều góc.
          const baseAng = Math.atan2(v.y, v.x);
          const spread = (k > 1) ? (m - (k - 1) / 2) * (Math.PI / 4) : 0;
          const rad = R * 1.9;
          atoms.push({ el, dx: Math.cos(baseAng + spread) * rad, dy: Math.sin(baseAng + spread) * rad });
          bonds.push([atomIndex, groupIndex, 1, side < 0 ? 'wedge' : 'hash']);
        }
      });
    }
    return {
      name: def.name, group: 'sugar', atoms, bonds, fusible: false,
      sugar: def, layout: haworth ? 'haworth' : 'flat',
      ring: { cx: 0, cy: 0, r: R, aromatic: false, vertices: Array.from({ length: n }, (_, i) => i) }
    };
  }

  const SUGARS = [
    sugarDef('Glucose', 6, 0, [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', 1], [5, 'CH2OH', -1]], Math.PI / 6),
    sugarDef('Galactose', 6, 0, [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', -1], [5, 'CH2OH', -1]], Math.PI / 6),
    sugarDef('Fructose', 5, 0, [[1, 'CH2OH', -1], [1, 'OH', 1], [2, 'OH', -1], [3, 'OH', 1], [4, 'CH2OH', 1]]),
    sugarDef('Ribose', 5, 0, [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'CH2OH', 1]])
  ];

  // Các dạng cấu hình (anomer α/β) cho mỗi đường. Mỗi dạng là danh sách
  // substituents đầy đủ [đỉnh, nhãn, hướng]; hướng: -1 = lên (ra trước), 1 = xuống (ra sau).
  // Điểm khác biệt α/β nằm ở nhóm –OH tại carbon anomeric (đỉnh 1, cạnh oxy vòng).
  const SUGAR_VARIANTS = {
    'Glucose': [
      { id: 'alpha', vi: 'α-D-Glucose', en: 'α-D-Glucose', substituents: [[1, 'OH', 1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', 1], [5, 'CH2OH', -1]] },
      { id: 'beta', vi: 'β-D-Glucose', en: 'β-D-Glucose', substituents: [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', 1], [5, 'CH2OH', -1]] }
    ],
    'Galactose': [
      { id: 'alpha', vi: 'α-D-Galactose', en: 'α-D-Galactose', substituents: [[1, 'OH', 1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', -1], [5, 'CH2OH', -1]] },
      { id: 'beta', vi: 'β-D-Galactose', en: 'β-D-Galactose', substituents: [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'OH', -1], [5, 'CH2OH', -1]] }
    ],
    'Fructose': [
      { id: 'alpha', vi: 'α-D-Fructose', en: 'α-D-Fructose', substituents: [[1, 'CH2OH', -1], [1, 'OH', -1], [2, 'OH', -1], [3, 'OH', 1], [4, 'CH2OH', 1]] },
      { id: 'beta', vi: 'β-D-Fructose', en: 'β-D-Fructose', substituents: [[1, 'CH2OH', -1], [1, 'OH', 1], [2, 'OH', -1], [3, 'OH', 1], [4, 'CH2OH', 1]] }
    ],
    'Ribose': [
      { id: 'alpha', vi: 'α-D-Ribose', en: 'α-D-Ribose', substituents: [[1, 'OH', 1], [2, 'OH', 1], [3, 'OH', -1], [4, 'CH2OH', 1]] },
      { id: 'beta', vi: 'β-D-Ribose', en: 'β-D-Ribose', substituents: [[1, 'OH', -1], [2, 'OH', 1], [3, 'OH', -1], [4, 'CH2OH', 1]] }
    ]
  };

  let sugarLayout = 'flat'; // 'flat' (khung phẳng + wedge/hash) hoặc 'haworth'
  const FRAGS = [
    { name: 'Cyclopropan', group: 'sat', snapVertices: true,
      atoms: [{ el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 6 }, { el: 'C', dx: R / 2, dy: -R * Math.sqrt(3) / 6 }, { el: 'C', dx: 0, dy: R * Math.sqrt(3) / 3 }],
      bonds: [[0, 1], [1, 2], [2, 0]],
      ring: { cx: 0, cy: 0, r: R / Math.sqrt(3), aromatic: false, vertices: [0, 1, 2] } },
    ringFrag('Cyclobutan', 'sat', 4, false, Math.PI / 4),
    ringFrag('Cyclopentan', 'sat', 5, false, 0),
    ringFrag('Cyclohexan', 'sat', 6, false, Math.PI / 6),
    // Ghế (chair) cyclohexane: chiếu xiên ~50° của hình 3D đúng (6 đỉnh so le ±h,
    // đối xứng tâm qua tâm vòng). Cặp cạnh đối diện luôn song song; 2 cạnh ngắn là
    // cạnh lùi vào màn hình (co ngắn perspective) — không phải tọa độ tùy hứng.
    { name: 'Chairs', group: 'sat', atoms: [{ el: 'C', dx: R, dy: -R * .175 }, { el: 'C', dx: R / 2, dy: R * .85 }, { el: 'C', dx: -R / 2, dy: R * .475 }, { el: 'C', dx: -R, dy: R * .175 }, { el: 'C', dx: -R / 2, dy: -R * .85 }, { el: 'C', dx: R / 2, dy: -R * .475 }], bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
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
    // –OH: O–H gấp 120° so với bond nối vào (bản cũ thẳng hàng 180°), đồng bộ –NH2.
    funcFrag('–OH', [{ el: 'O', dx: 0, dy: 0 }, { el: 'H', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }], [[0, 1]]),
    funcFrag('–NH2', [{ el: 'N', dx: 0, dy: 0 }, { el: 'H', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'H', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1], [0, 2]]),
    funcFrag('–SH', [{ el: 'S', dx: 0, dy: 0 }, { el: 'H', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }], [[0, 1]]),
    funcFrag('=O', [{ el: 'O', dx: 0, dy: 0 }], [], { order: 2 }),
    funcFrag('=S', [{ el: 'S', dx: 0, dy: 0 }], [], { order: 2 }),
    funcFrag('–CHO', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'H', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    funcFrag('–COOH', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'OH', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    // –COOCH3: methyl xoay để góc C–O–C = 120° (bản cũ gần như thẳng 150°).
    funcFrag('–COOCH3', [{ el: 'C', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'O', dx: R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'C', dx: R + R * Math.sqrt(3) / 2, dy: R * Math.sqrt(3) / 2 - R / 2 }], [[0, 1, 2], [0, 2], [2, 3]]),
    funcFrag('–NO2', [{ el: 'N⁺', dx: 0, dy: 0 }, { el: 'O', dx: R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'O⁻', dx: R / 2, dy: R * Math.sqrt(3) / 2 }], [[0, 1, 2], [0, 2]]),
    funcFrag('–CN', [{ el: 'C', dx: 0, dy: 0 }, { el: 'N', dx: R, dy: 0 }], [[0, 1, 3]]),
    funcFrag('–F', [{ el: 'F', dx: 0, dy: 0 }], []),
    funcFrag('–Cl', [{ el: 'Cl', dx: 0, dy: 0 }], []),
    funcFrag('–Br', [{ el: 'Br', dx: 0, dy: 0 }], []),
    funcFrag('–I', [{ el: 'I', dx: 0, dy: 0 }], []),
    funcFrag('–CH3', [{ el: 'C', dx: 0, dy: 0 }], []),
    // ---- Đường đơn ----
    ...SUGARS.map(s => buildSugar(s, sugarLayout)),
    // ---- Phân tử mẫu ----
    chainFrag('Etan (C2)', 2),
    chainFrag('Propan (C3)', 3),
    chainFrag('Butan (C4)', 4),
    chainFrag('Pentan (C5)', 5),
    // Etanol: zig-zag C–C–O 120°, O–H gấp ~109°; mọi bond = R (bản cũ đặt thẳng hàng 180°).
    { name: 'Etanol', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }, { el: 'O', dx: R * 1.5, dy: D / 2 }, { el: 'H', dx: R * 2.26, dy: R * .215 }], bonds: [[0, 1], [1, 2], [2, 3]] },
    { name: 'Axit axetic', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }, { el: 'O', dx: R * 1.5, dy: -R * Math.sqrt(3) / 2 }, { el: 'OH', dx: R * 1.5, dy: R * Math.sqrt(3) / 2 }], bonds: [[0, 1], [1, 2, 2], [1, 3]] },
    { name: 'Aceton', group: 'mol', atoms: [{ el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: -R / 2, dy: -R * Math.sqrt(3) / 2 }, { el: 'C', dx: -R / 2, dy: R * Math.sqrt(3) / 2 }, { el: 'O', dx: R, dy: 0 }], bonds: [[0, 1], [0, 2], [0, 3, 2]] },
    { name: 'Ethen', group: 'mol', atoms: [{ el: 'C', dx: -R / 2, dy: 0 }, { el: 'C', dx: R / 2, dy: 0 }], bonds: [[0, 1, 2]] },
    // Etyne: H–C≡C–H (4 nguyên tử, liên kết ba ở giữa) — bản cũ là C≡C≡C
    // (carbon giữa hóa trị 6, vẽ 2 liên kết ba liền nhau).
    { name: 'Etyne', group: 'mol', atoms: [{ el: 'H', dx: -R, dy: 0 }, { el: 'C', dx: 0, dy: 0 }, { el: 'C', dx: R, dy: 0 }, { el: 'H', dx: R * 2, dy: 0 }], bonds: [[1, 2, 3], [0, 1], [2, 3]] }
  ];

  // Đổi layout hiển thị cho nhóm đường và dựng lại các fragment sugar tại chỗ
  // trong FRAGS (giữ nguyên vị trí → byName vẫn tìm đúng). Trả về layout đang dùng.
  function setSugarLayout(layout) {
    sugarLayout = (layout === 'haworth') ? 'haworth' : 'flat';
    for (let i = 0; i < FRAGS.length; i++) {
      if (FRAGS[i].sugar) FRAGS[i] = buildSugar(FRAGS[i].sugar, sugarLayout);
    }
    return sugarLayout;
  }
  const getSugarLayout = () => sugarLayout;
  const byName = n => FRAGS.find(f => f.name === n);
  // Danh sách dạng cấu hình (α/β…) của một đường, kèm def gốc để dựng lại.
  const sugarVariants = name => (SUGAR_VARIANTS[name] || []).map(v => Object.assign({}, v, {
    def: SUGARS.find(s => s.name === name)
  })).filter(v => v.def);
  // Ảnh thu nhỏ cho sidebar — tự dựng từ fragment.
  // rotatePreview: mặc định (null) = tự xoay 90° nhóm "sugar" cho sidebar.
  // Truyền false để vẽ đúng hướng gốc (dùng cho ghost trên khung vẽ).
  function thumb(frag, rotatePreviewOverride) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const rotatePreview = rotatePreviewOverride != null
      ? rotatePreviewOverride
      : frag.group === 'sugar';
    const previewPoints = frag.atoms.map(atom => rotatePreview
      ? { x: -atom.dy, y: atom.dx }
      : { x: atom.dx, y: atom.dy });
    const xs = previewPoints.map(point => point.x), ys = previewPoints.map(point => point.y);
    const padding = 14;
    const width = Math.max(60, Math.max(...xs) - Math.min(...xs) + padding * 2);
    const height = Math.max(60, Math.max(...ys) - Math.min(...ys) + padding * 2);
    const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
    svg.setAttribute('viewBox', `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`);
    const drawing = document.createElementNS(NS, 'g');
    if (rotatePreview) drawing.setAttribute('transform', 'rotate(90)');
    const col = window.ChemModel.elColor;
    const ink = window.ChemTheme ? window.ChemTheme.palette().ink : '#202124';
    const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
    for (const bd of frag.bonds) {
      const A = frag.atoms[bd[0]], B = frag.atoms[bd[1]];
      if (!A || !B) continue;
      const dx = B.dx - A.dx, dy = B.dy - A.dy, L = Math.hypot(dx, dy) || 1;
      const px = -dy / L * 1.6, py = dx / L * 1.6;
      const style = bd[3], extra = bd[4] || {};
      const lw = extra.bold ? 3.2 : 1.6;
      const add = (ox, oy) => drawing.appendChild(mk('line', {
        x1: (A.dx + ox + dx * .12).toFixed(1), y1: (A.dy + oy + dy * .12).toFixed(1),
        x2: (B.dx + ox - dx * .12).toFixed(1), y2: (B.dy + oy - dy * .12).toFixed(1),
        stroke: ink, 'stroke-width': lw, 'stroke-linecap': 'round'
      }));
      if (style === 'wedge') {
        // Hình tam giác: mỏng ở A, rộng ở B (nét đậm hướng ra trước).
        const w0 = 0.4, w1 = 3.0;
        const pts = `${A.dx + px * w0},${A.dy + py * w0} ${B.dx + px * w1},${B.dy + py * w1} ${B.dx - px * w1},${B.dy - py * w1} ${A.dx - px * w0},${A.dy - py * w0}`;
        drawing.appendChild(mk('polygon', { points: pts, fill: ink, stroke: 'none' }));
      } else if (style === 'hash') {
        // Nét gạch đứt đều dần về phía B (hướng ra sau).
        const N = 6;
        for (let i = 1; i <= N; i++) {
          const s = 0.12 + (i / (N + 1)) * 0.76;
          const cx = A.dx + dx * s, cy = A.dy + dy * s;
          const hw = 0.5 + s * 2.6;
          drawing.appendChild(mk('line', {
            x1: (cx + px * hw).toFixed(1), y1: (cy + py * hw).toFixed(1),
            x2: (cx - px * hw).toFixed(1), y2: (cy - py * hw).toFixed(1),
            stroke: ink, 'stroke-width': 1.8, 'stroke-linecap': 'round'
          }));
        }
      } else if (bd[2] === 3) { add(-px * 2, -py * 2); add(0, 0); add(px * 2, py * 2); }
      else if (bd[2] === 2) { add(-px, -py); add(px, py); }
      else add(0, 0);
    }
    const rings = frag.rings || (frag.ring ? [frag.ring] : []);
    for (const rg of rings) {
      if (!rg.aromatic) continue;
      drawing.appendChild(mk('circle', { cx: rg.cx, cy: rg.cy, r: rg.r * 0.5, fill: 'none', stroke: ink, 'stroke-width': 1.4 }));
    }
    frag.atoms.forEach(a => {
      if (a.el === 'C' && frag.atoms.length > 3) return;
      const t = mk('text', { x: a.dx, y: a.dy + 3.6, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Arial, sans-serif', fill: col(a.el) });
      t.textContent = a.el; drawing.appendChild(t);
    });
    if (rotatePreview) {
      // Nhãn giữ ngang như kết quả vẽ thật — không xoay theo bản xem trước.
      const labels = drawing.querySelectorAll('text');
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const x = label.getAttribute('x'), y = label.getAttribute('y');
        if (x != null && y != null) label.setAttribute('transform', `rotate(-90 ${x} ${y})`);
      }
    }
    svg.appendChild(drawing);
    return svg;
  }

  function renderLibraries(filter) {
    const groups = { sat: 'tplSat', aro: 'tplAro', het: 'tplHet', fun: 'tplFun', sugar: 'tplSugar', mol: 'tplMol' };
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

  return { FRAGS, byName, thumb, renderLibraries, setSugarLayout, getSugarLayout, sugarVariants, buildSugar, R, D };
})();
