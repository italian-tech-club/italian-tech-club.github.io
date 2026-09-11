import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const server = await createServer({ server: { host: '127.0.0.1', port: 4174, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const campaignId = 'a'.repeat(24);
const at = '2026-09-10T14:00:00.000Z';
const campaign = { _id: campaignId, name: 'September aperitivo', subject: 'Ci vediamo?', audience: 'all', conversionGoal: 'registration', ctaUrl: 'https://www.gomry.com/event/event123', ctaLabel: 'RSVP', status: 'sent', sentCount: 30, lastSentAt: at };
const recipients = Array.from({ length: 30 }, (_, i) => ({
  profileId: String(i), name: i === 0 ? 'Mario Rossi' : `Member ${i}`, email: `member${i}@example.com`, tracked: true, acceptedAt: at, deliveredAt: at,
  ...(i < 15 ? { openedAt: at } : {}), ...(i < 6 ? { ctaClickedAt: at } : {}), ...(i < 2 ? { convertedAt: at } : {}),
}));
const report = { success: true, recipients, conversionGoal: 'registration', conversionGoals: ['registration'], eventIds: ['event123'], setup: { webhookConfigured: true, gomryConfigured: true },
  stats: { recipients: 30, accepted: 30, delivered: 30, opened: 15, ctaClicked: 6, clicked: 7, converted: 2, bounced: 0, complained: 0, failed: 0, unsubscribed: 0, untracked: 0, openRate: 50, clickRate: 20, conversionRate: 6.7, clickToConversionRate: 33.3, lastEventAt: at } };
let syncFails = false;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/marketing/report') return json(report);
    if (url.pathname === '/api/marketing/sync') return syncFails ? json({ success: false, message: 'Gomry could not load registrations (HTTP 403).' }, 500) : json({ success: true });
    if (url.pathname === '/api/community/marketing' && route.request().method() === 'GET') return json({ success: true, campaigns: [campaign], audience: { all: 30, claimed: 20, unclaimed: 10, approved: 30, optedOut: 0 }, optedOut: [], events: [] });
    if (url.pathname === '/api/community/marketing' && route.request().postDataJSON()?.action === 'preview') return json({ success: true, html: '<p>Email preview</p>' });
    throw new Error(`Unexpected API call: ${route.request().method()} ${url.pathname}`);
  });
  await page.goto('http://127.0.0.1:4174/tests/fixtures/marketing.html');
  await page.getByRole('button', { name: /September aperitivo/ }).click();
  await page.getByText('50% open rate', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/itc-marketing-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Search campaign recipients' }).fill('Mario');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByRole('textbox', { name: 'Search campaign recipients' }).fill('');
  await page.getByRole('combobox', { name: 'Filter campaign recipients' }).selectOption('ctaClickedAt');
  assert.equal(await page.locator('tbody tr').count(), 6);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `campaign-${campaignId}.csv`);
  await page.getByRole('combobox', { name: 'Filter campaign recipients' }).selectOption('all');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal(await page.locator('tbody tr').count(), 5);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  syncFails = true;
  await page.getByRole('button', { name: 'Sync registrations' }).click();
  await page.getByRole('alert').filter({ hasText: 'HTTP 403' }).waitFor();
  report.eventIds = ['https://luma.com/supper'];
  report.setup.lumaConfigured = false;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await page.getByText('Connect the event’s Luma calendar', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Sync registrations' }).isDisabled(), true);
  report.setup.lumaConfigured = true;
  syncFails = false;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await page.getByRole('button', { name: 'Sync registrations' }).click();
  await page.getByRole('button', { name: 'Sync registrations' }).waitFor();
  report.setup.webhookConfigured = false;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await page.getByText('Email tracking needs setup.', { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/itc-marketing-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'Mobile page must not overflow horizontally');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: '/tmp/itc-marketing-dark.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Marketing browser checks passed: report, search, filters, pagination, CSV, sync errors, setup state, mobile layout, dark mode.');
} finally {
  await browser.close();
  await server.close();
}
