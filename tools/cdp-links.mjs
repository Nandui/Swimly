// Signed-in link lister for the local sandbox.
// node cdp-links.mjs <unusedDir> <email> <password> /path /path ...
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [outDir, email, password, ...jobs] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:3100';
// Chromium: $CHROME if set; else Playwright's download (Windows or Linux). Install with: npx playwright install chromium
const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = process.platform === 'win32'
    ? [join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')]
    : [join(process.env.HOME ?? '', '.cache', 'ms-playwright'), '/ms-playwright'];
  for (const root of roots) {
    let dirs = [];
    try { dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse(); } catch { continue; }
    for (const d of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(root, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('No Chromium found: set CHROME or run npx playwright install chromium');
};
const CHROME = findChrome();
mkdirSync(outDir, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', ...(process.platform === 'win32' ? [] : ['--no-sandbox', '--disable-dev-shm-usage']), '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) waiters.filter((w) => w.method === m.method).forEach((w) => w.resolve(m)); });
const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
const once = (method) => new Promise((resolve) => { const w = { method, resolve: (m) => { waiters.splice(waiters.indexOf(w), 1); resolve(m); } }; waiters.push(w); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async (url) => { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await Promise.race([loaded, sleep(15000)]); await sleep(1200); };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
if (email) {
  await go(`${BASE}/sign-in`);
  await evaluate(`(() => { const set = (sel, v) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }; set('input[type=email]', ${JSON.stringify(email)}); set('input[type=password]', ${JSON.stringify(password)}); document.querySelector('form').requestSubmit(); })()`);
  await sleep(5000);
}
for (const path of jobs) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await go(`${BASE}${path}`);
  const links = await evaluate(`JSON.stringify([...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h.startsWith('/')))])`);
  console.log(path, links);
}
ws.close(); chrome.kill();
