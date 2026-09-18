import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Coffee, UtensilsCrossed, Play, Pause, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, Timestamp, updateDoc } from 'firebase/firestore';

const PAUSE_DURATIONS = {
  almoco: 60 * 60,
  cafe: 15 * 60,
};

interface PauseButtonProps {
  updatePresence: (
    status: 'online' | 'offline' | 'paused',
    pauseType?: string | null
  ) => Promise<void>;
}

const PauseButton = ({ updatePresence }: PauseButtonProps) => {
  const { currentUser } = useApp();
  const [showDialog, setShowDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseType, setPauseType] = useState<'almoco' | 'cafe' | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseHistoryIdRef = useRef<string | null>(null);

  const startPause = useCallback(
    async (type: 'almoco' | 'cafe') => {
      if (!currentUser) return;

      const startedAt = new Date();

      setPauseType(type);
      setIsPaused(true);
      setRemainingSeconds(PAUSE_DURATIONS[type]);
      setOvertimeSeconds(0);
      setPauseStartTime(startedAt);
      setShowDialog(false);

      await updatePresence('paused', type);

      const pauseRef = await addDoc(collection(db, 'pause_history'), {
        user_id: currentUser.id,
        pause_type: type,
        started_at: Timestamp.fromDate(startedAt),
        ended_at: null,
        duration_seconds: null,
        overtime_seconds: null,
        created_at: Timestamp.now(),
      });

      pauseHistoryIdRef.current = pauseRef.id;
    },
    [currentUser, updatePresence]
  );

  const endPause = useCallback(async () => {
    setIsPaused(false);

    const savedPauseType = pauseType;
    const savedPauseStartTime = pauseStartTime;
    const savedHistoryId = pauseHistoryIdRef.current;

    setPauseType(null);
    setRemainingSeconds(0);
    setOvertimeSeconds(0);
    setPauseStartTime(null);
    pauseHistoryIdRef.current = null;

    if (!currentUser) return;

    const now = new Date();
    const totalDuration = savedPauseStartTime
      ? Math.floor((now.getTime() - savedPauseStartTime.getTime()) / 1000)
      : 0;
    const maxDuration = savedPauseType ? PAUSE_DURATIONS[savedPauseType] : 0;
    const overtime = Math.max(0, totalDuration - maxDuration);

    try {
      if (savedHistoryId) {
        await updateDoc(doc(db, 'pause_history', savedHistoryId), {
          ended_at: Timestamp.fromDate(now),
          duration_seconds: totalDuration,
          overtime_seconds: overtime,
          updated_at: Timestamp.now(),
        });
      }

      await updatePresence('online');
    } catch (error) {
      console.error('Error ending pause:', error);
    }
  }, [currentUser, pauseType, pauseStartTime, updatePresence]);

  useEffect(() => {
    if (!isPaused || !pauseStartTime || !pauseType) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pauseStartTime.getTime()) / 1000);
      const max = PAUSE_DURATIONS[pauseType];
      const remaining = max - elapsed;

      if (remaining > 0) {
        setRemainingSeconds(remaining);
        setOvertimeSeconds(0);
      } else {
        setRemainingSeconds(0);
        setOvertimeSeconds(Math.abs(remaining));
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, pauseStartTime, pauseType]);

  useEffect(() => {
    if (!isPaused) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPaused]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pauseOverlay =
    isPaused && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Pausa em andamento"
          >
            <div className="relative flex w-full max-w-md flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-card/95 p-6 text-center shadow-2xl sm:min-h-[410px] sm:gap-6">
              <button
                type="button"
                onClick={endPause}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Encerrar pausa"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col items-center gap-2">
                {pauseType === 'almoco' ? (
                  <UtensilsCrossed className="h-9 w-9 text-orange-400" />
                ) : (
                  <Coffee className="h-9 w-9 text-amber-400" />
                )}

                <span className="text-xl font-semibold sm:text-2xl">
                  {pauseType === 'almoco' ? 'Almoço' : 'Café'}
                </span>
              </div>

              {remainingSeconds > 0 ? (
                <div className="w-full text-center">
                  <p
                    className="whitespace-nowrap font-mono font-bold leading-none tracking-tight text-foreground tabular-nums"
                    style={{ fontSize: 'clamp(3.2rem, 10vw, 5.8rem)' }}
                  >
                    {formatTime(remainingSeconds)}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">Tempo restante</p>
                </div>
              ) : (
                <div className="w-full text-center">
                  <p
                    className="whitespace-nowrap font-mono font-bold leading-none tracking-tight text-destructive tabular-nums"
                    style={{ fontSize: 'clamp(3.2rem, 10vw, 5.8rem)' }}
                  >
                    +{formatTime(overtimeSeconds)}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-destructive">Tempo excedido!</p>
                </div>
              )}

              <Button
                onClick={endPause}
                size="lg"
                className="h-12 w-full max-w-xs gap-2 bg-success text-base text-success-foreground hover:bg-success/90"
              >
                <Play className="h-5 w-5" />
                Encerrar Pausa
              </Button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {isPaused ? (
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className={`flex h-9 min-w-0 items-center gap-1.5 rounded-xl px-2 text-xs font-bold sm:px-2.5 ${
              overtimeSeconds > 0
                ? 'bg-destructive/15 text-destructive'
                : 'bg-warning/15 text-warning'
            }`}
            aria-label="Pausa em andamento"
          >
            {pauseType === 'almoco' ? (
              <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Coffee className="h-3.5 w-3.5 shrink-0" />
            )}

            <span className="tabular-nums">
              {remainingSeconds > 0
                ? formatTime(remainingSeconds)
                : `+${formatTime(overtimeSeconds)}`}
            </span>
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={endPause}
            className="h-9 gap-1 px-2 text-success hover:bg-success/10 hover:text-success"
            aria-label="Encerrar pausa e voltar"
          >
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => setShowDialog(true)}
          title="Fazer pausa"
          aria-label="Fazer pausa"
        >
          <Pause className="h-4 w-4" />
        </Button>
      )}

      {pauseOverlay}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-xs overflow-y-auto rounded-2xl sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-center">Tipo de Pausa</DialogTitle>
            <DialogDescription className="text-center">
              Escolha o tipo de pausa que deseja iniciar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => startPause('almoco')}
              className="h-16 w-full items-center justify-start gap-3 text-base"
              variant="outline"
            >
              <UtensilsCrossed className="h-6 w-6 shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Almoço</div>
                <div className="text-xs text-muted-foreground">60 minutos</div>
              </div>
            </Button>

            <Button
              onClick={() => startPause('cafe')}
              className="h-16 w-full items-center justify-start gap-3 text-base"
              variant="outline"
            >
              <Coffee className="h-6 w-6 shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Café</div>
                <div className="text-xs text-muted-foreground">15 minutos</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PauseButton;
