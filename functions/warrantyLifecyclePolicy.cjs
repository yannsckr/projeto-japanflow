"use strict";

// Só dados verificados no servidor devem ser usados como actor.
function checkPermission({ link, user, feature }, claim) {
  if (!link || !link.user_id || link.active === false || !user || user.active === false) {
    return false;
  }
  const sectors = Array.isArray(user.sectors) ? user.sectors : [];
  const admin = link.role === 'admin' || sectors.includes('ti');
  const canSeeModule = admin || sectors.some(s =>
    ['garantias', 'vendas', 'expedicao', 'site'].includes(s)
  ) || (feature?.enabled === true &&
    feature.user_id === link.user_id &&
    feature.feature_key === 'tracking_warranties');

  if (!canSeeModule || !claim) return false;
  if (admin) return true;
  if (claim.origin === 'site') {
    return claim.requested_by === 'site' && sectors.includes('site');
  }
  return claim.requested_by === link.user_id;
}

module.exports = { checkPermission };
