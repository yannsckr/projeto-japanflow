import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow, assertNoRuntimeIssues, login, watchRuntime } from './helpers';

for (const route of [
  '/admin',
  '/admin/monitor',
  '/chat',
  '/profile',
  '/inventario',
  '/encomendas-balcao',
  '/departmental',
]) {
  test(`${route} responsivo`, async ({ page }, testInfo) => {
    await login(page);
    const issues = watchRuntime(page);

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoRuntimeIssues(issues, testInfo);
  });
}
