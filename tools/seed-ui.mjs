// Fill the local Turnfin sandbox with records that design checks need, by driving the
// real UI in headless Chromium over the DevTools Protocol (no npm packages needed).
//
//   node seed-ui.mjs                 # everything
//   node seed-ui.mjs refunds docs    # only some steps (refunds, docs, deck)
//   BASE=http://localhost:3100 CHROME=/path/to/chrome SEED_DEBUG=1 node seed-ui.mjs
//
// Only for the in-memory sandbox (scripts/sandbox.mts): every record is obviously fictional.
// Safe to re-run: a re-run adds another set of refunds and documents; the deck step reuses
// a class already started today. Exits 1 if any step fails; the other steps still run.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const PASSWORD = process.env.SANDBOX_PASSWORD ?? 'sandbox-turnfin-2026';
const DEBUG = !!process.env.SEED_DEBUG;
const ALL_STEPS = ['refunds', 'docs', 'deck'];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ALL_STEPS;
for (const s of wanted) if (!ALL_STEPS.includes(s)) { console.error(`Unknown step "${s}". Steps: ${ALL_STEPS.join(', ')}`); process.exit(2); }
const as = (who) => `${who}@sandbox.invalid`;
const stamp = new Date().toISOString().slice(11, 19).replaceAll(':', ''); // HHMMSS, tells re-runs apart
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------- browser
const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = process.platform === 'win32'
    ? [join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')]
    : [join(process.env.HOME ?? '', '.cache', 'ms-playwright'), '/ms-playwright'];
  for (const root of roots) {
    let dirs = [];
    try { dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse(); } catch { continue; }
    for (const d of dirs) for (const rel of ['chrome-win64/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found: set CHROME or run npx playwright install chromium');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('  ', ...a);
const debug = (...a) => DEBUG && console.log('   ·', ...a);

{
  let r;
  try { r = await fetch(`${BASE}/sign-in`); }
  catch (e) { console.error(`Sandbox not reachable at ${BASE}/sign-in (${e.message}). Start it with: npm run sandbox`); process.exit(1); }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const hint = body.match(/\.\/src\/[^\s"\\]+:\d+:\d+/)?.[0];
    console.error(`Sandbox at ${BASE} answered HTTP ${r.status} for /sign-in${hint ? `: the app does not compile (${hint})` : ''}. Fix or wait for that, then re-run.`);
    process.exit(1);
  }
}

const profile = mkdtempSync(join(tmpdir(), 'seed-ui-'));
const port = 12000 + (process.pid % 5000) + Math.floor(Math.random() * 50);
const chrome = spawn(findChrome(), ['--headless=new', '--disable-gpu', ...(process.platform === 'win32' ? [] : ['--no-sandbox', '--disable-dev-shm-usage']), `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let list;
for (let i = 0; i < 75; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((t) => t.type === 'page')) break; } catch {} await sleep(200); }
if (!list?.some((t) => t.type === 'page')) { chrome.kill(); console.error('Chromium did not start (no DevTools page).'); process.exit(1); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let msgId = 0; const pending = new Map(); const waiters = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) {
    if (m.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); // e.g. "leave with unsaved changes?"
    waiters.filter((w) => w.method === m.method).forEach((w) => w.resolve(m));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++msgId; pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const once = (method) => new Promise((resolve) => { const w = { method, resolve: (m) => { waiters.splice(waiters.indexOf(w), 1); resolve(m); } }; waiters.push(w); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`Page script failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result?.value;
};
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------------------- page helpers
const go = async (path) => {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: path.startsWith('http') ? path : `${BASE}${path}` });
  await Promise.race([loaded, sleep(30000)]);
  // Typing or clicking before React hydrates is lost (or submits the form natively), so wait for it.
  await waitFor(`document.readyState === 'complete' && Object.keys(document.body).some(k => k.startsWith('__reactFiber'))`, `${path} to load and hydrate`, 45000);
  await sleep(500);
};
const url = () => evaluate('location.href');
/** What the page currently says: alerts, status messages, a Next error overlay. */
const pageProblems = () => evaluate(`[...document.querySelectorAll('[role=alert], [role=status], [aria-live]'), ...[...document.querySelectorAll('nextjs-portal')].map(p => p.shadowRoot?.querySelector('[data-nextjs-dialog]')).filter(Boolean)].map(e => e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 300)).filter(Boolean).join(' | ')`);
async function waitFor(expression, what, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const v = await evaluate(expression); if (v) return v; } catch {}
    await sleep(250);
  }
  const problems = await pageProblems().catch(() => '');
  throw new Error(`Timed out waiting for ${what} on ${await url().catch(() => '?')}${problems ? `; page says: ${problems}` : ''}`);
}
// An in-page finder: {css} or {text} (exact visible text or aria-label prefix) within an optional scope.
const FIND = `(spec) => {
  const scope = spec.scope ? document.querySelector(spec.scope) : document;
  if (!scope) return null;
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const pool = [...scope.querySelectorAll(spec.css || 'button, a, [role=button], [role=radio], [role=tab], [role=option], label')].filter(visible);
  if (!spec.text) return pool[0] || null;
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const label = (e) => { const c = e.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach(h => h.remove()); return norm(c.textContent); };
  return pool.find(e => label(e) === spec.text) || pool.find(e => norm(e.textContent) === spec.text) || pool.find(e => (e.getAttribute('aria-label') || '').startsWith(spec.text)) || null;
}`;
const describe = (spec) => spec.text ? `"${spec.text}"` : spec.css;
async function exists(spec) { return evaluate(`!!(${FIND})(${JSON.stringify(spec)})`); }
/** A real mouse click (Radix and other pointer-driven controls need one). */
async function click(spec, { enabled = true, timeout = 20000 } = {}) {
  const box = await waitFor(`(() => { const e = (${FIND})(${JSON.stringify(spec)}); if (!e${enabled ? ' || e.disabled || e.getAttribute("aria-disabled") === "true"' : ''}) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`, `${enabled ? 'enabled ' : ''}${describe(spec)}`, timeout);
  await sleep(150);
  const p = await evaluate(`(() => { const e = (${FIND})(${JSON.stringify(spec)}); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`).catch(() => box);
  debug('click', describe(spec));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await sleep(300);
}
/** Set a React-controlled input, textarea or native select. */
async function fill(css, value, { scope } = {}) {
  await waitFor(`!!(${scope ? `document.querySelector(${JSON.stringify(scope)})?` : 'document'}.querySelector(${JSON.stringify(css)}))`, css);
  await evaluate(`(() => {
    const el = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'}.querySelector(${JSON.stringify(css)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    if (el instanceof HTMLSelectElement && el.value !== ${JSON.stringify(value)}) throw new Error('No option ' + ${JSON.stringify(value)} + ' in ' + ${JSON.stringify(css)});
  })()`);
}
async function typeText(text) { await send('Input.insertText', { text }); }
async function key(name, code, text) {
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: name, code: name, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
  await sleep(100);
}

async function signIn(who) {
  await send('Network.clearBrowserCookies');
  await go('/sign-in');
  await waitFor(`!!document.querySelector('input[type=email]')`, 'the sign-in form');
  await fill('input[type=email]', as(who));
  await fill('input[type=password]', PASSWORD);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await waitFor(`!location.pathname.startsWith('/sign-in') && document.readyState === 'complete'`, `sign-in as ${as(who)} to finish`);
  await sleep(500);
  debug('signed in as', who, await url());
}

// ---------------------------------------------------------------------------- results
const created = []; // { step, what, url }
const record = (step, what, path) => { created.push({ step, what, url: `${BASE}${path}` }); log(`${what}: ${BASE}${path}`); };

// ---------------------------------------------------------------------------- refunds
// noah@ (Receptionist, Refunds "Use") requests; maya@ (Duty manager, Refunds "Manage") decides.
// docs/refunds.md: requesters never review their own request.
async function choose(trigger, text) {
  await click({ css: trigger });
  await waitFor(`!!document.querySelector('[role=listbox] [role=option]')`, `the ${trigger} options`);
  await click(text ? { css: '[role=option]', scope: '[role=listbox]', text } : { css: '[role=listbox] [role=option]' });
  await waitFor(`!document.querySelector('[role=listbox]')`, `the ${trigger} options to close`);
}
async function newRefund({ customer, service, amount, reference, reason, submit }) {
  await go('/refunds/new');
  await waitFor(`!!document.querySelector('#refund-customerName')`, 'the new refund form');
  await fill('#refund-customerName', customer);
  await fill('#refund-memberNumber', `EX-${reference.slice(-4)}`);
  await fill('#refund-contactEmail', 'placeholder@example.invalid');
  // Site and service are the shared Select (Radix): open the trigger, pick the option. The site
  // starts empty unless the person works at exactly one, so take the first one then.
  if (await evaluate(`/Choose a site/.test(document.querySelector('#refund-site')?.textContent || '')`)) await choose('#refund-site');
  await choose('#refund-service', { AQUATICS: 'Aquatics', MEMBERSHIP: 'Membership', BOOKING: 'Booking', OTHER: 'Other' }[service]);
  await fill('#refund-description', `Example ${service.toLowerCase()} purchase for design checks (fictional record).`);
  await fill('#refund-amount', amount);
  await fill('#refund-paymentDate', daysAgo(12));
  await fill('#refund-paymentReference', reference);
  await fill('#refund-reason', reason);
  await click({ text: submit ? 'Submit to finance' : 'Save draft', scope: 'form.refund-request-form' });
  const path = await waitFor(`/^\\/refunds\\/(?!new)[^/]+$/.test(location.pathname) && document.querySelector('h1') && location.pathname`, `the saved refund page (${customer})`, 60000);
  return path;
}
async function financeAction(path, label, { note, paidReference } = {}) {
  await go(path);
  await click({ text: label, scope: 'main' });
  await waitFor(`!!document.querySelector('[role=dialog] form')`, `the "${label}" dialog`);
  if (note) await fill('#decision-note', note, { scope: '[role=dialog]' });
  if (paidReference) await fill('#paid-reference', paidReference, { scope: '[role=dialog]' });
  await click({ css: '[role=dialog] form button[type=submit]' });
  await waitFor(`!document.querySelector('[role=dialog]')`, `"${label}" to be saved`, 60000);
  await sleep(800);
}
async function seedRefunds() {
  await signIn('noah');
  const ref = (n) => `EXAMPLE-${stamp}-${n}`;
  const draft = await newRefund({ customer: 'Sample Customer (draft)', service: 'MEMBERSHIP', amount: '45.00', reference: ref(1), reason: 'Placeholder reason: membership cancelled within the cooling-off period.', submit: false });
  record('refunds', 'Refund draft (noah@, private to its creator)', draft);
  const submitted = await newRefund({ customer: 'Example Customer (awaiting review)', service: 'AQUATICS', amount: '62.50', reference: ref(2), reason: 'Placeholder reason: swimming lessons block cancelled by the centre.', submit: true });
  record('refunds', 'Refund submitted, awaiting review', submitted);
  const info = await newRefund({ customer: 'Placeholder Customer (needs information)', service: 'BOOKING', amount: '18.00', reference: ref(3), reason: 'Placeholder reason: court booking charged twice.', submit: true });
  const approved = await newRefund({ customer: 'Sample Family (awaiting payment)', service: 'AQUATICS', amount: '120.00', reference: ref(4), reason: 'Placeholder reason: family moved away before the term started.', submit: true });
  const paid = await newRefund({ customer: 'Example Member (refunded)', service: 'OTHER', amount: '9.99', reference: ref(5), reason: 'Placeholder reason: locker deposit not returned by the machine.', submit: true });

  await signIn('maya');
  await financeAction(info, 'Request information', { note: 'Placeholder query: please add the original receipt number.' });
  await waitFor(`/Needs information/i.test(document.querySelector('main').textContent)`, 'the "Needs information" status');
  record('refunds', 'Refund returned for information (maya@)', info);
  await financeAction(approved, 'Approve refund', { note: 'Example approval note.' });
  await waitFor(`/Awaiting payment/i.test(document.querySelector('main').textContent)`, 'the "Awaiting payment" status');
  record('refunds', 'Refund approved, awaiting payment (maya@)', approved);
  await financeAction(paid, 'Approve refund');
  await financeAction(paid, 'Record payment', { paidReference: `PAY-EXAMPLE-${stamp}` });
  await waitFor(`/Refunded/i.test(document.querySelector('main').textContent)`, 'the "Refunded" status');
  record('refunds', 'Refund approved and paid (maya@)', paid);
}

// ---------------------------------------------------------------------------- docs
// alex@ (superadmin) authors; liam@ (Swim school manager, docs.approve) independently approves.
async function newDocument({ type, title, summary, body }) {
  await go('/docs/documents/new');
  await click({ css: `[role=radio][aria-label="${type}"]` });
  await click({ text: 'Use this template' });
  await waitFor(`!!document.querySelector('form.new-document-form')`, 'the document essentials form');
  await fill('form.new-document-form input[placeholder^="e.g."]', title);
  await fill('form.new-document-form textarea', summary);
  await click({ text: 'Create draft and start writing', scope: 'form.new-document-form' });
  const path = await waitFor(`/^\\/docs\\/documents\\/[^/]+\\/edit$/.test(location.pathname) && location.pathname`, `the editor for "${title}"`, 30000);
  // Wait for the editing lease, then type into the rich editor and save.
  await holdLease();
  await waitFor(`!!document.querySelector('[contenteditable=true]')`, 'the rich text editor');
  // Put the caret at the end of the template's first section heading, then start a paragraph under it.
  await click({ css: '[contenteditable=true] > :first-child' });
  await key('End', 35);
  await key('Enter', 13, '\r');
  await typeText(body);
  await waitFor(`[...document.querySelectorAll('[contenteditable=true] > *')].some(e => e.textContent.trim() === ${JSON.stringify(body)})`, 'the typed paragraph in the editor', 5000);
  await sleep(1500);
  await holdLease();
  await click({ text: 'Save now' });
  await waitFor(`!document.body.textContent.includes('Saving…') && [...document.querySelectorAll('[role=status]')].some(e => e.textContent.trim() === 'Saved')`, 'the draft to save');
  return path.replace(/\/edit$/, '');
}
/** The editor holds a short editing lease. In dev, React mounts the editor twice, and the two
 *  sessions can race so the page shows "… is editing this document" with Reconnect; press it. */
async function holdLease() {
  const ready = `(() => { const t = (b) => b.textContent.trim(); const bs = [...document.querySelectorAll('main button')]; return !bs.some(b => t(b) === 'Reconnect') && bs.some(b => t(b) === 'Save now' && !b.disabled); })()`;
  // A stale session's lease lasts up to 2 minutes (src/lib/docs/domain.ts), so keep trying that long.
  for (const end = Date.now() + 150000; Date.now() < end;) {
    await sleep(2000);
    if (await evaluate(ready)) { await sleep(800); if (await evaluate(ready)) return; }
    if (await exists({ text: 'Reconnect', css: 'main button' })) { debug('editing lease lost; reconnecting'); await click({ text: 'Reconnect', css: 'main button' }); }
  }
  await waitFor(ready, 'the document editing session (lease)', 5000);
}
async function submitForReview(approverName, changeSummary) {
  await holdLease();
  await click({ text: 'Submit for review' });
  await waitFor(`!!document.querySelector('[role=dialog] select')`, 'the review dialog');
  const value = await evaluate(`[...document.querySelector('[role=dialog] select').options].find(o => o.textContent.includes(${JSON.stringify(approverName)}))?.value || ''`);
  if (!value) throw new Error(`${approverName} is not offered as an independent approver: ${await evaluate(`[...document.querySelector('[role=dialog] select').options].map(o => o.textContent).join(', ')`)}`);
  await fill('[role=dialog] textarea', changeSummary);
  await fill('[role=dialog] select', value);
  await click({ text: 'Send for review', scope: '[role=dialog]' });
  return waitFor(`location.search.includes('version=') && location.pathname + location.search`, 'the submitted version', 30000);
}
async function seedDocs() {
  await signIn('alex');
  const docs = [
    { type: 'SOP', title: `Sample pool opening check ${stamp}`, summary: 'Example steps for opening the pool safely (fictional).', body: 'Placeholder step: walk the pool surround and check the water is clear. Example only.', publish: true },
    { type: 'EAP', title: `Example emergency evacuation plan ${stamp}`, summary: 'Placeholder emergency action plan for design checks.', body: 'Placeholder action: sound the alarm, clear the pool, gather at the example assembly point.', publish: true },
    { type: 'Policy', title: `Placeholder lost property policy ${stamp}`, summary: 'Example policy kept as a draft.', body: 'Placeholder principle: lost items are kept for an example period of 30 days.', publish: false },
  ];
  const toApprove = [];
  for (const d of docs) {
    const path = await newDocument(d);
    if (d.publish) toApprove.push({ ...d, path, review: await submitForReview('Liam', `Example first version of ${d.type}.`) });
    else record('docs', `Docs draft (${d.type}, alex@)`, path);
  }
  await signIn('liam');
  for (const d of toApprove) {
    await go(d.review);
    await click({ text: 'Approve and publish' });
    await waitFor(`!location.search.includes('version=') || /Approved and published/.test(document.body.textContent)`, `"${d.title}" to publish`, 30000);
    await go(d.path);
    await waitFor(`!!document.querySelector('h1') && !/Submitted|In review/.test(document.querySelector('main').textContent.slice(0, 400))`, `"${d.title}" to show as published`).catch(() => {});
    record('docs', `Docs published (${d.type}, written by alex@, approved by liam@)`, d.path);
    record('docs', `  history`, `${d.path}/history`);
  }
}

// ---------------------------------------------------------------------------- pool deck
// ava@ (Instructor) starts her own class today (a confirmed start per date) and takes attendance.
async function seedDeck() {
  await signIn('ava');
  await go('/instructor');
  await waitFor(`/Start class|Open class/.test(document.querySelector('main')?.textContent || '')`, 'a class on the Instructor list (the sandbox seeds Otters for today)');
  if (await exists({ text: 'Start class:', css: 'main button' })) {
    await click({ text: 'Start class:', css: 'main button' });
    await click({ text: 'Confirm and start', scope: '[role=dialog]' });
    log('Started a class as ava@');
  } else {
    await click({ text: 'Open class', css: 'main a' });
    log('A class was already started today; reusing it');
  }
  const path = await waitFor(`/^\\/instructor\\/classes\\/[^/]+$/.test(location.pathname) && location.pathname`, 'the class page', 30000);
  await markAttendance();
  record('deck', 'Pool deck class started today (ava@)', path);
  record('deck', '  class overview', `${path}/overview`);
}
async function markAttendance() {
  // register-form.tsx: "Everyone in" marks every swimmer present; the save bar then saves (and may move on to competencies).
  await click({ text: 'Everyone in', css: 'main button' });
  const save = await waitFor(`[...document.querySelectorAll('main button')].map(b => { const c = b.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach(h => h.remove()); return c.textContent.trim(); }).find(t => /^Save (and continue|attendance)$/.test(t))`, 'the attendance save button');
  await click({ text: save, css: 'main button' });
  await waitFor(`/Attendance saved/.test(document.body.textContent)`, 'the "Attendance saved" confirmation');
  await go('/instructor');
  await waitFor(`/Attendance saved/.test(document.querySelector('main').textContent)`, '"Attendance saved" on the class list');
  log('Attendance: everyone marked present and saved');
}

// ---------------------------------------------------------------------------- run
const steps = { refunds: seedRefunds, docs: seedDocs, deck: seedDeck };
const failures = [];
console.log(`Seeding ${BASE} (${wanted.join(', ')})`);
for (const name of wanted) {
  console.log(`\n[${name}]`);
  try { await steps[name](); }
  catch (e) { failures.push(name); console.error(`   FAILED ${name}: ${e.message}`); }
}
console.log('\nTraining: skipped. Certificates to check are uploaded only from Turnfin Me (apps/me), which the sandbox does not serve; the Work app has no upload.');
console.log(`\nSummary: ${created.length} record URLs`);
for (const c of created) console.log(`  [${c.step}] ${c.what.trim()}  ${c.url}`);
ws.close(); chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
if (failures.length) { console.error(`\nFailed steps: ${failures.join(', ')}`); process.exit(1); }
