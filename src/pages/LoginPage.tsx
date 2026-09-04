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
  const { login, users, usersLoading, usersError } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasUsersAvailable = users.length > 0;

    if (!hasUsersAvailable && usersLoading) {
      toast.error('Carregando usuários, tente novamente em instantes.');
      return;
    }

    setIsLoggingIn(true);

    // Verifica se o usuário é admin (admins podem acessar de qualquer rede)
    const normalizedUsername = username.trim().toLowerCase();
    const candidate = users.find((u) => u.username.trim().toLowerCase() === normalizedUsername);
    const isAdmin = candidate?.role === 'admin';

    if (!isAdmin) {
      const ip = await getClientPublicIp();
      if (!isIpAllowed(ip)) {
        // Verifica liberação individual para acesso fora da rede
        const allowedExternal = candidate ? await userCanAccessExternally(candidate.id) : false;
        if (!allowedExternal) {
          toast.error('Credenciais inválidas');
          setIsLoggingIn(false);
          return;
        }
      }
    }

    const success = login(username, password);
    if (success) {
      navigate(isAdmin ? '/admin' : '/board');
    } else if (!hasUsersAvailable && usersError) {
      toast.error('Não foi possível validar o acesso agora. Tente novamente em instantes.');
    } else {
      toast.error('Credenciais inválidas');
    }
    setIsLoggingIn(false);
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
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
