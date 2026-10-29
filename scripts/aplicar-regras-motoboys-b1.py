"""Aplica proposta de endurecimento nas regras das corridas, sem deploy.
Use em branch dedicada. Faz backup e falha se a estrutura não for a esperada.
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
# Copiado de scripts/ para a raiz do repositório: /projeto-japanflow/scripts/arquivo.py
rules = root / 'firestore.rules'
if not rules.is_file():
    raise SystemExit(f'firestore.rules não encontrado em {rules}. Coloque o script na pasta scripts/ do projeto.')
s = rules.read_text(encoding='utf-8')
start_marker = '    // Colecoes operacionais nao cobertas pelas regras especificas.'
if s.count(start_marker) != 1:
    raise SystemExit('Marcador de fallback inexistente/ambíguo; nenhuma alteração feita.')
if 'match /motoboy_assignments/{rideId}' in s:
    raise SystemExit('Regras de motoboy já presentes: revisar manualmente; nenhuma alteração feita.')
needle = "        && collection != 'motoboy_live_sessions'"
if s.count(needle) != 1:
    raise SystemExit('Fallback inesperado; nenhuma alteração feita.')

block = '''    // B1 — Corridas: separar controle de gestores e atualização operacional pelo motoboy.
    // Gestor operacional autorizado: administrador/TI ou conta interna emp-1 (validar identidade).
    function canManageMotoboyRides() {
      return isAdmin() || (isActive() && currentUserId() == 'emp-1');
    }

    function isAssignedMotoboy(data) {
      return isActive() && exists(currentUserPath())
        && ('sectors' in get(currentUserPath()).data)
        && get(currentUserPath()).data.sectors.hasAny(['motoboys'])
        && data.assigned_to == currentUserId();
    }

    function validRideCompletion(before, after) {
      return after.status == 'completed'
        && before.status == 'accepted'
        && after.get('proof_url', '') is string
        && after.proof_url.size() > 0
        && after.get('completed_at', null) == request.time
        && after.get('accepted_at', null) == before.get('accepted_at', null);
    }

    function validMotoboyOperationalUpdate() {
      return isAssignedMotoboy(resource.data)
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['status', 'updated_at', 'accepted_at', 'completed_at', 'proof_url', 'notes'])
        && request.resource.data.updated_at == request.time
        && (
          (resource.data.status == 'pending'
            && request.resource.data.status == 'accepted'
            && request.resource.data.accepted_at == request.time
            && request.resource.data.get('completed_at', null) == resource.data.get('completed_at', null)
            && request.resource.data.get('proof_url', null) == resource.data.get('proof_url', null))
          ||
          validRideCompletion(resource.data, request.resource.data)
        );
    }

    match /motoboy_assignments/{rideId} {
      allow read: if isActive();
      allow create: if canManageMotoboyRides()
        && request.resource.data.get('status', '') in ['pending', 'pending_approval']
        && request.resource.data.get('assigned_by', '') == currentUserId();
      allow update: if (
        canManageMotoboyRides()
        && request.resource.data.get('status', '') != 'completed'
      ) || validMotoboyOperationalUpdate();
      allow delete: if canManageMotoboyRides();
    }

'''
# This deliberately forbids managers from completing a ride, and disallows backward
# transitions by motoboys. Manager update clause will need hardening after emulator tests.
s = s.replace(start_marker, block + start_marker)
s = s.replace(needle, needle + "\n        && collection != 'motoboy_assignments'")
backup = rules.with_suffix('.rules.b1-backup')
if backup.exists():
    raise SystemExit('Backup preexistente; não sobrescrever. Nenhuma alteração feita.')
backup.write_text(rules.read_text(encoding='utf-8'), encoding='utf-8')
rules.write_text(s, encoding='utf-8')
print('Proposta B1 aplicada. Backup:', backup)
print('NÃO FAÇA DEPLOY sem teste do emulador e revisão de gestores/legado.')
