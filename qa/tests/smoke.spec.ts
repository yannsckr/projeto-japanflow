import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow, assertNoRuntimeIssues, login, watchRuntime } from './helpers';

const routes = [
  ['/admin', /Meu Quadro/i],
  ['/admin/monitor', /Monitoria/i],
  ['/chat', /Chat/i],
  ['/corporate', /Corporativo/i],
  ['/departmental', /Departamental/i],
  ['/financial', /Financeiro/i],
  ['/corridas', /Corridas/i],
  ['/time-reports', /Relatórios/i],
  ['/tracking', /Acompanhamento/i],
  ['/awards', /Premiações/i],
  ['/pedido-compras', /Pedido de Compras/i],
  ['/encomendas-balcao', /Encomendas/i],
  ['/inventario', /Inventário/i],
  ['/profile', /Perfil/i],
  ['/documentos', /Documentos/i],
  ['/politicas-internas', /Políticas/i],
  ['/historico-conversas', /Histórico/i],
] as const;

test.describe('JapanFlow — Smoke QA', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const [route, title] of routes) {
    test(`${route} abre sem erro`, async ({ page }, testInfo) => {
      const issues = watchRuntime(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(title).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertNoRuntimeIssues(issues, testInfo);
    });
  }
});
