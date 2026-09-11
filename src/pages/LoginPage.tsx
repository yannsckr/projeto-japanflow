import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logoImg from '@/assets/logo_japanflow.png';
import { toast } from 'sonner';
import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';

const LoginPage = () => {
  const { login, logout, authLoading } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading || isLoggingIn) return;

    setIsLoggingIn(true);

    try {
      const user = await login(username, password);

      if (user.role !== 'admin') {
        const ip = await getClientPublicIp();
        if (!isIpAllowed(ip)) {
          const allowedExternal = await userCanAccessExternally(user.id);
          if (!allowedExternal) {
            await logout();
            toast.error('Credenciais inválidas');
            return;
          }
        }
      }

      navigate(user.role === 'admin' ? '/admin' : '/board');
    } catch (error) {
      console.warn('Falha no login:', error);
      toast.error('Credenciais inválidas');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoImg} alt="JapanFlow" className="h-28 object-contain mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mt-1">Japan Imports — Gestão Interna</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-card rounded-xl border border-border p-6 shadow-lg space-y-4"
        >
          <div>
            <label className="text-sm font-medium mb-1.5 block">Usuário</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu.usuario"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoggingIn || authLoading}>
            {isLoggingIn ? 'Entrando...' : authLoading ? 'Verificando sessão...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
