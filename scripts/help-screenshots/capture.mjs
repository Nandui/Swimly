/* Help's screenshots (docs/help-centre.md, "Updating screenshots"): the real app in the local
 * sandbox (`npm run sandbox`), whose people and records are all invented, signed in as the
 * sandbox accounts, in light appearance. It opens dialogs and menus but never submits one.
 *
 *   node scripts/help-screenshots/capture.mjs                        # every image
 *   HELP_CAPTURE_ONLY=home,rota-week node scripts/help-screenshots/capture.mjs
 *
 * It refuses any address but localhost, so it can never photograph a real customer's data.
 * HELP_BASE (default http://localhost:3100) points at the sandbox. If Playwright is not a project
 * dependency, set HELP_PLAYWRIGHT_MODULE to its index.mjs; CHROME picks a Chromium binary. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.HELP_BASE ?? 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) throw Error(`Help screenshots come from the local sandbox only, not ${BASE}.`);
const PASSWORD = process.env.SANDBOX_PASSWORD ?? 'sandbox-turnfin-2026';
const ONLY = process.env.HELP_CAPTURE_ONLY?.split(',').filter(Boolean);
const { chromium } = await import(process.env.HELP_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HELP_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const dest = path.resolve('assets/help');
const review = path.resolve('.impeccable/review/help-screenshots');
await fs.mkdir(review, { recursive: true });
// Always merge into the committed manifest: an image this run leaves alone keeps its entry.
const manifest = JSON.parse(await fs.readFile(path.join(dest, 'manifest.json'), 'utf8'));
const failures = [];
/* One plan per image: who signs in (default Liam, the swim school manager at Hillview), the
 * viewport (default 1280 × 800), the steps and the crop. Step names are the labels staff see, so
 * a renamed control fails here first. The swim school's records are at Hillview. */
const robin = [{ go: '/students' }, { link: /^Robin Sample/ }];
const jamie = [{ go: '/students' }, { link: /^Jamie Sample/ }];
const deck = { as: 'ava', width: 1024, height: 720 };
const plans = [
  // Getting started, account and support
  { id: 'workspace', steps: [{ go: '/schedule' }] },
  { id: 'site-menu', steps: [{ go: '/schedule' }, { click: /change site$/ }], shot: 'menu' },
  { id: 'appearance', steps: [{ go: '/schedule' }, { click: /^Account menu:/ }], shot: 'menu' },
  { id: 'password', steps: [{ go: '/account' }] },
  { id: 'roles', as: 'alex', steps: [{ go: '/roles' }, { click: 'Edit Duty manager' }], shot: 'dialog' },
  { id: 'instructor-home', ...deck, steps: [{ go: '/instructor' }] },
  { id: 'instructor-menu', ...deck, steps: [{ go: '/instructor' }, { click: /^Account menu:/ }], shot: 'menu' },
  { id: 'instructor-site', ...deck, steps: [{ go: '/instructor' }, { click: /change site$/ }], shot: 'menu' },
  // Home and the Work modules
  { id: 'home', as: 'maya', steps: [{ go: '/' }] },
  { id: 'refund-new', as: 'noah', steps: [{ go: '/refunds/new' }] },
  { id: 'refund-decision', as: 'maya', steps: [{ go: '/refunds' }, { link: /Sam Example/ }] },
  { id: 'docs-home', steps: [{ go: '/docs' }] },
  { id: 'docs-new', steps: [{ go: '/docs/documents/new' }] },
  { id: 'training-assign', steps: [{ go: '/training' }, { click: 'Assign training' }], shot: 'dialog' },
  { id: 'training-signoff', steps: [{ go: '/training/sign-off' }] },
  { id: 'rota-week', as: 'maya', steps: [{ go: '/rota' }] },
  { id: 'rota-absence', as: 'maya', steps: [{ go: '/rota/absences' }, { click: 'Report absence' }], shot: 'dialog' },
  { id: 'hr-note', steps: [{ go: '/hr' }, { confirmPassword: true }, { link: /^Ava Example/ }, { click: 'Add note' }], shot: 'dialog' },
  { id: 'hr-review', steps: [{ go: '/hr' }, { confirmPassword: true }, { link: /^Ava Example/ }, { link: /review/ }] },
  // Swimmers, enrolment and parents
  { id: 'directory', steps: [{ go: '/students' }] },
  { id: 'add-swimmer', steps: [{ go: '/students' }, { click: 'Add a swimmer' }, { fill: { 'First name': 'Avery', 'Last name': 'Example' } }], shot: 'dialog' },
  { id: 'profile', steps: robin },
  { id: 'edit-swimmer', steps: [...robin, { tab: 'Details' }, { click: 'Edit details' }], shot: 'dialog' },
  { id: 'enrol', steps: [...robin, { click: 'Manage enrolment' }, { click: 'Enrol in a class' }], shot: 'dialog' },
  { id: 'move', steps: [...robin, { click: 'Manage enrolment' }, { click: /^Move class/ }], shot: 'dialog' },
  { id: 'waitlist', steps: [...jamie, { click: 'Manage enrolment' }], shot: 'dialog' },
  { id: 'end-enrolment', steps: [...robin, { click: 'Manage enrolment' }, { click: /^Unenrol/ }], shot: 'dialog' },
  { id: 'together', steps: [{ go: '/together' }] },
  { id: 'legend-agreements', steps: [{ go: '/legend-agreements' }] },
  { id: 'assessment-awaiting-enrolment', steps: [{ go: '/awaiting-enrolment' }] },
  { id: 'parent-profile', steps: [...robin, { tab: 'Parent access' }, { click: 'Approve parent email' }], shot: 'dialog' },
  { id: 'parent-link-request', steps: [{ go: '/students/parents' }, { click: 'Review and approve' }], shot: 'dialog' },
  { id: 'parent-accounts', steps: [{ go: '/students/parents' }, { fill: { 'Parent email': 'sample.parent@example.test' } }, { click: /^Find account/ }, { click: 'Suspend account' }], shot: 'dialog' },
  // Classes, teaching and progress
  { id: 'classes', steps: [{ go: '/courses' }] },
  { id: 'class-detail', steps: [{ go: '/courses' }, { link: /Otters/ }] },
  { id: 'add-class', steps: [{ go: '/courses' }, { click: /^Add (a )?class/ }], shot: 'dialog' },
  { id: 'schedule', steps: [{ go: '/schedule' }] },
  { id: 'profile-competencies', steps: [...robin, { tab: 'Competencies' }] },
  { id: 'complete-level', steps: [...robin, { tab: 'Competencies' }, { click: /complet/i }], shot: 'dialog' },
  { id: 'start-class', steps: [{ go: '/instructor?tab=all' }, { click: /^Start class/ }], shot: 'dialog' },
  { id: 'attendance', ...deck, steps: [{ go: '/instructor' }, { link: /Otters/ }] },
  { id: 'competencies', steps: [{ go: '/courses' }, { link: /Otters/ }, { link: 'Attendance and progress' }, { link: /Competencies/ }] },
  { id: 'complete-class', steps: [{ go: '/courses' }, { link: /Otters/ }, { link: 'Attendance and progress' }, { link: /Competencies/ }, { click: 'Complete Otters' }], shot: 'dialog' },
  { id: 'instructor-swimmer-competencies', ...deck, steps: [{ go: '/instructor' }, { link: /Otters/ }, { link: /competenc/i }, { click: /Robin Sample/ }] },
  { id: 'instructor-by-competency', ...deck, steps: [{ go: '/instructor' }, { link: /Otters/ }, { link: /competenc/i }, { click: 'By competency' }] },
  { id: 'instructor-class-overview', ...deck, steps: [{ go: '/instructor' }, { link: /Otters/ }, { link: /overview/i }] },
  { id: 'instructor-class-overview-mobile', ...deck, width: 375, height: 760, steps: [{ go: '/instructor' }, { link: /Otters/ }, { link: /overview/i }] },
  { id: 'save-conflict', ...deck, steps: [{ go: '/instructor' }, { link: /Otters/ }, { conflict: true }] },
  // Assessments
  { id: 'assessment-session', steps: [{ go: '/assessments/setup' }, { click: /^Add (a )?session/ }], shot: 'dialog' },
  { id: 'assessment-booking', steps: [{ go: '/assessments' }, { link: /^View swimmers/ }, { click: /^Book a swimmer/ }], shot: 'dialog' },
  { id: 'assessment-outcome', steps: [{ go: '/assessments' }, { link: /^View swimmers/ }, { click: /^Place/ }], shot: 'dialog' },
  { id: 'instructor-assessments', ...deck, steps: [{ go: '/instructor' }] },
  { id: 'parent-publication', steps: [{ go: '/assessments/setup' }, { link: /^Set up/ , nth: 1 }, { click: 'Publish to the parent app' }], shot: 'dialog' },
  // Daily operations
  { id: 'cancel-session', as: 'maya', steps: [{ go: '/duty' }, { click: /^Cancel session/ }, { fill: { 'Reason for cancellation': 'Learner pool closed for cleaning.' } }], shot: 'dialog' },
  { id: 'billing', as: 'maya', steps: [{ go: '/cancellations' }, { click: /^Review cancellation/ }], shot: 'dialog' },
  { id: 'analytics', steps: [{ go: '/analytics' }] },
  { id: 'analytics-reception', steps: [{ go: '/analytics' }, { link: 'Reception activity' }] },
  { id: 'analytics-instructors', steps: [{ go: '/analytics' }, { link: 'Instructor attendance' }] },
  // Administration
  { id: 'programme', steps: [{ go: '/programmes' }, { click: /^Add (a )?programme/ }, { fill: { Name: 'Water safety' } }], shot: 'dialog' },
  { id: 'curriculum', steps: [{ go: '/programmes' }, { link: /Learn to swim/ }, { click: /^Add (a )?competency/ }], shot: 'dialog' },
  { id: 'staff', as: 'alex', steps: [{ go: '/staff' }, { click: 'Add person' }, { fill: { Name: 'Jordan Example', Email: 'jordan@example.invalid' } }], shot: 'dialog' },
  { id: 'clubs', as: 'alex', steps: [{ go: '/clubs' }, { click: 'Add site' }, { fill: { Name: 'Lakeside' } }], shot: 'dialog' },
  { id: 'activity', as: 'alex', steps: [{ go: '/activity' }] },
];
// One signed-in browser context per sandbox person, reused across their plans.
const contexts = new Map();
async function signedIn(who, viewport) {
  if (!contexts.has(who)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
    // Hide the development build indicator and passing toasts; neither is part of the task shown.
    await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style'); style.textContent = 'nextjs-portal, [data-sonner-toaster] { display: none !important; }'; document.head.append(style);
    }));
    const page = await context.newPage();
    await page.goto(`${BASE}/sign-in`);
    await page.getByLabel(/email/i).fill(`${who}@sandbox.invalid`);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/sign-in'), { timeout: 30000 });
    await page.close();
    contexts.set(who, context);
  }
  return contexts.get(who);
}

const named = (name) => typeof name === 'string' ? { name, exact: true } : { name };
async function run(page, step) {
  if (step.go) { await page.goto(`${BASE}${step.go}`, { waitUntil: 'networkidle' }); return; }
  if (step.click) { await page.getByRole(step.role ?? 'button', named(step.click)).nth(step.nth ?? 0).click(); return; }
  if (step.link) {
    const before = page.url();
    await page.getByRole('link', named(step.link)).nth(step.nth ?? 0).click();
    await page.waitForURL(url => url.href !== before, { timeout: 20000 }).catch(() => {}); // a hash link stays put
    await page.waitForLoadState('networkidle');
    return;
  }
  if (step.tab) { await page.getByRole('tab', named(step.tab)).first().click(); return; }
  if (step.fill) { for (const [label, value] of Object.entries(step.fill)) await page.getByLabel(label, { exact: true }).first().fill(value); return; }
  if (step.choose) { await page.getByRole('radio', named(step.choose)).first().click(); return; }
  if (step.tick) { await page.getByRole('checkbox', named(step.tick)).first().click(); return; }
  if (step.option) { await page.getByRole('option', named(step.option)).first().click(); return; }
  if (step.press) { await page.keyboard.press(step.press); return; }
  if (step.scroll) { await page.locator(step.scroll).first().scrollIntoViewIfNeeded(); return; }
  if (step.conflict) {
    // A colleague saves the register in another tab after this one opened it (sandbox data only).
    const other = await page.context().newPage();
    await other.goto(page.url(), { waitUntil: 'networkidle' });
    // Change the first swimmer to whichever of Absent or Present they are not, so it differs.
    const absent = other.getByRole('radio', named('Absent')).first();
    await ((await absent.getAttribute('aria-checked')) === 'true' ? other.getByRole('radio', named('Present')).first() : absent).click();
    await other.getByRole('button', named(/^Save and continue/)).click();
    await other.waitForLoadState('networkidle'); await other.waitForTimeout(1500); await other.close();
    await page.getByRole('radio', named('Late')).first().click();
    await page.getByRole('button', named(/^Save and continue/)).click();
    await page.waitForTimeout(1500);
    return;
  }
  if (step.confirmPassword) {
    // HR asks for the password again before showing restricted records.
    const field = page.getByLabel(/password/i).first();
    if (await field.isVisible().catch(() => false)) { await field.fill(PASSWORD); await page.getByRole('button', { name: /confirm|continue/i }).first().click(); await page.waitForLoadState('networkidle'); }
    return;
  }
  throw Error(`Unknown step ${JSON.stringify(step)}`);
}

/** Where to crop: the top of the page, the open dialog, an open menu with the bar above it, or
 *  one element. Framed desk pages show the frame's top bar, so every image shows the fin, the
 *  page bar and the tools bar. */
async function capture(page, plan, file) {
  const { width, height } = page.viewportSize();
  if (plan.shot === 'dialog') return page.getByRole(plan.dialogRole ?? 'dialog').last().screenshot({ path: file, animations: 'disabled' });
  if (plan.shot === 'menu') {
    const menu = await page.getByRole('menu').last().boundingBox();
    const bottom = Math.ceil(menu.y + menu.height + 24);
    return page.screenshot({ path: file, clip: { x: 0, y: 0, width, height: Math.min(Math.max(bottom, 240), height) }, animations: 'disabled' });
  }
  if (plan.shot?.selector) return page.locator(plan.shot.selector).first().screenshot({ path: file, animations: 'disabled' });
  return page.screenshot({ path: file, clip: { x: 0, y: 0, width, height: plan.shot?.height ?? height }, animations: 'disabled' });
}

try {
  for (const plan of plans.filter(p => !ONLY || ONLY.includes(p.id))) {
    // Dialogs get a tall window so a long form shows whole rather than scrolled.
    const viewport = { width: plan.width ?? 1280, height: plan.height ?? (plan.shot === 'dialog' ? 1100 : 800) };
    const context = await signedIn(plan.as ?? 'liam', viewport);
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    page.setDefaultTimeout(10000);
    const file = path.join(dest, `${plan.id}.png`);
    try {
      for (const step of plan.steps) await run(page, step);
      // Wait out loading placeholders, and drop the focus a dialog puts in its first field.
      await page.waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-pulse'), null, { timeout: 20000 }).catch(() => {});
      if (plan.shot === 'dialog') await page.evaluate(() => { if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur(); });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400); // let menus and dialogs finish opening
      await capture(page, plan, file);
      const png = await fs.readFile(file);
      manifest[plan.id] = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      console.log(`${plan.id}: ${manifest[plan.id].width} × ${manifest[plan.id].height}`);
    } catch (error) {
      failures.push(plan.id);
      console.error(`${plan.id}: ${error.message.split('\n')[0]}`);
      await page.screenshot({ path: path.join(review, `${plan.id}-error.png`) }).catch(() => {});
    } finally { await page.close(); }
  }
  await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  if (failures.length) throw Error(`Screenshots need attention (see ${review}): ${failures.join(', ')}`);
} finally { await browser.close(); }
