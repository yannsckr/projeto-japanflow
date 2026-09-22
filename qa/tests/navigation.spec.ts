import { test, expect } from '@playwright/test';
import { assertNoRuntimeIssues, login, watchRuntime } from './helpers';

const paths = [
  '/admin',
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
];

test.describe('JapanFlow — Navegação e estabilidade', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('nenhuma rota crítica redireciona para login', async ({ page }, testInfo) => {
    const issues = watchRuntime(page);

    for (const path of paths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
    }

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('refresh mantém sessão autenticada', async ({ page }, testInfo) => {
    const issues = watchRuntime(page);

    await page.goto('/admin');
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Meu Quadro/i).first()).toBeVisible();

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('rota inexistente exibe fallback sem derrubar o navegador', async ({ page }) => {
    await page.goto('/qa-rota-inexistente', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/^about:blank$/);
  });
});
