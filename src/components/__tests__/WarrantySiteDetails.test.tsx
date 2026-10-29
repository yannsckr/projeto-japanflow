// Testes de regressão do fluxo atual de garantias. O nome do arquivo foi mantido
// para substituir a suíte antiga que testava o painel separado "Recebida pelo Site".
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateClaim: vi.fn(),
  softDeleteClaim: vi.fn(),
  restoreClaim: vi.fn(),
  createClaim: vi.fn(),
  updateClaimStatus: vi.fn(),
  addUpdate: vi.fn(),
  claims: [] as any[],
  currentUser: { id: 'emp-test', role: 'admin', sectors: [] as string[] },
  featureEnabled: false,
}));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ currentUser: mocks.currentUser, users: [] }),
}));
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {} }));
vi.mock('@/hooks/useFeaturePermissions', () => ({
  useFeaturePermissions: () => ({ hasFeature: () => mocks.featureEnabled }),
}));
vi.mock('@/hooks/useWarranties', () => ({
  useWarranties: () => ({
    claims: mocks.claims,
    updates: [],
    claimsError: null,
    updatesError: null,
    createClaim: mocks.createClaim,
    updateClaim: mocks.updateClaim,
    updateClaimStatus: mocks.updateClaimStatus,
    addUpdate: mocks.addUpdate,
    softDeleteClaim: mocks.softDeleteClaim,
    restoreClaim: mocks.restoreClaim,
  }),
}));
vi.mock('@/components/WarrantyAttachmentViewer', () => ({
  default: ({ name }: { name: string }) => <span data-testid="anexo">{name}</span>,
}));
vi.mock('@/components/ConfirmActionDialog', () => ({
  default: ({
    open,
    title,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => Promise<void>;
  }) => (open ? <button onClick={() => void onConfirm()}>{title}</button> : null),
}));

import WarrantiesPanel from '../WarrantiesPanel';

const baseClaim = {
  id: 'site-test',
  clientName: 'Cliente Fictício React',
  supplierName: '',
  productBrand: '',
  itemName: 'Peça fictícia React',
  itemCode: '',
  defectDescription: 'Defeito fictício',
  saleDate: '',
  invoiceNumber: '',
  status: 'pendente',
  requestedBy: 'site',
  laborReimbursementEnabled: false,
  laborReimbursementFileUrl: null,
  bankDetails: null,
  vehicleDocumentUrl: null,
  identityDocumentUrl: null,
  installationMileage: null,
  currentMileage: null,
  productImages: [],
  createdAt: '2026-10-27T12:00:00Z',
  updatedAt: '2026-10-27T12:00:00Z',
  origin: 'site',
  siteProtocol: 'JI-TESTE-REACT',
  siteOrder: '#0007',
  siteContactChannel: 'E-mail',
  siteContact: 'teste@example.com',
  siteReceived: '2020-01-02',
  siteInstalled: 'Não',
  siteVehicle: 'Honda Fit',
  siteNotes: 'Observação fictícia',
  siteAttachments: [
    {
      path: 'attachments/arquivo',
      name: 'comprovacao.png',
      type: 'image/png',
      size: 3,
      sha256: 'abc',
    },
  ],
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function mount() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<WarrantiesPanel />);
  });
  return host;
}

async function click(label: string) {
  const target = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].find(
    (element) => element.textContent?.includes(label)
  );
  expect(target, `Botão ${label} não encontrado`).toBeTruthy();
  await act(async () => {
    target!.click();
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.claims = [{ ...baseClaim }];
  mocks.currentUser = { id: 'emp-test', role: 'admin', sectors: [] };
  mocks.featureEnabled = false;
  for (const mock of [
    mocks.updateClaim,
    mocks.softDeleteClaim,
    mocks.restoreClaim,
    mocks.createClaim,
    mocks.updateClaimStatus,
    mocks.addUpdate,
  ]) {
    mock.mockReset().mockResolvedValue(undefined);
  }
  mocks.softDeleteClaim.mockResolvedValue({ archivedTasks: 1 });
});

afterEach(async () => {
  if (root)
    await act(async () => {
      root!.unmount();
    });
  root = undefined;
  host?.remove();
  host = undefined;
});

test('mostra campos do site na ficha principal e mantém anexos unificados', async () => {
  await mount();
  await click('Cliente Fictício React');
  expect(document.body.textContent).toContain('JI-TESTE-REACT');
  expect(document.body.textContent).toContain('teste@example.com');
  expect(document.body.textContent).toContain('02/01/2020');
  expect(document.body.textContent).toContain('comprovacao.png');
  expect(document.body.textContent).not.toContain('Recebida pelo Site');
});

test('edita garantia do site sem preencher data da venda', async () => {
  await mount();
  await click('Cliente Fictício React');
  await click('Editar');
  expect(document.querySelector('input[value="Cliente Fictício React"]')).toBeTruthy();
  await click('Salvar alterações');
  expect(mocks.updateClaim).toHaveBeenCalledTimes(1);
  expect(mocks.updateClaim.mock.calls[0][0]).toBe('site-test');
});

test('exclusão exige confirmação e chama a função correta', async () => {
  await mount();
  await click('Cliente Fictício React');
  await click('Excluir');
  expect(mocks.softDeleteClaim).not.toHaveBeenCalled();
  await click('Excluir pedido de garantia?');
  expect(mocks.softDeleteClaim).toHaveBeenCalledWith('site-test');
});

test('garantia excluída aparece na lixeira e pode ser restaurada', async () => {
  mocks.claims = [{ ...baseClaim, deletedAt: '2026-10-29T10:00:00Z' }];
  await mount();
  expect(document.body.textContent).not.toContain('Cliente Fictício React');
  await click('Lixeira');
  expect(document.body.textContent).toContain('Cliente Fictício React');
  await click('Restaurar garantia');
  expect(mocks.restoreClaim).toHaveBeenCalledWith('site-test');
});

test('funcionário sem setores, mas com recurso liberado, vê a lixeira', async () => {
  mocks.currentUser = { id: 'emp-test', role: 'employee', sectors: [] };
  mocks.featureEnabled = true;
  mocks.claims = [
    {
      ...baseClaim,
      id: 'manual-own',
      origin: '',
      requestedBy: 'emp-test',
      deletedAt: '2026-10-29T10:00:00Z',
    },
    {
      ...baseClaim,
      id: 'manual-other',
      origin: '',
      requestedBy: 'emp-other',
      deletedAt: '2026-10-29T10:00:00Z',
    },
  ];

  await mount();

  // Antes do clique, o botão mostra a quantidade de registros.
  expect(document.body.textContent).toContain('Lixeira (1)');

  // Abre a lixeira.
  await click('Lixeira');

  // Depois do clique, o botão muda de nome.
  expect(document.body.textContent).toContain('Voltar às garantias');

  // Confirma que o registro excluído pode ser restaurado.
  expect(document.body.textContent).toContain('Restaurar garantia');
});

test('funcionário SITE pode excluir solicitação recebida do site', async () => {
  mocks.currentUser = { id: 'emp-site', role: 'employee', sectors: ['site'] };
  await mount();
  await click('Cliente Fictício React');
  await click('Excluir');
  await click('Excluir pedido de garantia?');
  expect(mocks.softDeleteClaim).toHaveBeenCalledWith('site-test');
});

test('funcionário de Expedição sem Site não pode excluir a solicitação do site', async () => {
  mocks.currentUser = { id: 'emp-expedicao', role: 'employee', sectors: ['expedicao'] };
  await mount();
  await click('Cliente Fictício React');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.some((button) => button.textContent?.trim() === 'Excluir')).toBe(false);
});

test('funcionário SITE pode restaurar a solicitação recebida pelo site', async () => {
  mocks.currentUser = { id: 'emp-site', role: 'employee', sectors: ['site'] };
  mocks.claims = [{ ...baseClaim, deletedAt: '2026-10-29T10:00:00Z' }];
  await mount();
  await click('Lixeira');
  await click('Restaurar garantia');
  expect(mocks.restoreClaim).toHaveBeenCalledWith('site-test');
});

test('funcionário de Estoque sem Site não pode excluir garantia do site', async () => {
  mocks.currentUser = { id: 'emp-estoque', role: 'employee', sectors: ['estoque'] };
  mocks.featureEnabled = true; // Mesmo que receba acesso ao módulo, não recebe permissão de excluir site.
  await mount();
  await click('Cliente Fictício React');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.some((button) => button.textContent?.trim() === 'Excluir')).toBe(false);
});

test('Estoque e Expedição sem Site não podem restaurar garantia recebida pelo site', async () => {
  mocks.currentUser = { id: 'emp-duplo', role: 'employee', sectors: ['estoque', 'expedicao'] };
  mocks.claims = [{ ...baseClaim, deletedAt: '2026-10-29T10:00:00Z' }];
  await mount();
  await click('Lixeira');
  expect(document.body.textContent).not.toContain('Cliente Fictício React');
  expect(document.body.textContent).not.toContain('Restaurar garantia');
});
