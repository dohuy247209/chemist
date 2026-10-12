'use strict';
/* app.js — Nối giao diện: menu, toolbar, panel thuộc tính, mẫu, xuất file. */
window.ChemApp = (() => {
  const M = window.ChemModel, Ed = window.ChemEditor, T = window.ChemTemplates, X = window.ChemExport, Th = window.ChemTheme;
  const I = window.ChemI18n;
  const text = (vi, en) => I ? I.text(vi, en) : vi;
  const SETTINGS_KEY = 'chem-editor-settings';
  const AUTOSAVE_KEY = 'chem-editor-draft-v1';
  const AUTOSAVE_LATEST_KEY = `${AUTOSAVE_KEY}:latest`;
  // Bản sao bản nháp bị hỏng: khoá chính sẽ bị lần chỉnh sửa sau ghi đè nên
  // phải sang bên đây trước, để người dùng còn cứu lại được dữ liệu.
  const DRAFT_BACKUP_KEY = `${AUTOSAVE_KEY}:backup`;
  function getTabAutosaveKey() {
    try {
      const tabIdKey = `${AUTOSAVE_KEY}:tab-id`;
      let tabId = sessionStorage.getItem(tabIdKey);
      if (!tabId) {
        tabId = window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(tabIdKey, tabId);
      }
      return `${AUTOSAVE_KEY}:${tabId}`;
    } catch (error) {
      console.warn('Unable to isolate the autosaved drawing for this tab.', error);
      return AUTOSAVE_KEY;
    }
  }
  const TAB_AUTOSAVE_KEY = getTabAutosaveKey();
  const LABEL_COLOR_KEYS = ['N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'OH', 'NH2', 'SH', 'COOH', 'CHO', 'COOCH3', 'NO2', 'CN', 'OCH3'];
  const COLOR_PRESET_SOURCES = [
    ['ink', 'Màu chữ (C)', 'Text color (C)'], ['white', 'Trắng', 'White'],
    ['O', 'Đỏ (O)', 'Red (O)'], ['P', 'Cam (P)', 'Orange (P)'],
    ['S', 'Vàng (S)', 'Yellow (S)'], ['Cl', 'Xanh lá (Cl)', 'Green (Cl)'],
    ['N', 'Xanh dương (N)', 'Blue (N)'], ['Br', 'Tím (Br)', 'Purple (Br)']
  ];
  function lightenColor(color) {
    const channels = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
    return '#' + channels.map(channel => Math.round(channel + (255 - channel) * 0.08)
      .toString(16).padStart(2, '0')).join('');
  }
  function colorPresets() {
    return COLOR_PRESET_SOURCES.map(([source, vi, en]) => [
      source === 'white' ? '#ffffff' : lightenColor(source === 'ink' ? Th.palette().ink : Th.elColor(source)),
      vi,
      en
    ]);
  }
  function colorOptionsMarkup(current, defaultLabel) {
    const presets = colorPresets();
    const selectedPreset = presets.find(([color]) => color === current);
    return `<option value="default" ${current === null ? 'selected' : ''}>${defaultLabel}</option>
      ${presets.map(([color, vi, en]) => `<option value="${color}" ${selectedPreset && selectedPreset[0] === color ? 'selected' : ''}>${text(vi, en)}</option>`).join('')}
      <option value="custom" ${current !== null && !selectedPreset ? 'selected' : ''}>${text('Màu tùy chỉnh', 'Custom color')}</option>`;
  }
  function bindColorControls(selectId, pickerId, current, defaultColor, update) {
    const select = document.getElementById(selectId), picker = document.getElementById(pickerId);
    let selectedColor = current || defaultColor;
    picker.value = selectedColor;
    picker.hidden = select.value !== 'custom';
    select.onchange = () => {
      picker.hidden = select.value !== 'custom';
      if (select.value === 'custom') {
        picker.value = selectedColor;
        return;
      }
      selectedColor = select.value === 'default' ? defaultColor : select.value;
      update(select.value === 'default' ? null : select.value);
    };
    picker.onchange = () => {
      if (/^#[0-9a-f]{6}$/i.test(picker.value)) {
        selectedColor = picker.value;
        update(picker.value);
      }
    };
  }
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

  // ---------- Chế độ hiển thị liên kết: default | shiny | tint ----------
  const VIEW_MODES = ['default', 'shiny', 'tint'];
  function currentView() {
    const stage = document.getElementById('stage');
    if (!stage) return 'default';
    if (stage.classList.contains('shiny')) return 'shiny';
    if (stage.classList.contains('tint')) return 'tint';
    return 'default';
  }
  function applyView(mode) {
    const stage = document.getElementById('stage');
    if (!stage) return;
    stage.classList.toggle('shiny', mode === 'shiny');
    stage.classList.toggle('tint', mode === 'tint');
  }
  function saveSettings() {
    if (!document.getElementById('optBondLen')) return;
    const isEnabled = id => document.getElementById(id).value === 'enabled';
    storedSettings = {
      bondLength: +document.getElementById('optBondLen').value,
      stroke: +document.getElementById('optStroke').value,
      font: +document.getElementById('optFont').value,
      circle: isEnabled('optCircle'),
      kekule: isEnabled('optKekule'),
      background: document.getElementById('optBg').value,
      transparent: isEnabled('optTransparent'),
      grid: Ed.st.grid,
      snap: Ed.st.snap,
      gridType: Ed.st.gridType,
      gridOrientation: Ed.st.gridOrientation,
      selectionMode: Ed.st.selectionMode,
      valenceCheck: isEnabled('settingsValenceCheck'),
      view: currentView(),
      shinyIntensity: +document.getElementById('optShinyIntensity').value,
      exportFrame: isEnabled('settingsExportFrame'),
      marginTop: +document.getElementById('optMarginTop').value,
      marginBottom: +document.getElementById('optMarginBottom').value,
      marginLeft: +document.getElementById('optMarginLeft').value,
      marginRight: +document.getElementById('optMarginRight').value
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
    const setEnabled = (id, key) => {
      const input = document.getElementById(id);
      if (input && typeof s[key] === 'boolean') input.value = s[key] ? 'enabled' : 'disabled';
    };
    setValue('optBondLen', 'bondLength', v => Number.isFinite(v) && v >= 24 && v <= 64);
    setValue('optStroke', 'stroke', v => Number.isFinite(v) && v >= 1 && v <= 5);
    setValue('optFont', 'font', v => Number.isFinite(v) && v >= 12 && v <= 30);
    setValue('optShinyIntensity', 'shinyIntensity', v => Number.isFinite(v) && v >= 10 && v <= 100);
    setValue('optBg', 'background', v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v));
    const marginOk = v => Number.isFinite(v) && v >= 0 && v <= 200;
    setValue('optMarginTop', 'marginTop', marginOk);
    setValue('optMarginBottom', 'marginBottom', marginOk);
    setValue('optMarginLeft', 'marginLeft', marginOk);
    setValue('optMarginRight', 'marginRight', marginOk);
    setEnabled('optCircle', 'circle');
    setEnabled('optKekule', 'kekule');
    setEnabled('optTransparent', 'transparent');
    setEnabled('settingsGrid', 'grid');
    setEnabled('settingsSnap', 'snap');
    setEnabled('settingsValenceCheck', 'valenceCheck');
    setEnabled('settingsExportFrame', 'exportFrame');
    if (s.selectionMode === 'select' || s.selectionMode === 'lasso') Ed.st.selectionMode = s.selectionMode;
    if (s.gridType === 'square' || s.gridType === 'triangle') Ed.st.gridType = s.gridType;
    if (s.gridOrientation === 'horizontal' || s.gridOrientation === 'vertical') Ed.st.gridOrientation = s.gridOrientation;
    document.getElementById('settingsGridType').value = Ed.st.gridType;
    document.getElementById('settingsGridOrientation').value = Ed.st.gridOrientation;
    document.getElementById('settingsSelectionMode').value = Ed.st.selectionMode;
    if (typeof s.grid === 'boolean') Ed.st.grid = s.grid;
    if (typeof s.snap === 'boolean') Ed.st.snap = s.snap;
    // Chế độ hiển thị: ưu tiên khóa "view"; nếu chỉ có khóa "shiny" cũ thì quy đổi.
    const view = VIEW_MODES.includes(s.view) ? s.view : (s.shiny === true ? 'shiny' : 'default');
    applyView(view);
    for (const [inputId, labelId] of [['optBondLen', 'optBondLenV'], ['optStroke', 'optStrokeV'], ['optFont', 'optFontV'], ['optShinyIntensity', 'optShinyIntensityV'], ['optMarginTop', 'optMarginTopV'], ['optMarginBottom', 'optMarginBottomV'], ['optMarginLeft', 'optMarginLeftV'], ['optMarginRight', 'optMarginRightV']]) {
      const input = document.getElementById(inputId), label = document.getElementById(labelId);
      label.textContent = inputId === 'optShinyIntensity' ? input.value + '%' : input.value;
      const min = +input.min, max = +input.max, value = +input.value;
      input.style.setProperty('--range-progress', ((value - min) / (max - min) * 100) + '%');
    }
    syncViewControls();
    LABEL_COLOR_KEYS.forEach(label => {
      const input = document.querySelector(`[data-label-color="${label}"]`);
      if (input) input.value = Th.elColor(label);
    });
    // Khôi phục hover / select color settings.
    const hoverSettings = Ed.getHoverSettings();
    const hoverEnabledSelect = document.getElementById('settingsHoverEnabled');
    if (hoverEnabledSelect) hoverEnabledSelect.value = hoverSettings.enabled ? 'enabled' : 'disabled';
    const optHoverLight = document.getElementById('optHoverColorLight');
    if (optHoverLight) optHoverLight.value = hoverSettings.colorLight;
    const optHoverDark = document.getElementById('optHoverColorDark');
    if (optHoverDark) optHoverDark.value = hoverSettings.colorDark;
    const selectColors = Ed.getSelectColor();
    const optSelectLight = document.getElementById('optSelectColorLight');
    if (optSelectLight) optSelectLight.value = selectColors.light;
    const optSelectDark = document.getElementById('optSelectColorDark');
    if (optSelectDark) optSelectDark.value = selectColors.dark;
  }
  // Đồng bộ panel cài đặt lưới với trạng thái thật của editor — gọi khi người
  // dùng đổi lưới/bắt điểm bằng nút toolbar hoặc phím tắt (G/T/Y) thay vì
  // qua panel, để panel và localStorage luôn phản ánh đúng trạng thái hiện tại.
  function syncGridSettingsPanel() {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('settingsGrid', Ed.st.grid ? 'enabled' : 'disabled');
    set('settingsSnap', Ed.st.snap ? 'enabled' : 'disabled');
    set('settingsGridType', Ed.st.gridType);
    set('settingsGridOrientation', Ed.st.gridOrientation);
  }
  function syncViewControls() {
    const view = currentView();
    const setting = document.getElementById('settingsView');
    if (setting) setting.value = view;
    const menuButton = document.querySelector('[data-action="toggle-shiny"]');
    if (menuButton) {
      menuButton.setAttribute('aria-pressed', view === 'default' ? 'false' : 'true');
      const label = view === 'shiny' ? text('Shiny / phát sáng nhẹ', 'Shiny / subtle glow')
        : view === 'tint' ? text('Nửa liên kết theo màu nhóm', 'Half-tinted bonds')
        : text('Mặc định', 'Default');
      menuButton.textContent = text('Chế độ hiển thị: ', 'Display mode: ') + label;
    }
  }
  function resetSettings() {
    const values = { optBondLen: 40, optStroke: 2.5, optFont: 20, optShinyIntensity: 100 };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
    document.getElementById('optCircle').value = 'disabled';
    document.getElementById('optKekule').value = 'enabled';
    document.getElementById('optBg').value = Th.palette().canvas;
    document.getElementById('optTransparent').value = 'disabled';
    document.getElementById('settingsGrid').value = 'enabled';
    document.getElementById('settingsSnap').value = 'enabled';
    document.getElementById('settingsValenceCheck').value = 'enabled';
    document.getElementById('settingsExportFrame').value = 'disabled';
    document.getElementById('optMarginTop').value = 36;
    document.getElementById('optMarginBottom').value = 36;
    document.getElementById('optMarginLeft').value = 36;
    document.getElementById('optMarginRight').value = 36;
    document.getElementById('settingsGridType').value = 'square';
    document.getElementById('settingsGridOrientation').value = 'horizontal';
    Ed.setSelectionMode('select');
    Ed.st.grid = true; Ed.st.snap = true; Ed.st.gridType = 'square'; Ed.st.gridOrientation = 'horizontal';
    applyView('default');
    Th.resetLabelColors();
    LABEL_COLOR_KEYS.forEach(label => {
      const input = document.querySelector(`[data-label-color="${label}"]`);
      if (input) input.value = Th.elColor(label);
    });
    for (const [inputId, labelId] of [['optBondLen', 'optBondLenV'], ['optStroke', 'optStrokeV'], ['optFont', 'optFontV'], ['optShinyIntensity', 'optShinyIntensityV'], ['optMarginTop', 'optMarginTopV'], ['optMarginBottom', 'optMarginBottomV'], ['optMarginLeft', 'optMarginLeftV'], ['optMarginRight', 'optMarginRightV']]) {
      const input = document.getElementById(inputId), label = document.getElementById(labelId);
      label.textContent = inputId === 'optShinyIntensity' ? input.value + '%' : input.value;
      input.style.setProperty('--range-progress', ((+input.value - +input.min) / (+input.max - +input.min) * 100) + '%');
    }
    syncViewControls();
    Ed.updateGrid(); Ed.redraw(); saveSettings();
    // Reset hover / select colors.
    Ed.resetHoverSettings();
    Ed.resetSelectColor();
    const hoverSettings = Ed.getHoverSettings();
    const hSelect = document.getElementById('settingsHoverEnabled');
    if (hSelect) hSelect.value = hoverSettings.enabled ? 'enabled' : 'disabled';
    const optHL = document.getElementById('optHoverColorLight');
    if (optHL) optHL.value = hoverSettings.colorLight;
    const optHD = document.getElementById('optHoverColorDark');
    if (optHD) optHD.value = hoverSettings.colorDark;
    const selColors = Ed.getSelectColor();
    const optSL = document.getElementById('optSelectColorLight');
    if (optSL) optSL.value = selColors.light;
    const optSD = document.getElementById('optSelectColorDark');
    if (optSD) optSD.value = selColors.dark;
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
  function insertArrow(arrowType) {
    const position = worldCenter();
    let arrow;
    M.transact(() => {
      arrow = M.addText(position.x, position.y, '', +document.getElementById('optFont').value || 20, {
        type: 'arrow', arrowType, width: 96, above: '', below: '', latex: false
      });
    }, 'arrow');
    Ed.st.sel = { type: 'text', id: arrow.id };
    Ed.redraw();
  }
  const actions = {
    new: newDoc,
    open: () => document.getElementById('fileOpen').click(),
    'save-json': () => { X.saveJSON(); toast(text('Đã lưu file .json ✓', 'Project saved as .json ✓')); },
    'export-svg': () => { X.exportSVG(); toast(text('Đã xuất file .svg ✓', 'Exported .svg file ✓')); },
    'export-png': () => X.exportPNG(),
    'copy-svg': () => X.copySVG(),
    'copy-png': () => X.copyPNG(),
    'refresh-svg': () => { X.refreshCodeView(); toast(text('Đã làm mới mã SVG', 'SVG source refreshed')); },
    'insert-arrow': () => insertArrow('forward'),
    'insert-equilibrium': () => insertArrow('equilibrium'),
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
      const next = VIEW_MODES[(VIEW_MODES.indexOf(currentView()) + 1) % VIEW_MODES.length];
      applyView(next);
      syncViewControls();
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
      Ed.redraw(); updateProps(); saveSettings();
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
    'reset-hover-colors': () => {
      Ed.resetHoverSettings();
      const h = Ed.getHoverSettings();
      const hSelect = document.getElementById('settingsHoverEnabled');
      if (hSelect) hSelect.value = h.enabled ? 'enabled' : 'disabled';
      const optHL = document.getElementById('optHoverColorLight');
      if (optHL) optHL.value = h.colorLight;
      const optHD = document.getElementById('optHoverColorDark');
      if (optHD) optHD.value = h.colorDark;
      Ed.redraw();
      toast(text('Đã khôi phục màu hover mặc định.', 'Hover colors restored to defaults.'));
    },
    'reset-select-colors': () => {
      Ed.resetSelectColor();
      const c = Ed.getSelectColor();
      const optSL = document.getElementById('optSelectColorLight');
      if (optSL) optSL.value = c.light;
      const optSD = document.getElementById('optSelectColorDark');
      if (optSD) optSD.value = c.dark;
      Ed.redraw();
      toast(text('Đã khôi phục màu chọn mặc định.', 'Selection colors restored to defaults.'));
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
        <li>Add reaction and equilibrium arrows with labels, and format text with chemistry-oriented LaTeX scripts.</li>
        <li>Export SVG source, copy PNG images, download .svg/.png, and save .json projects — runs offline without a server.</li>
      </ul>
      <p class="muted">Open <code>index.html</code> in any modern browser.</p>` : `
      <p><b>Chemistry Workspace</b> — công cụ web tĩnh vẽ công thức khung (skeletal) phong cách Google Workspace.</p>
      <ul>
        <li>Vẽ hydrocarbon, arene, dị vòng, nhóm chức với đầy đủ liên kết đơn/đôi/ba, nét đậm–nét đứt.</li>
        <li>Thư viện mẫu: benzen, toluen, naftalen, pyridine, pyrrole, furan, thiophene, imidazole…</li>
        <li>Chèn mũi tên phản ứng/thuận nghịch kèm nhãn; định dạng công thức bằng LaTeX (chỉ số dưới/trên).</li>
        <li>Xuất <b>SVG dạng mã</b>, sao chép ảnh PNG, tải .svg/.png, lưu dự án .json — chạy offline, không cần server.</li>
      </ul>
      <p class="muted">Mở <code>index.html</code> bằng bất kỳ trình duyệt hiện đại nào.</p>`)
  };
  function shortcutTable() {
    if (I && I.language === 'en') return `<table>
      <tr><td>V / H / A / E / Z</td><td>Select · Pan · Atom · Erase · Carbon chain</td></tr>
      <tr><td>1 / 2 / 3</td><td>Single / double / triple bond</td></tr>
      <tr><td>4 / 5</td><td>Solid wedge / hashed wedge</td></tr>
      <tr><td>R / Shift+R</td><td>Rotate a terminal branch or a ring with its substituents by ±15°; select a bond to rotate one branch at a junction, or rotate a template before placing it</td></tr>
      <tr><td>Alt+R / Alt+Shift+R</td><td>Rotate the selected atom's whole connected molecule by ±15°</td></tr>
      <tr><td>Shift + drag</td><td>Draw freely without angle snapping</td></tr>
      <tr><td>Middle mouse / Space</td><td>Pan canvas</td></tr>
      <tr><td>Ctrl+Z / Ctrl+Y</td><td>Undo / Redo</td></tr>
      <tr><td>Ctrl+A / Delete</td><td>Select all / Delete object</td></tr>
      <tr><td>Ctrl + drag / Ctrl + click</td><td>Add a selection region / toggle an item; Ctrl+C copies selected objects as PNG</td></tr>
      <tr><td>G / T / Y / 0 / Esc</td><td>Toggle grid · Switch grid type · Change grid orientation and rotate structures · Fit view · Deselect</td></tr>
      <tr><td>Select atom</td><td>Edit its element/group in Properties (e.g. Fe, OH, COOH); double-click to edit</td></tr>
      <tr><td>Scroll wheel</td><td>Zoom at cursor</td></tr>
      <tr><td>/</td><td>Search the template library</td></tr>
    </table>`;
    return `<table>
      <tr><td>V / H / A / E / Z</td><td>Chọn · Kéo khung · Nguyên tử · Tẩy · Mạch zigzag</td></tr>
      <tr><td>1 / 2 / 3</td><td>Liên kết đơn / đôi / ba</td></tr>
      <tr><td>4 / 5</td><td>Nét đậm (wedge) / Nét đứt (hash)</td></tr>
      <tr><td>R / Shift+R</td><td>Xoay nhánh tận cùng hoặc vòng kèm nhóm thế ±15°; chọn liên kết để xoay một nhánh tại nút giao, hoặc xoay mẫu trước khi đặt</td></tr>
      <tr><td>Alt+R / Alt+Shift+R</td><td>Xoay toàn bộ phân tử liên thông quanh nguyên tử đang chọn ±15°</td></tr>
      <tr><td>Shift + kéo</td><td>Vẽ tự do, không bắt góc theo lưới</td></tr>
      <tr><td>Chuột giữa / Space</td><td>Kéo khung nhìn</td></tr>
      <tr><td>Ctrl+Z / Ctrl+Y</td><td>Hoàn tác / Làm lại</td></tr>
      <tr><td>Ctrl+A / Delete</td><td>Chọn tất cả / Xóa đối tượng</td></tr>
      <tr><td>Ctrl + kéo / Ctrl + nhấn</td><td>Cộng vùng chọn / thêm hoặc bỏ đối tượng; Ctrl+C sao chép vùng chọn thành PNG</td></tr>
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
      body.innerHTML = `<p class="muted">${text('Chưa chọn gì. Nhấn vào một nguyên tử để chọn và sửa ký hiệu/nhóm ở đây; double-click để sửa nhanh.', 'Nothing selected. Click an atom to edit its element or group here; double-click for quick editing.')}</p>
        `;
      return;
    }
    if (sel.type === 'atom') {
      const a = M.atom(sel.id);
      if (!a) { Ed.st.sel = null; return updateProps(); }
      const isInvalidValence = M.valenceViolations().includes(a.id);
      body.innerHTML = `<div class="propgrid">
        <label>${text('Ký hiệu / nhóm', 'Element / group')}</label>
        <input id="pEl" type="text" list="atomLabels" maxlength="16" autocomplete="off" aria-label="${text('Ký hiệu nguyên tử hoặc nhóm chức', 'Element or functional group')}">
        <label>${text('LaTeX cho nhãn', 'LaTeX label')}</label><select id="pAtomLatex"><option value="disabled">${text('Tắt', 'Disable')}</option><option value="enabled">${text('Bật', 'Enable')}</option></select>
        <label>${text('Màu nhãn', 'Label color')}</label>
        <select id="pColor" aria-label="${text('Màu nguyên tử hoặc nhóm chức', 'Element or group color')}">
          ${colorOptionsMarkup(a.color || null, text('Mặc định', 'Default'))}
        </select>
        <input id="pColorCustom" type="color" hidden aria-label="${text('Màu tùy chỉnh', 'Custom color')}">
        <label>${text('Toạ độ X', 'X coordinate')}</label><input id="pX" type="number" step="1" value="${a.x}">
        <label>${text('Toạ độ Y', 'Y coordinate')}</label><input id="pY" type="number" step="1" value="${a.y}">
        <label>${text('Bậc', 'Degree')}</label><span class="muted">${M.degree(a.id)} ${text('liên kết', 'bonds')}</span>
        <label>${text('Hóa trị', 'Valence')}</label><span class="${isInvalidValence ? 'valence-warn-inline' : 'muted'}">${M.atomValence(a.id)}</span>
      </div>
      `;
      const elInput = document.getElementById('pEl');
      elInput.value = a.el;
      elInput.onchange = e => {
        const value = e.target.value.trim();
        if (!value) { toast(text('Ký hiệu hoặc tên nhóm không được để trống.', 'Element or group name cannot be empty.')); e.target.value = a.el; return; }
        if (value.length > 16) { toast(text('Tên nguyên tử/nhóm tối đa 16 ký tự.', 'Element or group name must be 16 characters or fewer.')); e.target.value = a.el; return; }
        if (value !== a.el) M.transact(() => { a.el = value; }, 'prop');
      };
      const latexInput = document.getElementById('pAtomLatex');
      latexInput.value = a.latex === true ? 'enabled' : 'disabled';
      latexInput.onchange = e => M.transact(() => { a.latex = e.target.value === 'enabled'; }, 'atom-latex');
      const latexHelp = document.createElement('p');
      latexHelp.className = 'muted';
      latexHelp.textContent = text('Dùng CH_3, NH_{2}, N^+ hoặc ký hiệu có dấu $...$.', 'Use CH_3, NH_{2}, N^+, or delimit expressions with $...$.');
      body.appendChild(latexHelp);
      bindColorControls('pColor', 'pColorCustom', a.color || null, M.elColor(a.el), value => {
        if (value === a.color) return;
        M.transact(() => {
          if (value === null) delete a.color;
          else a.color = value;
        }, 'atom-color');
      });
      document.getElementById('pX').onchange = e => M.transact(() => { a.x = +e.target.value; }, 'prop');
      document.getElementById('pY').onchange = e => M.transact(() => { a.y = +e.target.value; }, 'prop');
      // Nếu nguyên tử thuộc một phân tử đường → hiện bộ chọn cấu hình α/β (anomer).
      if (a.sugar && a.sugar.name) {
        const variants = T.sugarVariants(a.sugar.name);
        if (variants.length) {
          const wrap = document.createElement('div');
          wrap.className = 'chem-property-group';
          const current = a.sugar.anomer;
          wrap.innerHTML = `<h3>${text('Cấu hình đường', 'Sugar configuration')} — ${text(a.sugar.name, window.ChemI18n ? window.ChemI18n.name(a.sugar.name) : a.sugar.name)}</h3>
            <div class="btnrow sugar-anomer-row">
              ${variants.map(v => `<button class="btn${current === v.id ? ' primary' : ''}" data-anomer="${v.id}" type="button">${text(v.vi, v.en)}</button>`).join('')}
            </div>
            <p class="muted">${text('Bấm để dựng lại phân tử theo dạng cấu hình đã chọn (α/β).', 'Click to rebuild the molecule in the selected configuration (α/β).')}</p>`;
          body.appendChild(wrap);
          wrap.querySelectorAll('[data-anomer]').forEach(btn => {
            btn.onclick = () => {
              const chosen = variants.find(v => v.id === btn.dataset.anomer);
              const newId = Ed.applySugarAnomer(sel.id, btn.dataset.anomer);
              if (newId != null) {
                toast(text('Đã chuyển sang ' + chosen.vi + '.', 'Switched to ' + chosen.en + '.'));
                Ed.st.sel = { type: 'atom', id: newId };
                Ed.redraw();
                updateProps();
              } else {
                toast(text('Không đổi được: phân tử đường đã bị sửa hoặc xoá nguyên tử. Hãy đặt lại mẫu.', 'Cannot switch: the sugar molecule was edited or an atom was removed. Please place the template again.'));
              }
            };
          });
        }
      }
    } else if (sel.type === 'bond') {
      const b = M.bond(sel.id);
      if (!b) { Ed.st.sel = null; return updateProps(); }
      const A = M.atom(b.a), B = M.atom(b.b);
      const aromaticDouble = M.aromaticDoubleBondIds();
      const isAromaticDouble = aromaticDouble.has(b.id);
      const isDoubleBond = isAromaticDouble || b.order === 2 || b.dbl;
      const aromaticNote = isAromaticDouble
        ? `<p class="muted">${text('Liên kết đôi thuộc hệ thơm (đang hiển thị dạng Kekulé).', 'Double bond part of an aromatic system (shown in Kekulé form).')}</p>`
        : '';
      body.innerHTML = `<div class="propgrid">
        <label>${text('Loại liên kết', 'Bond order')}</label>
        <select id="pOrder">
          ${isAromaticDouble ? `<option value="aromatic" selected>${text('Thơm (đôi/Kekulé)', 'Aromatic (double/Kekulé)')}</option>` : ''}
          <option value="1" ${!isAromaticDouble && b.order === 1 ? 'selected' : ''}>${text('Đơn', 'Single')}</option>
          <option value="2" ${!isAromaticDouble && b.order === 2 ? 'selected' : ''}>${text('Đôi', 'Double')}</option>
          <option value="3" ${!isAromaticDouble && b.order === 3 ? 'selected' : ''}>${text('Ba', 'Triple')}</option>
        </select>
        <label>${text('Kiểu nét', 'Bond style')}</label>
        <select id="pStyle">
          <option value="solid" ${b.style === 'solid' ? 'selected' : ''}>${text('Liền mạch', 'Solid')}</option>
          <option value="wedge" ${b.style === 'wedge' ? 'selected' : ''}>${text('Nét đậm (▲)', 'Solid wedge (▲)')}</option>
          <option value="hash" ${b.style === 'hash' ? 'selected' : ''}>${text('Nét đứt (╱)', 'Hashed wedge (╱)')}</option>
        </select>
        <label>${text('Màu liên kết', 'Bond color')}</label>
        <select id="pBondColor" aria-label="${text('Màu liên kết', 'Bond color')}">
          ${colorOptionsMarkup(b.color || null, text('Mặc định', 'Default'))}
        </select>
        <input id="pBondColorCustom" type="color" hidden aria-label="${text('Màu tùy chỉnh', 'Custom color')}">
        <label>${text('Từ → Đến', 'From → To')}</label><span class="muted">${A ? A.el : '?'} → ${B ? B.el : '?'}</span>
      </div>
      ${aromaticNote}
      <div class="btnrow">
        ${b.style === 'solid' && isDoubleBond ? `<button class="btn" id="pSwapDoubleSide" type="button">${text('Đổi phía nét phụ', 'Swap parallel line side')}</button>` : ''}
        <button class="btn" id="pDelBond">${text('Xóa liên kết', 'Delete bond')}</button>
      </div>`;
      document.getElementById('pOrder').onchange = e => {
        const value = e.target.value;
        if (value === 'aromatic') return; // giữ nguyên cấu trúc Kekulé của hệ thơm
        M.transact(() => {
          // Gỡ liên kết khỏi cấu trúc Kekulé của mọi vòng để bậc do người dùng đặt có hiệu lực.
          for (const ring of M.S.rings) {
            if (Array.isArray(ring.dblIds)) ring.dblIds = ring.dblIds.filter(x => x !== b.id);
          }
          b.order = +value;
          b.dbl = false;
          b.arom = false;
          b.dblSide = undefined;
        }, 'prop');
      };
      document.getElementById('pStyle').onchange = e => M.transact(() => { b.style = e.target.value; }, 'prop');
      bindColorControls('pBondColor', 'pBondColorCustom', b.color || null, Th.palette().ink, value => {
        if (value === b.color) return;
        M.transact(() => {
          if (value === null) delete b.color;
          else b.color = value;
        }, 'bond-color');
      });
      const swapDoubleSide = document.getElementById('pSwapDoubleSide');
      if (swapDoubleSide) swapDoubleSide.onclick = () => M.transact(() => { b.dblSide = b.dblSide === 1 ? -1 : 1; }, 'bond-side');
      document.getElementById('pDelBond').onclick = () => actions.delete();
    } else if (sel.type === 'text') {
      const annotation = M.textItem(sel.id);
      if (!annotation) { Ed.st.sel = null; return updateProps(); }
      if (annotation.type === 'arrow') {
        body.innerHTML = `<div class="propgrid">
          <label>${text('Loại mũi tên', 'Arrow type')}</label>
          <select id="pArrowType">
            <option value="forward" ${annotation.arrowType !== 'equilibrium' ? 'selected' : ''}>${text('Phản ứng →', 'Reaction →')}</option>
            <option value="equilibrium" ${annotation.arrowType === 'equilibrium' ? 'selected' : ''}>${text('Thuận nghịch ⇌', 'Equilibrium ⇌')}</option>
          </select>
          <label>${text('Nhãn phía trên', 'Label above')}</label><input id="pArrowAbove" type="text">
          <label>${text('Nhãn phía dưới', 'Label below')}</label><input id="pArrowBelow" type="text">
          <label>${text('LaTeX', 'LaTeX')}</label><select id="pTextLatex"><option value="disabled">${text('Tắt', 'Disable')}</option><option value="enabled">${text('Bật', 'Enable')}</option></select>
        </div>
        <div class="btnrow"><button class="btn" id="pDeleteText" type="button">${text('Xóa mũi tên', 'Delete arrow')}</button></div>
        <p class="muted">${text('Kéo mũi tên trên khung vẽ để di chuyển. LaTeX hỗ trợ chỉ số và lệnh như \\\\Delta, \\\\rightarrow.', 'Drag the arrow on the canvas to move it. LaTeX supports scripts and commands such as \\\\Delta and \\\\rightarrow.')}</p>`;
        const typeInput = document.getElementById('pArrowType');
        typeInput.onchange = e => M.transact(() => { annotation.arrowType = e.target.value; }, 'arrow');
        for (const [id, key] of [['pArrowAbove', 'above'], ['pArrowBelow', 'below']]) {
          const input = document.getElementById(id);
          input.value = annotation[key] || '';
          input.onchange = e => M.transact(() => { annotation[key] = e.target.value; }, 'arrow-label');
        }
        const latexInput = document.getElementById('pTextLatex');
        latexInput.value = annotation.latex === true ? 'enabled' : 'disabled';
        latexInput.onchange = e => M.transact(() => { annotation.latex = e.target.value === 'enabled'; }, 'text-latex');
        document.getElementById('pDeleteText').onclick = () => actions.delete();
      } else {
        body.innerHTML = `<div class="propgrid">
          <label>${text('Nội dung', 'Text')}</label><textarea id="pCanvasText" rows="3"></textarea>
          <label>${text('LaTeX', 'LaTeX')}</label><select id="pTextLatex"><option value="disabled">${text('Tắt', 'Disable')}</option><option value="enabled">${text('Bật', 'Enable')}</option></select>
        </div>
        <div class="btnrow"><button class="btn" id="pDeleteText" type="button">${text('Xóa chú thích', 'Delete text')}</button></div>
        <p class="muted">${text('Bật LaTeX để dùng chỉ số, ví dụ $CH_3$, hoặc ký hiệu như \\\\rightarrow.', 'Enable LaTeX for scripts, e.g. $CH_3$, or symbols such as \\\\rightarrow.')}</p>`;
        const content = document.getElementById('pCanvasText');
        content.value = annotation.text;
        content.onchange = e => M.transact(() => { annotation.text = e.target.value; }, 'text');
        const latexInput = document.getElementById('pTextLatex');
        latexInput.value = annotation.latex === true ? 'enabled' : 'disabled';
        latexInput.onchange = e => M.transact(() => { annotation.latex = e.target.value === 'enabled'; }, 'text-latex');
        document.getElementById('pDeleteText').onclick = () => actions.delete();
      }
    } else {
      const selectedCounts = [
        sel.ids.length ? `${sel.ids.length} ${text('nguyên tử', 'atoms')}` : '',
        (sel.bondIds || []).length ? `${sel.bondIds.length} ${text('liên kết', 'bonds')}` : '',
        (sel.textIds || []).length ? `${sel.textIds.length} ${text('chú thích', 'annotations')}` : ''
      ].filter(Boolean).join(', ');
      body.innerHTML = `<p class="muted">${text('Đang chọn', 'Selected')} <b>${selectedCounts}</b> — ${text('Del để xóa.', 'press Del to delete.')}</p>`;
    }
  }
  function updateUndoBtns() {
    const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
    if (u) { u.style.opacity = M.canUndo() ? 1 : .35; u.disabled = !M.canUndo(); }
    if (r) { r.style.opacity = M.canRedo() ? 1 : .35; r.disabled = !M.canRedo(); }
  }
  let quotaWarned = false;
  function persistDraft() {
    try {
      localStorage.setItem(TAB_AUTOSAVE_KEY, M.serialize(0));
      localStorage.setItem(AUTOSAVE_LATEST_KEY, TAB_AUTOSAVE_KEY);
      // Dấu thời gian cho bản nháp của tab này — pruneDrafts() dọn bản cũ theo nó.
      localStorage.setItem(`${TAB_AUTOSAVE_KEY}:t`, String(Date.now()));
    }
    catch (error) {
      console.warn('Unable to autosave the current drawing.', error);
      // Báo NGAY lần đầu lỗi lưu (bộ nhớ đầy): nếu im lặng thì người dùng không
      // biết bản vẽ không còn được tự động lưu và sẽ mất công sức lúc đóng tab.
      if (!quotaWarned && error && (error.name === 'QuotaExceededError' || error.code === 22)) {
        quotaWarned = true;
        toast(text('⚠ Bộ nhớ trình duyệt đầy — bản vẽ KHÔNG còn được tự động lưu. Hãy "Lưu dự án (.json)" để tránh mất dữ liệu.', '⚠ Browser storage is full — your drawing is NO LONGER autosaved. Use "Save project (.json)" to avoid losing data.'));
      }
    }
  }
  // Dọn bản nháp của các tab/phiên cũ: giữ `keep` bản MỚI NHẤT và xoá mọi bản
  // quá `maxAgeDays` — tab HIỆN TẠI không bao giờ bị xoá (kể cả khi quá hạn).
  // Chỉ bản nháp CÓ dấu thời gian (`:t`) mới được dọn; các bản lưu trước khi
  // thêm dấu thời gian được giữ lại (không đoán mò xoá nhầm).
  function pruneDrafts(keep = 5, maxAgeDays = 14) {
    try {
      const drafts = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${AUTOSAVE_KEY}:`) && k.endsWith(':t')) {
          drafts.push({ key: k.slice(0, -2), t: +localStorage.getItem(k) || 0 });
        }
      }
      drafts.sort((a, b) => b.t - a.t);
      drafts.forEach((d, i) => {
        if (d.key === TAB_AUTOSAVE_KEY) return;
        if (i >= keep || Date.now() - d.t > maxAgeDays * 864e5) {
          localStorage.removeItem(d.key);
          localStorage.removeItem(`${d.key}:t`);
        }
      });
    }
    catch (error) { console.warn('Unable to prune old autosaved drafts.', error); }
  }
  // Khôi phục bản nháp tự động lưu. Trả về { ok, dropped, backedUp }:
  //  - ok: đã tải được (phần bản ghi tốt nhất); dropped = số bản ghi hỏng bị bỏ.
  //  - backedUp: JSON hỏng → bản nháp được sao lưu sang khoá riêng TRƯỚC khi
  //    lần chỉnh sửa sau ghi đè khoá chính, để không mất dữ liệu có thể cứu.
  function restoreDraft() {
    let draft;
    try {
      draft = localStorage.getItem(TAB_AUTOSAVE_KEY);
      if (!draft) {
        const latestKey = localStorage.getItem(AUTOSAVE_LATEST_KEY);
        if (latestKey && latestKey.startsWith(`${AUTOSAVE_KEY}:`) && latestKey !== AUTOSAVE_LATEST_KEY) {
          draft = localStorage.getItem(latestKey);
        }
      }
      if (!draft) draft = localStorage.getItem(AUTOSAVE_KEY);
    }
    catch (error) {
      console.warn('Unable to read the autosaved drawing.', error);
      return { ok: false, dropped: 0, backedUp: false };
    }
    if (!draft) return { ok: false, dropped: 0, backedUp: false };
    try {
      const result = M.deserialize(draft);
      return { ok: true, dropped: (result && result.dropped) || 0, backedUp: false };
    } catch (error) {
      try { localStorage.setItem(DRAFT_BACKUP_KEY, draft); }
      catch (ignored) { /* localStorage đầy — đành chịu, vẫn còn console.warn */ }
      console.warn('Unable to restore the autosaved drawing (a backup copy was kept).', error);
      return { ok: false, dropped: 0, backedUp: true };
    }
  }
  function refreshLanguage() {
    updateProps();
    updateSugarBtn();
    syncViewControls();
    Ed.updateGrid();
    Ed.redraw();
  }
  // ---------- Chuyển kiểu vẽ đường (khung phẳng ↔ Haworth) ----------
  function sugarBtnLabel(layout) {
    return layout === 'haworth'
      ? text('↻ Haworth', '↻ Haworth')
      : text('↻ Khung phẳng', '↻ Flat skeleton');
  }
  function updateSugarBtn(layout) {
    const btn = document.getElementById('sugarLayoutBtn');
    if (btn) {
      const l = layout != null ? layout : T.getSugarLayout();
      btn.textContent = sugarBtnLabel(l);
      btn.title = text(
        l === 'haworth' ? 'Đang dùng công thức Haworth — bấm để chuyển sang khung phẳng' : 'Đang dùng khung phẳng (wedge/hash) — bấm để chuyển sang Haworth',
        l === 'haworth' ? 'Using Haworth projection — click to switch to flat skeleton' : 'Using flat skeleton (wedge/hash) — click to switch to Haworth'
      );
    }
  }
  function toggleSugarLayout() {
    const next = T.getSugarLayout() === 'haworth' ? 'flat' : 'haworth';
    T.setSugarLayout(next);
    T.renderLibraries(document.getElementById('tplSearch').value || '');
    updateSugarBtn(next);
    // Nếu đang chọn một mẫu đường, cập nhật lại ghost theo layout mới.
    if (Ed.st && Ed.st.tpl) Ed.redraw();
    toast(next === 'haworth'
      ? text('Đường sẽ vẽ theo công thức Haworth (vòng nghiêng, nhóm chức thẳng đứng).', 'Sugars will use the Haworth projection (tilted ring, vertical substituents).')
      : text('Đường sẽ vẽ theo khung phẳng (vòng đều, nhóm chức hướng ra ngoài + wedge/hash).', 'Sugars will use the flat skeleton (regular ring, substituents pointing out + wedge/hash).'));
  }
  // ---------- Nối sự kiện ----------
  function init() {
    restoreSettings();
    const draftState = restoreDraft();
    // Dọn bản nháp tab cũ TRƯỚC khi ghi bản vừa khôi phục sang khoá của TAB NÀY
    // — nội dung đã nằm trong bộ nhớ nên dù nguồn bị dọn, persistDraft bên dưới
    // sẽ lưu lại ngay, không mất dữ liệu.
    pruneDrafts();
    if (draftState.ok) persistDraft();
    T.renderLibraries('');
    updateSugarBtn(T.getSugarLayout());
    // Cập nhật panel thuộc tính + nút undo mỗi lần redraw (khi selection đổi).
    let lastSelKey = '';
    Ed.st.onAfter = () => {
      updateUndoBtns();
      const key = JSON.stringify(Ed.st.sel);
      if (key !== lastSelKey) {
        lastSelKey = key;
        updateProps();
        // Cảnh báo khi người dùng chọn một nguyên tử đang vượt hóa trị cho phép.
        const sel = Ed.st.sel;
        if (sel && sel.type === 'atom' && M.valenceViolations().includes(sel.id)) {
          const a = M.atom(sel.id);
          if (a) toast(text(`⚠ ${a.el} vượt hóa trị cho phép (${M.atomValence(a.id)}/${M.maxValence(a.el)}).`, `⚠ ${a.el} exceeds its allowed valence (${M.atomValence(a.id)}/${M.maxValence(a.el)}).`));
        }
      }
    };
    Ed.init();
    // Lưu localStorage + đồng bộ panel mỗi khi đổi lưới/bắt điểm bằng nút
    // toolbar hoặc phím tắt (G/T/Y, bắt điểm) — trước đây các thao tác này
    // không gọi saveSettings nên cài đặt lưới bị mất sau khi tải lại trang.
    Ed.setSettingsObserver(() => { syncGridSettingsPanel(); saveSettings(); });
    if (draftState.ok) Ed.fitView();
    updateProps(); updateUndoBtns();
    M.onChange(() => { persistDraft(); updateProps(); updateUndoBtns(); });

    document.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (a && actions[a.dataset.action]) { actions[a.dataset.action](); closeMenus(); return; }
      const tool = e.target.closest('.tool[data-tool]');
      if (tool) { Ed.setTool(tool.dataset.tool); return; }
      const bb = e.target.closest('.bondbtn');
      if (bb) { Ed.setBond(+bb.dataset.order, bb.dataset.style); return; }
      const atom = e.target.closest('.atom');
      if (atom) { Ed.setElement(atom.dataset.el); return; }
      const sugarBtn = e.target.closest('#sugarLayoutBtn');
      if (sugarBtn) { toggleSugarLayout(); return; }
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
    // Lề xuất ảnh: đổi là vẽ lại khung xem trước + cập nhật mã SVG.
    ['optMarginTop', 'optMarginBottom', 'optMarginLeft', 'optMarginRight'].forEach((id, i) =>
      bindRange(id, id + 'V', () => { Ed.redraw(); X.refreshCodeView(); }));
    document.getElementById('settingsExportFrame').addEventListener('change', () => { Ed.redraw(); saveSettings(); });
    ['optCircle', 'optKekule', 'optTransparent'].forEach(id =>
      document.getElementById(id).addEventListener('change', () => { Ed.redraw(); X.refreshCodeView(); saveSettings(); }));
    document.getElementById('optBg').addEventListener('input', () => { Ed.redraw(); X.refreshCodeView(); saveSettings(); });
    document.querySelectorAll('[data-label-color]').forEach(input => input.addEventListener('input', () => {
      Th.setLabelColor(input.dataset.labelColor, input.value);
      Ed.redraw();
    }));
    document.getElementById('settingsView').addEventListener('change', e => {
      applyView(e.target.value);
      syncViewControls(); Ed.redraw(); saveSettings();
    });
    // Hover / select highlight settings.
    document.getElementById('settingsHoverEnabled').addEventListener('change', e => {
      Ed.setHoverSettings({ enabled: e.target.value === 'enabled' });
      Ed.redraw();
    });
    document.getElementById('optHoverColorLight').addEventListener('input', e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        Ed.setHoverSettings({ colorLight: e.target.value });
        Ed.redraw();
      }
    });
    document.getElementById('optHoverColorDark').addEventListener('input', e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        Ed.setHoverSettings({ colorDark: e.target.value });
        Ed.redraw();
      }
    });
    document.getElementById('optSelectColorLight').addEventListener('input', e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        Ed.setSelectColor({ light: e.target.value });
        Ed.redraw();
      }
    });
    document.getElementById('optSelectColorDark').addEventListener('input', e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        Ed.setSelectColor({ dark: e.target.value });
        Ed.redraw();
      }
    });
    document.getElementById('settingsGrid').addEventListener('change', e => {
      Ed.st.grid = e.target.value === 'enabled'; Ed.updateGrid(); saveSettings();
    });
    document.getElementById('settingsSnap').addEventListener('change', e => {
      Ed.st.snap = e.target.value === 'enabled'; saveSettings();
    });
    document.getElementById('settingsValenceCheck').addEventListener('change', () => {
      Ed.redraw(); saveSettings();
    });
    document.getElementById('settingsGridType').addEventListener('change', e => {
      Ed.st.gridType = e.target.value; Ed.updateGrid(); saveSettings();
    });
    document.getElementById('settingsGridOrientation').addEventListener('change', e => {
      Ed.st.gridOrientation = e.target.value; Ed.updateGrid(); saveSettings();
    });
    document.getElementById('settingsSelectionMode').addEventListener('change', e => {
      Ed.setSelectionMode(e.target.value); saveSettings();
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
        try {
          const result = M.deserialize(rd.result);
          Ed.redraw(); Ed.fitView();
          const skipped = result && result.dropped
            ? text(` (bỏ qua ${result.dropped} bản ghi hỏng)`, ` (${result.dropped} damaged record(s) skipped)`)
            : '';
          toast(text('Đã mở "' + file.name + '" ✓', 'Opened "' + file.name + '" ✓') + skipped);
        }
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
    syncViewControls();
    saveSettings();
    document.getElementById('avatarBtn').addEventListener('click', avatarModal);
    document.getElementById('avatarFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) readAvatar(f);
      e.target.value = '';
    });
    toast(draftState.backedUp
      ? text(`Không tải được bản nháp (JSON hỏng) — đã giữ bản sao trong khoá "${DRAFT_BACKUP_KEY}" để không mất dữ liệu.`, `Could not load the draft (broken JSON) — a copy was kept under the "${DRAFT_BACKUP_KEY}" key so no data is lost.`)
      : draftState.ok
        ? (draftState.dropped
          ? text(`Đã khôi phục bản vẽ — bỏ qua ${draftState.dropped} bản ghi hỏng.`, `Draft restored — ${draftState.dropped} damaged record(s) skipped.`)
          : text('Đã khôi phục bản vẽ tự động lưu trên thiết bị này.', 'Restored the drawing autosaved on this device.'))
        : text('Sẵn sàng — bản vẽ tự động lưu trên thiết bị này.', 'Ready — drawings are autosaved on this device.'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  return { init, toast, showModal, closeModal, actions, worldCenter, place, refreshLanguage };
})();