'use strict';
/* export.js — Xuất file SVG / PNG, sao chép mã SVG, lưu/mở JSON. */
window.ChemExport = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function standaloneSVG() {
    const M = window.ChemModel, R = window.ChemRender;
    const world = document.getElementById('world');
    const box = M.bbox(36) || { x: -200, y: -150, w: 400, h: 300 };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', `${r1(box.x)} ${r1(box.y)} ${r1(box.w)} ${r1(box.h)}`);
    svg.setAttribute('width', Math.round(box.w)); svg.setAttribute('height', Math.round(box.h));
    const transparent = document.getElementById('optTransparent').checked;
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
    src.querySelectorAll('.sel-ring, .hit, .handle, circle[fill="rgba(0,0,0,0)"]').forEach(n => n.remove());
    g.innerHTML = src.innerHTML
      .replace(/ class="(bond|atom-dot|atom-label|arom-circle|canvas-text)"/g, '')
      .replace(/ data-[a-z]+="[^"]*"/g, '');
    svg.appendChild(g);
    let code = new XMLSerializer().serializeToString(svg);
    code = '<?xml version="1.0" encoding="UTF-8"?>\n' + code;
    return { code, box };
  }
  const r1 = v => Math.round(v * 10) / 10;
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function exportSVG() { const { code } = standaloneSVG(); download('cong-thuc.svg', code, 'image/svg+xml'); return code; }
  function copySVG() {
    const { code } = standaloneSVG();
    const done = () => window.ChemApp.toast('Đã sao chép mã SVG vào clipboard ✓');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(() => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
    return code;
  }
  function exportPNG(scale) {
    const { code, box } = standaloneSVG();
    const k = scale || 3;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([code], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(box.w * k); c.height = Math.round(box.h * k);
      const ctx = c.getContext('2d');
      if (!document.getElementById('optTransparent').checked) { ctx.fillStyle = document.getElementById('optBg').value; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a'); a.download = 'cong-thuc.png'; a.href = c.toDataURL('image/png');
      document.body.appendChild(a); a.click(); a.remove();
      window.ChemApp.toast('Đã xuất ảnh PNG ✓');
    };
    img.onerror = () => window.ChemApp.toast('Xuất PNG thất bại trên trình duyệt này.');
    img.src = url;
  }
  function saveJSON() { download('phan-tu.json', window.ChemModel.serialize(), 'application/json'); }
  function refreshCodeView() {
    const pane = document.getElementById('pane-svg');
    if (pane && !pane.classList.contains('active')) return; // chỉ cập nhật khi tab Mã SVG đang mở
    const { code } = standaloneSVG();
    document.getElementById('svgCode').textContent = code;
  }
  return { standaloneSVG, exportSVG, copySVG, exportPNG, saveJSON, refreshCodeView };
})();
