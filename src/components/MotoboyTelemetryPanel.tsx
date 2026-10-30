import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MapPinned, Route, Clock3 } from 'lucide-react';

type Point = {
  id: string;
  userId: string;
  rideId: string;
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
};
type SummaryUser = {
  user_id: string;
  rides: number;
  km: number;
  duration_minutes?: number;
  limited_gps_coverage?: boolean;
};
const R = 6371000;
const rad = (v: number) => (v * Math.PI) / 180;
const dayInSaoPaulo = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function segment(a: Point, b: Point) {
  const secs = (b.at - a.at) / 1000;
  if (secs <= 0 || secs > 300 || a.accuracy > 50 || b.accuracy > 50) return 0;
  const dlat = rad(b.lat - a.lat);
  const dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  const meters = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return meters >= Math.max(15, a.accuracy + b.accuracy) && meters / secs <= 40 ? meters : 0;
}
function RouteSketch({ points }: { points: Point[] }) {
  if (points.length < 2)
    return (
      <p className="text-sm text-muted-foreground">Percurso insuficiente para desenhar a rota.</p>
    );
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const midLat = (minLat + maxLat) / 2;
  const xScale = Math.max(0.01, Math.cos(rad(midLat)));
  const xs = points.map((p) => p.lng * xScale);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const dx = Math.max(0.00001, maxX - minX),
    dy = Math.max(0.00001, maxLat - minLat);
  const coords = points.map((p, i) => ({
    x: 18 + (564 * (xs[i] - minX)) / dx,
    y: 202 - (184 * (p.lat - minLat)) / dy,
  }));
  const path = coords
    .map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 600 220"
        role="img"
        aria-label="Traçado esquemático das posições GPS da corrida"
        className="w-full rounded-xl border bg-muted/20"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={coords[0].x} cy={coords[0].y} r="6" fill="#16a34a" />
        <circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r="6"
          fill="#dc2626"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        Traçado GPS esquemático (não é um mapa viário). Verde: início · Vermelho: última amostra.
      </p>
    </div>
  );
}
export function MotoboyTelemetryPanel({ userId, name }: { userId: string; name: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [rideId, setRideId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'motoboy_telemetry'), where('user_id', '==', userId)),
      (snap) => {
        const data = snap.docs.map((d) => {
          const p = d.data();
          return {
            id: d.id,
            userId: String(p.user_id),
            rideId: String(p.ride_id),
            lat: Number(p.lat),
            lng: Number(p.lng),
            accuracy: Number(p.accuracy),
            at: Number(p.client_at),
          };
        });
        setPoints(
          data
            .filter((p) => [p.lat, p.lng, p.accuracy, p.at].every(Number.isFinite))
            .sort((a, b) => a.at - b.at)
        );
        setError('');
      },
      () => setError('Sem permissão para consultar a telemetria ou falha de rede.')
    );
    return unsubscribe;
  }, [userId]);
  const rides = useMemo(() => [...new Set(points.map((p) => p.rideId))], [points]);
  const selected = rideId && rides.includes(rideId) ? rideId : rides[rides.length - 1];
  const path = useMemo(() => points.filter((p) => p.rideId === selected), [points, selected]);
  const meters = useMemo(
    () => path.reduce((total, p, i) => (i ? total + segment(path[i - 1], p) : total), 0),
    [path]
  );
  const elapsed =
    path.length > 1 ? Math.max(0, Math.round((path[path.length - 1].at - path[0].at) / 60000)) : 0;
  const gaps = path.reduce(
    (count, p, i) => (i && p.at - path[i - 1].at > 300000 ? count + 1 : count),
    0
  );
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-label={`Telemetria de ${name}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Route className="h-4 w-4" /> Percurso de {name}
        </h2>
        <span className="text-xs text-muted-foreground">{rides.length} corrida(s) com GPS</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {rides.length ? (
        <>
          <label className="block text-xs text-muted-foreground" htmlFor={`ride-${userId}`}>
            Corrida registrada
          </label>
          <select
            id={`ride-${userId}`}
            className="w-full rounded-lg border bg-background p-2 text-sm"
            value={selected}
            onChange={(e) => setRideId(e.target.value)}
          >
            {rides.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Km registrados</p>
              <strong>{(meters / 1000).toFixed(2)} km</strong>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Janela GPS</p>
              <strong>{elapsed} min</strong>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amostras</p>
              <strong>{path.length}</strong>
            </div>
          </div>
          <RouteSketch points={path} />
          {gaps > 0 && (
            <p className="text-xs text-amber-600">
              {gaps} intervalo(s) sem GPS por mais de cinco minutos. Distância parcial.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" /> Duração acima é apenas o período entre
            amostras, não o tempo oficial de início e conclusão da corrida.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ainda não há telemetria registrada para este motoboy.
        </p>
      )}
    </section>
  );
}
export function MotoboyDailyReportPanel({ getName }: { getName: (id: string) => string }) {
  const [day, setDay] = useState(dayInSaoPaulo);
  const [users, setUsers] = useState<SummaryUser[] | null>(null);
  const [error, setError] = useState('');
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'motoboy_daily_reports', day),
        (snap) => {
          setUsers(snap.exists() ? (snap.data().users as SummaryUser[]) || [] : null);
          setError('');
        },
        () => {
          setUsers(null);
          setError('Não foi possível abrir o fechamento diário.');
        }
      ),
    [day]
  );
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-label="Fechamento diário dos motoboys"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPinned className="h-4 w-4" /> Resumo das 18h
        </h2>
        <input
          type="date"
          aria-label="Data do fechamento"
          className="rounded-lg border bg-background p-2 text-sm"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {users ? (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.user_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-3 text-sm"
            >
              <strong>{getName(user.user_id)}</strong>
              <span>{user.rides} corrida(s)</span>
              <span>{Number(user.km || 0).toFixed(2)} km</span>
              <span>{user.duration_minutes || 0} min</span>
              {user.limited_gps_coverage && <span className="text-amber-600">GPS incompleto</span>}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Relatório gerado sem corridas registradas.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem relatório para esta data. O fechamento é previsto para as 18h (São Paulo), após
          publicação da função agendada.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Quilometragem estimada de pontos GPS aceitos. O relatório é um retrato gerado às 18h, não o
        fechamento final de todo o dia.
      </p>
    </section>
  );
}
