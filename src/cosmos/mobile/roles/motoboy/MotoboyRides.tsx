import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, CheckCircle2, MapPin } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useMotoboyRides } from './useMotoboyRides';
import './motoboy.css';

export default function MotoboyRides() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const { route, completed, error, loading } = useMotoboyRides(currentUser?.id);
  return (
    <main className="jf-moto-list">
      <button className="jf-moto-back" onClick={() => navigate('/motoboy')}>
        <ArrowLeft size={18} /> Início
      </button>
      <h1>Minhas corridas</h1>
      {loading && <p>Sincronizando…</p>}
      {error && <p role="alert">{error}</p>}
      <section>
        <h2>
          <Clock3 size={17} className="inline mr-2" />
          Abertas ({route.length})
        </h2>
        {route.length === 0 && <p className="jf-moto-empty">Nenhuma corrida em aberto.</p>}
        {route.map((ride) => (
          <div key={ride.id} className="border rounded-xl p-4 mb-3">
            <strong>{ride.clientName || ride.description}</strong>
            <p className="text-sm text-gray-600 mt-2">
              <MapPin size={14} className="inline mr-1" />
              {ride.location || 'Sem endereço'}
            </p>
            <small className="text-red-600 font-semibold">
              {ride.status === 'accepted' ? 'Em andamento' : 'Aguardando início'}
            </small>
          </div>
        ))}
      </section>
      <section>
        <h2>
          <CheckCircle2 size={17} className="inline mr-2" />
          Concluídas ({completed.length})
        </h2>
        {completed.length === 0 && <p className="jf-moto-empty">Nenhuma corrida concluída.</p>}
        {completed.map((ride) => (
          <div key={ride.id} className="border rounded-xl p-4 mb-3">
            <strong>{ride.clientName || ride.description}</strong>
            <p className="text-sm text-gray-600">{ride.location || 'Sem endereço'}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
