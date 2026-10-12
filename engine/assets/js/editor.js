'use strict';
/* editor.js — Tương tác canvas: công cụ, chọn/kéo, vẽ liên kết, đặt mẫu, phím tắt. */
window.ChemEditor = (() => {
  const M = window.ChemModel;
  const text = (vi, en) => window.ChemI18n ? window.ChemI18n.text(vi, en) : vi;
  const st = {
    tool: 'select', selectionMode: 'select', el: 'C', order: 1, bstyle: 'solid',
    tpl: null, tplRotation: 0, tplRotateAt: 0, sel: null, snap: true, grid: true, gridType: 'square', gridOrientation: 'horizontal', space: false,
    view: { x: 0, y: 0, k: 1 }, drag: null, hover: null, changed: false
  };
  let stage, viewport, gridRect, overlay, wrap, textInput, textEdit = null, lastTextClick = null, tplRotateTimer = null;
  let settingsObserver = null;

  // ---------- Toạ độ & hiển thị ----------
  function toWorld(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - st.view.x) / st.view.k, y: (e.clientY - r.top - st.view.y) / st.view.k };
  }
  function normalizeSelection(selection) {
    if (!selection) return null;
    if (selection.type === 'atom') return M.atom(selection.id) ? selection : null;
    if (selection.type === 'bond') return M.bond(selection.id) ? selection : null;
    if (selection.type === 'text') return M.textItem(selection.id) ? selection : null;
    if (selection.type !== 'multi') return null;
    const ids = (selection.ids || []).filter(id => M.atom(id));
    const bondIds = (selection.bondIds || []).filter(id => M.bond(id));
    const textIds = (selection.textIds || []).filter(id => M.textItem(id));
    return selectionFromItems(ids, bondIds, textIds);
  }
  // ---------- Cài đặt (thông báo ra app.js) ----------
  // app.js đăng ký callback để LƯU localStorage + đồng bộ panel mỗi khi
  // người dùng đổi lưới/bắt điểm bằng nút toolbar hoặc phím tắt (G/T/Y).
  function setSettingsObserver(fn) { settingsObserver = typeof fn === 'function' ? fn : null; }
  function notifySettingsChanged() { if (settingsObserver) settingsObserver(); }
  function toggleGridOrientation() {
    if (st.gridType !== 'triangle') return;
    const angle = st.gridOrientation === 'horizontal' ? Math.PI / 2 : -Math.PI / 2;
    st.gridOrientation = st.gridOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    rotateAllComponents(angle);
    updateGrid();
    notifySettingsChanged();
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
  function gridAngleBase() {
    if (st.gridType !== 'triangle') return 0;
    return st.gridOrientation === 'vertical' ? Math.PI / 6 : 0;
  }
  function nearestGridAngle(angle) {
    const step = st.gridType === 'triangle' ? Math.PI / 3 : Math.PI / 6;
    const base = gridAngleBase();
    return base + Math.round((angle - base) / step) * step;
  }
  function openAttachmentAngle(atom) {
    const step = st.gridType === 'triangle' ? Math.PI / 3 : Math.PI / 6;
    const base = gridAngleBase();
    const neighbors = M.neighbors(atom.id).map(id => M.atom(id)).filter(Boolean);
    let bestAngle = base, bestScore = -Infinity;
    for (let i = 0; i < (st.gridType === 'triangle' ? 6 : 12); i++) {
      const angle = base + i * step;
      const score = neighbors.reduce((sum, neighbor) => {
        const dx = neighbor.x - atom.x, dy = neighbor.y - atom.y;
        const length = Math.hypot(dx, dy) || 1;
        return sum - (dx * Math.cos(angle) + dy * Math.sin(angle)) / length;
      }, 0);
      if (score > bestScore) { bestAngle = angle; bestScore = score; }
    }
    return bestAngle;
  }
  function orientTemplatePoint(x, y, angle) {
    const rotation = angle == null
      ? (st.gridType === 'triangle' && st.gridOrientation === 'vertical' ? Math.PI / 2 : 0) + st.tplRotation
      : angle;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    return { x: cos * x - sin * y, y: sin * x + cos * y };
  }
  function templateOriginAt(position, frag, angle) {
    if (!frag.snapVertices || !st.snap || st.gridType !== 'triangle') return position;
    const first = frag.atoms[0];
    const offset = orientTemplatePoint(first.dx, first.dy, angle);
    const snapped = snapP({ x: position.x + offset.x, y: position.y + offset.y });
    return { x: snapped.x - offset.x, y: snapped.y - offset.y };
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
      button.title = text(triangle ? 'Chuyển sang lưới vuông' : 'Chuyển sang lưới tam giác', triangle ? 'Switch to square grid' : 'Switch to triangular grid');
      button.setAttribute('aria-label', text('Loại lưới: ' + (triangle ? 'tam giác' : 'vuông'), 'Grid type: ' + (triangle ? 'triangular' : 'square')));
      button.setAttribute('aria-pressed', triangle ? 'true' : 'false');
      button.classList.toggle('active', triangle);
    }
    const orientationButton = document.getElementById('gridOrientationBtn');
    if (orientationButton) {
      const vertical = st.gridOrientation === 'vertical';
      orientationButton.hidden = st.gridType !== 'triangle';
      orientationButton.textContent = vertical ? '↔' : '↕';
      orientationButton.title = text(`Chuyển trục sang ${vertical ? 'nằm ngang' : 'nằm dọc'} và xoay cấu trúc 90°`, `Switch triangle-grid axis to ${vertical ? 'horizontal' : 'vertical'} and rotate structures 90°`);
      orientationButton.setAttribute('aria-label', text(`Trục lưới tam giác nằm ${vertical ? 'dọc' : 'ngang'}`, `Triangle-grid axis is ${vertical ? 'vertical' : 'horizontal'}`));
      orientationButton.setAttribute('aria-pressed', vertical ? 'true' : 'false');
      orientationButton.classList.toggle('active', vertical);
    }
    updateGridStatus();
  }
  function updateGridStatus() {
    const s = document.getElementById('stSnap');
    if (s) s.textContent = window.ChemI18n && window.ChemI18n.language === 'en'
      ? `${st.gridType === 'triangle' ? `Triangle grid (${st.gridOrientation})` : 'Square grid'}: ${st.grid ? 'On' : 'Off'} · Snap: ${st.snap ? 'On' : 'Off'}`
      : `Lưới ${st.gridType === 'triangle' ? `tam giác (${st.gridOrientation === 'vertical' ? 'dọc' : 'ngang'})` : 'vuông'}: ${st.grid ? 'Bật' : 'Tắt'} · Bắt điểm: ${st.snap ? 'Bật' : 'Tắt'}`;
  }
  function applyView() {
    const v = st.view;
    const t = `translate(${v.x.toFixed(2)},${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`;
    viewport.setAttribute('transform', t);
    if (gridRect) gridRect.setAttribute('transform', t);
    const zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = Math.round(v.k * 100) + '%';
    positionTextInput();
  }
  function positionTextInput() {
    if (!textInput || !textEdit) return;
    const stageRect = stage.getBoundingClientRect(), wrapRect = wrap.getBoundingClientRect();
    textInput.style.left = `${stageRect.left - wrapRect.left + st.view.x + textEdit.x * st.view.k}px`;
    textInput.style.top = `${stageRect.top - wrapRect.top + st.view.y + textEdit.y * st.view.k}px`;
    textInput.style.fontSize = `${(parseFloat(document.getElementById('optFont').value) || 20) * st.view.k}px`;
  }
  function beginTextEdit(position, id) {
    finishTextEdit(false);
    const annotation = id == null ? null : M.textItem(id);
    textEdit = { x: position.x, y: position.y, id: annotation ? annotation.id : null };
    textInput.value = annotation ? annotation.text : '';
    positionTextInput();
    textInput.hidden = false;
    textInput.style.width = `${Math.max(84, (textInput.value.length || 8) * (parseFloat(document.getElementById('optFont').value) || 20) * st.view.k * 0.62 + 24)}px`;
    textInput.focus();
    textInput.select();
  }
  function finishTextEdit(commit) {
    if (!textEdit) return;
    const edit = textEdit, value = textInput.value.trim();
    textEdit = null;
    textInput.hidden = true;
    if (!commit || !value) {
      if (commit && !value) window.ChemApp.toast(text('Nội dung chú thích không được để trống.', 'Annotation text cannot be empty.'));
      return;
    }
    if (edit.id == null) {
      let annotation;
      M.transact(() => {
        annotation = M.addText(edit.x, edit.y, value, parseFloat(document.getElementById('optFont').value) || 20);
      }, 'text');
      st.sel = { type: 'text', id: annotation.id };
    } else {
      const annotation = M.textItem(edit.id);
      if (annotation && annotation.text !== value) M.transact(() => { annotation.text = value; }, 'text');
      st.sel = { type: 'text', id: edit.id };
    }
    redraw();
  }
  function redraw() {
    window.ChemRender.renderAll(st.sel);
    drawOverlay();
    const tb = document.getElementById('stTool');
    if (tb) tb.textContent = text('Công cụ: ', 'Tool: ') + toolName();
    if (st.onAfter) { try { st.onAfter(); } catch (e) { console.error(e); } }
  }
  function toolName() {
    const english = window.ChemI18n && window.ChemI18n.language === 'en';
    const order = st.order === 3 ? (english ? 'triple' : 'ba') : st.order === 2 ? (english ? 'double' : 'đôi') : (english ? 'single' : 'đơn');
    const styles = english ? { wedge: 'wedge', hash: 'hashed' } : { wedge: 'nét đậm', hash: 'nét đứt' };
    return (english
      ? { select: st.selectionMode === 'lasso' ? 'Lasso select' : 'Select', pan: 'Pan', atom: 'Place atom (' + st.el + ')', bond: `${order} bond${st.bstyle !== 'solid' ? ' · ' + (styles[st.bstyle] || st.bstyle) : ''}`, erase: 'Erase', chain: 'Carbon chain', text: 'Insert text' }
      : { select: st.selectionMode === 'lasso' ? 'Chọn vùng tự do' : 'Chọn', pan: 'Kéo khung', atom: 'Đặt nguyên tử (' + st.el + ')', bond: `Liên kết ${order}${st.bstyle !== 'solid' ? ' · ' + (styles[st.bstyle] || st.bstyle) : ''}`, erase: 'Tẩy', chain: 'Mạch zigzag', text: 'Chèn văn bản' })[st.tool] || st.tool;
  }
  function clearOverlay() { while (overlay.firstChild) overlay.removeChild(overlay.firstChild); }
  function ov(tag, attrs, parent) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    (parent || overlay).appendChild(n); return n;
  }
  // Vẽ khung xem trước vùng sẽ được xuất ảnh (lề theo settings). Khung này phản
  // ánh ĐÚNG hộp export: nếu đang chọn đối tượng thì là vùng chọn, ngược lại là
  // toàn khung vẽ. Cập nhật theo thời gian thực khi kéo/xoay/thay đổi lề.
  function drawExportFrame() {
    const X = window.ChemExport;
    if (!X || !X.exportFrame) return;
    const setting = document.getElementById('settingsExportFrame');
    if (setting && setting.value !== 'enabled') return;
    let box;
    try { box = X.exportFrame(st.sel || undefined); } catch (error) { return; }
    if (!box) return;
    const blue = window.ChemTheme.palette().blue;
    ov('rect', {
      x: box.x, y: box.y, width: box.w, height: box.h,
      fill: 'none', stroke: blue, 'stroke-width': 1.5, 'stroke-dasharray': '6 4',
      'pointer-events': 'none', class: 'export-frame'
    });
    // Góc đánh dấu để dững tâm khung.
    const c = 8;
    for (const [cx, cy, sx, sy] of [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1], [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]]) {
      ov('path', {
        d: `M${cx} ${cy + sy * c} L${cx} ${cy} L${cx + sx * c} ${cy}`,
        fill: 'none', stroke: blue, 'stroke-width': 2, 'stroke-linecap': 'round',
        'pointer-events': 'none', class: 'export-frame'
      });
    }
  }
  // Vẽ vùng chọn (multi) + ghost + hover lên lớp overlay.
  function drawOverlay() {
    clearOverlay();
    drawExportFrame();
    const draggingLasso = st.drag && st.drag.mode === 'lasso';
    if (draggingLasso) {
      ov('polygon', {
        points: st.drag.points.map(p => p.x + ',' + p.y).join(' '),
        fill: window.ChemTheme.palette().blue,
        'fill-opacity': 0.08,
        stroke: window.ChemTheme.palette().blue,
        'stroke-opacity': 0.85,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-dasharray': '4 3',
        'pointer-events': 'none'
      });
    }
    const draggingBox = st.drag && st.drag.mode === 'box';
    const selection = draggingLasso
      ? st.drag.additive ? combineSelections(st.drag.baseSelection, lassoSelection(st.drag.points)) : lassoSelection(st.drag.points)
      : draggingBox
        ? st.drag.additive ? combineSelections(st.drag.baseSelection, boxSelection(st.drag)) : boxSelection(st.drag)
        : st.sel;
    drawSelectionOverlay(selection, draggingLasso);
    if (st.drag) drawDragGhost();
    else if (st.tool === 'erase' && st.hover) drawHover();
    else if (st.tpl && st.hoverP) drawTplGhost();
  }
  function drawSelectionOverlay(selection, preview) {
    if (!selection) return;
    const blue = window.ChemTheme.palette().blue;
    const atomIds = selection.type === 'atom' ? [selection.id] : selection.ids || [];
    const radius = preview ? 13 : 15;
    for (const id of atomIds) {
      const atom = M.atom(id);
      if (atom) ov('circle', {
        cx: atom.x, cy: atom.y, r: radius, class: 'sel-ring',
        fill: blue, 'fill-opacity': preview ? 0.06 : 0.12,
        stroke: blue, 'stroke-width': preview ? 1.5 : 1.5,
        'stroke-dasharray': preview ? 'none' : '5 3',
        'pointer-events': 'none'
      });
    }
    const bondIds = selection.type === 'bond' ? [selection.id] : selection.bondIds || [];
    for (const id of bondIds) {
      const bond = M.bond(id), a = bond && M.atom(bond.a), b = bond && M.atom(bond.b);
      if (a && b) ov('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, fill: 'none', stroke: blue, 'stroke-opacity': 0.4, 'stroke-width': 9, 'pointer-events': 'none' });
    }
    const textIds = selection.type === 'text' ? [selection.id] : selection.textIds || [];
    for (const id of textIds) {
      const annotation = M.textItem(id);
      if (!annotation) continue;
      const size = annotation.fontSize || 20;
      const width = annotation.type === 'arrow'
        ? Math.max(annotation.width || 96, Math.max((annotation.above || '').length, (annotation.below || '').length) * size * 0.6)
        : Math.max(size, annotation.text.length * size * 0.6);
      const height = annotation.type === 'arrow' ? size * 2 + 24 : size;
      ov('rect', { x: annotation.x - width / 2 - 4, y: annotation.y - height / 2 - 3, width: width + 8, height: height + 6, fill: blue, 'fill-opacity': 0.08, stroke: blue, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' });
    }
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
    // Dùng chung phép tính với placeTemplate → ghost hiển thị ĐÚNG vị trí/góc
    // sẽ đặt (gồm ghép vòng, hàn vào atom sẵn có, gắn nhóm chức theo hướng lưới).
    const place = computeTemplatePlacement(frag, st.hoverP);
    const angleDeg = place.fusion
      ? Math.atan2(place.fusion.sin, place.fusion.cos) * 180 / Math.PI
      : place.templateAngle * 180 / Math.PI;
    const transform = place.fusion
      ? `translate(${place.ox},${place.oy}) scale(${place.fusion.scale}) rotate(${angleDeg})`
      : `translate(${place.ox},${place.oy}) rotate(${angleDeg})`;
    const g = ov('g', { class: 'ghost', transform });
    // Dùng rotatePreview=false rồi tự xoay theo góc đặt — khớp hướng lúc đặt.
    const thumb = window.ChemTemplates.thumb(frag, false);
    while (thumb.firstChild) g.appendChild(thumb.firstChild);
    // Nhãn giữ ngang như kết quả đặt thật (chữ KHÔNG xoay theo ghost).
    const labels = g.querySelectorAll('text');
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      label.setAttribute('transform', `rotate(${-angleDeg} ${label.getAttribute('x')} ${label.getAttribute('y')})`);
    }
    // Nhãn góc xoay: chỉ hiện khi đã xoay (góc khác 0) và trong vài giây sau lần xoay cuối.
    const deg = ((Math.round(st.tplRotation * 180 / Math.PI) % 360) + 360) % 360;
    const showLabel = deg !== 0 && (Date.now() - st.tplRotateAt < 2000);
    if (showLabel) {
      const label = ov('text', {
        x: place.ox, y: place.oy - 46,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        class: 'rot-label', 'pointer-events': 'none'
      });
      label.textContent = deg + '°';
    }
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
    } else if (d.mode === 'lasso') {
      ov('polyline', { points: d.points.map(p => p.x + ',' + p.y).join(' '), fill: 'none', stroke: window.ChemTheme.palette().blue, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '4 3' });
    }
  }
  function chainPoints(start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = parseFloat(document.getElementById('optBondLen').value) || 40;
    const wantedLength = Math.hypot(dx, dy);
    const wantedX = wantedLength ? dx / wantedLength : 1;
    const wantedY = wantedLength ? dy / wantedLength : 0;
    // Số nguyên tử động theo khoảng cách kéo chuột (không còn ô nhập cố định).
    const n = Math.max(2, Math.min(30, Math.round(wantedLength / length) + 1));
    // Bước zigzag cố định 60° → góc C–C–C trong = 120° trên mọi loại lưới,
    // 6 hướng × 60° = phủ đủ 360°.
    const step = Math.PI / 3;
    const base = gridAngleBase();
    let best = null;
    for (let direction = -1; direction <= 1; direction += 2) {
      for (let orientation = 0; orientation < 6; orientation++) {
        const firstAngle = base + orientation * step;
        const secondAngle = firstAngle + direction * step;
        const points = [{ x: start.x, y: start.y }];
        for (let i = 0; i < n - 1; i++) {
          const angle = i % 2 === 0 ? firstAngle : secondAngle;
          const last = points[points.length - 1];
          points.push({ x: last.x + Math.cos(angle) * length, y: last.y + Math.sin(angle) * length });
        }
        const endPoint = points[points.length - 1];
        const endX = endPoint.x - start.x, endY = endPoint.y - start.y;
        const endLength = Math.hypot(endX, endY);
        const score = endLength ? (endX * wantedX + endY * wantedY) / endLength : -Infinity;
        if (!best || score > best.score) best = { points, score };
      }
    }
    return best ? best.points : [start];
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
    if (!(frag.ring || frag.rings) || frag.fusible === false) return null;
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
  // Tính trước vị trí + góc đặt mẫu cho con trỏ tại p. Dùng CHUNG cho ghost
  // (bản xem trước) và placeTemplate → hiển thị = kết quả đặt thật.
  function computeTemplatePlacement(frag, p) {
    const bl = parseFloat(document.getElementById('optBondLen').value) || 40;
    const isRing = !!(frag.ring || frag.rings);
    const fusion = fusionTransform(frag, p);
    let templateAngle = (st.gridType === 'triangle' && st.gridOrientation === 'vertical' ? Math.PI / 2 : 0) + st.tplRotation;
    const position = fusion ? p : templateOriginAt(snapP(p), frag, templateAngle);
    const near = (!isRing && frag.anchor != null) ? M.nearAtom(position, 20) : (isRing && frag.anchor != null ? M.nearAtom(position, 20) : null);
    let ox = position.x, oy = position.y;
    if (fusion) {
      ox = fusion.ox; oy = fusion.oy;
    } else if (near && isRing) {
      const ai = frag.anchor != null ? frag.anchor : 0;
      const anchor = orientTemplatePoint(frag.atoms[ai].dx, frag.atoms[ai].dy, templateAngle);
      ox = near.x - anchor.x; oy = near.y - anchor.y;
    } else if (near && !isRing) {
      const A = frag.anchor != null ? frag.atoms[frag.anchor] : frag.atoms[0];
      let dx = p.x - near.x, dy = p.y - near.y, L = Math.hypot(dx, dy);
      const attachmentAngle = L < 6
        ? openAttachmentAngle(near)
        : nearestGridAngle(Math.atan2(dy, dx));
      templateAngle = attachmentAngle - (frag.anchorOffset || 0) + st.tplRotation;
      const anchor = orientTemplatePoint(A.dx, A.dy, templateAngle);
      ox = near.x + Math.cos(attachmentAngle) * bl - anchor.x;
      oy = near.y + Math.sin(attachmentAngle) * bl - anchor.y;
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
          const offset = orientTemplatePoint(v.dx, v.dy, templateAngle);
          const mx = t0.x - offset.x, my = t0.y - offset.y;
          const dd = Math.hypot(mx - lx, my - ly);
          if (dd > bd) { bd = dd; bv = v; }
        }
        const offset = orientTemplatePoint(bv.dx, bv.dy, templateAngle);
        ox = t0.x - offset.x; oy = t0.y - offset.y;
      } else {
        // Nhấn gần rìa (đỉnh vòng nằm sát atom) cũng hàn được.
        for (let i = 0; i < frag.atoms.length; i++) {
          const v = frag.atoms[i];
          const offset = orientTemplatePoint(v.dx, v.dy, templateAngle);
          const t = M.nearAtom({ x: position.x + offset.x, y: position.y + offset.y }, 10);
          if (t) { ox = t.x - offset.x; oy = t.y - offset.y; break; }
        }
      }
    } else if (frag.anchor != null) {
      const anchor = orientTemplatePoint(frag.atoms[frag.anchor].dx, frag.atoms[frag.anchor].dy, templateAngle);
      ox = position.x - anchor.x; oy = position.y - anchor.y;
    }
    return { ox, oy, templateAngle, fusion, near, isRing, bl };
  }
  function placeTemplate(frag, p) {
    if (!frag) return;
    const place = computeTemplatePlacement(frag, p);
    const templateAngle = place.templateAngle, fusion = place.fusion, near = place.near, isRing = place.isRing;
    const ox = place.ox, oy = place.oy;

    M.transact(() => {
      const created = [];
      const ids = frag.atoms.map(a => {
        const offset = orientTemplatePoint(a.dx, a.dy, templateAngle);
        const x = fusion ? ox + fusion.scale * (fusion.cos * a.dx - fusion.sin * a.dy) : offset.x + ox;
        const y = fusion ? oy + fusion.scale * (fusion.sin * a.dx + fusion.cos * a.dy) : offset.y + oy;
        const ex = M.nearAtom({ x, y }, 10);
        created.push(!ex);
        return ex ? ex.id : M.addAtom(x, y, a.el).id;
      });
      const bondIds = [];
      for (const bd of frag.bonds) {
        // bd = [a, b, order?, style?, extra?] — style/extra cho phép đặt wedge/hash/bold.
        const b = M.addBond(ids[bd[0]], ids[bd[1]], bd[2] || 1, bd[3] || 'solid', bd[4] || null);
        bondIds.push(b ? b.id : null);
      }
      const rings = frag.rings || (frag.ring ? [frag.ring] : []);
      let sugarGid = null;
      for (const rg of rings) {
        const center = orientTemplatePoint(rg.cx, rg.cy, templateAngle);
        const cx = fusion ? ox + fusion.scale * (fusion.cos * rg.cx - fusion.sin * rg.cy) : ox + center.x;
        const cy = fusion ? oy + fusion.scale * (fusion.sin * rg.cx + fusion.cos * rg.cy) : oy + center.y;
        const g = M.addRing(cx, cy, rg.r * (fusion ? fusion.scale : 1), rg.aromatic);
        if (frag.group === 'sugar') sugarGid = g.id;
        g.atoms = rg.vertices ? rg.vertices.map(i => ids[i]) : undefined;
        if (rg.dbl && rg.dbl.length) g.dblIds = rg.dbl.map(i => bondIds[i]).filter(Boolean);
      }
      if (near && !isRing) M.addBond(near.id, ids[frag.anchor != null ? frag.anchor : 0], frag.order || 1, 'solid');
      // Đánh dấu các nguyên tử thuộc phân tử đường để panel thuộc tính hiện bộ chọn
      // cấu hình α/β. Mã nhóm = id của VÒNG (gid): vòng đã đăng ký id nên không trùng
      // sau khi mở lại file, và cho phép đổi α/β tại chỗ mà không đụng phân tử khác.
      // Chỉ gắn cho nguyên tử do mẫu tạo (created), tránh ghi đè metadata của phân tử
      // khác khi vị trí trùng một nguyên tử có sẵn (nearAtom).
      if (frag.group === 'sugar' && frag.sugar && sugarGid != null) {
        // Mẫu gốc đang là dạng α hay β? (so với danh sách biến thể) → panel tô sáng đúng nút.
        const same = v => JSON.stringify(v.substituents) === JSON.stringify(frag.sugar.substituents);
        const match = window.ChemTemplates.sugarVariants(frag.sugar.name).find(same);
        ids.forEach((id, i) => {
          const atom = M.atom(id);
          if (atom && created[i]) atom.sugar = {
            gid: sugarGid, idx: i, name: frag.sugar.name,
            layout: frag.layout || 'flat', anomer: match ? match.id : null
          };
        });
      }
    }, 'place');
    st.sel = null;
    const templateName = window.ChemI18n ? window.ChemI18n.name(frag.name) : frag.name;
    setHint(fusion
      ? text(`Đã ghép "${templateName}" với vòng hiện có qua một cạnh chung.`, `Fused "${templateName}" to the existing ring along a shared edge.`)
      : text('Đã đặt mẫu "' + templateName + '" — nhấn tiếp để đặt nữa hoặc Esc để thoát.', 'Placed "' + templateName + '" — click again to place another or press Esc to exit.'));
  }
  // Đổi cấu hình anomer (α/β) của một phân tử đường đang có trên khung vẽ.
  // seedAtomId: 1 nguyên tử thuộc phân tử đường; variantId: 'alpha' | 'beta' …
  // Trả về id nguyên tử mới (để panel chọn lại) hoặc null nếu thất bại.
  function applySugarAnomer(seedAtomId, variantId) {
    const T = window.ChemTemplates;
    const seed = M.atom(seedAtomId);
    if (!seed || !seed.sugar || seed.sugar.gid == null) return null;   // bản vẽ cũ chưa có gid
    const { gid, name } = seed.sugar;
    const layout = seed.sugar.layout || 'flat';
    const variant = T.sugarVariants(name).find(v => v.id === variantId);
    if (!variant || !variant.def) return null;

    // Chỉ lấy nguyên tử của ĐÚNG phân tử đường này (theo gid), KHÔNG lấy cả thành
    // phần liên thông → glycosid/nhóm thế vừa vẽ/đường lân cận không bị đụng.
    const byIdx = new Map();
    for (const a of M.S.atoms) if (a.sugar && a.sugar.gid === gid) byIdx.set(a.sugar.idx, a);

    const frag = T.buildSugar(Object.assign({}, variant.def, { substituents: variant.substituents }), layout);
    if (frag.atoms.some((_, i) => !byIdx.has(i))) return null;       // thiếu nguyên tử (đã bị xoá)

    // Phép biến đổi mẫu → khung vẽ, suy ra từ 2 đỉnh vòng hiện tại (đã gồm kéo,
    // xoay, scale) → giữ nguyên vị trí VÀ hướng xoay của phân tử.
    const n = frag.ring.vertices.length;
    const t0 = frag.atoms[0], t1 = frag.atoms[1], c0 = byIdx.get(0), c1 = byIdx.get(1);
    const scale = Math.hypot(c1.x - c0.x, c1.y - c0.y) / (Math.hypot(t1.dx - t0.dx, t1.dy - t0.dy) || 1);
    const rot = Math.atan2(c1.y - c0.y, c1.x - c0.x) - Math.atan2(t1.dy - t0.dy, t1.dx - t0.dx);
    const cos = Math.cos(rot) * scale, sin = Math.sin(rot) * scale;
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += byIdx.get(i).x; cy += byIdx.get(i).y; }
    cx /= n; cy /= n;                                                // tâm mẫu = (0,0)

    M.transact(() => {
      // Cập nhật TẠI CHỖ: đỉnh vòng giữ nguyên (giữ id/màu/nhãn), chỉ đổi nhóm thế.
      frag.atoms.forEach((t, i) => {
        if (i < n) return;                                           // đỉnh vòng giữ nguyên
        const a = byIdx.get(i);
        a.x = Math.round((cx + cos * t.dx - sin * t.dy) * 10) / 10;
        a.y = Math.round((cy + sin * t.dx + cos * t.dy) * 10) / 10;
      });
      // Chỉ đổi kiểu nét (wedge ↔ hash) của các liên kết nhóm thế; liên kết khác
      // (kể cả glycosid) giữ nguyên.
      frag.bonds.forEach(bd => {
        if (bd[0] < n && bd[1] < n) return;                          // chỉ liên kết nhóm thế
        const A = byIdx.get(bd[0]), B = byIdx.get(bd[1]);
        if (!A || !B) return;
        const b = M.S.bonds.find(x => (x.a === A.id && x.b === B.id) || (x.a === B.id && x.b === A.id));
        if (b) b.style = bd[3] || 'solid';
      });
      byIdx.forEach(a => { a.sugar.anomer = variantId; });
    }, 'sugar-anomer');
    return seedAtomId;                                               // id không đổi → panel giữ nguyên
  }
  // ---------- Xử lý chuột ----------
  function onDown(e) {
    if (e.button === 2) return;
    if (st.tool !== 'text') stage.focus();
    // Xóa mọi vùng bôi đen văn bản còn sót (phòng khi user-select chưa đủ trên vài trình duyệt).
    try { const s = window.getSelection && window.getSelection(); if (s && s.removeAllRanges) s.removeAllRanges(); } catch (err) {}
    const p = toWorld(e);
    const additiveSelection = e.ctrlKey || e.metaKey;
    if (e.button === 1 || st.tool === 'pan' || st.space) {
      st.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (st.tpl) { placeTemplate(window.ChemTemplates.byName(st.tpl), p); st.tpl = null; syncTplButtons(); redraw(); return; }
    if (st.tool === 'select' && st.selectionMode === 'lasso') {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      const textElement = e.target.closest && e.target.closest('[data-tid]');
      const annotation = textElement ? M.textItem(+textElement.getAttribute('data-tid')) : null;
      const hit = annotation ? { type: 'text', id: annotation.id } : hitTest(p);
      if (additiveSelection) {
        st.drag = {
          mode: 'lasso', points: [p], startX: e.clientX, startY: e.clientY,
          clickSelection: hit, baseSelection: st.sel, additive: true
        };
        redraw();
        return;
      }
      if (hit) {
        if (!selectionIncludesItem(st.sel, hit.type, hit.id)) st.sel = hit;
        beginSelectionMove(p);
        redraw();
        return;
      }
      st.sel = null;
      st.drag = {
        mode: 'lasso', points: [p], startX: e.clientX, startY: e.clientY,
        clickSelection: hit
      };
      redraw();
      return;
    }

    const textElement = e.target.closest && e.target.closest('[data-tid]');
    const hitText = textElement ? M.textItem(+textElement.getAttribute('data-tid')) : null;
    const hitA = M.nearAtom(p, 16), hitB = hitA ? null : M.nearBond(p, 9);
    const now = performance.now();
    const isTextDoubleClick = st.tool === 'select' && hitText && hitText.type !== 'arrow' && lastTextClick &&
      lastTextClick.id === hitText.id && now - lastTextClick.time < 500 &&
      Math.hypot(e.clientX - lastTextClick.x, e.clientY - lastTextClick.y) < 8;
    if (isTextDoubleClick) {
      lastTextClick = null;
      e.preventDefault();
      st.sel = { type: 'text', id: hitText.id };
      beginTextEdit(hitText, hitText.id);
      redraw();
      return;
    }
    lastTextClick = st.tool === 'select' && hitText
      ? { id: hitText.id, time: now, x: e.clientX, y: e.clientY }
      : null;
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}

    if (st.tool === 'text') {
      e.preventDefault();
      if (hitText && hitText.type !== 'arrow') {
        beginTextEdit(hitText, hitText.id);
        return;
      }
      st.sel = null;
      redraw();
      beginTextEdit(p);
      return;
    }
    if (st.tool === 'select') {
      if (additiveSelection) {
        const hit = hitText ? { type: 'text', id: hitText.id }
          : hitA ? { type: 'atom', id: hitA.id }
            : hitB ? { type: 'bond', id: hitB.id } : null;
        if (hit) {
          st.sel = toggleSelectionItem(st.sel, hit);
          redraw();
          hintSelectionCount();
          return;
        }
        st.drag = {
          mode: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y,
          startX: e.clientX, startY: e.clientY, baseSelection: st.sel, additive: true
        };
        redraw();
        return;
      }
      if (hitText) {
        if (isSelectedItem('text', hitText.id)) beginSelectionMove(p);
        else {
          st.sel = { type: 'text', id: hitText.id };
          M.beginTx(); st.changed = false;
          st.drag = { mode: 'move-text', id: hitText.id, last: p, moved: false };
        }
      } else if (hitA) {
        if (isSelectedItem('atom', hitA.id)) beginSelectionMove(p);
        else {
          st.sel = { type: 'atom', id: hitA.id };
          M.beginTx(); st.changed = false;
          st.drag = { mode: 'move', from: hitA.id, ids: Array.from(M.component(hitA.id)), last: p, moved: false };
        }
      } else if (hitB) {
        if (isSelectedItem('bond', hitB.id)) beginSelectionMove(p);
        else {
          st.sel = { type: 'bond', id: hitB.id };
          M.beginTx(); st.changed = false;
          st.drag = { mode: 'move', from: null, ids: [hitB.a, hitB.b], last: p, moved: false };
        }
      } else {
        st.sel = null;
        st.drag = { mode: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, startX: e.clientX, startY: e.clientY };
      }
      redraw(); return;
    }
    if (st.tool === 'bond' && hitB) {
      M.transact(() => applySelectedBondType(hitB.id), 'bond-order');
      return;
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
  function selectionIncludesItem(selection, type, id) {
    if (!selection) return false;
    if (selection.type === 'multi') {
      const key = type === 'atom' ? 'ids' : type === 'bond' ? 'bondIds' : 'textIds';
      return (selection[key] || []).includes(id);
    }
    return selection.type === type && selection.id === id;
  }
  function isSelectedItem(type, id) {
    return selectionIncludesItem(st.sel, type, id);
  }
  function beginSelectionMove(p) {
    const selection = st.sel;
    const ids = new Set(selection.type === 'multi' ? selection.ids || [] : []);
    const bondIds = selection.type === 'multi'
      ? selection.bondIds || []
      : selection.type === 'bond' ? [selection.id] : [];
    const textIds = selection.type === 'multi'
      ? selection.textIds || []
      : selection.type === 'text' ? [selection.id] : [];
    for (const bondId of bondIds) {
      const bond = M.bond(bondId);
      if (bond) { ids.add(bond.a); ids.add(bond.b); }
    }
    if (selection.type === 'atom') {
      for (const id of M.component(selection.id)) ids.add(id);
    }
    M.beginTx(); st.changed = false;
    st.drag = {
      mode: 'move-selection', ids: Array.from(ids), textIds: textIds.slice(),
      last: p, moved: false
    };
  }
  function moveSelectionItems(d, p) {
    const dx = p.x - d.last.x, dy = p.y - d.last.y;
    if (Math.abs(dx) + Math.abs(dy) <= 0.5) return;
    const movedIds = new Set(d.ids);
    const rings = M.S.rings.filter(ring => ring.atoms
      ? ring.atoms.every(id => movedIds.has(id))
      : d.ids.filter(id => {
        const atom = M.atom(id);
        return atom && Math.abs(Math.hypot(atom.x - ring.cx, atom.y - ring.cy) - ring.r) < 10;
      }).length >= 3);
    for (const id of d.ids) {
      const atom = M.atom(id);
      if (atom) { atom.x = Math.round((atom.x + dx) * 10) / 10; atom.y = Math.round((atom.y + dy) * 10) / 10; }
    }
    for (const ring of rings) { ring.cx += dx; ring.cy += dy; }
    for (const id of d.textIds || []) {
      const annotation = M.textItem(id);
      if (annotation) { annotation.x += dx; annotation.y += dy; }
    }
    d.last = p; d.moved = true; M.markTx(); redraw();
  }
  function applySelectedBondType(id) {
    const existing = M.bond(id);
    if (!existing) return null;
    if (existing.order === st.order && existing.style === st.bstyle) return M.cycleBondOrder(id);
    return M.setBondType(id, st.order, st.bstyle);
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
    if (d.mode === 'lasso') {
      const last = d.points[d.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2 / st.view.k) {
        d.points.push(p);
      }
      drawOverlay();
      return;
    }
    if (d.mode === 'chain') { d.cur = snapP(p); drawOverlay(); return; }
    if (d.mode === 'erase') { eraseAt(p); return; }
    if (d.mode === 'move-text') {
      const annotation = M.textItem(d.id);
      if (annotation) {
        const dx = p.x - d.last.x, dy = p.y - d.last.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) {
          annotation.x += dx; annotation.y += dy;
          d.last = p; d.moved = true; lastTextClick = null; M.markTx(); redraw();
        }
      }
      return;
    }
    if (d.mode === 'move' || d.mode === 'move-selection') {
      moveSelectionItems(d, p);
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
        if (!e.shiftKey) {
          const dx = target.x - A.x, dy = target.y - A.y, L = Math.hypot(dx, dy);
          if (L > 4) {
            const ang = nearestGridAngle(Math.atan2(dy, dx));
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
    if (d.mode === 'lasso') {
      if (e.type !== 'pointercancel') {
        const p = toWorld(e), last = d.points[d.points.length - 1];
        const moved = d.points.length > 1 || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
        if (!moved) st.sel = d.additive
          ? d.clickSelection ? toggleSelectionItem(d.baseSelection, d.clickSelection) : d.baseSelection
          : d.clickSelection;
        else {
          if (Math.hypot(p.x - last.x, p.y - last.y) >= 0.01) d.points.push(p);
          const selection = lassoSelection(d.points);
          st.sel = d.additive ? combineSelections(d.baseSelection, selection) : selection;
        }
      } else st.sel = d.additive ? d.baseSelection : null;
      redraw(); hintSelectionCount(); return;
    }
    if (d.mode === 'box') {
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1);
      const y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      const selection = moved ? boxSelection({ x0, y0, x1, y1 }) : null;
      st.sel = d.additive
        ? moved ? combineSelections(d.baseSelection, selection) : d.baseSelection
        : selection;
      redraw(); hintSelectionCount(); return;
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
    if (d.mode === 'move-text') { M.endTx(); if (d.moved) M.emit('change'); redraw(); return; }
    if (d.mode === 'move' || d.mode === 'move-selection') { M.endTx(); if (d.moved) M.emit('change'); redraw(); return; }
    if (d.mode === 'bond') {
      const A = M.atom(d.from);
      if (A && d.moved && d.cur) {
        const hit = M.nearAtom(d.cur, 14);
        if (hit && hit.id !== d.from) {
          const existing = M.S.bonds.find(bond =>
            (bond.a === d.from && bond.b === hit.id) || (bond.a === hit.id && bond.b === d.from)
          );
          if (existing) applySelectedBondType(existing.id);
          else M.addBond(d.from, hit.id, st.order, st.bstyle);
          M.markTx();
        }
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
  function pointInPolygon(point, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i];
      const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
      if (Math.abs(cross) < 0.01 &&
          point.x >= Math.min(a.x, b.x) - 0.01 && point.x <= Math.max(a.x, b.x) + 0.01 &&
          point.y >= Math.min(a.y, b.y) - 0.01 && point.y <= Math.max(a.y, b.y) + 0.01) return true;
      if ((b.y > point.y) !== (a.y > point.y) &&
          point.x < (a.x - b.x) * (point.y - b.y) / (a.y - b.y) + b.x) inside = !inside;
    }
    return inside;
  }
  function lassoSelection(points) {
    if (points.length < 3) return null;
    const ids = M.S.atoms.filter(atom => pointInPolygon(atom, points)).map(atom => atom.id);
    const bondIds = M.S.bonds.filter(bond => {
      const a = M.atom(bond.a), b = M.atom(bond.b);
      return a && b && pointInPolygon({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, points);
    }).map(bond => bond.id);
    const textIds = M.S.texts.filter(annotation => pointInPolygon(annotation, points)).map(annotation => annotation.id);
    return selectionFromItems(ids, bondIds, textIds);
  }
  function boxSelection(box) {
    const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1);
    const y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
    const inside = point => point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
    const ids = M.S.atoms.filter(inside).map(atom => atom.id);
    const bondIds = M.S.bonds.filter(bond => {
      const a = M.atom(bond.a), b = M.atom(bond.b);
      return a && b && inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }).map(bond => bond.id);
    const textIds = M.S.texts.filter(inside).map(annotation => annotation.id);
    return selectionFromItems(ids, bondIds, textIds);
  }
  function selectionFromItems(ids, bondIds, textIds) {
    const count = ids.length + bondIds.length + textIds.length;
    if (!count) return null;
    if (count === 1) {
      if (ids.length) return { type: 'atom', id: ids[0] };
      if (bondIds.length) return { type: 'bond', id: bondIds[0] };
      return { type: 'text', id: textIds[0] };
    }
    return { type: 'multi', ids, bondIds, textIds };
  }
  function selectionItems(selection) {
    if (!selection) return { ids: [], bondIds: [], textIds: [] };
    if (selection.type === 'atom') return { ids: [selection.id], bondIds: [], textIds: [] };
    if (selection.type === 'bond') return { ids: [], bondIds: [selection.id], textIds: [] };
    if (selection.type === 'text') return { ids: [], bondIds: [], textIds: [selection.id] };
    if (selection.type === 'multi') return {
      ids: selection.ids || [], bondIds: selection.bondIds || [], textIds: selection.textIds || []
    };
    return { ids: [], bondIds: [], textIds: [] };
  }
  function combineSelections(first, second) {
    const a = selectionItems(first), b = selectionItems(second);
    return selectionFromItems(
      Array.from(new Set([...a.ids, ...b.ids])),
      Array.from(new Set([...a.bondIds, ...b.bondIds])),
      Array.from(new Set([...a.textIds, ...b.textIds]))
    );
  }
  function toggleSelectionItem(selection, item) {
    const items = selectionItems(selection);
    const key = item.type === 'atom' ? 'ids' : item.type === 'bond' ? 'bondIds' : 'textIds';
    const ids = new Set(items[key]);
    if (ids.has(item.id)) ids.delete(item.id);
    else ids.add(item.id);
    items[key] = Array.from(ids);
    return selectionFromItems(items.ids, items.bondIds, items.textIds);
  }
  // Thông báo số đối tượng vừa được quét chọn (box/lasso/select-all).
  function hintSelectionCount() {
    const sel = st.sel;
    const items = selectionItems(sel);
    const n = items.ids.length + items.bondIds.length + items.textIds.length;
    if (n) setHint(text(
      'Đã chọn ' + n + ' đối tượng — kéo để di chuyển, nhấn R để xoay, Delete để xóa.',
      'Selected ' + n + ' item' + (n > 1 ? 's' : '') + ' — drag to move, press R to rotate, Delete to remove.'
    ));
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
    if (e.altKey && e.code === 'KeyR') {
      e.preventDefault();
      rotateSelection(e.shiftKey ? -Math.PI / 12 : Math.PI / 12, true);
      return;
    }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'c' && st.sel) {
      e.preventDefault();
      window.ChemExport.copyPNG(st.sel);
      return;
    }
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
    else if (k === 'r') rotateSelection(e.shiftKey ? -Math.PI / 12 : Math.PI / 12, false);
    else if (k === 'd') { if (window.ChemApp && ChemApp.actions['toggle-theme']) ChemApp.actions['toggle-theme'](); }
    else if (k === '0') fitView();
    else if (k === 'escape') {
      const hadTpl = st.tpl, hadSel = st.sel;
      st.tpl = null; st.sel = null; syncTplButtons(); redraw();
      if (hadTpl) setHint(text('Đã hủy mẫu đang chọn.', 'Cleared the selected template.'));
      else if (hadSel) setHint(text('Đã bỏ chọn.', 'Selection cleared.'));
    }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  }
  function onKeyUp(e) { if (e.key === ' ') { st.space = false; stage.classList.remove('panning'); } }
  function onDblClick(e) {
    if (st.tool === 'select' && st.selectionMode === 'lasso') return;
    const textElement = e.target.closest && e.target.closest('[data-tid]');
    const annotation = textElement ? M.textItem(+textElement.getAttribute('data-tid')) : null;
    if (annotation && annotation.type !== 'arrow') {
      e.preventDefault();
      st.sel = { type: 'text', id: annotation.id };
      beginTextEdit(annotation, annotation.id);
      redraw();
      return;
    }
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
    stage.style.cursor = t === 'pan' ? 'grab' : t === 'select' && st.selectionMode !== 'lasso' ? 'default' : 'crosshair';
    syncTplButtons(); redraw();
    const tips = {
      select: text('Nhấn để chọn, kéo vùng để quét chọn nhiều; Ctrl + kéo để cộng vùng, Ctrl + nhấn để thêm/bỏ đối tượng; Ctrl+C sao chép vùng chọn thành PNG.', 'Click to select or drag a box; Ctrl+drag adds a region, Ctrl+click toggles an item, and Ctrl+C copies the selection as PNG.'),
      pan: text('Kéo để di chuyển khung nhìn; cuộn chuột để phóng to/thu nhỏ (phím 0: vừa khung).', 'Drag to pan; scroll to zoom (key 0: fit to view).'),
      atom: text('Nhấn hoặc kéo trên khung vẽ để đặt "' + st.el + '" và nối liên kết.', 'Click or drag on the canvas to place "' + st.el + '" and bond it.'),
      bond: text('Kéo giữa hai nguyên tử để vẽ liên kết; nhấn 1–5 để đổi loại liên kết.', 'Drag between two atoms to draw a bond; press 1–5 to change the bond type.'),
      erase: text('Nhấn hoặc kéo qua đối tượng để xóa.', 'Click or drag over objects to erase them.'),
      chain: text('Kéo trên khung vẽ để vẽ mạch zigzag carbon.', 'Drag on the canvas to draw a zig-zag carbon chain.'),
      text: text('Nhấn lên khung vẽ để nhập chú thích.', 'Click on the canvas to insert an annotation.')
    };
    if (tips[t]) setHint(tips[t]);
  }
  function setSelectionMode(mode) {
    if (mode !== 'select' && mode !== 'lasso') throw new Error(`Unsupported selection mode: ${mode}`);
    st.selectionMode = mode;
    const setting = document.getElementById('settingsSelectionMode');
    if (setting) setting.value = mode;
    if (!stage) return;
    setTool('select');
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
    const bondLabel = st.bstyle === 'wedge'
      ? text('nét đậm', 'wedge bond')
      : st.bstyle === 'hash'
        ? text('nét đứt', 'hashed bond')
        : st.order === 3 ? text('liên kết ba', 'triple bond')
        : st.order === 2 ? text('liên kết đôi', 'double bond')
        : text('liên kết đơn', 'single bond');
    setHint(text(
      'Đang chọn ' + bondLabel + ' — kéo giữa hai nguyên tử để vẽ; nhấn lên liên kết đang có để đổi kiểu.',
      'Selected ' + bondLabel + ' — drag between two atoms to draw; click an existing bond to change its type.'
    ));
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
    st.tplRotation = 0;
    st.tplRotateAt = 0;
    if (tplRotateTimer) { clearTimeout(tplRotateTimer); tplRotateTimer = null; }
    if (st.tpl) { st.tool = 'select'; document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === 'select')); }
    syncTplButtons(); redraw();
    if (st.tpl) {
      const name = window.ChemI18n ? window.ChemI18n.name(st.tpl) : st.tpl;
      setHint(text('Nhấn lên khung vẽ để đặt "' + name + '" — R/Shift+R để xoay, đặt gần vòng khác để hàn chung cạnh. Nhấn mẫu lần nữa hoặc Esc để hủy.', 'Click the canvas to place "' + name + '" — press R/Shift+R to rotate, place near another ring to fuse a shared edge. Click the template again or press Esc to cancel.'));
    }
  }
  function syncTplButtons() {
    document.querySelectorAll('.tpl').forEach(b => b.classList.toggle('active', b.dataset.frag === st.tpl));
  }
  function selectAll() {
    const ids = M.S.atoms.map(a => a.id);
    st.sel = selectionFromItems(ids, M.S.bonds.map(bond => bond.id), M.S.texts.map(annotation => annotation.id));
    redraw();
    hintSelectionCount();
  }
  function deleteSel() {
    const s = st.sel; if (!s) return;
    M.transact(() => {
      if (s.type === 'atom') M.removeAtom(s.id);
      else if (s.type === 'bond') M.removeBond(s.id);
      else if (s.type === 'text') M.removeText(s.id);
      else if (s.ids) {
        s.ids.forEach(id => M.removeAtom(id));
        (s.bondIds || []).forEach(id => M.removeBond(id));
        (s.textIds || []).forEach(id => M.removeText(id));
      }
    }, 'delete');
    st.sel = null; redraw();
    setHint(text('Đã xóa đối tượng đã chọn — Ctrl+Z để hoàn tác.', 'Deleted the selected items — press Ctrl+Z to undo.'));
  }
  function hintRotate(angle, whole) {
    const deg = Math.round(Math.abs(angle) * 180 / Math.PI);
    const dir = angle < 0
      ? text('ngược chiều kim đồng hồ', 'counterclockwise')
      : text('theo chiều kim đồng hồ', 'clockwise');
    setHint(whole
      ? text('Đã xoay toàn bộ cấu trúc ' + deg + '° ' + dir + '. Alt+R để xoay tiếp.', 'Rotated the whole structure ' + deg + '° ' + dir + '. Press Alt+R to rotate again.')
      : text('Đã xoay ' + deg + '° ' + dir + ' — nhấn R / Shift+R để xoay tiếp, Alt+R xoay cả phân tử.', 'Rotated ' + deg + '° ' + dir + ' — press R / Shift+R to rotate again, Alt+R for the whole molecule.'));
  }
  function rotateSelection(angle, wholeComponent) {
    if (st.tpl) {
      const step = Math.PI / 12;
      st.tplRotation += Math.sign(angle || 1) * step;
      st.tplRotateAt = Date.now();
      redraw();
      // Tự ẩn nhãn góc xoay sau ~2s không thao tác bằng cách vẽ lại.
      if (tplRotateTimer) clearTimeout(tplRotateTimer);
      tplRotateTimer = setTimeout(() => { if (st.tpl) redraw(); }, 2000);
      const name = window.ChemI18n ? window.ChemI18n.name(st.tpl) : st.tpl;
      setHint(text(
        `Đã xoay mẫu "${name}" ${angle < 0 ? 'ngược chiều kim đồng hồ' : 'theo chiều kim đồng hồ'} ${Math.round(step * 180 / Math.PI)}°. Nhấn lên khung vẽ để đặt.`,
        `Rotated "${name}" ${angle < 0 ? 'counterclockwise' : 'clockwise'} by ${Math.round(step * 180 / Math.PI)}°. Click the canvas to place it.`
      ));
      return true;
    }
    if (!st.sel) return false;
    let ids;
    if (st.sel.type === 'bond') {
      const bond = M.bond(st.sel.id);
      if (!bond) return false;
      ids = branchBySide(bond);
      if (!ids) {
        setHint(text('Liên kết nằm trong vòng; hãy quét chọn các nguyên tử cần xoay.', 'Bond is in a ring; box-select the atoms to rotate.'));
        return true;
      }
    } else if (st.sel.type === 'atom') {
      const pivot = M.atom(st.sel.id);
      if (!pivot) return false;
      if (wholeComponent) {
        const ids = M.component(pivot.id);
        M.transact(() => rotateAtomGroup(Array.from(ids).map(id => M.atom(id)), angle, pivot, ids), 'rotate');
        redraw();
        hintRotate(angle, true);
        return true;
      }
      const ringIds = ringGroupForAtom(pivot.id);
      if (ringIds) {
        const ids = ringGroupWithBranches(ringIds);
        const outside = M.S.bonds.filter(bond => ids.has(bond.a) !== ids.has(bond.b));
        if (outside.length > 1) {
          setHint(text(
            'Vòng và nhánh nối ra ngoài qua nhiều liên kết; hãy chọn một liên kết để xoay nhánh.',
            'The ring and its branches have several outside bonds; select one bond to rotate a branch.'
          ));
          return true;
        }
        const center = outside.length
          ? M.atom(ids.has(outside[0].a) ? outside[0].b : outside[0].a)
          : pivot;
        M.transact(() => rotateAtomGroup(Array.from(ids).map(id => M.atom(id)), angle, center, ids), 'rotate');
        redraw();
        hintRotate(angle, false);
        return true;
      }
      const neighbors = M.neighbors(pivot.id);
      if (!neighbors.length) {
        setHint(text('Nguyên tử này không có nhánh rời để xoay.', 'This atom has no separate branch to rotate.'));
        return true;
      }
      const parent = neighbors
        .map(id => ({
          id,
          size: componentWithoutBond(id, { a: pivot.id, b: id }).size
        }))
        .sort((a, b) => b.size - a.size)[0];
      const edge = { a: pivot.id, b: parent.id };
      const ids = componentWithoutBond(pivot.id, edge);
      if (ids.has(parent.id)) {
        const component = M.component(pivot.id);
        M.transact(() => rotateAtomGroup(
          Array.from(component).map(id => M.atom(id)),
          angle,
          pivot,
          component
        ), 'rotate');
        redraw();
        hintRotate(angle, true);
        return true;
      }
      M.transact(() => rotateAtomGroup(
        Array.from(ids).map(id => M.atom(id)),
        angle,
        M.atom(parent.id),
        ids
      ), 'rotate');
      redraw();
      hintRotate(angle, false);
      return true;
    } else ids = new Set(st.sel.ids || []);
    ids = new Set(Array.from(ids).filter(id => M.atom(id)));
    if (!ids.size) return false;

    const links = M.S.bonds.filter(bond => ids.has(bond.a) !== ids.has(bond.b));
    let pivot = null;
    if (links.length === 1) pivot = M.atom(ids.has(links[0].a) ? links[0].b : links[0].a);
    else if (links.length > 1) {
      setHint(text(
        'Vùng chọn nối với phần còn lại qua nhiều liên kết; xoay sẽ làm méo cấu trúc.',
        'Selection has several outside bonds; rotating would distort it.'
      ));
      return true;
    } else if (ids.size < 2) {
      setHint(text('Nguyên tử này không gắn với cấu trúc nào để xoay.', 'This isolated atom has nothing to rotate.'));
      return true;
    }

    M.transact(() => rotateAtomGroup(Array.from(ids).map(id => M.atom(id)), angle, pivot, ids), 'rotate');
    redraw();
    hintRotate(angle, false);
    return true;
  }
  function ringGroupForAtom(atomId) {
    const rings = M.S.rings.map(ring => {
      const ids = ringAtomIds(ring);
      return { ring, ids };
    }).filter(item => item.ids.size >= 3);
    const included = new Set(rings.filter(item => item.ids.has(atomId)));
    if (!included.size) return null;
    const ids = new Set();
    for (const item of included) item.ids.forEach(id => ids.add(id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of rings) {
        if (included.has(item) || !Array.from(item.ids).some(id => ids.has(id))) continue;
        included.add(item);
        item.ids.forEach(id => ids.add(id));
        changed = true;
      }
    }
    return ids;
  }
  function ringAtomIds(ring) {
    return ring.atoms
      ? new Set(ring.atoms.filter(id => M.atom(id)))
      : new Set(M.S.atoms
        .filter(atom => Math.abs(Math.hypot(atom.x - ring.cx, atom.y - ring.cy) - ring.r) < 10)
        .map(atom => atom.id));
  }
  function ringGroupWithBranches(ringIds) {
    const allRingIds = new Set();
    for (const ring of M.S.rings) ringAtomIds(ring).forEach(id => allRingIds.add(id));
    const ids = new Set(ringIds), queue = Array.from(ringIds);
    while (queue.length) {
      for (const neighbor of M.neighbors(queue.pop())) {
        if (ids.has(neighbor) || allRingIds.has(neighbor)) continue;
        ids.add(neighbor);
        queue.push(neighbor);
      }
    }
    return ids;
  }
  function componentWithoutBond(start, bond) {
    const seen = new Set([start]), queue = [start];
    while (queue.length) {
      const current = queue.pop();
      for (const neighbor of M.neighbors(current)) {
        if ((current === bond.a && neighbor === bond.b) || (current === bond.b && neighbor === bond.a)) continue;
        if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
    }
    return seen;
  }
  function branchBySide(bond) {
    const sideA = componentWithoutBond(bond.a, bond);
    if (sideA.has(bond.b)) return null;
    const sideB = componentWithoutBond(bond.b, bond);
    return sideA.size <= sideB.size ? sideA : sideB;
  }
  function rotatePoint(point, angle, center) {
    const x = point.x - center.x, y = point.y - center.y;
    return {
      x: Math.round((center.x + Math.cos(angle) * x - Math.sin(angle) * y) * 10) / 10,
      y: Math.round((center.y + Math.sin(angle) * x + Math.cos(angle) * y) * 10) / 10
    };
  }
  function rotateAtomGroup(atoms, angle, pivot, ids) {
    if (!atoms.length) return;
    const center = pivot || {
      x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length,
      y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length
    };
    const atomIds = ids || new Set(atoms.map(atom => atom.id));
    const rings = M.S.rings.filter(ring => ring.atoms
      ? ring.atoms.every(id => atomIds.has(id))
      : atoms.filter(atom => Math.abs(Math.hypot(atom.x - ring.cx, atom.y - ring.cy) - ring.r) < 10).length >= 3);
    for (const atom of atoms) Object.assign(atom, rotatePoint(atom, angle, center));
    for (const ring of rings) {
      const centerPoint = rotatePoint({ x: ring.cx, y: ring.cy }, angle, center);
      ring.cx = centerPoint.x;
      ring.cy = centerPoint.y;
    }
  }
  // Xoay cấu trúc khi đổi hướng lưới tam giác. MỖI thành phần liên thông tự
  // xoay quanh tâm của CHÍNH NÓ → phân tử riêng lẻ giữ nguyên vị trí tuyệt đối
  // (chỉ đổi hướng); thành phần nối với nhau xoay cùng nhau như một khối.
  function rotateAllComponents(angle) {
    const atoms = M.S.atoms;
    if (!atoms.length) return;
    M.transact(() => {
      const seen = new Set();
      for (const seed of atoms) {
        if (seen.has(seed.id)) continue;
        const ids = M.component(seed.id);
        ids.forEach(id => seen.add(id));
        const group = Array.from(ids).map(id => M.atom(id)).filter(Boolean);
        if (!group.length) continue;
        const center = {
          x: group.reduce((sum, atom) => sum + atom.x, 0) / group.length,
          y: group.reduce((sum, atom) => sum + atom.y, 0) / group.length
        };
        rotateAtomGroup(group, angle, center, ids);
      }
      // Chú thích (texts) giữ nguyên vị trí tuyệt đối — chữ luôn nằm ngang,
      // không có hướng để xoay.
    }, 'grid-orientation');
    redraw();
  }
  function toggleGrid() {
    st.grid = !st.grid;
    updateGrid();
    notifySettingsChanged();
  }
  function toggleGridType() {
    st.gridType = st.gridType === 'square' ? 'triangle' : 'square';
    updateGrid();
    notifySettingsChanged();
  }
  function toggleSnap() { st.snap = !st.snap; updateGridStatus(); notifySettingsChanged(); }
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
    wrap = document.getElementById('canvasWrap');
    textInput = document.getElementById('canvasTextInput');
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
    textInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finishTextEdit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finishTextEdit(false); }
    });
    textInput.addEventListener('input', () => {
      if (textEdit) textInput.style.width = `${Math.max(84, textInput.value.length * (parseFloat(document.getElementById('optFont').value) || 20) * st.view.k * 0.62 + 24)}px`;
    });
    textInput.addEventListener('blur', () => finishTextEdit(!!textInput.value.trim()));
    window.addEventListener('resize', positionTextInput);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    M.onChange(what => {
      st.sel = what === 'open' ? null : normalizeSelection(st.sel);
      redraw();
    });
    const r = stage.getBoundingClientRect();
    st.view.x = r.width / 2; st.view.y = r.height / 2;
    applyView(); redraw();
    setTimeout(() => setHint(text('Chào mừng! Nhấn mẫu ⬡ Benzen bên trái rồi nhấn vào khung vẽ.', 'Welcome! Select the ⬡ Benzene template on the left, then click the canvas.')), 400);
    setTimeout(() => { const h = document.getElementById('hint'); if (h) h.classList.add('hide'); }, 7000);
  }
  return {
    st, init, redraw, applyView, setTool, setSelectionMode, setBond, setElement, setTemplate,
    selectAll, deleteSel, rotateSelection, toggleGrid, toggleGridType, toggleGridOrientation, toggleSnap, updateGrid, zoomBtn, fitView, setHint, placeTemplate, applySugarAnomer,
    setSettingsObserver
  };
})();