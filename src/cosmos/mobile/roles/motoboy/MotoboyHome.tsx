import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bike,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  Route,
  X,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import logoDark from '@/assets/japanflow-logo-dark.png';
import logoLight from '@/assets/japanflow-logo-light.png';
import markLight from '@/assets/japanflow-mark-light.png';
import { useMotoboyRides, type Ride } from './useMotoboyRides';
import './motoboy.css';

const MotoboyMap = lazy(() => import('./MotoboyMap'));

function RideCard({ ride, onOpen }: { ride: Ride; onOpen: () => void }) {
  const title = ride.clientName || ride.description || 'Corrida';
  return (
    <button type="button" className="jf-moto-card" onClick={onOpen}>
      <span className="jf-moto-card-top">
        <Bike size={21} />
        <ChevronRight size={17} />
      </span>
      <strong>{title}</strong>
      <span className="jf-moto-card-location">{ride.location || 'Endereço não informado'}</span>
      <small>{ride.status === 'accepted' ? 'Em andamento' : 'Aguardando início'}</small>
      <span className="jf-moto-card-accent" aria-hidden="true" />
    </button>
  );
}

function RideSection({
  title,
  icon: Icon,
  rides,
  empty,
  onRide,
}: {
  title: string;
  icon: typeof Route;
  rides: Ride[];
  empty: string;
  onRide: (ride: Ride) => void;
}) {
  return (
    <section className="jf-moto-section">
      <div className="jf-moto-section-title">
        <span className="jf-moto-section-icon">
          <Icon size={18} />
        </span>
        <h2>{title}</h2>
        <span className="jf-moto-rule" />
      </div>
      {rides.length ? (
        <div className="jf-moto-cards" role="list">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} onOpen={() => onRide(ride)} />
          ))}
        </div>
      ) : (
        <p className="jf-moto-empty">{empty}</p>
      )}
    </section>
  );
}

export default function MotoboyHome() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<Ride | null>(null);
  const { route, pending, active, completed, loading, error } = useMotoboyRides(currentUser?.id);

  return (
    <div className="jf-moto-root">
      <header className="jf-moto-header">
        <img src={logoDark} alt="JapanFlow" />
        <span className="jf-moto-header-mark" aria-hidden="true" />
      </header>
      <div className="jf-moto-map-wrap">
        <Suspense fallback={<div className="jf-moto-map-skeleton">Carregando mapa…</div>}>
          <MotoboyMap />
        </Suspense>
        <button
          className="jf-moto-menu-btn"
          onClick={() => setDrawer(true)}
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>
      </div>
      <div className="jf-moto-body">
        {error && (
          <p role="alert" className="jf-moto-error">
            {error}
          </p>
        )}
        {loading && <p className="jf-moto-empty">Sincronizando corridas…</p>}
        <RideSection
          title="Sua rota"
          icon={MapPin}
          rides={route}
          empty="Nenhuma rota atribuída no momento."
          onRide={setSelected}
        />
        <RideSection
          title="Corridas pendentes"
          icon={Clock3}
          rides={pending}
          empty="Nenhuma corrida aguardando início."
          onRide={setSelected}
        />
      </div>
      {selected && (
        <div className="jf-moto-overlay" onClick={() => setSelected(null)}>
          <div
            className="jf-moto-detail"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da corrida"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Fechar detalhes"
              className="jf-moto-close"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <span className="jf-moto-pill">
              {selected.status === 'accepted' ? 'Em andamento' : 'Aguardando início'}
            </span>
            <h2>{selected.clientName || selected.description || 'Corrida'}</h2>
            <p>
              <MapPin size={17} /> {selected.location || 'Endereço não informado'}
            </p>
            <p>{selected.description}</p>
            <p className="jf-moto-detail-note">
              Os comandos de iniciar/finalizar serão integrados ao fluxo de comprovante e às
              permissões existentes. Nenhuma ação é simulada nesta tela.
            </p>
            <button
              className="jf-moto-action"
              onClick={() => {
                setSelected(null);
                navigate('/motoboy/corridas');
              }}
            >
              Ver minhas corridas
            </button>
          </div>
        </div>
      )}
      {drawer && (
        <div className="jf-moto-overlay jf-moto-drawer-overlay" onClick={() => setDrawer(false)}>
          <aside
            className="jf-moto-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu do JapanFlow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jf-moto-drawer-brand">
              <img src={markLight} alt="" />
              <img src={logoLight} alt="JapanFlow" />
            </div>
            <nav aria-label="Menu do motoboy">
              <button onClick={() => setDrawer(false)}>Início</button>
              <button
                onClick={() => {
                  setDrawer(false);
                  navigate('/motoboy/corridas');
                }}
              >
                Minhas corridas
              </button>
              <button
                onClick={() => {
                  setDrawer(false);
                  navigate('/chat');
                }}
              >
                Chat
              </button>
            </nav>
            <div className="jf-moto-drawer-bottom">
              <span className="jf-moto-avatar">
                <img src={markLight} alt="" />
              </span>
              <div className="jf-moto-person">
                <strong>{currentUser?.name || 'Usuário'}</strong>
                <small>{currentUser?.function || 'Motoboy'}</small>
              </div>
              <button
                aria-label="Abrir chat"
                onClick={() => {
                  setDrawer(false);
                  navigate('/chat');
                }}
              >
                <MessageCircle size={19} />
              </button>
              <button
                aria-label="Sair da conta"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut size={19} />
              </button>
            </div>
          </aside>
        </div>
      )}
      <span className="sr-only">
        {active.length} corridas em andamento e {completed.length} finalizadas
      </span>
    </div>
  );
}
