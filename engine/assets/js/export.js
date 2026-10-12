'use strict';
/* export.js — Xuất file SVG / PNG, sao chép mã SVG, lưu/mở JSON. */
window.ChemExport = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function selectionItems(selection) {
    if (!selection) return null;
    if (selection.type === 'atom') return { atoms: [selection.id], bonds: [], texts: [] };
    if (selection.type === 'bond') return { atoms: [], bonds: [selection.id], texts: [] };
    if (selection.type === 'text') return { atoms: [], bonds: [], texts: [selection.id] };
    if (selection.type === 'multi') return {
      atoms: selection.ids || [], bonds: selection.bondIds || [], texts: selection.textIds || []
    };
    return null;
  }
  // Lề xuất ảnh (px) theo 4 phía, đọc từ settings; mặc định 36 như trước.
  function margins() {
    const read = (id, fallback) => {
      const input = document.getElementById(id);
      const value = parseFloat(input && input.value);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    return {
      top: read('optMarginTop', 36), bottom: read('optMarginBottom', 36),
      left: read('optMarginLeft', 36), right: read('optMarginRight', 36)
    };
  }
  // Phạm vi thô (không lề) của các đối tượng được chọn.
  function selectionExtent(model, items) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const include = (x, y) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    for (const id of items.atoms) {
      const atom = model.atom(id);
      if (atom) include(atom.x, atom.y);
    }
    for (const id of items.bonds) {
      const bond = model.bond(id);
      if (!bond) continue;
      const a = model.atom(bond.a), b = model.atom(bond.b);
      if (a && b) { include(a.x, a.y); include(b.x, b.y); }
    }
    for (const id of items.texts) {
      const annotation = model.textItem(id);
      if (!annotation) continue;
      const size = annotation.fontSize || 20;
      if (annotation.type === 'arrow') {
        const width = Math.max(annotation.width || 96, Math.max((annotation.above || '').length, (annotation.below || '').length) * size * 0.6);
        include(annotation.x - width / 2, annotation.y - (annotation.above ? size : 12));
        include(annotation.x + width / 2, annotation.y + (annotation.below ? size : 12));
      } else {
        const width = (annotation.text || '').length * size * 0.6;
        include(annotation.x - width / 2, annotation.y - size / 2);
        include(annotation.x + width / 2, annotation.y + size / 2);
      }
    }
    if (!Number.isFinite(x0)) throw new Error('The selected objects are no longer available.');
    return { x0, y0, x1, y1 };
  }
  // Từ phạm vi thô + lề → hộp xuất {x,y,w,h}. Lề = 0 ⇒ phân tử sát mép khung.
  function boxFromExtent(ext, m) {
    return {
      x: ext.x0 - m.left, y: ext.y0 - m.top,
      w: Math.max(10, (ext.x1 - ext.x0) + m.left + m.right),
      h: Math.max(10, (ext.y1 - ext.y0) + m.top + m.bottom)
    };
  }
  // Phạm vi thô của TOÀN khung vẽ (mọi nguyên tử + chú thích), không áp dụng
  // mức tối thiểu 10px như M.bbox — để cộng lề sau cho khớkkhớp hành vi cũ.
  function fullExtent(model) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const include = (x, y) => {
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    };
    for (const atom of model.S.atoms) include(atom.x, atom.y);
    for (const t of model.S.texts) {
      const size = t.fontSize || 20;
      if (t.type === 'arrow') {
        const width = Math.max(t.width || 96, Math.max((t.above || '').length, (t.below || '').length) * size * 0.6);
        include(t.x - width / 2, t.y - (t.above ? size : 12));
        include(t.x + width / 2, t.y + (t.below ? size : 12));
      } else {
        const width = (t.text || '').length * size * 0.6;
        include(t.x - width / 2, t.y - size / 2);
        include(t.x + width / 2, t.y + size / 2);
      }
    }
    if (!Number.isFinite(x0)) return null;
    return { x0, y0, x1, y1 };
  }
  // Hộp sẽ được xuất cho một lựa chọn (selection === undefined ⇒ toàn khung).
  // Dùng cho cả overlay xem trước trên canvas và standaloneSVG.
  function exportFrame(selection) {
    const M = window.ChemModel;
    const m = margins();
    const items = selection === undefined ? null : selectionItems(selection);
    if (items) return boxFromExtent(selectionExtent(M, items), m);
    const ext = fullExtent(M) || { x0: -200, y0: -150, x1: 200, y1: 150 };
    return boxFromExtent(ext, m);
  }
  function standaloneSVG(selection) {
    const M = window.ChemModel, R = window.ChemRender;
    const world = document.getElementById('world');
    const items = selection === undefined ? null : selectionItems(selection);
    if (selection !== undefined && !items) throw new Error('The selection cannot be exported.');
    const box = exportFrame(selection);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', `${r1(box.x)} ${r1(box.y)} ${r1(box.w)} ${r1(box.h)}`);
    svg.setAttribute('width', Math.round(box.w)); svg.setAttribute('height', Math.round(box.h));
    const transparent = document.getElementById('optTransparent').value === 'enabled';
    if (!transparent) {
      const bg = document.createElementNS(NS, 'rect');
      const c = document.getElementById('optBg').value;
      bg.setAttribute('x', r1(box.x)); bg.setAttribute('y', r1(box.y));
      bg.setAttribute('width', r1(box.w)); bg.setAttribute('height', r1(box.h)); bg.setAttribute('fill', c);
      svg.appendChild(bg);
    }
    const title = document.createElementNS(NS, 'title'); title.textContent = 'Công thức khung — Chemistry Workspace'; svg.appendChild(title);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
    const src = world.cloneNode(true);
    // Bỏ các phần hiển thị tạm thời: vùng chọn, nét hit vô hình, vòng chọn.
    src.querySelectorAll('.sel-ring, .valence-warning, .hit, .handle, circle[fill="rgba(0,0,0,0)"]').forEach(n => n.remove());
    if (items) {
      const atomIds = new Set(items.atoms.map(String));
      const bondIds = new Set(items.bonds.map(String));
      const textIds = new Set(items.texts.map(String));
      src.querySelectorAll('[data-aid]').forEach(node => {
        if (!atomIds.has(node.getAttribute('data-aid'))) node.remove();
      });
      src.querySelectorAll('[data-bid]').forEach(node => {
        if (!bondIds.has(node.getAttribute('data-bid'))) node.remove();
      });
      src.querySelectorAll('[data-tid]').forEach(node => {
        if (!textIds.has(node.getAttribute('data-tid'))) node.remove();
      });
      const selectedAtoms = new Set(items.atoms);
      src.querySelectorAll('[data-ring-id]').forEach(node => {
        const ring = M.S.rings.find(item => String(item.id) === node.getAttribute('data-ring-id'));
        const ringAtoms = ring && Array.isArray(ring.atoms) && ring.atoms.length
          ? ring.atoms
          : ring ? M.S.atoms.filter(atom => Math.abs(Math.hypot(atom.x - ring.cx, atom.y - ring.cy) - ring.r) < 6).map(atom => atom.id) : [];
        if (!ringAtoms.length || !ringAtoms.every(id => selectedAtoms.has(id))) node.remove();
      });
    }
    g.innerHTML = src.innerHTML
      .replace(/ class="(bond|atom-dot|atom-label|arom-circle|canvas-text)"/g, '')
      .replace(/ data-[a-z]+="[^"]*"/g, '');
    svg.appendChild(g);
    let code = new XMLSerializer().serializeToString(svg);
    code = '<?xml version="1.0" encoding="UTF-8"?>\n' + code;
    return { code, box };
  }
  const r1 = v => Math.round(v * 10) / 10;
  function message(vi, en) {
    return window.ChemI18n ? window.ChemI18n.text(vi, en) : vi;
  }
  function notify(vi, en) {
    if (window.ChemApp) window.ChemApp.toast(message(vi, en));
  }
  function renderPNGBlob(scale, selection) {
    const { code, box } = standaloneSVG(selection);
    const k = scale || 3;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([code], { type: 'image/svg+xml;charset=utf-8' }));
      const release = () => URL.revokeObjectURL(url);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(box.w * k);
          canvas.height = Math.round(box.h * k);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Unable to create a canvas context for PNG rendering.');
          if (document.getElementById('optTransparent').value !== 'enabled') {
            ctx.fillStyle = document.getElementById('optBg').value;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          release();
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('The browser could not encode the drawing as PNG.'));
          }, 'image/png');
        } catch (error) {
          release();
          reject(error);
        }
      };
      img.onerror = () => {
        release();
        reject(new Error('The browser could not render the drawing SVG as an image.'));
      };
      img.src = url;
    });
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function exportSVG() { const { code } = standaloneSVG(); download('chemistry.svg', code, 'image/svg+xml'); return code; }
  function copySVG() {
    const { code } = standaloneSVG();
    const done = () => window.ChemApp.toast('Đã sao chép mã SVG vào clipboard ✓');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(() => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
    return code;
  }
  function exportPNG(scale) {
    renderPNGBlob(scale).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'chemistry.png';
      a.href = url;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
      notify('Đã xuất ảnh PNG ✓', 'PNG image exported ✓');
    }).catch(error => {
      console.warn('Unable to export the drawing as PNG.', error);
      notify('Xuất PNG thất bại trên trình duyệt này.', 'PNG export failed in this browser.');
    });
  }
  function copyPNG(selection) {
    if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) {
      notify('Trình duyệt không hỗ trợ sao chép ảnh vào clipboard.', 'This browser does not support copying images to the clipboard.');
      return;
    }
    try {
      const png = renderPNGBlob(3, selection);
      navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(() => {
        notify('Đã sao chép ảnh PNG — bạn có thể dán vào ứng dụng khác.', 'PNG image copied — you can paste it into another app.');
      }).catch(error => {
        console.warn('Unable to copy the drawing image to the clipboard.', error);
        notify('Không thể sao chép ảnh. Hãy kiểm tra quyền clipboard của trình duyệt.', 'Unable to copy the image. Check the browser clipboard permission.');
      });
    } catch (error) {
      console.warn('Unable to prepare the drawing image for the clipboard.', error);
      notify('Không thể sao chép ảnh. Hãy kiểm tra quyền clipboard của trình duyệt.', 'Unable to copy the image. Check the browser clipboard permission.');
    }
  }
  function saveJSON() { download('chemistry.json', window.ChemModel.serialize(), 'application/json'); }
  function refreshCodeView() {
    const pane = document.getElementById('pane-svg');
    if (pane && !pane.classList.contains('active')) return; // chỉ cập nhật khi tab Mã SVG đang mở
    const { code } = standaloneSVG();
    document.getElementById('svgCode').textContent = code;
  }
  return { standaloneSVG, exportSVG, copySVG, exportPNG, copyPNG, saveJSON, refreshCodeView, exportFrame };
})();
