import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import ThemeToggleButton from '@/components/ThemeToggleButton';

import logoDark from '@/assets/japanflow-logo-dark.png';
import logoLight from '@/assets/japanflow-logo-light.png';
import liquidDark from '@/assets/japanflow-liquid-dark.webp';
import liquidLight from '@/assets/japanflow-liquid-light.webp';

import { getClientPublicIp, isIpAllowed } from '@/lib/networkGuard';
import { userCanAccessExternally } from '@/lib/externalAccess';
import { MOTIVATIONAL_QUOTES } from '@/data/motivationalQuotes';

const QUOTE_STORAGE_KEY = 'japanflow-login-seen-quotes';
const QUOTE_LAST_KEY = 'japanflow-login-last-quote';

const LoginPage = () => {
  const { login, logout, authLoading } = useApp();
  const navigate = useNavigate();
  const { theme } = useThemeToggle();

  const isLight = theme === 'light';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [logoVisible, setLogoVisible] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  const [quoteVisible, setQuoteVisible] = useState(false);

  const pickNextQuote = () => {
    const allIds = MOTIVATIONAL_QUOTES.map((quote) => quote.id);

    let seenIds: string[] = [];

    try {
      seenIds = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || '[]');
      if (!Array.isArray(seenIds)) seenIds = [];
    } catch {
      seenIds = [];
    }

    const lastId = localStorage.getItem(QUOTE_LAST_KEY);
    let available = MOTIVATIONAL_QUOTES.filter((quote) => !seenIds.includes(quote.id));

    if (available.length === 0) {
      seenIds = [];
      available = MOTIVATIONAL_QUOTES.filter((quote) => quote.id !== lastId);

      if (available.length === 0) {
        available = MOTIVATIONAL_QUOTES;
      }
    }

    const candidates =
      available.length > 1 && lastId ? available.filter((quote) => quote.id !== lastId) : available;

    const pool = candidates.length > 0 ? candidates : available;
    const next = pool[Math.floor(Math.random() * pool.length)];

    const nextSeen = [...new Set([...seenIds, next.id])].filter((id) => allIds.includes(id));

    localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(nextSeen));
    localStorage.setItem(QUOTE_LAST_KEY, next.id);

    return next;
  };

  useEffect(() => {
    const showLogoTimer = window.setTimeout(() => setLogoVisible(true), 320);

    const finishIntroTimer = window.setTimeout(() => {
      setCurrentQuote(pickNextQuote());
      setIntroFinished(true);
      setQuoteVisible(true);
    }, 2850);

    return () => {
      window.clearTimeout(showLogoTimer);
      window.clearTimeout(finishIntroTimer);
    };
  }, []);

  useEffect(() => {
    if (!introFinished) return;

    let swapTimer: number | undefined;

    const interval = window.setInterval(() => {
      setQuoteVisible(false);

      swapTimer = window.setTimeout(() => {
        setCurrentQuote(pickNextQuote());
        setQuoteVisible(true);
      }, 520);
    }, 5000);

    return () => {
      window.clearInterval(interval);
      if (swapTimer) window.clearTimeout(swapTimer);
    };
  }, [introFinished]);

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
            await logout();
            toast.error('Credenciais inválidas');
            return;
          }
        }
      }

      navigate(user.role === 'admin' ? '/admin' : '/board', {
        replace: true,
        state: { showLoginSplash: true },
      });
    } catch (error) {
      console.warn('Falha no login:', error);
      toast.error('Credenciais inválidas');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isBusy = isLoggingIn || authLoading;
  const activeLogo = isLight ? logoLight : logoDark;
  const activeLiquidLogo = isLight ? liquidLight : liquidDark;

  return (
    <main
      className={
        isLight
          ? 'relative min-h-[100dvh] overflow-hidden bg-[#F4F5F7] text-[#18191D]'
          : 'relative min-h-[100dvh] overflow-hidden bg-[#0B0C10] text-white'
      }
    >
      <div
        className={
          isLight
            ? 'pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(24,25,29,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(24,25,29,.035)_1px,transparent_1px)] [background-size:40px_40px]'
            : 'pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] [background-size:40px_40px]'
        }
      />

      <div className="pointer-events-none absolute -right-[18%] -top-[32%] h-[155%] w-[50%] rotate-[18deg] bg-gradient-to-b from-primary/16 via-primary/[0.035] to-transparent" />
      <div className="pointer-events-none absolute bottom-[-22%] left-[-8%] h-[46%] w-[44%] -rotate-[10deg] rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggleButton
          className={
            isLight
              ? 'h-10 w-10 border border-black/[0.07] bg-white/60 text-[#4E515A] shadow-sm backdrop-blur-md hover:bg-white hover:text-[#18191D]'
              : 'h-10 w-10 border border-white/[0.07] bg-white/[0.035] text-white/55 backdrop-blur-md hover:bg-white/[0.07] hover:text-white'
          }
        />
      </div>

      <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-[1480px] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden min-h-[100dvh] items-center justify-center px-10 lg:flex xl:px-16">
          <div className="mx-auto flex w-full max-w-[640px] flex-col items-center text-center">
            {/* Base e animação compartilham exatamente a mesma caixa e proporção. */}
            <div className="group/logo flex w-full cursor-default items-center justify-center">
              <div
                className={[
                  'relative w-full max-w-[520px] transition-all',
                  logoVisible
                    ? 'translate-y-0 scale-100 opacity-100 blur-0'
                    : 'translate-y-2 scale-[0.97] opacity-0 blur-[8px]',
                ].join(' ')}
                style={{
                  aspectRatio: '966 / 275',
                  transitionDuration: '1900ms',
                  transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
                }}
              >
                <img
                  src={activeLogo}
                  alt="JapanFlow"
                  className="absolute inset-0 h-full w-full object-contain transition-[transform,filter] duration-500 ease-out group-hover/logo:scale-[1.012] group-hover/logo:brightness-110"
                />

                {logoVisible && (
                  <img
                    src={activeLiquidLogo}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-90 transition-[opacity,filter] duration-500 group-hover/logo:opacity-100 group-hover/logo:brightness-110"
                  />
                )}
              </div>
            </div>

            {/* Quote stage: fixed height prevents layout shifts */}
            <div
              className={[
                'mt-5 flex min-h-[126px] w-full max-w-[560px] flex-col items-center transition-opacity duration-500',
                introFinished ? 'opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
            >
              <div
                className={[
                  'flex w-full flex-col items-center transition-all duration-500 ease-out',
                  quoteVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                ].join(' ')}
                aria-live="polite"
              >
                <span className="mb-3 block h-px w-full max-w-lg bg-primary/75" />

                <p
                  className={
                    isLight
                      ? 'max-w-lg text-center text-[16px] font-medium leading-[1.4] tracking-[-0.01em] text-[#3F424A]'
                      : 'max-w-lg text-center text-[16px] font-medium leading-[1.4] tracking-[-0.01em] text-white/64'
                  }
                >
                  “{currentQuote.text}”
                </p>

                <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">
                  — {currentQuote.author}
                </p>

                {currentQuote.source && (
                  <p
                    className={
                      isLight
                        ? 'mt-1 text-center text-[10px] tracking-[0.06em] text-[#8A8D95]'
                        : 'mt-1 text-center text-[10px] tracking-[0.06em] text-white/24'
                    }
                  >
                    {currentQuote.source}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[100dvh] items-center justify-center px-4 py-20 sm:px-8 lg:px-10 lg:py-8 xl:px-16">
          <div className="w-full max-w-[430px] animate-scale-in">
            <div className="mb-7 flex flex-col items-center lg:hidden">
              <div className="group/logo flex w-full items-center justify-center px-2">
                <div
                  className={[
                    'relative w-full max-w-[290px] transition-all',
                    logoVisible
                      ? 'translate-y-0 scale-100 opacity-100 blur-0'
                      : 'translate-y-2 scale-[0.97] opacity-0 blur-[6px]',
                  ].join(' ')}
                  style={{
                    aspectRatio: '966 / 275',
                    transitionDuration: '1600ms',
                    transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
                  }}
                >
                  <img
                    src={activeLogo}
                    alt="JapanFlow"
                    className="absolute inset-0 h-full w-full object-contain"
                  />

                  {logoVisible && (
                    <img
                      src={activeLiquidLogo}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                    />
                  )}
                </div>
              </div>

              <div className="mt-4 flex min-h-[84px] max-w-xs items-start justify-center px-2">
                {introFinished && (
                  <p
                    className={[
                      'text-center text-xs leading-[1.45] transition-all duration-500',
                      quoteVisible ? 'opacity-100' : 'opacity-0',
                      isLight ? 'text-[#6B6E76]' : 'text-white/40',
                    ].join(' ')}
                  >
                    “{currentQuote.text}”
                    <span className="mt-1.5 block font-semibold text-primary">
                      — {currentQuote.author}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div
              className={
                isLight
                  ? 'rounded-[28px] border border-black/[0.07] bg-white/78 p-5 shadow-[0_28px_90px_rgba(28,30,36,.10)] backdrop-blur-xl sm:p-7'
                  : 'rounded-[28px] border border-white/[0.08] bg-white/[0.055] p-5 shadow-[0_28px_90px_rgba(0,0,0,.34)] backdrop-blur-xl sm:p-7'
              }
            >
              <div className="mb-7">
                <div
                  className={
                    isLight
                      ? 'mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.07] bg-black/[0.025]'
                      : 'mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045]'
                  }
                >
                  <LockKeyhole className="h-[18px] w-[18px] text-primary" />
                </div>

                <h1
                  className={
                    isLight
                      ? 'text-2xl font-semibold tracking-[-0.025em] text-[#18191D]'
                      : 'text-2xl font-semibold tracking-[-0.025em] text-white'
                  }
                >
                  Acesse sua conta
                </h1>

                <p
                  className={
                    isLight
                      ? 'mt-2 text-sm leading-6 text-[#6B6E76]'
                      : 'mt-2 text-sm leading-6 text-white/42'
                  }
                >
                  Entre com suas credenciais para continuar no JapanFlow.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className={
                      isLight
                        ? 'text-xs font-medium text-[#555861]'
                        : 'text-xs font-medium text-white/68'
                    }
                  >
                    Usuário
                  </label>

                  <div className="relative">
                    <UserRound
                      className={
                        isLight
                          ? 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/28'
                          : 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28'
                      }
                    />

                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Seu usuário"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      disabled={isBusy}
                      className={
                        isLight
                          ? 'h-12 rounded-[14px] border-black/[0.08] bg-black/[0.025] pl-10 text-[#18191D] placeholder:text-black/28 focus-visible:border-primary/60 focus-visible:ring-primary/20'
                          : 'h-12 rounded-[14px] border-white/[0.08] bg-white/[0.045] pl-10 text-white placeholder:text-white/22 focus-visible:border-primary/70 focus-visible:ring-primary/25'
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className={
                      isLight
                        ? 'text-xs font-medium text-[#555861]'
                        : 'text-xs font-medium text-white/68'
                    }
                  >
                    Senha
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      className={
                        isLight
                          ? 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/28'
                          : 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28'
                      }
                    />

                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      disabled={isBusy}
                      className={
                        isLight
                          ? 'h-12 rounded-[14px] border-black/[0.08] bg-black/[0.025] pl-10 pr-11 text-[#18191D] placeholder:text-black/28 focus-visible:border-primary/60 focus-visible:ring-primary/20'
                          : 'h-12 rounded-[14px] border-white/[0.08] bg-white/[0.045] pl-10 pr-11 text-white placeholder:text-white/22 focus-visible:border-primary/70 focus-visible:ring-primary/25'
                      }
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className={
                        isLight
                          ? 'jf-interactive absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-black/32 hover:bg-black/[0.05] hover:text-black/65'
                          : 'jf-interactive absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/32 hover:bg-white/[0.06] hover:text-white/70'
                      }
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isBusy}
                  className="group h-12 w-full rounded-[14px] bg-primary font-semibold text-primary-foreground shadow-[0_12px_30px_hsl(var(--brand-red)/0.16)] transition-all duration-200 hover:bg-brand-hover hover:shadow-[0_16px_34px_hsl(var(--brand-red)/0.20)] active:scale-[0.99]"
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
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
