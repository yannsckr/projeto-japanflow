"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPermission } = require('../warrantyLifecyclePolicy.cjs');
const make = (sectors, role='employee', enabled=false, id='emp-1') => ({
  link: { user_id: id, role, active: true },
  user: { active: true, sectors },
  feature: { user_id: id, feature_key: 'tracking_warranties', enabled },
});
const site = { origin: 'site', requested_by: 'site' };
const own = { origin: '', requested_by: 'emp-1' };
const other = { origin: '', requested_by: 'emp-2' };
test('admin gerencia qualquer garantia', () => {
  for (const claim of [site, own, other]) assert.equal(checkPermission(make([], 'admin'), claim), true);
});
test('TI com setor ti tem privilégios administrativos', () => assert.equal(checkPermission(make(['ti']), other), true));
test('site gerencia pedidos do site e próprios, mas não de colegas', () => {
  const actor = make(['site', 'estoque', 'expedicao']);
  assert.equal(checkPermission(actor, site), true);
  assert.equal(checkPermission(actor, own), true);
  assert.equal(checkPermission(actor, other), false);
});
test('estoque e expedição isoladamente não gerenciam site', () => {
  for (const sectors of [['estoque'], ['expedicao'], ['estoque', 'expedicao']]) {
    assert.equal(checkPermission(make(sectors), site), false);
  }
});
test('funcionário com acesso ao módulo gerencia apenas próprias', () => {
  const actor = make(['garantias']);
  assert.equal(checkPermission(actor, own), true);
  assert.equal(checkPermission(actor, other), false);
});
test('recurso explícito permite gerenciar própria mesmo sem setor', () => {
  assert.equal(checkPermission(make([], 'employee', true), own), true);
  assert.equal(checkPermission(make([], 'employee', true), site), false);
});
test('sem módulo não tem permissão nem para própria', () => {
  assert.equal(checkPermission(make(['estoque']), own), false);
});
test('usuário inativo e vínculo inativo são bloqueados', () => {
  const actor = make(['site']);
  actor.user.active = false;
  assert.equal(checkPermission(actor, site), false);
  actor.user.active = true;
  actor.link.active = false;
  assert.equal(checkPermission(actor, site), false);
});
test('permissão falsa de outro usuário não concede acesso', () => {
  const actor = make([]);
  actor.feature.user_id = 'emp-2';
  assert.equal(checkPermission(actor, own), false);
});
test('origem site com solicitante falso não concede acesso', () => {
  assert.equal(checkPermission(make(['site']), { origin: 'site', requested_by: 'emp-1' }), false);
});
