import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { dayInSaoPaulo, measureGpsSegment, type GpsSample } from '@/lib/motoboyTelemetry';
import type { MotoboyAssignment } from '@/hooks/useDepartmental';

/** Rastreamento operacional durante a jornada de entregas iniciada pelo motoboy.
 * A primeira corrida iniciada abre a jornada; apos a ultima entrega, aguarda
 * confirmacao de chegada a loja. O navegador exige permissao de GPS e pode
 * suspender a coleta se o aplicativo for fechado ou colocado em segundo plano.
 */
export function MotoboyLocationSharing({
  userId,
  assignments,
}: {
  userId: string;
  assignments: MotoboyAssignment[];
}) {
  const [session, setSession] = useState(false);
  const previousSample = useRef<GpsSample | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const activeRides = assignments.filter(
    (ride) => ride.assignedTo === userId && ride.status === 'accepted'
  );
  const hasActiveRides = activeRides.length > 0;
  // Never select an arbitrary ride when multiple deliveries are open.
  // Continue live location sharing but pause per-ride odometer tracking until unique.
  const primaryRideId = activeRides.length === 1 ? activeRides[0].id : null;
  const reference = useMemo(() => doc(db, 'motoboy_live_sessions', userId), [userId]);

  // Uma jornada iniciada permanece ativa apos a ultima entrega, ate o retorno.
  useEffect(() => {
    return onSnapshot(
      reference,
      (snapshot) => setSession(snapshot.exists()),
      () => setGpsError('Nao foi possivel consultar a jornada.')
    );
  }, [reference]);

  useEffect(() => {
    if (!hasActiveRides || session) return;
    // O aplicativo so inicia a jornada quando o motoboy inicia uma corrida.
    void setDoc(
      reference,
      { user_id: userId, phase: 'delivering', updated_at: serverTimestamp() },
      { merge: true }
    ).catch(() => setGpsError('Nao foi possivel iniciar o rastreamento.'));
  }, [reference, userId, hasActiveRides, session]);

  useEffect(() => {
    previousSample.current = null;
  }, [session, primaryRideId]);

  useEffect(() => {
    if (!session) return;
    if (!navigator.geolocation) {
      setGpsError('GPS indisponivel neste aparelho.');
      return;
    }
    let last = 0;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - last < 15000) return;
        last = Date.now();
        const current: GpsSample = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        };
        const validFix =
          [current.lat, current.lng, current.accuracy, current.timestamp].every(Number.isFinite) &&
          Math.abs(current.lat) <= 90 &&
          Math.abs(current.lng) <= 180 &&
          current.accuracy >= 0 &&
          current.accuracy <= 50;
        const previous = previousSample.current;
        const segment = previous ? measureGpsSegment(previous, current) : null;
        // Do not let an inaccurate or invalid fix contaminate the next segment.
        previousSample.current = validFix ? current : null;
        // Atribui o deslocamento a uma unica corrida quando ha multiplas simultaneas.
        // Sem isso o mesmo quilometro seria contado duas ou mais vezes.
        if (
          primaryRideId &&
          validFix &&
          (!previous ||
            segment?.accepted === true ||
            (segment?.accepted === false && segment.reason === 'stationary'))
        ) {
          void addDoc(collection(db, 'motoboy_telemetry'), {
            user_id: userId,
            ride_id: primaryRideId,
            day: dayInSaoPaulo(new Date(current.timestamp)),
            lat: current.lat,
            lng: current.lng,
            accuracy: current.accuracy,
            client_at: current.timestamp,
            // The backend recomputes meters from GPS points; keep this inert and within rules limits.
            meters: 0,
            recorded_at: serverTimestamp(),
          }).catch(() => setGpsError('Nao foi possivel salvar o percurso.'));
        }
        if (!validFix) {
          setGpsError('Localização imprecisa ou inválida. Aguardando nova leitura GPS.');
          return;
        }
        void setDoc(
          reference,
          {
            user_id: userId,
            phase: hasActiveRides ? 'delivering' : 'returning',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => setGpsError('Falha ao atualizar a localizacao.'));
      },
      () => setGpsError('Permita acesso a localizacao no navegador para acompanhar a jornada.'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [reference, session, userId, hasActiveRides, primaryRideId]);

  // Mantém o rastreamento ativo, sem mostrar banner durante as corridas.
  // Ao terminar as entregas, mantém apenas a confirmação necessária para encerrar a jornada.
  if (!session) return null;
  if (activeRides.length > 1) {
    return (
      <p
        role="status"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
      >
        Há várias corridas ativas. O GPS da jornada continua disponível, mas a quilometragem por
        corrida fica pausada para evitar atribuição incorreta. Conclua uma das corridas para
        retomar.
      </p>
    );
  }
  if (hasActiveRides) return null;
  return (
    <div className="rounded-xl border bg-card p-3 text-sm">
      {gpsError && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {gpsError}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        className="min-h-11 w-full sm:w-auto"
        onClick={async () => {
          try {
            await deleteDoc(reference);
            toast.success('Retorno à loja confirmado. Jornada encerrada.');
          } catch {
            toast.error('Não foi possível encerrar a jornada. Tente novamente.');
          }
        }}
      >
        Confirmar chegada à loja
      </Button>
    </div>
  );
}
