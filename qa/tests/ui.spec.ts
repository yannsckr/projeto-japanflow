import { test, expect } from '@playwright/test';
import { assertNoRuntimeIssues, login, watchRuntime } from './helpers';

test.describe('JapanFlow — UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar recolhe e expande', async ({ page }, testInfo) => {
    const issues = watchRuntime(page);
    await page.goto('/admin');

    const collapse = page.getByRole('button', { name: /recolher menu/i });
    if (await collapse.isVisible().catch(() => false)) {
      await collapse.click();
      await expect(page.getByRole('button', { name: /expandir menu/i })).toBeVisible();
    }

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('troca de tema funciona', async ({ page }, testInfo) => {
    const issues = watchRuntime(page);
    await page.goto('/admin');

    const root = page.locator('html');
    const before = await root.getAttribute('data-theme');

    const button = page
      .getByRole('button', { name: /modo claro|modo escuro|ativar modo/i })
      .first();
    await expect(button).toBeVisible();
    await button.click();
    await page.waitForTimeout(500);

    expect(await root.getAttribute('data-theme')).not.toBe(before);
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('notificações abrem', async ({ page }, testInfo) => {
    const issues = watchRuntime(page);
    await page.goto('/admin');

    const bell = page.getByRole('button', { name: /notificações/i }).first();
    await bell.click();
    await expect(page.getByText(/Notificações/i).first()).toBeVisible();

    await assertNoRuntimeIssues(issues, testInfo);
  });
});
