import { test } from '@playwright/test';
import { login } from './helpers';

test('debug admin monitor', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await login(page);

  console.log('\n=== DEPOIS DO LOGIN ===');
  console.log('URL:', page.url());

  await page.goto('/admin/monitor', {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForTimeout(3000);

  console.log('\n=== ADMIN MONITOR ===');
  console.log('URL FINAL:', page.url());
  console.log('TITLE:', await page.title());

  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  console.log('\n=== BODY ===');
  console.log(body.slice(0, 5000));

  console.log('\n=== CONSOLE ERRORS ===');
  console.log(consoleErrors);

  console.log('\n=== PAGE ERRORS ===');
  console.log(pageErrors);

  await page.screenshot({
    path: 'qa-results/debug-admin-monitor.png',
    fullPage: true,
  });
});
