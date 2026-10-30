import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type RoutePoint = { lat: number; lng: number; accuracy: number; at: number };
type Basemap = 'standard' | 'satellite';

function FitRoute({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
  }, [map, points]);
  return null;
}

// Segmentos com intervalos longos são separados: não há linha inventada sobre um trecho sem GPS.
function splitByGap(points: RoutePoint[]): [number, number][][] {
  const result: [number, number][][] = [];
  let current: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (i > 0 && point.at - points[i - 1].at > 300_000) {
      result.push(current);
      current = [];
    }
    current.push([point.lat, point.lng]);
  }
  if (current.length) result.push(current);
  return result;
}

export function MotoboyRouteMap({ points }: { points: RoutePoint[] }) {
  const [basemap, setBasemap] = useState<Basemap>('standard');
  const valid = points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Number.isFinite(p.at) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
  );
  if (!valid.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum ponto GPS disponível para o mapa desta corrida.
      </p>
    );
  const sorted = [...valid].sort((a, b) => a.at - b.at);
  const segments = splitByGap(sorted);
  const start: [number, number] = [sorted[0].lat, sorted[0].lng];
  const end: [number, number] = [sorted[sorted.length - 1].lat, sorted[sorted.length - 1].lng];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Traçado das amostras GPS registradas, não rota calculada por ruas.
        </p>
        <div className="flex overflow-hidden rounded-lg border" aria-label="Tipo de mapa">
          <button
            type="button"
            aria-pressed={basemap === 'standard'}
            className={`px-3 py-2 text-xs ${basemap === 'standard' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            onClick={() => setBasemap('standard')}
          >
            Mapa
          </button>
          <button
            type="button"
            aria-pressed={basemap === 'satellite'}
            className={`px-3 py-2 text-xs ${basemap === 'satellite' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            onClick={() => setBasemap('satellite')}
          >
            Satélite
          </button>
        </div>
      </div>
      <div className="h-[360px] w-full overflow-hidden rounded-xl border sm:h-[480px]">
        <MapContainer
          center={start}
          zoom={15}
          scrollWheelZoom={false}
          className="h-full w-full"
          aria-label="Mapa do percurso do motoboy"
        >
          {basemap === 'standard' ? (
            <TileLayer
              key="standard"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          ) : (
            <TileLayer
              key="satellite"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri and its data providers"
            />
          )}
          <FitRoute points={sorted} />
          {segments.map((segment, index) =>
            segment.length > 1 ? (
              <Polyline
                key={index}
                positions={segment}
                pathOptions={{ color: '#2563eb', weight: 4 }}
              />
            ) : null
          )}
          <CircleMarker
            center={start}
            radius={7}
            pathOptions={{ color: '#166534', fillColor: '#22c55e', fillOpacity: 1 }}
          />
          <CircleMarker
            center={end}
            radius={7}
            pathOptions={{ color: '#991b1b', fillColor: '#ef4444', fillOpacity: 1 }}
          />
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Verde: início · Vermelho: última leitura · Trechos com mais de 5 minutos sem GPS permanecem
        desconectados. As coordenadas exibidas são transmitidas ao provedor dos mapas.
      </p>
    </div>
  );
}
