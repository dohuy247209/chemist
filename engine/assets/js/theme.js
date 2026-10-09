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
    light: { N: '#0b57d0', O: '#d01818', S: '#b58900', P: '#e8710a', F: '#1a7f37', Cl: '#1a7f37', Br: '#9334e6', I: '#9334e6' },
    dark:  { N: '#8ab4f8', O: '#ff8177', S: '#d4a72c', P: '#f2a950', F: '#6dd58c', Cl: '#6dd58c', Br: '#c58af9', I: '#c58af9' }
  };
  function theme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function isDark() { return theme() === 'dark'; }
  function set(t) {
    const v = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function toggle() { set(isDark() ? 'light' : 'dark'); return theme(); }
  function palette() { return PAL[theme()]; }
  function elColor(el) { return (EL[theme()][el]) || palette().ink; }
  return { theme, isDark, set, toggle, palette, elColor };
})();