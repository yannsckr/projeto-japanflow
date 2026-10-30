import { MotoboyTelemetryPanel, MotoboyDailyReportPanel } from '@/components/MotoboyTelemetryPanel';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock3, LocateFixed, MapPin, ShieldCheck, Truck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Session = {
  id: string;
  userId: string;
  phase: 'delivering' | 'returning';
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: number;
};

const MAX_AGE_MS = 120_000;

/** Mapa mostra a ultima posicao conhecida, mesmo quando a leitura estiver desatualizada. */
function IndividualMap({ session, name, now }: { session: Session; name: string; now: number }) {
  const valid =
    session.lat !== null &&
    session.lng !== null &&
    Number.isFinite(session.lat) &&
    Number.isFinite(session.lng) &&
    session.lat >= -90 &&
    session.lat <= 90 &&
    session.lng >= -180 &&
    session.lng <= 180;
  const recent =
    valid &&
    session.updatedAt > 0 &&
    now - session.updatedAt >= 0 &&
    now - session.updatedAt <= MAX_AGE_MS;
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite'>('roadmap');
  const url = valid
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${session.lat},${session.lng}`)}&z=16&t=${mapStyle === 'satellite' ? 'k' : 'm'}&output=embed`
    : '';
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Truck className="h-4 w-4 text-primary" /> {name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.phase === 'returning' ? 'Retornando à loja' : 'Em entregas'}
          </p>
        </div>
        <Badge variant={recent ? 'default' : 'secondary'}>
          {recent
            ? 'Ao vivo (recente)'
            : valid
              ? 'Última posição · desatualizada'
              : 'Sem posição registrada'}
        </Badge>
      </div>
      {valid && (
        <div
          className="flex items-center justify-end gap-2 border-t px-4 py-2"
          role="group"
          aria-label={`Estilo do mapa de ${name}`}
        >
          <Button
            size="sm"
            variant={mapStyle === 'roadmap' ? 'default' : 'outline'}
            onClick={() => setMapStyle('roadmap')}
            aria-pressed={mapStyle === 'roadmap'}
          >
            Mapa
          </Button>
          <Button
            size="sm"
            variant={mapStyle === 'satellite' ? 'default' : 'outline'}
            onClick={() => setMapStyle('satellite')}
            aria-pressed={mapStyle === 'satellite'}
          >
            Satélite
          </Button>
        </div>
      )}
      {valid ? (
        <iframe
          title={`Mapa individual de ${name}`}
          className="h-[420px] w-full border-y md:h-[570px] xl:h-[680px]"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={url}
        />
      ) : (
        <div className="flex h-[420px] flex-col items-center justify-center gap-2 border-y bg-muted/30 px-5 text-center text-muted-foreground md:h-[570px] xl:h-[680px]">
          <MapPin className="h-8 w-8" />
          <p className="text-sm font-medium">Nenhuma coordenada registrada</p>
          <p className="max-w-xs text-xs">
            O motoboy ainda não enviou uma coordenada válida nesta jornada.
          </p>
        </div>
      )}
      {valid && !recent && (
        <div
          role="alert"
          className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300"
        >
          Mostrando a última posição conhecida, não a localização atual. O aparelho pode estar
          offline, com o GPS indisponível ou com o navegador suspenso.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />{' '}
          {session.updatedAt
            ? new Date(session.updatedAt).toLocaleString('pt-BR')
            : 'Aguardando primeira posição'}
        </span>
        {valid && session.accuracy !== null && (
          <span className="flex items-center gap-1">
            <LocateFixed className="h-3.5 w-3.5" /> Precisão aproximada:{' '}
            {Math.round(session.accuracy)} m
          </span>
        )}
      </div>
    </article>
  );
}

export default function MotoboyTrackingPage() {
  const { currentUser, users } = useApp();
  const authorized = currentUser?.role === 'admin' || currentUser?.id === 'emp-1';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!authorized) return;
    const unsubscribe = onSnapshot(
      collection(db, 'motoboy_live_sessions'),
      (snapshot) => {
        setSessions(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              userId: String(data.user_id || docSnap.id),
              phase: data.phase === 'returning' ? 'returning' : 'delivering',
              lat: typeof data.lat === 'number' ? data.lat : null,
              lng: typeof data.lng === 'number' ? data.lng : null,
              accuracy: typeof data.accuracy === 'number' ? data.accuracy : null,
              updatedAt: data.updated_at?.toMillis?.() || 0,
            };
          })
        );
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Não foi possível consultar as jornadas. Verifique as permissões do Firestore.');
        setLoading(false);
        setSessions([]);
      }
    );
    return unsubscribe;
  }, [authorized]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => a.userId.localeCompare(b.userId)),
    [sessions]
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!authorized)
    return (
      <div role="alert" className="rounded-xl border p-6">
        Acesso restrito à gestão autorizada dos motoboys.
      </div>
    );
  const getName = (id: string) => users.find((user) => user.id === id)?.name || id;

  return (
    <main className="space-y-6 pb-8">
      <header className="rounded-2xl border bg-card p-5 sm:p-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/departmental">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Departamental
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <MapPin className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Acompanhamento dos motoboys</h1>
            <p className="text-sm text-muted-foreground">
              Uma visualização individual por jornada ativa, atualizada pelo Firestore.
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Somente a gestão autorizada acessa
          estes dados. Mapas externos Google Maps recebem as coordenadas de cada posição exibida. O
          navegador móvel pode suspender atualizações em segundo plano.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jornadas registradas</p>
          <strong className="text-2xl">{sessions.length}</strong>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Em entregas</p>
          <strong className="text-2xl">
            {sessions.filter((s) => s.phase === 'delivering').length}
          </strong>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Retornando à loja</p>
          <strong className="text-2xl">
            {sessions.filter((s) => s.phase === 'returning').length}
          </strong>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Consultando jornadas...</p>
      ) : sorted.length === 0 && !error ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Nenhum motoboy com jornada registrada no momento.
        </div>
      ) : null}
      <section className="flex flex-col gap-6" aria-label="Mapas individuais dos motoboys">
        {sorted.map((s) => (
          <IndividualMap key={s.id} session={s} name={getName(s.userId)} now={now} />
        ))}
      </section>
      {/* C.2: telemetria de corridas e fechamento diario */}
      <MotoboyDailyReportPanel getName={getName} />
      <section className="space-y-5" aria-label="Percursos GPS por motoboy">
        {sorted.map((session) => (
          <MotoboyTelemetryPanel
            key={session.userId}
            userId={session.userId}
            name={getName(session.userId)}
          />
        ))}
      </section>
    </main>
  );
}
