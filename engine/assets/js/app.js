'use strict';
/* app.js — Nối giao diện: menu, toolbar, panel thuộc tính, mẫu, xuất file. */
window.ChemApp = (() => {
  const M = window.ChemModel, Ed = window.ChemEditor, T = window.ChemTemplates, X = window.ChemExport, Th = window.ChemTheme;

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function showModal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalBack').classList.add('show');
  }
  function closeModal() { document.getElementById('modalBack').classList.remove('show'); }

  // ---------- Giao diện sáng / tối ----------
  function syncThemeBtn() {
    const b = document.getElementById('themeBtn');
    if (b) b.textContent = Th.isDark() ? '☀' : '☾';
  }
  // ---------- Ảnh đại diện (lưu cục bộ trên máy) ----------
  function paintAvatar(el) {
    if (!el) return;
    let data = '';
    try { data = localStorage.getItem('chem-avatar') || ''; } catch (e) {}
    if (data) {
      el.textContent = '';
      el.style.backgroundImage = 'url(' + data + ')';
      el.classList.add('has-img');
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has-img');
      el.textContent = 'H';
    }
  }
  function avatarModal() {
    const btn = document.getElementById('avatarBtn');
    paintAvatar(btn);
    showModal('Ảnh đại diện', `
      <div class="ava-wrap"><span class="avatar big" id="avaPrev"></span></div>
      <p class="muted">Ảnh được cắt vuông, thu nhỏ và <b>lưu ngay trên máy bạn</b> (localStorage) — không tải lên mạng.</p>
      <div class="btnrow">
        <button class="btn primary" id="avaPick">Chọn ảnh từ máy…</button>
        <button class="btn" id="avaDel">Xóa ảnh</button>
        <button class="btn" id="avaClose">Đóng</button>
      </div>`);
    const prev = document.getElementById('avaPrev');
    paintAvatar(prev);
    document.getElementById('avaPick').onclick = () => document.getElementById('avatarFile').click();
    document.getElementById('avaDel').onclick = () => {
      try { localStorage.removeItem('chem-avatar'); } catch (e) {}
      paintAvatar(btn); paintAvatar(prev);
      toast('Đã xóa ảnh đại diện');
    };
    document.getElementById('avaClose').onclick = closeModal;
  }
  function readAvatar(file) {
    if (!/^image\//.test(file.type)) { toast('Vui lòng chọn file ảnh (PNG/JPG…).'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Ảnh quá lớn — tối đa 5MB.'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        let data = rd.result;
        try {
          // Cắt vuông giữa + thu nhỏ 160×160 để nhẹ bộ nhớ trình duyệt.
          const S = 160, c = document.createElement('canvas');
          c.width = c.height = S;
          const ctx = c.getContext('2d');
          if (ctx) {
            const side = Math.min(img.width, img.height) || S;
            ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
            data = c.toDataURL('image/png');
          }
        } catch (e) {}
        try { localStorage.setItem('chem-avatar', data); }
        catch (e) { toast('Không đủ dung lượng bộ nhớ để lưu ảnh.'); return; }
        paintAvatar(document.getElementById('avatarBtn'));
        const prev = document.getElementById('avaPrev');
        if (prev) paintAvatar(prev);
        toast('Đã cập nhật ảnh đại diện ✓');
      };
      img.onerror = () => toast('Không đọc được file ảnh này.');
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  function worldCenter() {
    const stage = document.getElementById('stage');
    const r = stage.getBoundingClientRect(), v = Ed.st.view;
    return { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k };
  }
  function place(name, off) {
    const f = T.byName(name); if (!f) return;
    const c = worldCenter();
    Ed.placeTemplate(f, { x: c.x + (off ? off.x : 0), y: c.y + (off ? off.y : 0) });
    Ed.redraw();
  }
  function newDoc() {
    if (M.S.atoms.length && !confirm('Xóa toàn bộ khung vẽ hiện tại?')) return;
    M.transact(() => M.clearAll(), 'clear');
    Ed.st.sel = null; Ed.redraw();
    toast('Đã tạo khung vẽ mới');
  }
  const actions = {
    new: newDoc,
    open: () => document.getElementById('fileOpen').click(),
    'save-json': () => { X.saveJSON(); toast('Đã lưu file .json ✓'); },
    'export-svg': () => { X.exportSVG(); toast('Đã xuất file .svg ✓'); },
    'export-png': () => X.exportPNG(),
    'copy-svg': () => X.copySVG(),
    'refresh-svg': () => { X.refreshCodeView(); toast('Đã làm mới mã SVG'); },
    undo: () => { M.undo(); Ed.redraw(); },
    redo: () => { M.redo(); Ed.redraw(); },
    'select-all': () => Ed.selectAll(),
    delete: () => Ed.deleteSel(),
    'rotate-left': () => { if (!Ed.rotateSelection(-Math.PI / 6)) toast('Chọn một nguyên tử hoặc liên kết trước khi xoay.'); },
    'rotate-right': () => { if (!Ed.rotateSelection(Math.PI / 6)) toast('Chọn một nguyên tử hoặc liên kết trước khi xoay.'); },
    fit: () => Ed.fitView(),
    'zoom-in': () => Ed.zoomBtn(1.25),
    'zoom-out': () => Ed.zoomBtn(0.8),
    'zoom-100': () => { const s = document.getElementById('stage'); const r = s.getBoundingClientRect(); Ed.st.view = { x: r.width / 2, y: r.height / 2, k: 1 }; Ed.applyView(); },
    'toggle-grid': () => Ed.toggleGrid(),
    'toggle-grid-type': () => Ed.toggleGridType(),
    'toggle-grid-orientation': () => Ed.toggleGridOrientation(),
    'toggle-snap': () => Ed.toggleSnap(),
    'toggle-theme': () => {
      Th.toggle();
      syncThemeBtn();
      // Đồng bộ màu nền xuất bản với nền canvas (người dùng vẫn đổi được sau đó).
      const bg = document.getElementById('optBg');
      if (bg) bg.value = Th.palette().canvas;
      T.renderLibraries(document.getElementById('tplSearch').value || '');
      Ed.redraw();
      toast(Th.isDark() ? 'Đã bật giao diện tối 🌙' : 'Đã bật giao diện sáng ☀');
    },
    'sample-ethanol': () => { place('Etanol'); toast('Đã đặt mẫu Etanol'); },
    'sample-toluene': () => { place('Toluen'); toast('Đã đặt mẫu Toluen'); },
    'sample-acetic': () => { place('Axit axetic'); toast('Đã đặt mẫu Axit axetic'); },
    shortcuts: () => showModal('Phím tắt', shortcutTable()),
    about: () => showModal('Giới thiệu', `
      <p><b>Chemistry Workspace</b> — công cụ web tĩnh vẽ công thức khung (skeletal) phong cách Google Workspace.</p>
      <ul>
        <li>Vẽ hydrocarbon, arene, dị vòng, nhóm chức với đầy đủ liên kết đơn/đôi/ba, nét đậm–nét đứt.</li>
        <li>Thư viện mẫu: benzen, toluen, naftalen, pyridine, pyrrole, furan, thiophene, imidazole…</li>
        <li>Xuất <b>SVG dạng mã</b>, tải .svg/.png, lưu dự án .json — chạy offline, không cần server.</li>
      </ul>
      <p class="muted">Mở <code>index.html</code> bằng bất kỳ trình duyệt hiện đại nào.</p>`)
  };
  function shortcutTable() {
    return `<table>
      <tr><td>V / H / A / E / Z</td><td>Chọn · Kéo khung · Nguyên tử · Tẩy · Mạch zigzag</td></tr>
      <tr><td>1 / 2 / 3</td><td>Liên kết đơn / đôi / ba</td></tr>
      <tr><td>4 / 5</td><td>Nét đậm (wedge) / Nét đứt (hash)</td></tr>
      <tr><td>R / Shift+R</td><td>Xoay cấu trúc đang chọn ±30°</td></tr>
      <tr><td>Shift + kéo</td><td>Vẽ tự do, không bắt góc 30°</td></tr>
      <tr><td>Chuột giữa / Space</td><td>Kéo khung nhìn</td></tr>
      <tr><td>Ctrl+Z / Ctrl+Y</td><td>Hoàn tác / Làm lại</td></tr>
      <tr><td>Ctrl+A / Delete</td><td>Chọn tất cả / Xóa đối tượng</td></tr>
      <tr><td>G / T / Y / 0 / Esc</td><td>Bật/tắt lưới · Đổi lưới vuông/tam giác · Đổi hướng trục và xoay cấu trúc 90° · Vừa khung · Bỏ chọn</td></tr>
      <tr><td>Chọn nguyên tử</td><td>Sửa ký hiệu hoặc nhóm ở bảng Thuộc tính (vd Fe, OH, COOH); double-click cũng mở sửa nhanh</td></tr>
      <tr><td>Lăn chuột</td><td>Phóng to / thu nhỏ tại con trỏ</td></tr>
      <tr><td>/</td><td>Tìm trong thư viện mẫu</td></tr>
    </table>`;
  }
  // ---------- Panel thuộc tính ----------
  function updateProps() {
    const body = document.getElementById('propBody');
    if (!body) return;
    const sel = Ed.st.sel;
    if (!sel) {
      body.innerHTML = `<p class="muted">Chưa chọn gì. Nhấn vào một nguyên tử để chọn và sửa ký hiệu/nhóm ở đây; double-click để sửa nhanh.</p>`;
      return;
    }
    if (sel.type === 'atom') {
      const a = M.atom(sel.id);
      if (!a) { Ed.st.sel = null; return updateProps(); }
      body.innerHTML = `<div class="propgrid">
        <label>Ký hiệu / nhóm</label>
        <input id="pEl" type="text" list="atomLabels" maxlength="16" autocomplete="off" aria-label="Ký hiệu nguyên tử hoặc nhóm chức">
        <label>Màu nhãn</label>
        <input id="pColor" type="color" aria-label="Màu nguyên tử hoặc nhóm chức">
        <label>Toạ độ X</label><input id="pX" type="number" step="1" value="${a.x}">
        <label>Toạ độ Y</label><input id="pY" type="number" step="1" value="${a.y}">
        <label>Bậc</label><span class="muted">${M.degree(a.id)} liên kết</span>
      </div>
      <div class="btnrow"><button class="btn" id="pResetColor" type="button">Dùng lại màu mặc định</button></div>`;
      const elInput = document.getElementById('pEl');
      elInput.value = a.el;
      elInput.onchange = e => {
        const value = e.target.value.trim();
        if (!value) { toast('Ký hiệu hoặc tên nhóm không được để trống.'); e.target.value = a.el; return; }
        if (value.length > 16) { toast('Tên nguyên tử/nhóm tối đa 16 ký tự.'); e.target.value = a.el; return; }
        if (value !== a.el) M.transact(() => { a.el = value; }, 'prop');
      };
      const colorInput = document.getElementById('pColor');
      colorInput.value = a.color || M.elColor(a.el);
      colorInput.onchange = e => {
        const value = e.target.value;
        if (!/^#[0-9a-f]{6}$/i.test(value)) { toast('Màu không hợp lệ.'); e.target.value = a.color || M.elColor(a.el); return; }
        if (value !== a.color) M.transact(() => { a.color = value; }, 'atom-color');
      };
      const resetColor = document.getElementById('pResetColor');
      resetColor.onclick = () => {
        if (a.color) M.transact(() => { delete a.color; }, 'atom-color');
      };
      document.getElementById('pX').onchange = e => M.transact(() => { a.x = +e.target.value; }, 'prop');
      document.getElementById('pY').onchange = e => M.transact(() => { a.y = +e.target.value; }, 'prop');
    } else if (sel.type === 'bond') {
      const b = M.bond(sel.id);
      if (!b) { Ed.st.sel = null; return updateProps(); }
      const A = M.atom(b.a), B = M.atom(b.b);
      body.innerHTML = `<div class="propgrid">
        <label>Loại liên kết</label>
        <select id="pOrder">
          <option value="1" ${b.order === 1 ? 'selected' : ''}>Đơn</option>
          <option value="2" ${b.order === 2 ? 'selected' : ''}>Đôi</option>
          <option value="3" ${b.order === 3 ? 'selected' : ''}>Ba</option>
        </select>
        <label>Kiểu nét</label>
        <select id="pStyle">
          <option value="solid" ${b.style === 'solid' ? 'selected' : ''}>Liền mạch</option>
          <option value="wedge" ${b.style === 'wedge' ? 'selected' : ''}>Nét đậm (▲)</option>
          <option value="hash" ${b.style === 'hash' ? 'selected' : ''}>Nét đứt (╱)</option>
        </select>
        <label>Từ → Đến</label><span class="muted">${A ? A.el : '?'} → ${B ? B.el : '?'}</span>
      </div>
      <div class="btnrow"><button class="btn" id="pDelBond">Xóa liên kết</button></div>`;
      document.getElementById('pOrder').onchange = e => M.transact(() => { b.order = +e.target.value; b.dbl = false; }, 'prop');
      document.getElementById('pStyle').onchange = e => M.transact(() => { b.style = e.target.value; }, 'prop');
      document.getElementById('pDelBond').onclick = () => actions.delete();
    } else {
      body.innerHTML = `<p class="muted">Đang chọn <b>${sel.ids.length} nguyên tử</b> — kéo để di chuyển, Del để xóa.</p>`;
    }
  }
  function updateUndoBtns() {
    const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
    if (u) { u.style.opacity = M.canUndo() ? 1 : .35; u.disabled = !M.canUndo(); }
    if (r) { r.style.opacity = M.canRedo() ? 1 : .35; r.disabled = !M.canRedo(); }
  }
  // ---------- Nối sự kiện ----------
  function init() {
    T.renderLibraries('');
    // Cập nhật panel thuộc tính + nút undo mỗi lần redraw (khi selection đổi).
    let lastSelKey = '';
    Ed.st.onAfter = () => {
      updateUndoBtns();
      const key = JSON.stringify(Ed.st.sel);
      if (key !== lastSelKey) { lastSelKey = key; updateProps(); }
    };
    Ed.init();
    updateProps(); updateUndoBtns();
    M.onChange(() => { updateProps(); updateUndoBtns(); });

    document.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (a && actions[a.dataset.action]) { actions[a.dataset.action](); closeMenus(); return; }
      const tool = e.target.closest('.tool[data-tool]');
      if (tool) { Ed.setTool(tool.dataset.tool); return; }
      const bb = e.target.closest('.bondbtn');
      if (bb) { Ed.setBond(+bb.dataset.order, bb.dataset.style); return; }
      const atom = e.target.closest('.atom');
      if (atom) { Ed.setElement(atom.dataset.el); return; }
      const tpl = e.target.closest('.tpl');
      if (tpl) { Ed.setTemplate(tpl.dataset.frag); return; }
      const tab = e.target.closest('.tab');
      if (tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab.dataset.tab));
        if (tab.dataset.tab === 'svg') X.refreshCodeView();
      }
    });
    function closeMenus() { document.activeElement && document.activeElement.blur && document.activeElement.blur(); }

    document.getElementById('modalOk').onclick = closeModal;
    document.getElementById('modalBack').addEventListener('click', e => { if (e.target.id === 'modalBack') closeModal(); });
    document.getElementById('btnUndo').onclick = () => actions.undo();
    document.getElementById('btnRedo').onclick = () => actions.redo();

    const bindRange = (id, vid, cb) => {
      const el = document.getElementById(id), lab = document.getElementById(vid);
      const syncRange = () => {
        const min = parseFloat(el.min) || 0, max = parseFloat(el.max) || 100;
        const value = parseFloat(el.value) || 0;
        const progress = max === min ? 0 : (value - min) / (max - min) * 100;
        el.style.setProperty('--range-progress', progress + '%');
      };
      syncRange();
      el.addEventListener('input', () => { lab.textContent = el.value; syncRange(); cb(); });
    };
    bindRange('optBondLen', 'optBondLenV', () => Ed.updateGrid());
    bindRange('optStroke', 'optStrokeV', () => Ed.redraw());
    bindRange('optFont', 'optFontV', () => Ed.redraw());
    ['optCircle', 'optKekule', 'optBg', 'optTransparent'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => { Ed.redraw(); X.refreshCodeView(); }));

    const doFilter = v => T.renderLibraries(v);
    document.getElementById('tplSearch').addEventListener('input', e => doFilter(e.target.value));
    const gs = document.getElementById('globalSearch');
    gs.addEventListener('input', e => doFilter(e.target.value));
    gs.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim().toLowerCase();
        const f = T.FRAGS.find(x => x.name.toLowerCase().includes(q)) || T.FRAGS.filter(x => x.name.toLowerCase().includes(q))[0];
        if (f) { Ed.setTemplate(f.name); Ed.setHint('Đã chọn "' + f.name + '" — nhấn vào khung vẽ để đặt.'); }
      }
    });

    // Mở file .json.
    document.getElementById('fileOpen').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { M.deserialize(rd.result); Ed.redraw(); Ed.fitView(); toast('Đã mở "' + file.name + '" ✓'); }
        catch (err) { toast('Lỗi: ' + err.message); }
      };
      rd.readAsText(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault(); document.getElementById('globalSearch').focus();
      }
    });

    Ed.setTool('select');
    // Giao diện + ảnh đại diện.
    syncThemeBtn();
    paintAvatar(document.getElementById('avatarBtn'));
    if (Th.isDark()) {
      const bg = document.getElementById('optBg');
      if (bg && bg.value === '#ffffff') bg.value = Th.palette().canvas;
    }
    document.getElementById('avatarBtn').addEventListener('click', avatarModal);
    document.getElementById('avatarFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) readAvatar(f);
      e.target.value = '';
    });
    toast('Sẵn sàng — hãy chọn mẫu bên trái và vẽ nhé!');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  return { init, toast, showModal, closeModal, actions, worldCenter, place };
})();