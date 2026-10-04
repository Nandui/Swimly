// Layout checks the first audit lacked: column alignment, list alignment, overlap and spill.
window.layoutAudit = function (d, win) {
  const out = { colAlign: [], listAlign: [], overlap: [], spill: [] };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = win.getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const textLeft = (el) => { const w = d.createTreeWalker(el, NodeFilter.SHOW_TEXT); let min = Infinity; while (w.nextNode()) { const t = w.currentNode; if (!t.textContent.trim() || t.parentElement.closest('.sr')) continue; const rg = d.createRange(); rg.selectNodeContents(t); const rs = rg.getClientRects(); for (const r of rs) if (r.width > 0) min = Math.min(min, r.left); } return min; };
  const paints = (c) => { const cs = win.getComputedStyle(c); const bg = cs.backgroundColor; return (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) || cs.backgroundImage !== 'none' || parseFloat(cs.borderLeftWidth) > 0 || /inset/.test(cs.boxShadow); };
  const firstLeft = (el) => { let min = Infinity; for (const c of el.querySelectorAll('*')) { if (!vis(c) || c.closest('.sr') || c.closest('svg') && c.tagName !== 'svg') continue; if (c.tagName === 'svg' || paints(c) || c.children.length === 0) { const r = c.getBoundingClientRect(); min = Math.min(min, r.left); } } return Math.min(min, textLeft(el)); };
  // 1. Table columns: content starts where its header text starts.
  for (const t of d.querySelectorAll('table')) {
    if (!vis(t)) continue;
    const ths = [...t.querySelectorAll('thead th')];
    const heads = ths.map((th) => textLeft(th));
    for (const tr of t.querySelectorAll('tbody tr')) {
      [...tr.children].forEach((td, i) => { const h = heads[i]; if (!isFinite(h)) return; const l = firstLeft(td); if (isFinite(l) && Math.abs(l - h) > 4 && win.getComputedStyle(td).textAlign !== 'right') out.colAlign.push(`${ths[i].textContent.trim()} col ${Math.round(l - h)}px`); });
    }
  }
  // 2. Lists: rows with the same structure start their text at the same x.
  for (const ul of d.querySelectorAll('ul.list')) {
    if (!vis(ul)) continue;
    const groups = {};
    for (const li of ul.children) { const row = li.firstElementChild; if (!row || !vis(row)) continue; const key = [...row.children].map((c) => c.className.baseVal === undefined ? c.className : 'svg').join('|'); const bd = row.querySelector('.bd'); if (!bd) continue; (groups[key] = groups[key] || []).push(textLeft(bd) - row.getBoundingClientRect().left); }
    for (const k in groups) { const v = groups[k].filter(isFinite); if (v.length > 1 && Math.max(...v) - Math.min(...v) > 4) out.listAlign.push(`${k.slice(0, 40)} spread ${Math.round(Math.max(...v) - Math.min(...v))}px`); }
  }
  // 3. Overlap: visible in-flow siblings must not intersect.
  for (const p of d.querySelectorAll('body *')) {
    if (p.closest('svg')) continue;
    const kids = [...p.children].filter((c) => vis(c) && !['absolute', 'fixed', 'sticky'].includes(win.getComputedStyle(c).position) && !c.classList.contains('sr'));
    if (kids.length < 2 || kids.length > 40) continue;
    const pcs = win.getComputedStyle(p); if (pcs.display === 'grid') continue; // grids place on purpose (timeline)
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect(); const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (x > 2 && y > 2) out.overlap.push(`${(kids[i].className || kids[i].tagName).toString().slice(0, 20)} × ${(kids[j].className || kids[j].tagName).toString().slice(0, 20)} ${Math.round(x)}x${Math.round(y)}`); }
  }
  // 4. Spill: content poking out of a box that does not scroll or clip.
  for (const el of d.querySelectorAll('body *')) {
    const ecs = win.getComputedStyle(el);
    if (!vis(el) || ['absolute', 'fixed'].includes(ecs.position) || el.closest('.sr') || el.closest('svg') || parseFloat(ecs.marginLeft) < 0 || parseFloat(ecs.marginRight) < 0 || (el.parentElement && parseFloat(win.getComputedStyle(el.parentElement).marginLeft) < 0)) continue;
    const p = el.parentElement; if (!p || p === d.body) continue;
    const pcs = win.getComputedStyle(p); if (pcs.overflowX !== 'visible' || pcs.display === 'inline') continue;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    if (a.right > b.right + 2 || a.left < b.left - 2) { if (!el.closest('.bar') && !el.closest('.hscroll') && !el.closest('.daystrip')) out.spill.push(`${(el.className || el.tagName).toString().slice(0, 24)} in ${(p.className || p.tagName).toString().slice(0, 24)} ${Math.round(Math.max(a.right - b.right, b.left - a.left))}px`); }
  }
  for (const k in out) out[k] = [...new Set(out[k])].slice(0, 8);
  return out;
};
