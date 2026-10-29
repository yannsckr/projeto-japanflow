import { describe, expect, it } from 'vitest';
import {
  canAccessWarrantyModule,
  canTrashWarranty,
  hasWarrantyAdminAccess,
} from '../warrantyPermissions';

const admin = { id: 'admin-1', role: 'admin', sectors: [] };
const employee = { id: 'emp-1', role: 'employee', sectors: ['garantias'] };
const colleague = { id: 'emp-2', role: 'employee', sectors: ['vendas'] };
const noModule = { id: 'emp-3', role: 'employee', sectors: [] };
const own = { requestedBy: 'emp-1', origin: '' };
const other = { requestedBy: 'emp-2', origin: '' };
const site = { requestedBy: 'site', origin: 'site' };
const siteStaff = { id: 'emp-site', role: 'employee', sectors: ['site'] };
const siteAndExpedition = {
  id: 'emp-site-exp',
  role: 'employee',
  sectors: ['estoque', 'site', 'expedicao'],
};
const fakeSite = { requestedBy: 'emp-2', origin: 'site' };
const estoqueOnly = { id: 'emp-estoque', role: 'employee', sectors: ['estoque'] };
const expedicaoOnly = { id: 'emp-expedicao', role: 'employee', sectors: ['expedicao'] };
const estoqueExpedicao = { id: 'emp-duplo', role: 'employee', sectors: ['estoque', 'expedicao'] };

describe('Permissões da lixeira de Garantias', () => {
  it('admin pode excluir/restaurar qualquer origem', () => {
    expect(canTrashWarranty(admin, own)).toBe(true);
    expect(canTrashWarranty(admin, other)).toBe(true);
    expect(canTrashWarranty(admin, site)).toBe(true);
  });
  it('funcionário autorizado pode excluir somente garantia que criou', () => {
    expect(canTrashWarranty(employee, own)).toBe(true);
    expect(canTrashWarranty(employee, other)).toBe(false);
    expect(canTrashWarranty(employee, site)).toBe(false);
    expect(canTrashWarranty(colleague, other)).toBe(true);
  });
  it('setor SITE pode excluir e restaurar solicitações originadas no site', () => {
    expect(canAccessWarrantyModule(siteStaff)).toBe(true);
    expect(canTrashWarranty(siteStaff, site)).toBe(true);
    expect(canTrashWarranty(siteAndExpedition, site)).toBe(true);
    expect(canTrashWarranty(siteStaff, fakeSite)).toBe(false);
    // O fator decisivo é possuir SITE, independentemente de outros setores.
    expect(canTrashWarranty(estoqueOnly, site)).toBe(false);
    expect(canTrashWarranty(expedicaoOnly, site)).toBe(false);
    expect(canTrashWarranty(estoqueExpedicao, site)).toBe(false);
  });
  it('setor SITE não concede exclusão sobre pedidos manuais de colegas', () => {
    expect(canTrashWarranty(siteStaff, other)).toBe(false);
    expect(canTrashWarranty(siteStaff, { requestedBy: siteStaff.id, origin: '' })).toBe(true);
    expect(canTrashWarranty(employee, site)).toBe(false);
    expect(canTrashWarranty(colleague, site)).toBe(false);
    expect(canTrashWarranty(noModule, site)).toBe(false);
    expect(canTrashWarranty({ ...siteStaff, active: false }, site)).toBe(false);
  });
  it('conta inativa não tem acesso, e setor TI possui acesso administrativo existente', () => {
    expect(canAccessWarrantyModule({ ...employee, active: false })).toBe(false);
    expect(canTrashWarranty({ ...admin, active: false }, other)).toBe(false);
    const tiMaster = { id: 'ti-1', role: 'employee', sectors: ['ti'] };
    expect(hasWarrantyAdminAccess(tiMaster)).toBe(true);
    expect(canTrashWarranty(tiMaster, site)).toBe(true);
  });
  it('usuário sem acesso à aba não consegue excluir nem restaurar', () => {
    expect(canAccessWarrantyModule(noModule)).toBe(false);
    expect(canTrashWarranty(noModule, { requestedBy: 'emp-3', origin: '' })).toBe(false);
  });
  it('permissão específica tracking_warranties concede acesso ao módulo', () => {
    expect(canAccessWarrantyModule(noModule, true)).toBe(true);
    expect(canTrashWarranty(noModule, { requestedBy: 'emp-3', origin: '' }, true)).toBe(true);
    expect(canTrashWarranty(noModule, other, true)).toBe(false);
  });
});
