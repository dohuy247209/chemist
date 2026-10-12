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
  const FACTORY_DEFAULT_COLORS = {
    light: { bond: '#202124', atom: '#202124', text: '#202124' },
    dark:  { bond: '#e8eaed', atom: '#e8eaed', text: '#e8eaed' }
  };
  const DEFAULT_COLORS_KEY = 'chem-default-colors';
  const GROUP_COLORS_KEY = 'chem-group-colors-enabled';

  let defaultColors = {
    light: Object.assign({}, FACTORY_DEFAULT_COLORS.light),
    dark:  Object.assign({}, FACTORY_DEFAULT_COLORS.dark)
  };
  let groupColorsEnabled = true;

  try {
    const savedColors = localStorage.getItem(DEFAULT_COLORS_KEY);
    if (savedColors) {
      const p = JSON.parse(savedColors);
      if (p && typeof p === 'object') {
        for (const t of ['light', 'dark']) {
          if (p[t] && typeof p[t] === 'object') {
            for (const k of ['bond', 'atom', 'text']) {
              if (typeof p[t][k] === 'string' && /^#[0-9a-f]{6}$/i.test(p[t][k])) {
                defaultColors[t][k] = p[t][k];
              }
            }
          }
        }
      }
    }
  } catch (e) {}

  try {
    const savedGroup = localStorage.getItem(GROUP_COLORS_KEY);
    if (savedGroup !== null) {
      groupColorsEnabled = savedGroup !== 'false';
    }
  } catch (e) {}

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
  function bondColor() { return defaultColors[theme()].bond; }
  function atomColor() { return defaultColors[theme()].atom; }
  function textColor() { return defaultColors[theme()].text; }
  function themeInk() { return PAL[theme()].ink; }
  function palette() {
    const p = PAL[theme()];
    return Object.assign({}, p, {
      ink: p.ink,
      themeInk: p.ink,
      bond: bondColor(),
      atom: atomColor(),
      text: textColor()
    });
  }
  function elColor(el) {
    if (!groupColorsEnabled) return atomColor();
    return labelOverrides[el] || EL[theme()][el] || atomColor();
  }
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

  function getDefaultColors() {
    return {
      light: Object.assign({}, defaultColors.light),
      dark:  Object.assign({}, defaultColors.dark)
    };
  }
  function setDefaultColor(type, mode, color) {
    if (!['bond', 'atom', 'text'].includes(type) || !['light', 'dark'].includes(mode) || !/^#[0-9a-f]{6}$/i.test(color)) return;
    defaultColors[mode][type] = color;
    try { localStorage.setItem(DEFAULT_COLORS_KEY, JSON.stringify(defaultColors)); } catch (e) {}
  }
  function resetDefaultColors() {
    defaultColors = {
      light: Object.assign({}, FACTORY_DEFAULT_COLORS.light),
      dark:  Object.assign({}, FACTORY_DEFAULT_COLORS.dark)
    };
    try { localStorage.removeItem(DEFAULT_COLORS_KEY); } catch (e) {}
  }

  function getGroupColorsEnabled() { return groupColorsEnabled; }
  function setGroupColorsEnabled(val) {
    groupColorsEnabled = !!val;
    try { localStorage.setItem(GROUP_COLORS_KEY, groupColorsEnabled ? 'true' : 'false'); } catch (e) {}
  }
  function resetGroupColorsEnabled() {
    groupColorsEnabled = true;
    try { localStorage.removeItem(GROUP_COLORS_KEY); } catch (e) {}
  }

  function hasSpecificColor(el) {
    if (!groupColorsEnabled) return false;
    return !!(labelOverrides[el] || (EL[theme()] && EL[theme()][el]));
  }
  function bondTintForAtom(atom) {
    if (!atom) return bondColor();
    if (atom.color) return atom.color;
    if (hasSpecificColor(atom.el)) return elColor(atom.el);
    return bondColor();
  }

  return {
    theme, isDark, set, toggle, palette, elColor, setLabelColor, resetLabelColors, customLabelColors,
    bondColor, atomColor, textColor, getDefaultColors, setDefaultColor, resetDefaultColors,
    getGroupColorsEnabled, setGroupColorsEnabled, resetGroupColorsEnabled,
    hasSpecificColor, bondTintForAtom, themeInk
  };
})();