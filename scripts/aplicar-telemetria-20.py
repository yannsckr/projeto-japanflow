"""Aplica somente regras e agenda; faça backup/commit antes e teste em emuladores."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
rules=root/'firestore.rules'
s=rules.read_text(encoding='utf-8')
marker='    // Colecoes operacionais nao cobertas pelas regras especificas.'
if marker not in s: raise SystemExit('Marcador das regras nao encontrado; nenhuma alteracao feita.')
block='''    // Pontos do percurso: somente motoboy da corrida ativa cria amostras.
    // Os campos "meters" enviados pelo dispositivo nao sao usados no calculo do fechamento.
    function validTelemetry() {
      let r = request.resource.data;
      let ridePath = /databases/$(database)/documents/motoboy_assignments/$(r.ride_id);
      return isActive() && exists(currentUserPath())
        && get(currentUserPath()).data.sectors.hasAny(['motoboys'])
        && r.keys().hasOnly(['user_id','ride_id','day','lat','lng','accuracy','client_at','meters','recorded_at'])
        && r.keys().hasAll(['user_id','ride_id','day','lat','lng','accuracy','client_at','meters','recorded_at'])
        && r.user_id == currentUserId()
        && r.ride_id is string && r.day is string && r.day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && r.lat is number && r.lat >= -90 && r.lat <= 90
        && r.lng is number && r.lng >= -180 && r.lng <= 180
        && r.accuracy is number && r.accuracy >= 0 && r.accuracy <= 50
        && r.client_at is number && r.meters is number && r.meters >= 0 && r.meters <= 1000
        && r.recorded_at == request.time
        && exists(ridePath)
        && get(ridePath).data.assigned_to == currentUserId()
        && get(ridePath).data.status == 'accepted';
    }
    match /motoboy_telemetry/{sampleId} {
      allow get, list: if canViewMotoboyGps();
      allow create: if validTelemetry();
      allow update, delete: if false;
    }
    match /motoboy_daily_reports/{day} {
      allow get, list: if canViewMotoboyGps();
      allow create, update, delete: if false;
    }

'''
if 'match /motoboy_telemetry/{sampleId}' not in s:
 s=s.replace(marker,block+marker)
 s=s.replace("&& collection != 'motoboy_live_sessions'", "&& collection != 'motoboy_live_sessions'\n        && collection != 'motoboy_telemetry'\n        && collection != 'motoboy_daily_reports'")
 rules.write_text(s,encoding='utf-8')
 print('firestore.rules atualizado')
else: print('firestore.rules ja atualizado')
index=root/'functions/index.js'
content=index.read_text(encoding='utf-8')
line="exports.motoboyDailySummary = require('./motoboyDailySummary').motoboyDailySummary;"
if line not in content:
 with index.open('a',encoding='utf-8') as f:f.write('\n'+line+'\n')
 print('functions/index.js atualizado')
else: print('functions/index.js ja atualizado')
