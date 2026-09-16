import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logoImg from '@/assets/logo_japanflow.png';
import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';
import { resetLoginSplash } from '@/lib/loginSplash';

const LoginPage = () => {
  const { login, logout, authLoading } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (authLoading || isLoggingIn) return;

    setIsLoggingIn(true);

    try {
      const user = await login(username.trim(), password);

      if (user.role !== 'admin') {
        const ip = await getClientPublicIp();

        if (!isIpAllowed(ip)) {
          const allowedExternal = await userCanAccessExternally(user.id);

          if (!allowedExternal) {
            resetLoginSplash();
            await logout();
            toast.error('Credenciais inválidas');
            return;
          }
        }
      }

      // Garante que cada novo login exiba a splash uma vez.
      resetLoginSplash();

      navigate(user.role === 'admin' ? '/admin' : '/board', {
        replace: true,
      });
    } catch (error) {
      console.warn('Falha no login:', error);
      toast.error('Credenciais inválidas');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isBusy = isLoggingIn || authLoading;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070B10] text-white">
      {/* Malha técnica sutil */}
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] [background-size:40px_40px]" />

      {/* Assinatura diagonal JapanFlow */}
      <div className="pointer-events-none absolute -right-[16%] -top-[30%] h-[150%] w-[48%] rotate-[18deg] bg-gradient-to-b from-primary/22 via-primary/5 to-transparent" />
      <div className="pointer-events-none absolute bottom-[-18%] left-[-8%] h-[44%] w-[42%] -rotate-[10deg] rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1480px] lg:grid-cols-[1.08fr_.92fr]">
        {/* Painel institucional */}
        <section className="hidden min-h-screen flex-col justify-between px-10 py-10 lg:flex xl:px-16 xl:py-14">
          <div>
            <img src={logoImg} alt="JapanFlow" className="h-14 w-auto object-contain" />
          </div>

          <div className="max-w-xl animate-fade-up">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.30em] text-white/35">
              Japan Imports · Gestão Interna
            </p>

            <h1 className="max-w-lg text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-white xl:text-6xl">
              Gestão que move
              <span className="block text-primary">resultados.</span>
            </h1>

            <p className="mt-6 max-w-md text-[15px] leading-7 text-white/48">
              Um ambiente de trabalho mais claro, ágil e organizado para manter a operação em
              movimento.
            </p>

            <div className="mt-10 flex items-center gap-3 text-xs text-white/30">
              <span className="h-px w-10 bg-primary/70" />
              <span>Minimalismo com presença. Produtividade com identidade.</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/25">
            <span>JapanFlow</span>
            <span>Sistema interno · Japan Imports</span>
          </div>
        </section>

        {/* Área de autenticação */}
        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
          <div className="w-full max-w-[430px] animate-scale-in">
            <div className="mb-8 lg:hidden">
              <img src={logoImg} alt="JapanFlow" className="h-14 w-auto object-contain" />
            </div>

            <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.055] p-5 shadow-[0_28px_90px_rgba(0,0,0,.34)] backdrop-blur-xl sm:p-7">
              <div className="mb-7">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045]">
                  <LockKeyhole className="h-[18px] w-[18px] text-primary" />
                </div>

                <h2 className="text-2xl font-semibold tracking-[-0.025em] text-white">
                  Acesse sua conta
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/42">
                  Entre com suas credenciais para continuar no JapanFlow.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-xs font-medium text-white/68">
                    Usuário
                  </label>

                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28" />

                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="seu.usuario"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      disabled={isBusy}
                      className="h-12 rounded-[14px] border-white/[0.08] bg-white/[0.045] pl-10 text-white placeholder:text-white/22 focus-visible:border-primary/70 focus-visible:ring-primary/25"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-xs font-medium text-white/68">
                    Senha
                  </label>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28" />

                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      disabled={isBusy}
                      className="h-12 rounded-[14px] border-white/[0.08] bg-white/[0.045] pl-10 pr-11 text-white placeholder:text-white/22 focus-visible:border-primary/70 focus-visible:ring-primary/25"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="jf-interactive absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/32 hover:bg-white/[0.06] hover:text-white/70"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isBusy}
                  className="group h-12 w-full rounded-[14px] bg-primary font-semibold text-primary-foreground shadow-[0_12px_30px_hsl(var(--brand-red)/0.18)] transition-all duration-220 ease-premium hover:bg-brand-hover hover:shadow-[0_16px_34px_hsl(var(--brand-red)/0.22)] active:scale-[0.99]"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Entrando...
                    </>
                  ) : authLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Verificando sessão...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-220 ease-premium group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="text-center text-[11px] leading-5 text-white/24">
                  Acesso restrito aos colaboradores autorizados da Japan Imports.
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-[10px] uppercase tracking-[0.20em] text-white/18 lg:hidden">
              Gestão que move resultados
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
