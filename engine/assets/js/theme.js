'use strict';
/* theme.js — Giao diện sáng/tối + bảng màu theo chủ đề.
   Nạp TRƯỚC các module khác; giá trị theme được ghi vào <html data-theme>
   bởi script nội tuyến trong <head> để tránh nhấp nháy khi tải trang. */
window.ChemTheme = (() => {
  const KEY = 'chem-theme';
  const PAL = {
    light: { ink: '#202124', halo: '#ffffff', canvas: '#ffffff', grid: '#d7e0ec', blue: '#0b57d0' },
    dark:  { ink: '#e8eaed', halo: '#202124', canvas: '#202124', grid: '#3c4043', blue: '#8ab4f8' }
  };
  // Màu nhãn nguyên tử theo giao diện (sáng = bảng gốc, tối = biến thể sáng hơn).
  const EL = {
    light: { N: '#0b57d0', 'N⁺': '#0b57d0', O: '#d01818', 'O⁻': '#d01818', S: '#b58900', P: '#e8710a', F: '#1a7f37', Cl: '#1a7f37', Br: '#9334e6', I: '#9334e6', OH: '#d01818', NH2: '#0b57d0', SH: '#b58900', COOH: '#d01818', CHO: '#d01818', COOCH3: '#d01818', NO2: '#0b57d0', CN: '#0b57d0', OCH3: '#d01818' },
    dark:  { N: '#8ab4f8', 'N⁺': '#8ab4f8', O: '#ff8177', 'O⁻': '#ff8177', S: '#d4a72c', P: '#f2a950', F: '#6dd58c', Cl: '#6dd58c', Br: '#c58af9', I: '#c58af9', OH: '#ff8177', NH2: '#8ab4f8', SH: '#d4a72c', COOH: '#ff8177', CHO: '#ff8177', COOCH3: '#ff8177', NO2: '#8ab4f8', CN: '#8ab4f8', OCH3: '#ff8177' }
  };
  const COLOR_KEY = 'chem-label-colors';
  let labelOverrides = {};
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        labelOverrides = Object.fromEntries(Object.entries(parsed).filter(([label, color]) =>
          typeof label === 'string' && label.length <= 16 && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
        ));
      }
    }
  } catch (error) {
    console.warn('Unable to load custom label colors.', error);
  }
  function theme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function isDark() { return theme() === 'dark'; }
  function set(t) {
    const v = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function toggle() { set(isDark() ? 'light' : 'dark'); return theme(); }
  function palette() { return PAL[theme()]; }
  function elColor(el) { return labelOverrides[el] || EL[theme()][el] || palette().ink; }
  function setLabelColor(label, color) {
    if (typeof label !== 'string' || !label || label.length > 16 || !/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error('Invalid label color setting.');
    }
    labelOverrides[label] = color;
    try { localStorage.setItem(COLOR_KEY, JSON.stringify(labelOverrides)); }
    catch (error) { console.warn('Unable to save custom label colors.', error); }
  }
  function resetLabelColors() {
    labelOverrides = {};
    try { localStorage.removeItem(COLOR_KEY); }
    catch (error) { console.warn('Unable to reset custom label colors.', error); }
  }
  function customLabelColors() { return Object.assign({}, labelOverrides); }
  return { theme, isDark, set, toggle, palette, elColor, setLabelColor, resetLabelColors, customLabelColors };
})();