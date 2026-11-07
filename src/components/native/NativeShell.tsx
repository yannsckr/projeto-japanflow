import { useMemo } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  UserRound,
  MapPinned,
  LogOut,
  Monitor,
  Smartphone,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export type NativePlatform = 'desktop' | 'android';

const links = [
  { to: '/board', label: 'Meu quadro', icon: LayoutDashboard },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/drive', label: 'Drive', icon: FolderOpen },
  { to: '/tracking', label: 'Acompanhamentos', icon: ClipboardList },
  { to: '/profile', label: 'Perfil', icon: UserRound },
];

export default function NativeShell({ platform }: { platform: NativePlatform }) {
  const { currentUser, authLoading, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const menu = useMemo(() => {
    if (!currentUser) return [];
    const result = [...links];
    if (currentUser.role === 'admin')
      result.unshift({ to: '/admin', label: 'Administração', icon: LayoutDashboard });
    // Vitrine de acesso: autorização real continua nas regras/servidor.
    if (Array.isArray(currentUser.sectors) && currentUser.sectors.includes('motoboys')) {
      result.push({ to: '/departmental/motoboys/mapa', label: 'Motoboys', icon: MapPinned });
    }
    return result;
  }, [currentUser]);

  if (authLoading)
    return (
      <div role="status" className="p-8">
        Validando sessão...
      </div>
    );
  if (!currentUser) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (location.pathname === '/admin' && currentUser.role !== 'admin') {
    return <Navigate to="/board" replace />;
  }
  if (
    location.pathname === '/departmental/motoboys/mapa' &&
    currentUser.role !== 'admin' &&
    !(Array.isArray(currentUser.sectors) && currentUser.sectors.includes('motoboys'))
  ) {
    return <Navigate to="/board" replace />;
  }

  const nav = (
    <nav
      aria-label="Navegação COSMOS"
      className={
        platform === 'desktop' ? 'flex flex-col gap-1' : 'flex items-center gap-1 overflow-x-auto'
      }
    >
      {menu.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-sm transition-colors ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`
          }
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className={platform === 'desktop' ? 'flex min-h-screen' : 'flex min-h-screen flex-col'}>
        {platform === 'desktop' && (
          <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-6 bg-slate-950 p-5 text-white">
            <div>
              <p className="text-xl font-bold tracking-tight">JapanFlow</p>
              <p className="text-xs tracking-widest text-cyan-400">COSMOS · DESKTOP</p>
            </div>
            {nav}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
              <span className="truncate text-xs text-slate-400">{currentUser.name}</span>
              <button
                aria-label="Sair"
                className="rounded p-2 hover:bg-slate-800"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {platform === 'desktop' ? <Monitor size={17} /> : <Smartphone size={17} />} JapanFlow
              COSMOS
            </span>
            <span className="truncate text-xs text-muted-foreground">{currentUser.name}</span>
            {platform === 'android' && (
              <button
                aria-label="Sair"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut size={18} />
              </button>
            )}
          </header>
          <main className="min-w-0 flex-1 px-3 py-4 sm:px-6">
            <Outlet />
          </main>
          {platform === 'android' && (
            <div className="sticky bottom-0 z-20 border-t bg-slate-950 px-2 pb-[env(safe-area-inset-bottom)] text-white">
              {nav}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
