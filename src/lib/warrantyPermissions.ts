import type { WarrantyClaim } from '@/hooks/useWarranties';

export type WarrantyPermissionUser = {
  id: string;
  role: string;
  sectors?: readonly string[];
  active?: boolean;
};

/** TI com setor `ti` tem poderes administrativos nas regras atuais do Firestore.
 * A UI deve refletir o mesmo nível administrativo concedido por `isTiMaster()`.
 */
export function hasWarrantyAdminAccess(user: WarrantyPermissionUser | null | undefined): boolean {
  return Boolean(
    user && user.active !== false && (user.role === 'admin' || user.sectors?.includes('ti'))
  );
}

/** Mesma visibilidade da aba Garantias na página Departamental. */
export function canAccessWarrantyModule(
  user: WarrantyPermissionUser | null | undefined,
  hasTrackingWarrantyFeature = false
): boolean {
  if (!user || user.active === false) return false;
  return (
    hasWarrantyAdminAccess(user) ||
    Boolean(
      user.sectors?.some((sector) => ['garantias', 'vendas', 'expedicao', 'site'].includes(sector))
    ) ||
    hasTrackingWarrantyFeature
  );
}

/** Não confundir o solicitante 'site' com a identidade de um funcionário. */
export function canTrashWarranty(
  user: WarrantyPermissionUser | null | undefined,
  claim: Pick<WarrantyClaim, 'requestedBy' | 'origin'>,
  hasTrackingWarrantyFeature = false
): boolean {
  if (!user || !canAccessWarrantyModule(user, hasTrackingWarrantyFeature)) {
    return false;
  }
  // Requisições recebidas pelo site têm autoria 'site' (backend), não de funcionário.
  // A equipe do setor Site pode gerenciá-las, sem receber permissão
  // para excluir garantias manuais de outros funcionários.
  if (hasWarrantyAdminAccess(user)) return true;
  if (claim.origin === 'site') {
    return claim.requestedBy === 'site' && Boolean(user.sectors?.includes('site'));
  }
  return claim.requestedBy === user.id;
}
