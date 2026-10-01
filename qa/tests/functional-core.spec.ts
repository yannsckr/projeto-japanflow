import { test, expect } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  assertNoRuntimeIssues,
  login,
  watchRuntime,
} from './helpers';

async function gotoAndWatch(page: any, route: string) {
  const issues = watchRuntime(page);
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  return issues;
}

test.describe('JapanFlow — Fluxos funcionais seguros', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Chat alterna para Contatos sem expor grupos', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/chat');

    const contactsTab = page.getByRole('button', { name: /^Contatos$/i });
    await expect(contactsTab).toBeVisible();
    await contactsTab.click();

    await expect(contactsTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Grupos$/i })).toHaveCount(0);
    await expect(page.getByText(/Criar Novo Grupo/i)).toHaveCount(0);

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Políticas abre cadastro sem publicar', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/politicas-internas');

    const button = page.getByRole('button', { name: /Adicionar documento/i });
    await expect(button).toBeVisible();
    await button.click();

    await expect(
      page.getByRole('heading', { name: /Novo documento de política interna/i })
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Documentos abre compartilhamento sem enviar', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/documentos');

    const button = page.getByRole('button', { name: /Enviar documento/i });
    await expect(button).toBeVisible();
    await button.click();

    await expect(
      page.getByRole('heading', { name: /Compartilhar documento/i })
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Premiações abre novo cadastro sem salvar', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/awards');

    const button = page.getByRole('button', { name: /Nova Premiação/i });
    await expect(button).toBeVisible();
    await button.click();

    await expect(
      page.getByRole('heading', { name: /Registrar Premiação/i })
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Inventário abre relatórios', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/inventario');

    await expect(
      page.getByRole('heading', { name: /^Inventário$/i })
    ).toBeVisible();

    const reportsButton = page
      .locator('#main-content')
      .getByRole('button', { name: /^Relatórios$/i });

    await expect(reportsButton).toBeVisible();
    await reportsButton.click();

    const reportsDialog = page.getByRole('dialog').last();
    await expect(reportsDialog).toBeVisible();
    await expect(reportsDialog).toContainText(/Relatórios de Inventário/i);

    await page.keyboard.press('Escape');
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Encomendas mostra formulário principal', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/encomendas-balcao');

    await expect(page.getByText(/Encomendas Balcão/i).first()).toBeVisible();
    await expect(page.getByText(/Nome do item|Item/i).first()).toBeVisible();

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Pedido de compras renderiza sem overflow', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/pedido-compras');

    await expect(page.getByText(/Pedido de Compras/i).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Financeiro renderiza sem overflow', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/financial');

    await expect(page.getByText(/Financeiro/i).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Departamental renderiza tabs', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/departmental');

    await expect(page.getByText(/Módulos Departamentais/i).first()).toBeVisible();
    await expect(page.getByRole('tab').first()).toBeVisible();

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Perfil mostra aparência/tema', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/profile');

    await expect(page.getByText(/Perfil/i).first()).toBeVisible();
    await expect(page.getByText(/Aparência|Tema/i).first()).toBeVisible();

    await assertNoRuntimeIssues(issues, testInfo);
  });

  test('Dashboard admin não possui overflow horizontal', async ({ page }, testInfo) => {
    const issues = await gotoAndWatch(page, '/admin');

    await expect(page.getByText(/Meu Quadro/i).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoRuntimeIssues(issues, testInfo);
  });
});