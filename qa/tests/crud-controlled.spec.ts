import { test, expect } from '@playwright/test';
import { login } from './helpers';

function qaId(prefix: string) {
  return `QA_${prefix}_${Date.now()}`;
}

test.describe('JapanFlow — CRUD controlado', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Encomenda: cria, altera status e exclui dado QA_', async ({ page }) => {
    const name = qaId('ENCOMENDA');

    await page.goto('/encomendas-balcao', { waitUntil: 'domcontentloaded' });

    const itemLabel = page.locator('label').filter({ hasText: 'Nome do Item' }).first();
    const itemInput = itemLabel.locator('xpath=following-sibling::input[1]');
    await expect(itemInput).toBeVisible();
    await itemInput.fill(name);

    await page.getByRole('button', { name: /Registrar Encomenda/i }).click();

    const card = page.locator('[class*="rounded"]').filter({ hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const receivedButton = card.getByRole('button', { name: /Recebido/i }).first();
    if (await receivedButton.isVisible().catch(() => false)) {
      await receivedButton.click();
      await expect(card.getByText(/Recebido/i).first()).toBeVisible({ timeout: 10000 });
    }

    const trashButton = card
      .locator('button')
      .filter({
        has: card.locator('svg.lucide-trash-2'),
      })
      .last();

    if (await trashButton.count()) {
      await trashButton.click();
    } else {
      await card.locator('button').last().click();
    }

    const confirm = page.getByRole('dialog').last();
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /^Excluir$/i }).click();

    await expect(page.getByText(name, { exact: true })).toHaveCount(0, { timeout: 10000 });
  });

  test('Premiação: cria e exclui dado QA_', async ({ page }) => {
    const title = qaId('PREMIACAO');

    await page.goto('/awards', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /Nova Premiação/i }).click();

    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible();

    const userBlock = dialog
      .locator('div')
      .filter({ hasText: /^Usuário alvo/ })
      .first();
    const combo = userBlock.getByRole('combobox');
    await combo.click();

    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    const titleInput = dialog.getByPlaceholder(/Premiação Outubro/i);
    await titleInput.fill(title);

    await dialog.getByRole('button', { name: /^Salvar$/i }).click();

    const card = page.locator('[class*="rounded"]').filter({ hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    const trashButton = card
      .locator('button')
      .filter({
        has: card.locator('svg.lucide-trash-2'),
      })
      .last();

    if (await trashButton.count()) {
      await trashButton.click();
    } else {
      await card.locator('button').last().click();
    }

    const confirm = page.getByRole('dialog').last();
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /^Excluir$/i }).click();

    await expect(page.getByText(title, { exact: true })).toHaveCount(0, { timeout: 10000 });
  });
});
