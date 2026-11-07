import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, UserRound } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';
import logoDark from '@/assets/japanflow-logo-dark.png';
import markDark from '@/assets/japanflow-mark-dark.png';
import './motoboy.css';

export default function MotoboyLogin() {
  const { login, logout, authLoading } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || authLoading) return;
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), password);
      // Preservar a mesma restricao de rede do login web existente.
      if (user.role !== 'admin') {
        const ip = await getClientPublicIp();
        if (!isIpAllowed(ip) && !(await userCanAccessExternally(user.id))) {
          await logout();
          setError('Acesso não permitido nesta rede.');
          return;
        }
      }
      navigate(
        user.sectors?.includes('motoboys')
          ? '/motoboy'
          : user.role === 'admin'
            ? '/admin'
            : '/board',
        { replace: true }
      );
    } catch (reason) {
      console.warn('Falha no login mobile:', reason);
      setError('Não foi possível entrar. Confira suas credenciais.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="jf-moto-login">
      <header className="jf-moto-login-hero">
        <img src={markDark} alt="" />
        <img src={logoDark} alt="JapanFlow" />
      </header>
      <form className="jf-moto-login-form" onSubmit={onSubmit}>
        <h1>Acesse sua conta</h1>
        <div className="jf-moto-field">
          <label htmlFor="jf-user">Usuário</label>
          <div className="jf-moto-input-wrap">
            <UserRound size={18} />
            <input
              id="jf-user"
              autoComplete="username"
              placeholder="Seu usuário"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="jf-moto-field">
          <label htmlFor="jf-pass">Senha</label>
          <div className="jf-moto-input-wrap">
            <LockKeyhole size={18} />
            <input
              id="jf-pass"
              autoComplete="current-password"
              placeholder="Sua senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="jf-moto-form-error">
            {error}
          </p>
        )}
        <button className="jf-moto-login-submit" type="submit" disabled={busy || authLoading}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <span className="jf-moto-red-circle" aria-hidden="true" />
    </main>
  );
}
