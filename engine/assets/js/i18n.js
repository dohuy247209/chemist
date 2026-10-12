'use strict';
window.ChemI18n = (() => {
  const translations = {
    'Menu chính': 'Main menu', 'Tệp': 'File', 'Chỉnh sửa': 'Edit', 'Mẫu': 'Templates', 'Xem': 'View', 'Trợ giúp': 'Help',
    'Mới (xóa khung vẽ)': 'New (clear canvas)', 'Mở file .json…': 'Open .json file…', 'Lưu dự án (.json)': 'Save project (.json)',
    'Xuất file .svg': 'Export .svg file', 'Xuất ảnh .png': 'Export .png image', 'Sao chép mã SVG': 'Copy SVG code',
    '⬇ Xuất SVG': '⬇ Export SVG', 'Xuất SVG': 'Export SVG',
    'Hoàn tác': 'Undo', 'Làm lại': 'Redo', 'Chọn tất cả': 'Select all', 'Xóa đã chọn': 'Delete selected',
    'Mẫu: Etanol': 'Sample: Ethanol', 'Mẫu: Toluen': 'Sample: Toluene', 'Mẫu: Axit axetic': 'Sample: Acetic acid',
    'Vừa khung hình': 'Fit to view', 'Thu phóng 100%': 'Zoom to 100%', 'Bật/tắt lưới': 'Toggle grid',
    'Đổi lưới vuông / tam giác': 'Toggle square / triangular grid',
    'Đổi hướng trục tam giác và xoay cấu trúc': 'Change triangle-grid orientation and rotate structures',
    'Bật/tắt bắt điểm': 'Toggle snapping', 'Giao diện tối / sáng': 'Dark / light theme', 'Phím tắt': 'Keyboard shortcuts',
    'Bật/tắt phát sáng nhẹ': 'Toggle subtle glow',
    'Chèn chú thích văn bản': 'Insert text annotation',
    'Giới thiệu': 'About', 'Tìm mẫu, nhóm chức…  (nhấn / )': 'Search templates, functional groups… (press /)',
    'Hoàn tác (Ctrl+Z)': 'Undo (Ctrl+Z)', 'Làm lại (Ctrl+Y)': 'Redo (Ctrl+Y)',
    'Đổi giao diện tối / sáng': 'Toggle dark / light theme', 'Ảnh đại diện — nhấn để thay đổi': 'Avatar — click to change',
    'Công cụ vẽ': 'Drawing tools', 'Chọn / di chuyển (V)': 'Select / move (V)', 'Kéo khung nhìn (H)': 'Pan canvas (H)',
    'Nguyên tử': 'Atoms', 'Cacbon (C)': 'Carbon (C)', 'Nitơ (N)': 'Nitrogen (N)', 'Oxi (O)': 'Oxygen (O)',
    'Lưu huỳnh': 'Sulfur', 'Photpho': 'Phosphorus', 'Flo': 'Fluorine', 'Clo': 'Chlorine', 'Brom': 'Bromine', 'Iot': 'Iodine',
    'Bút đặt nguyên tử (A)': 'Atom tool (A)', 'Liên kết': 'Bonds', 'Liên kết đơn (1)': 'Single bond (1)',
    'Liên kết đôi (2)': 'Double bond (2)', 'Liên kết ba (3)': 'Triple bond (3)', 'Nét đậm (4)': 'Solid wedge (4)',
    'Nét đứt (5)': 'Hashed wedge (5)', 'Mạch C': 'Carbon chain', 'Vẽ mạch zigzag (Z)': 'Draw zigzag chain (Z)',
    'Số nguyên tử C trong mạch': 'Number of carbon atoms in chain', 'Tẩy (E)': 'Erase (E)',
    'Xóa đối tượng đang chọn': 'Delete selected object', 'Xoay cấu trúc đã chọn': 'Rotate selected structure',
    'Xoay cấu trúc đang chọn 15°; khi chọn mẫu, xoay mẫu theo bước lưới (Shift+R)': 'Rotate the selected atom branch or ring by 15°; rotate a template by one grid step (Shift+R)',
    'Xoay cấu trúc đang chọn 15°; khi chọn mẫu, xoay mẫu theo bước lưới (R)': 'Rotate the selected atom branch or ring by 15°; rotate a template by one grid step (R)',
    'Thư viện mẫu': 'Template library', 'Lọc mẫu…': 'Filter templates…', 'Vòng no': 'Saturated rings',
    'Vòng thơm (arene)': 'Aromatic rings (arenes)', 'Dị vòng thơm': 'Aromatic heterocycles',
    'Nhóm chức': 'Functional groups', 'Đường đơn': 'Simple sugars', 'Phân tử mẫu': 'Molecule templates',
    '💡 Chọn mẫu rồi nhấn lên khung vẽ. Đặt vòng mới gần một cạnh của vòng sẵn có để ghép chung cạnh; chọn cấu trúc rồi dùng ↶ / ↻ hoặc R để xoay.':
      '💡 Select a template, then click the canvas to place it. Place a ring near an existing ring edge to fuse them; select a structure and use ↶ / ↻ or R to rotate.',
    'Khung vẽ công thức': 'Molecular structure canvas', 'Loại lưới: vuông': 'Grid type: square',
    'Trục lưới tam giác nằm ngang': 'Triangle-grid axis is horizontal', 'Thu nhỏ': 'Zoom out',
    'Về 100%': 'Reset zoom to 100%', 'Phóng to': 'Zoom in', 'Vừa khung hình (0)': 'Fit to view (0)',
    'Thuộc tính': 'Properties', 'Mã SVG': 'SVG source', 'Cài đặt': 'Settings', 'Bảng điều khiển': 'Dashboard',
    'Đối tượng đang chọn': 'Selected object', 'Chưa chọn gì. Dùng công cụ Chọn (V) để chọn nguyên tử hoặc liên kết.':
      'Nothing selected. Use Select (V) to choose an atom or bond.',
    'Thành phần phương trình': 'Equation components', 'Chèn mũi tên phản ứng →': 'Insert reaction arrow →',
    'Chèn mũi tên thuận nghịch ⇌': 'Insert equilibrium arrow ⇌',
    'Mũi tên được chèn gần tâm khung vẽ; chọn và kéo để di chuyển.':
      'Arrows are inserted near the canvas center; select and drag to move.',
    'Kiểu vẽ': 'Drawing style', 'Kiểu vẽ mặc định': 'Default drawing style', 'Độ dài liên kết': 'Bond length', 'Độ dày nét': 'Stroke width', 'Cỡ chữ': 'Font size',
    'Tùy chọn xuất': 'Export options', 'Bật': 'Enable', 'Tắt': 'Disable',
    'Công cụ chọn mặc định': 'Default selection tool', 'Chế độ chọn': 'Selection mode',
    'Chọn mặc định (khung chữ nhật)': 'Default select (rectangle)', 'Lasso Select (chọn vùng tự do)': 'Lasso Select (freehand area)',
    'Lưới mặc định': 'Default grid', 'Vuông': 'Square', 'Tam giác': 'Triangle',
    'Đổi phía nét phụ': 'Swap parallel line side',
    'Vòng thơm vẽ vòng tròn trong': 'Draw aromatic rings as circles', 'Vòng thơm vẽ liên kết đôi xen kẽ (Kekulé)':
      'Draw alternating aromatic double bonds (Kekule)', 'Xem trước xuất bản': 'Export preview', 'Nền': 'Background',
    'Nền trong suốt': 'Transparent background', 'Hiệu ứng shiny': 'Shiny effect', 'Bật shiny': 'Enable shiny',
    'Chế độ hiển thị': 'Display mode', 'Kiểu liên kết': 'Bond style',
    'Mặc định': 'Default', 'Shiny / phát sáng nhẹ': 'Shiny / subtle glow',
    'Nửa liên kết theo màu nhóm': 'Half-tinted bonds',
    'Độ mạnh gradient': 'Gradient strength', 'Màu mặc định của nhãn': 'Default label colors',
    'Áp dụng cho nhãn mới nếu chưa đặt màu riêng trong Thuộc tính.': 'Used for new labels unless overridden in Properties.',
    'Khôi phục màu nhãn mặc định': 'Reset default label colors', 'Khôi phục cài đặt ban đầu': 'Reset settings to defaults',
    'Hiện lưới': 'Show grid', 'Bắt điểm vào lưới': 'Snap to grid', 'Loại lưới': 'Grid type', 'Trục lưới tam giác': 'Triangle grid axis',
    'Kiểm tra cấu trúc': 'Structure checks', 'Kiểm tra hóa trị tự động': 'Check valence automatically',
    'Nguyên tử vượt hóa trị cho phép được đánh dấu bằng vòng nét đứt màu đỏ.':
      'Atoms exceeding their allowed valence are marked with a dashed red circle.',
    'Nằm ngang': 'Horizontal', 'Nằm dọc': 'Vertical', 'Sao chép SVG': 'Copy SVG', 'Sao chép PNG': 'Copy PNG', 'Tải .svg': 'Download .svg',
    'Tải .png': 'Download .png', 'Lưu .json': 'Save .json', 'Sao chép': 'Copy', 'Làm mới': 'Refresh',
    '0 nguyên tử · 0 liên kết': '0 atoms · 0 bonds', 'Bắt điểm: Bật': 'Snap: On',
    'Mở index.html là chạy — không cần cài đặt.': 'Open index.html to run — no installation required.',
    'Tiêu đề': 'Title', 'Đóng': 'Close', 'Chọn một nguyên tử hoặc liên kết trước khi xoay.':
      'Select an atom or bond before rotating.',
    'Chào mừng! Nhấn mẫu ⬡ Benzen bên trái rồi nhấn vào khung vẽ.':
      'Welcome! Select the ⬡ Benzene template on the left, then click the canvas.'
  };
  const attributeTranslations = {
    'placeholder': {
      'Tìm mẫu, nhóm chức…  (nhấn / )': 'Search templates, functional groups… (press /)',
      'Lọc mẫu…': 'Filter templates…'
    },
    'aria-label': {
      'Menu chính': 'Main menu', 'Công cụ vẽ': 'Drawing tools', 'Khung vẽ công thức': 'Molecular structure canvas',
      'Xoay cấu trúc đã chọn': 'Rotate selected structure', 'Loại lưới: vuông': 'Grid type: square',
      'Trục lưới tam giác nằm ngang': 'Triangle-grid axis is horizontal'
    }
  };
  const names = {
    'Cyclopropan': 'Cyclopropane', 'Cyclobutan': 'Cyclobutane', 'Cyclopentan': 'Cyclopentane',
    'Cyclohexan': 'Cyclohexane', 'Chairs': 'Cyclohexane chair', 'Benzen': 'Benzene', 'Toluen': 'Toluene',
    'Naftalen': 'Naphthalene', 'Fenol': 'Phenol', 'Pyrrole (N)': 'Pyrrole', 'Furan (O)': 'Furan',
    'Thiophene (S)': 'Thiophene', 'Piridine (N)': 'Pyridine', 'Imidazole': 'Imidazole',
    '–OH': '–OH (hydroxy)', '–NH2': '–NH₂ (amino)', '–SH': '–SH (sulfanyl)', '=O': '=O (oxo)',
    '=S': '=S (thioxo)', '–CHO': '–CHO (formyl)', '–COOH': '–COOH (carboxy)',
    '–COOCH3': '–COOCH₃ (methoxycarbonyl)', '–NO2': '–NO₂ (nitro)', '–CN': '–CN (cyano)',
    '–F': '–F (fluoro)', '–Cl': '–Cl (chloro)', '–Br': '–Br (bromo)', '–I': '–I (iodo)',
    '–CH3': '–CH₃ (methyl)', 'Etan (C2)': 'Ethane (C2)', 'Propan (C3)': 'Propane (C3)',
    'Butan (C4)': 'Butane (C4)', 'Pentan (C5)': 'Pentane (C5)', 'Etanol': 'Ethanol',
    'Axit axetic': 'Ethanoic acid (acetic acid)', 'Aceton': 'Propanone (acetone)', 'Ethen': 'Ethene', 'Etyne': 'Ethyne',
    'Glucose': 'Glucose', 'Galactose': 'Galactose', 'Fructose': 'Fructose', 'Ribose': 'Ribose'
  };
  const textOriginals = new WeakMap();
  const attrOriginals = new WeakMap();
  let language = 'vi';
  try {
    const stored = localStorage.getItem('chem-language');
    if (stored === 'en' || stored === 'vi') language = stored;
  } catch (error) {
    console.warn('Unable to read saved language preference.', error);
  }
  function text(vietnamese, english) {
    return language === 'en' ? english : vietnamese;
  }
  function translatePage() {
    document.title = language === 'en' ? 'Chemistry Workspace — Skeletal Structure Editor' : 'Chemistry Workspace — Vẽ công thức khung';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!textOriginals.has(node)) textOriginals.set(node, node.nodeValue);
      const original = textOriginals.get(node);
      const trimmed = original.trim();
      if (language === 'en' && translations[trimmed]) {
        node.nodeValue = original.replace(trimmed, translations[trimmed]);
      } else {
        node.nodeValue = original;
      }
    }
    for (const element of document.body.querySelectorAll('*')) {
      let originals = attrOriginals.get(element);
      if (!originals) { originals = {}; attrOriginals.set(element, originals); }
      for (const attr of ['title', 'placeholder', 'aria-label']) {
        if (!element.hasAttribute(attr)) continue;
        if (!(attr in originals)) originals[attr] = element.getAttribute(attr);
        const original = originals[attr];
        element.setAttribute(attr, language === 'en'
          ? (attributeTranslations[attr] && attributeTranslations[attr][original]) || translations[original] || original
          : original);
      }
    }
    document.documentElement.lang = language;
    const button = document.getElementById('languageBtn');
    if (button) {
      button.textContent = language === 'en' ? 'VI' : 'EN';
      button.title = language === 'en' ? 'Switch to Vietnamese' : 'Switch to English';
      button.setAttribute('aria-label', button.title);
    }
  }
  function setLanguage(next) {
    if (next !== 'en' && next !== 'vi') throw new Error(`Unsupported language: ${next}`);
    language = next;
    try { localStorage.setItem('chem-language', language); }
    catch (error) { console.warn('Unable to save language preference.', error); }
    translatePage();
    if (window.ChemTemplates) window.ChemTemplates.renderLibraries(document.getElementById('tplSearch')?.value || '');
    if (window.ChemApp && window.ChemApp.refreshLanguage) window.ChemApp.refreshLanguage();
    if (window.ChemEditor) window.ChemEditor.redraw();
  }
  translatePage();
  return { get language() { return language; }, text, name: value => language === 'en' ? (names[value] || value) : value, setLanguage, translatePage };
})();
