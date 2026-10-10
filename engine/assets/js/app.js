'use strict';
/* app.js — Nối giao diện: menu, toolbar, panel thuộc tính, mẫu, xuất file. */
window.ChemApp = (() => {
  const M = window.ChemModel, Ed = window.ChemEditor, T = window.ChemTemplates, X = window.ChemExport, Th = window.ChemTheme;
  const I = window.ChemI18n;
  const text = (vi, en) => I ? I.text(vi, en) : vi;
  const SETTINGS_KEY = 'chem-editor-settings';
  const LABEL_COLOR_KEYS = ['N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'OH', 'NH2', 'SH', 'COOH', 'CHO', 'COOCH3', 'NO2', 'CN', 'OCH3'];
  let storedSettings = {};
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) storedSettings = parsed;
      else console.warn('Ignoring invalid saved editor settings.');
    }
  } catch (error) {
    console.warn('Unable to load editor settings.', error);
  }

  function saveSettings() {
    if (!document.getElementById('optBondLen')) return;
    storedSettings = {
      bondLength: +document.getElementById('optBondLen').value,
      stroke: +document.getElementById('optStroke').value,
      font: +document.getElementById('optFont').value,
      circle: document.getElementById('optCircle').checked,
      kekule: document.getElementById('optKekule').checked,
      background: document.getElementById('optBg').value,
      transparent: document.getElementById('optTransparent').checked,
      grid: Ed.st.grid,
      snap: Ed.st.snap,
      gridType: Ed.st.gridType,
      gridOrientation: Ed.st.gridOrientation,
      shiny: document.getElementById('stage').classList.contains('shiny'),
      shinyIntensity: +document.getElementById('optShinyIntensity').value
    };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings)); }
    catch (error) { console.warn('Unable to save editor settings.', error); }
  }
  function restoreSettings() {
    const s = storedSettings;
    const setValue = (id, key, valid) => {
      const input = document.getElementById(id);
      if (input && valid(s[key])) input.value = s[key];
    };
    const setChecked = (id, key) => {
      const input = document.getElementById(id);
      if (input && typeof s[key] === 'boolean') input.checked = s[key];
    };
    setValue('optBondLen', 'bondLength', v => Number.isFinite(v) && v >= 24 && v <= 64);
    setValue('optStroke', 'stroke', v => Number.isFinite(v) && v >= 1 && v <= 5);
    setValue('optFont', 'font', v => Number.isFinite(v) && v >= 12 && v <= 30);
    setValue('optShinyIntensity', 'shinyIntensity', v => Number.isFinite(v) && v >= 10 && v <= 100);
    setValue('optBg', 'background', v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v));
    setChecked('optCircle', 'circle');
    setChecked('optKekule', 'kekule');
    setChecked('optTransparent', 'transparent');
    setChecked('settingsGrid', 'grid');
    setChecked('settingsSnap', 'snap');
    setChecked('settingsShiny', 'shiny');
    if (s.gridType === 'square' || s.gridType === 'triangle') Ed.st.gridType = s.gridType;
    if (s.gridOrientation === 'horizontal' || s.gridOrientation === 'vertical') Ed.st.gridOrientation = s.gridOrientation;
    document.getElementById('settingsGridType').value = Ed.st.gridType;
    document.getElementById('settingsGridOrientation').value = Ed.st.gridOrientation;
    if (typeof s.grid === 'boolean') Ed.st.grid = s.grid;
    if (typeof s.snap === 'boolean') Ed.st.snap = s.snap;
    document.getElementById('stage').classList.toggle('shiny', s.shiny === true);
    for (const [inputId, labelId] of [['optBondLen', 'optBondLenV'], ['optStroke', 'optStrokeV'], ['optFont', 'optFontV'], ['optShinyIntensity', 'optShinyIntensityV']]) {
      const input = document.getElementById(inputId), label = document.getElementById(labelId);
      label.textContent = inputId === 'optShinyIntensity' ? input.value + '%' : input.value;
      const min = +input.min, max = +input.max, value = +input.value;
      input.style.setProperty('--range-progress', ((value - min) / (max - min) * 100) + '%');
    }
    syncShinyControls();
    LABEL_COLOR_KEYS.forEach(label => {
      const input = document.querySelector(`[data-label-color="${label}"]`);
      if (input) input.value = Th.elColor(label);
    });
  }
  function syncShinyControls() {
    const enabled = document.getElementById('stage').classList.contains('shiny');
    const checkbox = document.getElementById('settingsShiny');
    const menuButton = document.querySelector('[data-action="toggle-shiny"]');
    if (checkbox) checkbox.checked = enabled;
    if (menuButton) menuButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  function resetSettings() {
    const values = { optBondLen: 40, optStroke: 2.5, optFont: 20, optShinyIntensity: 100 };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
    document.getElementById('optCircle').checked = false;
    document.getElementById('optKekule').checked = true;
    document.getElementById('optBg').value = Th.palette().canvas;
    document.getElementById('optTransparent').checked = false;
    document.getElementById('settingsGrid').checked = true;
    document.getElementById('settingsSnap').checked = true;
    document.getElementById('settingsGridType').value = 'square';
    document.getElementById('settingsGridOrientation').value = 'horizontal';
    Ed.st.grid = true; Ed.st.snap = true; Ed.st.gridType = 'square'; Ed.st.gridOrientation = 'horizontal';
    document.getElementById('stage').classList.remove('shiny');
    Th.resetLabelColors();
    LABEL_COLOR_KEYS.forEach(label => {
      const input = document.querySelector(`[data-label-color="${label}"]`);
      if (input) input.value = Th.elColor(label);
    });
    for (const [inputId, labelId] of [['optBondLen', 'optBondLenV'], ['optStroke', 'optStrokeV'], ['optFont', 'optFontV'], ['optShinyIntensity', 'optShinyIntensityV']]) {
      const input = document.getElementById(inputId), label = document.getElementById(labelId);
      label.textContent = inputId === 'optShinyIntensity' ? input.value + '%' : input.value;
      input.style.setProperty('--range-progress', ((+input.value - +input.min) / (+input.max - +input.min) * 100) + '%');
    }
    syncShinyControls();
    Ed.updateGrid(); Ed.redraw(); saveSettings();
    toast(text('Đã khôi phục cài đặt mặc định.', 'Settings restored to defaults.'));
  }

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
    showModal(text('Ảnh đại diện', 'Avatar'), `
      <div class="ava-wrap"><span class="avatar big" id="avaPrev"></span></div>
      <p class="muted">${text('Ảnh được cắt vuông, thu nhỏ và <b>lưu ngay trên máy bạn</b> (localStorage) — không tải lên mạng.', 'The image is cropped square, resized, and <b>stored on your device</b> (localStorage) — it is never uploaded.')}</p>
      <div class="btnrow">
        <button class="btn primary" id="avaPick">${text('Chọn ảnh từ máy…', 'Choose image…')}</button>
        <button class="btn" id="avaDel">${text('Xóa ảnh', 'Remove image')}</button>
        <button class="btn" id="avaClose">${text('Đóng', 'Close')}</button>
      </div>`);
    const prev = document.getElementById('avaPrev');
    paintAvatar(prev);
    document.getElementById('avaPick').onclick = () => document.getElementById('avatarFile').click();
    document.getElementById('avaDel').onclick = () => {
      try { localStorage.removeItem('chem-avatar'); } catch (e) {}
      paintAvatar(btn); paintAvatar(prev);
      toast(text('Đã xóa ảnh đại diện', 'Avatar removed'));
    };
    document.getElementById('avaClose').onclick = closeModal;
  }
  function readAvatar(file) {
    if (!/^image\//.test(file.type)) { toast(text('Vui lòng chọn file ảnh (PNG/JPG…).', 'Please choose an image file (PNG/JPG…).')); return; }
    if (file.size > 5 * 1024 * 1024) { toast(text('Ảnh quá lớn — tối đa 5MB.', 'Image is too large — maximum size is 5 MB.')); return; }
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
        catch (e) { toast(text('Không đủ dung lượng bộ nhớ để lưu ảnh.', 'Not enough storage to save the image.')); return; }
        paintAvatar(document.getElementById('avatarBtn'));
        const prev = document.getElementById('avaPrev');
        if (prev) paintAvatar(prev);
        toast(text('Đã cập nhật ảnh đại diện ✓', 'Avatar updated ✓'));
      };
      img.onerror = () => toast(text('Không đọc được file ảnh này.', 'Could not read this image file.'));
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
    if ((M.S.atoms.length || M.S.texts.length) && !confirm(text('Xóa toàn bộ khung vẽ hiện tại?', 'Clear the entire current drawing?'))) return;
    M.transact(() => M.clearAll(), 'clear');
    Ed.st.sel = null; Ed.redraw();
    toast(text('Đã tạo khung vẽ mới', 'New drawing created'));
  }
  const actions = {
    new: newDoc,
    open: () => document.getElementById('fileOpen').click(),
    'save-json': () => { X.saveJSON(); toast(text('Đã lưu file .json ✓', 'Project saved as .json ✓')); },
    'export-svg': () => { X.exportSVG(); toast(text('Đã xuất file .svg ✓', 'Exported .svg file ✓')); },
    'export-png': () => X.exportPNG(),
    'copy-svg': () => X.copySVG(),
    'refresh-svg': () => { X.refreshCodeView(); toast(text('Đã làm mới mã SVG', 'SVG source refreshed')); },
    undo: () => { M.undo(); Ed.redraw(); },
    redo: () => { M.redo(); Ed.redraw(); },
    'select-all': () => Ed.selectAll(),
    delete: () => Ed.deleteSel(),
    'rotate-left': () => { if (!Ed.rotateSelection(-Math.PI / 6)) toast(text('Chọn một nguyên tử hoặc liên kết trước khi xoay.', 'Select an atom or bond before rotating.')); },
    'rotate-right': () => { if (!Ed.rotateSelection(Math.PI / 6)) toast(text('Chọn một nguyên tử hoặc liên kết trước khi xoay.', 'Select an atom or bond before rotating.')); },
    fit: () => Ed.fitView(),
    'zoom-in': () => Ed.zoomBtn(1.25),
    'zoom-out': () => Ed.zoomBtn(0.8),
    'zoom-100': () => { const s = document.getElementById('stage'); const r = s.getBoundingClientRect(); Ed.st.view = { x: r.width / 2, y: r.height / 2, k: 1 }; Ed.applyView(); },
    'toggle-grid': () => Ed.toggleGrid(),
    'toggle-grid-type': () => Ed.toggleGridType(),
    'toggle-grid-orientation': () => Ed.toggleGridOrientation(),
    'toggle-snap': () => Ed.toggleSnap(),
    'toggle-shiny': () => {
      const stage = document.getElementById('stage');
      stage.classList.toggle('shiny');
      syncShinyControls();
      Ed.redraw(); saveSettings();
    },
    'toggle-theme': () => {
      Th.toggle();
      syncThemeBtn();
      // Đồng bộ màu nền xuất bản với nền canvas (người dùng vẫn đổi được sau đó).
      const bg = document.getElementById('optBg');
      if (bg) bg.value = Th.palette().canvas;
      T.renderLibraries(document.getElementById('tplSearch').value || '');
      LABEL_COLOR_KEYS.forEach(label => {
        const input = document.querySelector(`[data-label-color="${label}"]`);
        if (input && !Th.customLabelColors()[label]) input.value = Th.elColor(label);
      });
      Ed.redraw(); saveSettings();
      toast(Th.isDark() ? text('Đã bật giao diện tối 🌙', 'Dark theme enabled 🌙') : text('Đã bật giao diện sáng ☀', 'Light theme enabled ☀'));
    },
    'reset-label-colors': () => {
      Th.resetLabelColors();
      LABEL_COLOR_KEYS.forEach(label => {
        const input = document.querySelector(`[data-label-color="${label}"]`);
        if (input) input.value = Th.elColor(label);
      });
      Ed.redraw();
    },
    'reset-settings': resetSettings,
    'sample-ethanol': () => { place('Etanol'); toast(text('Đã đặt mẫu Etanol', 'Ethanol sample placed')); },
    'sample-toluene': () => { place('Toluen'); toast(text('Đã đặt mẫu Toluen', 'Toluene sample placed')); },
    'sample-acetic': () => { place('Axit axetic'); toast(text('Đã đặt mẫu Axit axetic', 'Acetic acid sample placed')); },
    shortcuts: () => showModal(text('Phím tắt', 'Keyboard shortcuts'), shortcutTable()),
    about: () => showModal(text('Giới thiệu', 'About'), I && I.language === 'en' ? `
      <p><b>Chemistry Workspace</b> — a static web app for drawing skeletal structures.</p>
      <ul>
        <li>Draw hydrocarbons, arenes, heterocycles, and functional groups with single, double, triple, wedge, and hashed bonds.</li>
        <li>Template library includes benzene, toluene, naphthalene, pyridine, pyrrole, furan, thiophene, and imidazole.</li>
        <li>Export SVG source, download .svg/.png, and save .json projects — runs offline without a server.</li>
      </ul>
      <p class="muted">Open <code>index.html</code> in any modern browser.</p>` : `
      <p><b>Chemistry Workspace</b> — công cụ web tĩnh vẽ công thức khung (skeletal) phong cách Google Workspace.</p>
      <ul>
        <li>Vẽ hydrocarbon, arene, dị vòng, nhóm chức với đầy đủ liên kết đơn/đôi/ba, nét đậm–nét đứt.</li>
        <li>Thư viện mẫu: benzen, toluen, naftalen, pyridine, pyrrole, furan, thiophene, imidazole…</li>
        <li>Xuất <b>SVG dạng mã</b>, tải .svg/.png, lưu dự án .json — chạy offline, không cần server.</li>
      </ul>
      <p class="muted">Mở <code>index.html</code> bằng bất kỳ trình duyệt hiện đại nào.</p>`)
  };
  function shortcutTable() {
    if (I && I.language === 'en') return `<table>
      <tr><td>V / H / A / E / Z</td><td>Select · Pan · Atom · Erase · Carbon chain</td></tr>
      <tr><td>1 / 2 / 3</td><td>Single / double / triple bond</td></tr>
      <tr><td>4 / 5</td><td>Solid wedge / hashed wedge</td></tr>
      <tr><td>R / Shift+R</td><td>Rotate selection ±30°; rotate a template by one grid step before placing</td></tr>
      <tr><td>Shift + drag</td><td>Draw freely without angle snapping</td></tr>
      <tr><td>Middle mouse / Space</td><td>Pan canvas</td></tr>
      <tr><td>Ctrl+Z / Ctrl+Y</td><td>Undo / Redo</td></tr>
      <tr><td>Ctrl+A / Delete</td><td>Select all / Delete object</td></tr>
      <tr><td>G / T / Y / 0 / Esc</td><td>Toggle grid · Switch grid type · Change grid orientation and rotate structures · Fit view · Deselect</td></tr>
      <tr><td>Select atom</td><td>Edit its element/group in Properties (e.g. Fe, OH, COOH); double-click to edit</td></tr>
      <tr><td>Scroll wheel</td><td>Zoom at cursor</td></tr>
      <tr><td>/</td><td>Search the template library</td></tr>
    </table>`;
    return `<table>
      <tr><td>V / H / A / E / Z</td><td>Chọn · Kéo khung · Nguyên tử · Tẩy · Mạch zigzag</td></tr>
      <tr><td>1 / 2 / 3</td><td>Liên kết đơn / đôi / ba</td></tr>
      <tr><td>4 / 5</td><td>Nét đậm (wedge) / Nét đứt (hash)</td></tr>
      <tr><td>R / Shift+R</td><td>Xoay cấu trúc đang chọn ±30°; xoay mẫu trước khi đặt theo bước lưới</td></tr>
      <tr><td>Shift + kéo</td><td>Vẽ tự do, không bắt góc theo lưới</td></tr>
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
      body.innerHTML = `<p class="muted">${text('Chưa chọn gì. Nhấn vào một nguyên tử để chọn và sửa ký hiệu/nhóm ở đây; double-click để sửa nhanh.', 'Nothing selected. Click an atom to edit its element or group here; double-click for quick editing.')}</p>`;
      return;
    }
    if (sel.type === 'atom') {
      const a = M.atom(sel.id);
      if (!a) { Ed.st.sel = null; return updateProps(); }
      body.innerHTML = `<div class="propgrid">
        <label>${text('Ký hiệu / nhóm', 'Element / group')}</label>
        <input id="pEl" type="text" list="atomLabels" maxlength="16" autocomplete="off" aria-label="${text('Ký hiệu nguyên tử hoặc nhóm chức', 'Element or functional group')}">
        <label>${text('Màu nhãn', 'Label color')}</label>
        <input id="pColor" type="color" aria-label="${text('Màu nguyên tử hoặc nhóm chức', 'Element or group color')}">
        <label>${text('Toạ độ X', 'X coordinate')}</label><input id="pX" type="number" step="1" value="${a.x}">
        <label>${text('Toạ độ Y', 'Y coordinate')}</label><input id="pY" type="number" step="1" value="${a.y}">
        <label>${text('Bậc', 'Degree')}</label><span class="muted">${M.degree(a.id)} ${text('liên kết', 'bonds')}</span>
      </div>
      <div class="btnrow"><button class="btn" id="pResetColor" type="button">${text('Dùng lại màu mặc định', 'Reset to default color')}</button></div>`;
      const elInput = document.getElementById('pEl');
      elInput.value = a.el;
      elInput.onchange = e => {
        const value = e.target.value.trim();
        if (!value) { toast(text('Ký hiệu hoặc tên nhóm không được để trống.', 'Element or group name cannot be empty.')); e.target.value = a.el; return; }
        if (value.length > 16) { toast(text('Tên nguyên tử/nhóm tối đa 16 ký tự.', 'Element or group name must be 16 characters or fewer.')); e.target.value = a.el; return; }
        if (value !== a.el) M.transact(() => { a.el = value; }, 'prop');
      };
      const colorInput = document.getElementById('pColor');
      colorInput.value = a.color || M.elColor(a.el);
      colorInput.onchange = e => {
        const value = e.target.value;
        if (!/^#[0-9a-f]{6}$/i.test(value)) { toast(text('Màu không hợp lệ.', 'Invalid color.')); e.target.value = a.color || M.elColor(a.el); return; }
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
        <label>${text('Loại liên kết', 'Bond order')}</label>
        <select id="pOrder">
          <option value="1" ${b.order === 1 ? 'selected' : ''}>${text('Đơn', 'Single')}</option>
          <option value="2" ${b.order === 2 ? 'selected' : ''}>${text('Đôi', 'Double')}</option>
          <option value="3" ${b.order === 3 ? 'selected' : ''}>${text('Ba', 'Triple')}</option>
        </select>
        <label>${text('Kiểu nét', 'Bond style')}</label>
        <select id="pStyle">
          <option value="solid" ${b.style === 'solid' ? 'selected' : ''}>${text('Liền mạch', 'Solid')}</option>
          <option value="wedge" ${b.style === 'wedge' ? 'selected' : ''}>${text('Nét đậm (▲)', 'Solid wedge (▲)')}</option>
          <option value="hash" ${b.style === 'hash' ? 'selected' : ''}>${text('Nét đứt (╱)', 'Hashed wedge (╱)')}</option>
        </select>
        <label>${text('Từ → Đến', 'From → To')}</label><span class="muted">${A ? A.el : '?'} → ${B ? B.el : '?'}</span>
      </div>
      <div class="btnrow"><button class="btn" id="pDelBond">${text('Xóa liên kết', 'Delete bond')}</button></div>`;
      document.getElementById('pOrder').onchange = e => M.transact(() => { b.order = +e.target.value; b.dbl = false; }, 'prop');
      document.getElementById('pStyle').onchange = e => M.transact(() => { b.style = e.target.value; }, 'prop');
      document.getElementById('pDelBond').onclick = () => actions.delete();
    } else if (sel.type === 'text') {
      const annotation = M.textItem(sel.id);
      if (!annotation) { Ed.st.sel = null; return updateProps(); }
      body.innerHTML = `<p><b>${text('Chú thích', 'Annotation')}:</b> <span id="pCanvasText"></span></p>
        <p class="muted">${text('Kéo để di chuyển, nhấp đúp để sửa, Delete để xóa.', 'Drag to move, double-click to edit, or press Delete to remove.')}</p>`;
      document.getElementById('pCanvasText').textContent = annotation.text;
    } else {
      body.innerHTML = `<p class="muted">${text('Đang chọn', 'Selected')} <b>${sel.ids.length} ${text('nguyên tử', 'atoms')}</b> — ${text('kéo để di chuyển, Del để xóa.', 'drag to move, Del to delete.')}</p>`;
    }
  }
  function updateUndoBtns() {
    const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
    if (u) { u.style.opacity = M.canUndo() ? 1 : .35; u.disabled = !M.canUndo(); }
    if (r) { r.style.opacity = M.canRedo() ? 1 : .35; r.disabled = !M.canRedo(); }
  }
  function refreshLanguage() {
    updateProps();
    Ed.updateGrid();
    Ed.redraw();
  }
  // ---------- Nối sự kiện ----------
  function init() {
    restoreSettings();
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
    const languageButton = document.getElementById('languageBtn');
    if (languageButton) languageButton.addEventListener('click', () => I.setLanguage(I.language === 'en' ? 'vi' : 'en'));

    const bindRange = (id, vid, cb) => {
      const el = document.getElementById(id), lab = document.getElementById(vid);
      const syncRange = () => {
        const min = parseFloat(el.min) || 0, max = parseFloat(el.max) || 100;
        const value = parseFloat(el.value) || 0;
        const progress = max === min ? 0 : (value - min) / (max - min) * 100;
        el.style.setProperty('--range-progress', progress + '%');
      };
      syncRange();
      el.addEventListener('input', () => { lab.textContent = id === 'optShinyIntensity' ? el.value + '%' : el.value; syncRange(); cb(); saveSettings(); });
    };
    bindRange('optBondLen', 'optBondLenV', () => Ed.updateGrid());
    bindRange('optStroke', 'optStrokeV', () => Ed.redraw());
    bindRange('optFont', 'optFontV', () => Ed.redraw());
    bindRange('optShinyIntensity', 'optShinyIntensityV', () => Ed.redraw());
    ['optCircle', 'optKekule', 'optBg', 'optTransparent'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => { Ed.redraw(); X.refreshCodeView(); saveSettings(); }));
    document.querySelectorAll('[data-label-color]').forEach(input => input.addEventListener('input', () => {
      Th.setLabelColor(input.dataset.labelColor, input.value);
      Ed.redraw();
    }));
    document.getElementById('settingsShiny').addEventListener('change', e => {
      document.getElementById('stage').classList.toggle('shiny', e.target.checked);
      syncShinyControls(); Ed.redraw(); saveSettings();
    });
    document.getElementById('settingsGrid').addEventListener('change', e => {
      Ed.st.grid = e.target.checked; Ed.updateGrid(); saveSettings();
    });
    document.getElementById('settingsSnap').addEventListener('change', e => {
      Ed.st.snap = e.target.checked; saveSettings();
    });
    document.getElementById('settingsGridType').addEventListener('change', e => {
      Ed.st.gridType = e.target.value; Ed.updateGrid(); saveSettings();
    });
    document.getElementById('settingsGridOrientation').addEventListener('change', e => {
      Ed.st.gridOrientation = e.target.value; Ed.updateGrid(); saveSettings();
    });

    const doFilter = v => T.renderLibraries(v);
    document.getElementById('tplSearch').addEventListener('input', e => doFilter(e.target.value));
    const gs = document.getElementById('globalSearch');
    gs.addEventListener('input', e => doFilter(e.target.value));
    gs.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim().toLowerCase();
        const f = T.FRAGS.find(x => x.name.toLowerCase().includes(q) || I.name(x.name).toLowerCase().includes(q));
        if (f) { Ed.setTemplate(f.name); Ed.setHint(text('Đã chọn "', 'Selected "') + I.name(f.name) + text('" — nhấn vào khung vẽ để đặt.', '" — click the canvas to place it.')); }
      }
    });

    // Mở file .json.
    document.getElementById('fileOpen').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { M.deserialize(rd.result); Ed.redraw(); Ed.fitView(); toast(text('Đã mở "' + file.name + '" ✓', 'Opened "' + file.name + '" ✓')); }
        catch (err) { toast(text('Lỗi: ' + err.message, 'Error: ' + err.message)); }
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
      if (bg && !Object.prototype.hasOwnProperty.call(storedSettings, 'background')) bg.value = Th.palette().canvas;
    }
    syncShinyControls();
    saveSettings();
    document.getElementById('avatarBtn').addEventListener('click', avatarModal);
    document.getElementById('avatarFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) readAvatar(f);
      e.target.value = '';
    });
    toast(text('Sẵn sàng — hãy chọn mẫu bên trái và vẽ nhé!', 'Ready — choose a template on the left and start drawing!'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  return { init, toast, showModal, closeModal, actions, worldCenter, place, refreshLanguage };
})();