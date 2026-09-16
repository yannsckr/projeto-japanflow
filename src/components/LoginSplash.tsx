import { useEffect, useState } from 'react';

import logoImg from '@/assets/logo_japanflow.png';

interface LoginSplashProps {
  userName?: string;
  onComplete: () => void;
  minimumDuration?: number;
}

export default function LoginSplash({
  userName,
  onComplete,
  minimumDuration = 950,
}: LoginSplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(
      () => setLeaving(true),
      Math.max(450, minimumDuration - 220)
    );

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
      className={`fixed inset-0 z-[9999] overflow-hidden bg-[#070B10] transition-all duration-220 ease-premium ${
        leaving ? 'pointer-events-none opacity-0 scale-[1.01]' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Preparando o JapanFlow"
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="absolute -right-[12%] -top-[28%] h-[150%] w-[42%] rotate-[18deg] bg-gradient-to-b from-primary/18 via-primary/5 to-transparent blur-[1px]" />

      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <div className="mb-8 animate-scale-in rounded-[28px] border border-white/8 bg-white/[0.025] px-8 py-6 shadow-[0_28px_80px_rgba(0,0,0,.28)] backdrop-blur-sm">
            <img src={logoImg} alt="JapanFlow" className="h-16 w-auto max-w-[260px] object-contain" />
          </div>

          <div className="animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/35">
              Japan Imports
            </p>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {userName ? `Olá, ${userName.split(' ')[0]}.` : 'Bem-vindo ao JapanFlow.'}
            </h1>

            <p className="mt-2 text-sm text-white/48">Preparando seu ambiente...</p>

            <div className="mx-auto mt-7 h-1 w-40 overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-full origin-left animate-[japanflow-splash-progress_950ms_cubic-bezier(.22,1,.36,1)_forwards] rounded-full bg-primary" />
            </div>

            <p className="mt-8 text-xs font-medium tracking-wide text-white/28">
              Gestão que move resultados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}