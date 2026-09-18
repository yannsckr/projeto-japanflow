import { useEffect, useState } from 'react';

import { useThemeToggle } from '@/hooks/useThemeToggle';
import logoDark from '@/assets/japanflow-logo-dark.png';
import logoLight from '@/assets/japanflow-logo-light.png';

interface LoginSplashProps {
  userName?: string;
  onComplete: () => void;
  minimumDuration?: number;
}

export default function LoginSplash({
  userName,
  onComplete,
  minimumDuration = 5000,
}: LoginSplashProps) {
  const { theme } = useThemeToggle();
  const [leaving, setLeaving] = useState(false);

  const isLight = theme === 'light';
  const firstName = userName?.trim().split(/\s+/)[0] || 'usuário';

  useEffect(() => {
    const leaveAt = Math.max(800, minimumDuration - 650);

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, leaveAt);

    const completeTimer = window.setTimeout(() => {
      onComplete();
    }, minimumDuration);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [minimumDuration, onComplete]);

  return (
    <div
      className={[
        'fixed inset-0 z-[9999] overflow-hidden transition-[opacity,transform,filter] duration-700',
        isLight ? 'bg-[#F4F5F7] text-[#18191D]' : 'bg-[#0B0C10] text-white',
        leaving
          ? 'pointer-events-none scale-[1.015] opacity-0 blur-[5px]'
          : 'scale-100 opacity-100 blur-0',
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-label="Carregando seu espaço no JapanFlow"
    >
      <div
        className={
          isLight
            ? 'absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(20,22,26,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(20,22,26,.035)_1px,transparent_1px)] [background-size:40px_40px]'
            : 'absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] [background-size:40px_40px]'
        }
      />

      <div className="pointer-events-none absolute -right-[12%] -top-[30%] h-[150%] w-[42%] rotate-[18deg] bg-gradient-to-b from-primary/14 via-primary/[0.035] to-transparent" />
      <div className="pointer-events-none absolute bottom-[-22%] left-[-10%] h-[50%] w-[45%] rounded-full bg-primary/[0.035] blur-3xl" />

      <div className="relative flex min-h-[100dvh] items-center justify-center px-6">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <img
            src={isLight ? logoLight : logoDark}
            alt="JapanFlow"
            className="h-auto w-full max-w-[360px] animate-scale-in object-contain"
          />

          <div className="mt-9 animate-fade-up">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
              Japan Imports · Gestão Interna
            </p>

            <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
              Carregando o seu espaço, {firstName}.
            </h1>

            <p className={isLight ? 'mt-2 text-sm text-[#666A73]' : 'mt-2 text-sm text-white/45'}>
              Organizando tudo para você começar.
            </p>
          </div>

          <div className="mt-8 w-full max-w-sm">
            <div
              className={
                isLight
                  ? 'h-1.5 overflow-hidden rounded-full bg-black/[0.07]'
                  : 'h-1.5 overflow-hidden rounded-full bg-white/[0.08]'
              }
            >
              <div
                className="h-full origin-left rounded-full bg-primary shadow-[0_0_18px_hsl(var(--brand-red)/0.22)]"
                style={{
                  animation: `japanflow-splash-progress ${minimumDuration}ms linear forwards`,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
              <span className={isLight ? 'text-[#7A7E87]' : 'text-white/28'}>
                Preparando ambiente
              </span>
              <span className="font-semibold text-primary">JapanFlow</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes japanflow-splash-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          [style*="japanflow-splash-progress"] {
            animation-timing-function: linear !important;
          }
        }
      `}</style>
    </div>
  );
}
