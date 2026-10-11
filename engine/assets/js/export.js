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
  function renderPNGBlob(scale) {
    const { code, box } = standaloneSVG();
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
  function copyPNG() {
    if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) {
      notify('Trình duyệt không hỗ trợ sao chép ảnh vào clipboard.', 'This browser does not support copying images to the clipboard.');
      return;
    }
    try {
      const png = renderPNGBlob(3);
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
  return { standaloneSVG, exportSVG, copySVG, exportPNG, copyPNG, saveJSON, refreshCodeView };
})();
