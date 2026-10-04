// Loads every v2 preview in an iframe at several widths and themes and reports problems.
window.runAudit = async function (pages, widths, themes) {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const results = [];
  for (const page of pages) for (const w of widths) for (const theme of themes) {
    const f = document.createElement('iframe');
    f.style.cssText = `position:absolute;left:-5000px;top:0;width:${w}px;height:900px;border:0`;
    document.body.appendChild(f);
    await new Promise((res) => { f.onload = res; f.src = `/preview/${page}.html?t=${Date.now()}`; });
    const d = f.contentDocument, win = f.contentWindow;
    const tf = d.querySelector('.tf');
    if (theme === 'dark') tf.classList.add('dark'); else tf.classList.remove('dark');
    await new Promise((r) => setTimeout(r, 60));
    const issues = { overflow: 0, small: [], contrast: [], sizes: new Set(), trunc: [], clipped: [], unnamed: [], headings: [] };
    issues.overflow = d.documentElement.scrollWidth - d.documentElement.clientWidth;
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = win.getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
    const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    for (const el of d.querySelectorAll('a,button,input,select,textarea')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const inProse = el.closest('.prose p');
      const inBigLabel = (el.type === 'checkbox' || el.type === 'radio') && el.closest('label') && el.closest('label').getBoundingClientRect().height >= 43.5;
      if (inBigLabel) continue;
      if (el.tagName === 'INPUT' && el.closest('.search')) { const s = el.closest('.search').getBoundingClientRect(); if (s.height < 44) issues.small.push(label(el) + ' ' + Math.round(s.height)); continue; }
      if (!inProse && (r.height < 43.5 || (r.width < 43.5 && el.tagName !== 'INPUT'))) issues.small.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim() || (el.labels && el.labels.length) || el.getAttribute('placeholder');
      if (!name) issues.unnamed.push(el.outerHTML.slice(0, 80));
    }
    const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode; if (!t.textContent.trim()) continue;
      const el = t.parentElement; if (seen.has(el) || !visible(el) || el.closest('.sr,[aria-hidden="true"]')) continue; seen.add(el);
      const cs = win.getComputedStyle(el);
      issues.sizes.add(cs.fontSize);
      let fg = parse(cs.color); let bg = null, n = el, gradient = false;
      while (n && n.nodeType === 1) { const s = win.getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== 'none') { gradient = true; break; } const c = parse(s.backgroundColor); if (c && c.a > 0) { bg = bg ? blend(bg, c) : c; if (c.a >= 1) break; } n = n.parentElement; }
      if (gradient || !bg || !fg) continue;
      if (bg.a < 1) bg = blend(bg, { r: 255, g: 255, b: 255, a: 1 });
      if (fg.a < 1) fg = blend(fg, bg);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const r = ratio(fg, bg);
      if (r < need) issues.contrast.push(`${t.textContent.trim().slice(0, 30)} ${r.toFixed(2)}`);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) issues.trunc.push(t.textContent.trim().slice(0, 30));
    }
    for (const el of d.querySelectorAll('*')) {
      const cs = win.getComputedStyle(el);
      if (cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && visible(el) && !el.classList.contains('meter') && !el.classList.contains('sr')) issues.clipped.push((el.className || el.tagName) + ' ' + label(el).slice(0, 30));
    }
    const hs = [...d.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1]);
    if (hs.filter((x) => x === 1).length !== 1) issues.headings.push('h1 count ' + hs.filter((x) => x === 1).length);
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) issues.headings.push('skip ' + hs[i - 1] + '>' + hs[i]);
    const layout = window.layoutAudit ? window.layoutAudit(d, win) : {};
    results.push({ page, w, theme, layout, overflow: issues.overflow, small: [...new Set(issues.small)], contrast: [...new Set(issues.contrast)], sizes: [...issues.sizes].sort(), trunc: [...new Set(issues.trunc)], clipped: [...new Set(issues.clipped)].slice(0, 6), unnamed: issues.unnamed.slice(0, 4), headings: issues.headings });
    f.remove();
  }
  window.auditResults = results;
  return results.length;
};
