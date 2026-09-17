// Real interface with fictional identity and no live authentication or data access.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPortalPreview, outputDir} from './staff-portal-preview/build.mjs';
import {servePreview} from './instructor-swimmer-preview/build.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await buildPortalPreview();
const {server, base} = await servePreview(0, outputDir, ['modules', 'start', 'sign-in']);
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
await context.route('**/*', route => route.request().url().startsWith(base) && route.request().method() === 'GET' ? route.continue() : route.abort());
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
try {
  for (const width of [375, 768, 1024, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto(`${base}/modules?theme=${theme}&long-name`);
    await page.getByRole('heading', {level: 1, name: 'Choose your workspace'}).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.getByRole('main').count(), 1);
    assert.equal(await page.getByText('Coming soon', {exact: true}).count(), 2);
    assert.equal(await page.getByRole('link', {name: /Docs|Bookings/}).count(), 0);
    assert.equal(await page.getByRole('link', {name: 'Open Swimly'}).getAttribute('href'), '/start');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}/${theme}`);
    for (const control of await page.locator('button, main a').all()) {
      const bounds = await control.boundingBox();
      if (bounds) assert(bounds.height >= 44 && bounds.width >= 44, `Small control ${await control.textContent()}`);
    }
    await page.screenshot({path: path.resolve(`.impeccable/review/staff-portal/${width}-${theme}.png`), fullPage: true});
  }

  await page.goto(`${base}/modules`);
  await page.keyboard.press('Tab');
  assert(await page.getByRole('link', {name: 'Skip to content'}).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter');
  assert(await page.getByRole('main').evaluate(el => el === document.activeElement));
  await page.getByRole('button', {name: 'Switch to dark mode'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert((await context.cookies()).some(cookie => cookie.name === 'swimly.theme' && cookie.value === 'dark'));
  await page.getByRole('link', {name: 'Open Swimly'}).click();
  await page.getByRole('heading', {name: 'Swimly workspace preview'}).waitFor();
  await page.getByRole('link', {name: 'All modules'}).click();
  await page.getByRole('heading', {name: 'Choose your workspace'}).waitFor();

  await page.setViewportSize({width: 375, height: 900});
  await page.getByRole('link', {name: 'Open Swimly'}).click();
  await page.getByRole('button', {name: 'Open navigation'}).click();
  await page.getByRole('link', {name: 'All modules'}).click();
  await page.getByRole('heading', {name: 'Choose your workspace'}).waitFor();
  await page.evaluate(() => {window.portalPreview.fail = true;});
  await page.getByRole('button', {name: 'Sign out', exact: true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('alert').textContent(), 'Could not sign out. Please try again.');
  assert.equal(await page.evaluate(() => window.portalPreview.calls.length), 1);
  assert.deepEqual(await page.evaluate(() => window.portalPreview.calls[0]), {redirectTo: '/sign-in'});
  await page.evaluate(() => {window.portalPreview.fail = false;});
  await page.getByRole('button', {name: 'Sign out', exact: true}).click();
  await page.getByRole('heading', {name: 'Signed out of preview'}).waitFor();
  assert.equal(await page.getByRole('link', {name: 'Open Swimly'}).count(), 0);
  assert.deepEqual(errors, []);
  console.log('Staff portal checks passed: eight layouts, keyboard, module/return navigation, appearance and sign-out feedback. Authentication is mocked in the UI fixture.');
} finally {
  await browser.close();
  server.close();
}
