import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';

const marker = L.divIcon({
  className: 'jf-motoboy-location',
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

type Coordinates = [number, number];
const fallback: Coordinates = [-23.1896, -45.8841]; // Centro de referencia, nao posicao do usuario.

function Follow({ coordinate }: { coordinate: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (coordinate) map.flyTo(coordinate, 15, { duration: 0.7 });
  }, [coordinate, map]);
  return null;
}

export default function MotoboyMap() {
  const [coordinate, setCoordinate] = useState<Coordinates | null>(null);
  const [message, setMessage] = useState('Mapa de referência — localização ainda não autorizada');
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setMessage('GPS indisponível neste dispositivo');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinate([pos.coords.latitude, pos.coords.longitude]);
        setMessage('Sua localização atual');
      },
      () => setMessage('Localização não autorizada. Você pode acompanhar as corridas na lista.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  };

  return (
    <div className="jf-moto-map">
      <MapContainer
        center={fallback}
        zoom={12}
        scrollWheelZoom={false}
        zoomControl={false}
        className="jf-moto-map-layer"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Follow coordinate={coordinate} />
        {coordinate && <Marker position={coordinate} icon={marker} />}
      </MapContainer>
      <button
        className="jf-moto-locate"
        type="button"
        onClick={locate}
        aria-label="Localizar minha posição"
      >
        <LocateFixed size={21} />
      </button>
      <span className="jf-moto-map-caption">{message}</span>
    </div>
  );
}
