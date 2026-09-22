import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow, assertNoRuntimeIssues, login, watchRuntime } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const routes = [
  '/admin',
  '/admin/monitor',
  '/chat',
  '/corporate',
  '/departmental',
  '/financial',
  '/corridas',
  '/time-reports',
  '/tracking',
  '/awards',
  '/pedido-compras',
  '/encomendas-balcao',
  '/inventario',
  '/profile',
  '/documentos',
  '/politicas-internas',
  '/historico-conversas',
];

test.describe('JapanFlow — Rotas mobile completas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of routes) {
    test(`${route} abre em 390px sem overflow`, async ({ page }, testInfo) => {
      const issues = watchRuntime(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertNoRuntimeIssues(issues, testInfo);
    });
  }
});
