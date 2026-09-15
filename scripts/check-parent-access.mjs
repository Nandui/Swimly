// Run against a parent dev server at :3020 with SWIMLY_API_URL=http://127.0.0.1:4189/api/parent/v1.
// All state is isolated PostgreSQL. No real accounts, emails or records are used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startParentAdminPreview } from './parent-admin-preview.ts';

process.env.PARENT_ADMIN_PREVIEW = '1';
const preview = await startParentAdminPreview(4189);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = path.resolve('.impeccable/review/parent-access');
await fs.mkdir(evidence, { recursive: true });
const parentContext = await browser.newContext({ viewport: { width: 1280, height: 1050 }, reducedMotion: 'reduce' });
await parentContext.addCookies([{ name: 'bookly-parent', value: preview.parentToken, url: 'http://127.0.0.1:3020', httpOnly: true, sameSite: 'Lax' }]);
const parent = await parentContext.newPage();
const staff = await browser.newPage({ viewport: { width: 1280, height: 1050 }, reducedMotion: 'reduce' });
const failures = [];
let checks = 0;
for (const page of [parent, staff]) page.on('pageerror', error => failures.push(error.message));

async function layout(page, label, dialog = false) {
  await page.evaluate(() => document.fonts.ready);
  const issues = await page.evaluate(dialog => {
    const root = dialog ? document.querySelector('[role=dialog]') : document.querySelector('main');
    const problems = [];
    if (!dialog && document.querySelectorAll('h1').length !== 1) problems.push('H1 count');
    if (document.querySelectorAll('main').length !== 1) problems.push('main count');
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('page overflow');
    for (const element of root.querySelectorAll('button,input:not([type=hidden]),textarea,a')) {
      if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
      const rect = element.getBoundingClientRect();
      if (rect.height < 43.5) problems.push(`small control: ${element.textContent || element.name}`);
      if (rect.left < -1 || rect.right > innerWidth + 1) problems.push('control overflow');
      if (element.matches('input,textarea') && !element.labels.length && !element.getAttribute('aria-label')) problems.push('unlabelled field');
    }
    return problems;
  }, dialog);
  assert.deepEqual(issues, [], label);
  checks++;
}
async function fillParent(firstName = 'Jamie') {
  await parent.getByLabel('Child’s first name').fill(firstName);
  await parent.getByLabel('Child’s surname').fill('Example');
  await parent.getByLabel('Child’s date of birth').fill('2018-04-06');
  await parent.getByLabel('Lesson details (optional)').fill('Churchfield, Tuesdays at 4pm');
}
async function matchSwimmer() {
  await staff.getByRole('combobox', { name: 'Match to an existing swimmer' }).click();
  await staff.getByRole('combobox', { name: 'Search swimmers' }).fill('Jamie');
  await staff.getByRole('option', { name: /Jamie Example/ }).click();
}
try {
  const probe = await fetch(`${preview.url}/api/parent/v1/me`, { headers: { Authorization: `Bearer ${preview.parentToken}` } });
  assert.equal(probe.status, 200, `Synthetic parent session probe: ${await probe.text()}`);
  await parent.goto('http://127.0.0.1:3020/children');
  await parent.getByRole('link', { name: 'Link my child / check requests' }).click();
  await parent.getByRole('heading', { name: 'Link my child', exact: true }).waitFor();
  await fillParent();
  // Drop the response AFTER the API commits: retry must reuse the payload and key.
  const keys = [];
  let drop = true;
  await parent.route('**/api/parent/access-requests', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    if (drop) { drop = false; await route.abort('failed'); } else await route.fulfill({ response });
  });
  await parent.getByRole('button', { name: 'Send request to swim school' }).click();
  await parent.getByText('We couldn’t confirm your request.', { exact: false }).waitFor();
  assert.equal(await parent.getByLabel('Child’s first name').isDisabled(), true);
  await parent.getByRole('button', { name: 'Retry request' }).click();
  await parent.getByText('Your request for Jamie is with the swim school.', { exact: false }).waitFor();
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
  assert.equal(await preview.prisma.parentAccessRequest.count(), 1);
  assert.equal(await preview.prisma.parentChildAccess.count(), 0);
  await parent.getByText('Waiting for the swim school', { exact: true }).waitFor();
  await parent.screenshot({ path: path.join(evidence, 'parent-request-desktop.png'), fullPage: true });
  console.log('Parent request, uncertain response and safe retry passed.');

  for (const theme of ['light', 'dark']) for (const width of [375, 768, 1024, 1280]) {
    await parent.setViewportSize({ width, height: 1050 });
    await parentContext.addCookies([{ name: 'bookly-theme', value: theme, url: 'http://127.0.0.1:3020' }]);
    await parent.reload(); await parent.getByRole('heading', { name: 'Your requests' }).waitFor();
    await layout(parent, `parent-${width}-${theme}`);
    await staff.setViewportSize({ width, height: 1050 });
    await staff.goto(`${preview.url}/?screen=accounts&theme=${theme}`);
    await staff.getByRole('button', { name: 'Review and approve' }).waitFor();
    await layout(staff, `staff-${width}-${theme}`);
    await staff.getByRole('button', { name: 'Review and approve' }).click();
    await staff.locator('[data-slot=dialog-content]').waitFor();
    await matchSwimmer();
    await staff.locator('[data-slot=dialog-content]').getByLabel('Reason', { exact: false }).fill('Verified guardian against the existing record');
    await layout(staff, `review-${width}-${theme}`, true);
    await staff.keyboard.press('Tab');
    assert.equal(await staff.locator('[data-slot=dialog-content]').evaluate(el => el.contains(document.activeElement)), true);
    if (width === 1280 && theme === 'light') await staff.locator('[data-slot=dialog-content]').screenshot({ path: path.join(evidence, 'staff-approve.png') });
    if (width === 375) {
      await parent.screenshot({ path: path.join(evidence, `parent-${theme}-mobile.png`), fullPage: true });
      await staff.locator('[data-slot=dialog-content]').screenshot({ path: path.join(evidence, `staff-${theme}-mobile.png`) });
    }
    await staff.getByRole('button', { name: 'Cancel', exact: true }).click();
    await staff.locator('[data-slot=dialog-content]').waitFor({ state: 'hidden' });
    await staff.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Review and approve', undefined, { timeout: 1500 });
    console.log(`Parent, staff queue and approval dialog: ${width}px ${theme} passed.`);
  }
  await staff.getByRole('button', { name: 'Review and approve' }).click();
  await matchSwimmer();
  await staff.locator('[data-slot=dialog-content]').getByLabel('Reason', { exact: false }).fill('Verified guardian against the existing record');
  preview.state.failAudit = true;
  await staff.getByRole('button', { name: 'Approve and link swimmer' }).click();
  await staff.getByText('Something went wrong. Please try again.').waitFor();
  assert.equal(await preview.prisma.parentChildAccess.count(), 0);
  assert.equal(await staff.locator('[data-slot=dialog-content]').getByLabel('Reason', { exact: false }).inputValue(), 'Verified guardian against the existing record');
  preview.state.failAudit = false;
  await staff.getByRole('button', { name: 'Approve and link swimmer' }).click();
  await staff.locator('[data-slot=dialog-content]').waitFor({ state: 'hidden' });
  await staff.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Refresh requests', undefined, { timeout: 2000 });
  assert.equal((await preview.prisma.parentChildAccess.findFirstOrThrow()).studentId, 'demo-swimmer-1');
  await parent.reload(); await parent.getByText('Request approved', { exact: true }).waitFor();
  await parent.getByRole('link', { name: 'View my children', exact: true }).click();
  await parent.getByRole('heading', { name: 'Jamie Example' }).waitFor();
  await parent.getByRole('link', { name: 'Missing a child? Request a link' }).click();
  await fillParent('Avery');
  await parent.getByRole('button', { name: 'Send request to swim school' }).click();
  await parent.getByText('Your request for Avery is with the swim school.', { exact: false }).waitFor();
  await staff.getByRole('button', { name: 'Refresh requests' }).click();
  await staff.getByRole('button', { name: 'Decline request', exact: true }).click();
  const reply = 'Please check the child’s name and date of birth, then send a new request.';
  await staff.locator('[data-slot=dialog-content]').getByLabel('Reply to the parent').fill(reply);
  await staff.locator('[data-slot=dialog-content]').getByLabel('Reason', { exact: false }).fill('Could not verify supplied details');
  await staff.locator('[data-slot=dialog-content]').getByRole('button', { name: 'Decline request', exact: true }).click();
  await staff.locator('[data-slot=dialog-content]').waitFor({ state: 'hidden' });
  await parent.reload(); await parent.getByText(reply, { exact: true }).waitFor();
  assert.equal(await preview.prisma.parentChildAccess.count(), 1);
  assert.equal(await preview.prisma.auditLog.count({ where: { entity: 'ParentAccessRequest' } }), 4);
  assert.deepEqual(failures, []);
  console.log(`PASS: ${checks} layout checks; request, retry, staff audit rollback, cross-site approval, linked child and decline reply verified.`);
} catch (error) {
  await parent.screenshot({ path: path.join(evidence, 'failure-parent.png'), fullPage: true }).catch(() => {});
  await staff.screenshot({ path: path.join(evidence, 'failure-staff.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); await preview.close(); }
