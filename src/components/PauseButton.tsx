import { useState, useEffect, useCallback, useRef } from 'react';
import { Coffee, UtensilsCrossed, Play, Pause, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

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
    } catch (e) {
      console.error('Error ending pause:', e);
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const headerIndicator = isPaused ? (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer ${
          overtimeSeconds > 0
            ? 'bg-destructive/20 text-destructive animate-pulse'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}
      >
        {pauseType === 'almoco' ? (
          <UtensilsCrossed className="w-3.5 h-3.5" />
        ) : (
          <Coffee className="w-3.5 h-3.5" />
        )}
        {remainingSeconds > 0 ? (
          formatTime(remainingSeconds)
        ) : (
          <span className="text-destructive">+{formatTime(overtimeSeconds)}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={endPause}
        className="h-7 px-2 text-xs gap-1 text-green-400 hover:text-green-300 hover:bg-green-500/10"
      >
        <Play className="w-3.5 h-3.5" />
        Voltar
      </Button>
    </div>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={() => setShowDialog(true)}
      title="Fazer pausa"
    >
      <Pause className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {headerIndicator}

      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[90vw] max-w-lg h-[50vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col items-center justify-center gap-6 relative p-6">
            <button
              onClick={endPause}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              {pauseType === 'almoco' ? (
                <UtensilsCrossed className="w-10 h-10 text-orange-400" />
              ) : (
                <Coffee className="w-10 h-10 text-amber-400" />
              )}
              <span className="text-2xl font-bold">
                {pauseType === 'almoco' ? 'Almoço' : 'Café'}
              </span>
            </div>

            {remainingSeconds > 0 ? (
              <div className="text-center">
                <p className="text-7xl md:text-8xl font-mono font-bold tracking-wider text-foreground">
                  {formatTime(remainingSeconds)}
                </p>
                <p className="text-sm text-muted-foreground mt-3">Tempo restante</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-7xl md:text-8xl font-mono font-bold tracking-wider text-destructive animate-pulse">
                  +{formatTime(overtimeSeconds)}
                </p>
                <p className="text-sm text-destructive mt-3 font-semibold">Tempo excedido!</p>
              </div>
            )}

            <Button
              onClick={endPause}
              size="lg"
              className="gap-2 text-base px-8 py-6 bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-5 h-5" />
              Encerrar Pausa
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Tipo de Pausa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => startPause('almoco')}
              className="h-16 flex items-center gap-3 text-base"
              variant="outline"
            >
              <UtensilsCrossed className="w-6 h-6" />
              <div className="text-left">
                <div className="font-semibold">Almoço</div>
                <div className="text-xs text-muted-foreground">60 minutos</div>
              </div>
            </Button>
            <Button
              onClick={() => startPause('cafe')}
              className="h-16 flex items-center gap-3 text-base"
              variant="outline"
            >
              <Coffee className="w-6 h-6" />
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
