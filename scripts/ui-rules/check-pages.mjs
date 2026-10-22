/* The full run of the app for the UI rules (CLAUDE.md, "UI rules"): every page in src/app,
 * opened in the local sandbox (`npm run sandbox`, invented people and records only), checked for
 * one PageShell holding one PageHeader with the page's one H1. Optionally photographs each page.
 *
 *   node scripts/ui-rules/check-pages.mjs                   # check every page
 *   UI_SHOTS=out/dir UI_SIZES=375,1280 UI_THEMES=light,dark node scripts/ui-rules/check-pages.mjs
 *   UI_ONLY=/rota,/tasks node scripts/ui-rules/check-pages.mjs
 *
 * Dynamic pages ([id]) are reached by following links from the pages before them, so a page
 * whose records the sandbox lacks is reported as "not reached" rather than failing. It refuses
 * any address but localhost. UI_BASE (default http://localhost:3100) points at the sandbox; if
 * Playwright is not a project dependency, set PLAYWRIGHT_MODULE to its index.mjs; CHROME picks
 * a Chromium binary. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.UI_BASE ?? 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) throw Error(`The UI check runs on the local sandbox only, not ${BASE}.`);
const PASSWORD = process.env.SANDBOX_PASSWORD ?? 'sandbox-turnfin-2026';
const SHOTS = process.env.UI_SHOTS;
const SIZES = (process.env.UI_SIZES ?? '1280').split(',').map(Number);
const THEMES = (process.env.UI_THEMES ?? 'light').split(',');
const ONLY = process.env.UI_ONLY?.split(',').filter(Boolean);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');

// Every page route, as a pattern: route groups dropped, [id] one segment, [[...x]] optional.
async function pages(dir, route = '') {
  const found = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'api') {
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
      found.push(...await pages(path.join(dir, entry.name), route + segment));
    } else if (entry.name === 'page.tsx') {
      found.push({ route: route || '/', file: path.join(dir, entry.name) });
    }
  }
  return found;
}
const toPattern = (route) => new RegExp(`^${route
  .replace(/\/\[\[\.\.\.\w+\]\]/g, '(?:/.*)?')
  .replace(/\[\.\.\.\w+\]/g, '.+')
  .replace(/\[\w+\]/g, '[^/]+')}$`);
// Static routes first, so /assessments/setup is not taken for /assessments/[id].
const routes = (await pages('src/app')).map((page) => ({ ...page, pattern: toPattern(page.route), dynamic: page.route.includes('[') }))
  .sort((a, b) => a.route.split('[').length - b.route.split('[').length);
// Pages seen signed out: sign-in, and the links staff send outside the app.
const PUBLIC = new Set(['/sign-in', '/footage/[token]', '/wellbeing/[token]']);

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
async function context(signedIn, theme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style'); style.textContent = 'nextjs-portal, [data-sonner-toaster] { display: none !important; }'; document.head.append(style);
  }));
  if (!signedIn) return ctx;
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel(/email/i).fill('alex@sandbox.invalid');
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 60000 });
  await page.close();
  return ctx;
}

async function open(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 120000 });
  // HR and the reports behind it ask for the password again first.
  const confirm = page.getByLabel(/^password$/i).first();
  if (new URL(page.url()).pathname.startsWith('/confirm-password') && await confirm.isVisible().catch(() => false)) {
    await confirm.fill(PASSWORD);
    await page.getByRole('button', { name: /confirm|continue/i }).first().click();
    await page.waitForLoadState('networkidle');
  }
}

const inspect = (page) => page.evaluate(() => {
  const shells = [...document.querySelectorAll('[data-page-shell]')];
  const headers = [...document.querySelectorAll('[data-page-header]')];
  // An open dialog hides the page from screen readers (aria-hidden); its H1 still counts.
  const h1s = [...document.querySelectorAll('h1')].filter((h) => !h.closest('[hidden]'));
  const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((href) => href.startsWith('/'));
  return {
    shells: shells.length,
    headers: headers.length,
    headerInShell: headers.every((h) => h.closest('[data-page-shell]')),
    h1s: h1s.length,
    h1InHeader: h1s.every((h) => h.closest('[data-page-header]')),
    title: h1s[0]?.textContent?.trim() ?? '',
    links,
  };
});

const results = [];
const reached = new Map();
const queue = [];
for (const route of routes) if (!route.dynamic) queue.push(route.route);
const seen = new Set();
const signedIn = await context(true, 'light', 1280);
const signedOut = await context(false, 'light', 1280);
const pageIn = await signedIn.newPage(), pageOut = await signedOut.newPage();
while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const route = routes.find((r) => r.pattern.test(url.split(/[?#]/)[0]));
  if (!route || reached.has(route.route)) continue;
  reached.set(route.route, url);
  const page = PUBLIC.has(route.route) ? pageOut : pageIn;
  try {
    await open(page, url);
    const found = await inspect(page);
    const landed = new URL(page.url()).pathname;
    const problems = [];
    if (found.shells !== 1) problems.push(`${found.shells} PageShell`);
    if (found.headers !== 1) problems.push(`${found.headers} PageHeader`);
    if (!found.headerInShell) problems.push('PageHeader outside PageShell');
    if (found.h1s !== 1) problems.push(`${found.h1s} H1`);
    if (!found.h1InHeader) problems.push('H1 outside PageHeader');
    results.push({ route: route.route, url, landed, title: found.title, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${route.route} ${url}${landed !== url.split('?')[0] ? ` -> ${landed}` : ''}${problems.length ? `: ${problems.join(', ')}` : ''}`);
    for (const href of found.links) if (!seen.has(href)) queue.push(href);
  } catch (error) {
    results.push({ route: route.route, url, problems: [`error: ${String(error.message).split('\n')[0]}`] });
    console.log(`FAIL ${route.route} ${url}: ${String(error.message).split('\n')[0]}`);
  }
}
const missed = routes.filter((r) => !reached.has(r.route)).map((r) => r.route);
for (const route of missed) console.log(`skip ${route}: not reached (no link to one in the sandbox)`);

if (SHOTS) {
  await fs.mkdir(SHOTS, { recursive: true });
  for (const theme of THEMES) for (const width of SIZES) {
    const ins = await context(true, theme, width), outs = await context(false, theme, width);
    const pIn = await ins.newPage(), pOut = await outs.newPage();
    for (const [route, url] of reached) {
      if (ONLY && !ONLY.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) continue;
      const page = PUBLIC.has(route) ? pOut : pIn;
      const name = (route === '/' ? 'home' : route.slice(1)).replace(/[\[\]]/g, '').replace(/[^\w.-]+/g, '-');
      try {
        await open(page, url);
        await page.screenshot({ path: path.join(SHOTS, `${name}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      } catch (error) { console.log(`shot failed ${route}: ${String(error.message).split('\n')[0]}`); }
    }
    await ins.close(); await outs.close();
  }
}
await browser.close();

const failed = results.filter((r) => r.problems.length);
console.log(`\n${results.length} pages checked, ${failed.length} with problems, ${missed.length} not reached.`);
await fs.writeFile(process.env.UI_REPORT ?? '.impeccable/review/ui-rules.json', JSON.stringify({ results, missed }, null, 2)).catch(async () => {
  await fs.mkdir('.impeccable/review', { recursive: true });
  await fs.writeFile('.impeccable/review/ui-rules.json', JSON.stringify({ results, missed }, null, 2));
});
process.exitCode = failed.length ? 1 : 0;
