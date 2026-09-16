import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useAllPresences } from '@/hooks/usePresence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Coffee, UtensilsCrossed, AlertTriangle, Circle, Monitor } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PauseRecord {
  id: string;
  user_id: string;
  pause_type: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  overtime_seconds: number | null;
}

interface SessionRecord {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
}

const TimeReportsPage = () => {
  const { currentUser, users } = useApp();
  const { getStatus, getPauseInfo } = useAllPresences();
  const [pauseHistory, setPauseHistory] = useState<PauseRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [dateFilter, setDateFilter] = useState('today');
  const allUsers = users.filter((u) => u.role === 'employee' || u.role === 'admin');

  useEffect(() => {
    const fetchData = async () => {
      let startDate: Date;
      const now = new Date();

      switch (dateFilter) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case '7days':
          startDate = subDays(now, 7);
          break;
        case '30days':
          startDate = subDays(now, 30);
          break;
        default:
          startDate = startOfDay(now);
      }

      const startTimestamp = Timestamp.fromDate(startDate);

      const [pauseSnapshot, sessionSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, 'pause_history'),
            where('started_at', '>=', startTimestamp),
            orderBy('started_at', 'desc')
          )
        ),
        getDocs(
          query(
            collection(db, 'presence_sessions'),
            where('started_at', '>=', startTimestamp),
            orderBy('started_at', 'desc')
          )
        ),
      ]);

      setPauseHistory(
        pauseSnapshot.docs.map((pauseDoc) => {
          const data = pauseDoc.data();
          return {
            id: pauseDoc.id,
            user_id: data.user_id || '',
            pause_type: data.pause_type || '',
            started_at: data.started_at?.toDate
              ? data.started_at.toDate().toISOString()
              : data.started_at || '',
            ended_at: data.ended_at?.toDate
              ? data.ended_at.toDate().toISOString()
              : data.ended_at || null,
            duration_seconds:
              typeof data.duration_seconds === 'number' ? data.duration_seconds : null,
            overtime_seconds:
              typeof data.overtime_seconds === 'number' ? data.overtime_seconds : null,
          } as PauseRecord;
        })
      );

      setSessions(
        sessionSnapshot.docs.map((sessionDoc) => {
          const data = sessionDoc.data();
          return {
            id: sessionDoc.id,
            user_id: data.user_id || '',
            started_at: data.started_at?.toDate
              ? data.started_at.toDate().toISOString()
              : data.started_at || '',
            ended_at: data.ended_at?.toDate
              ? data.ended_at.toDate().toISOString()
              : data.ended_at || null,
            duration_seconds:
              typeof data.duration_seconds === 'number' ? data.duration_seconds : null,
            status: data.status || '',
          } as SessionRecord;
        })
      );
    };

    fetchData();
    // Poll a cada 60s; pausa quando aba está oculta para reduzir egress/cloud cost
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 60000);
    const onVis = () => {
      if (!document.hidden) fetchData();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [dateFilter]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '0min';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min`;
    return `${s}s`;
  };

  const getStatusColor = (userId: string) => {
    const status = getStatus(userId);
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'paused':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const getStatusLabel = (userId: string) => {
    const status = getStatus(userId);
    switch (status) {
      case 'online':
        return 'Online';
      case 'paused':
        return 'Em Pausa';
      default:
        return 'Offline';
    }
  };

  const getLivePauseDuration = (userId: string) => {
    const info = getPauseInfo(userId);
    if (!info?.pauseStartedAt) return null;
    return Math.floor((Date.now() - new Date(info.pauseStartedAt).getTime()) / 1000);
  };

  const getUserOnlineTime = (userId: string) => {
    const userSessions = sessions.filter((s) => s.user_id === userId);
    let total = 0;
    for (const s of userSessions) {
      if (s.duration_seconds) {
        total += s.duration_seconds;
      } else if (!s.ended_at) {
        // For active sessions, calculate live duration
        const elapsed = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000);
        // Cap at 24h to avoid stale session inflation
        total += Math.min(elapsed, 86400);
      }
    }
    // Subtract total pause time from online time
    const userPauses = pauseHistory.filter((p) => p.user_id === userId);
    const totalPauseTime = userPauses.reduce((acc, p) => {
      if (p.duration_seconds) return acc + p.duration_seconds;
      if (!p.ended_at)
        return acc + Math.floor((Date.now() - new Date(p.started_at).getTime()) / 1000);
      return acc;
    }, 0);
    return Math.max(0, total - totalPauseTime);
  };

  const getUserPauseStats = (userId: string) => {
    const userPauses = pauseHistory.filter((p) => p.user_id === userId);
    const lunchPauses = userPauses.filter((p) => p.pause_type === 'almoco');
    const coffeePauses = userPauses.filter((p) => p.pause_type === 'cafe');
    const totalLunchTime = lunchPauses.reduce((acc, p) => acc + (p.duration_seconds || 0), 0);
    const totalCoffeeTime = coffeePauses.reduce((acc, p) => acc + (p.duration_seconds || 0), 0);
    const totalPauseTime = userPauses.reduce((acc, p) => acc + (p.duration_seconds || 0), 0);
    const totalOvertime = userPauses.reduce((acc, p) => acc + (p.overtime_seconds || 0), 0);
    return {
      totalPauseTime,
      totalOvertime,
      lunchCount: lunchPauses.length,
      coffeeCount: coffeePauses.length,
      totalLunchTime,
      totalCoffeeTime,
      pauses: userPauses,
    };
  };

  const formatTimeRange = (startedAt: string, endedAt: string | null) => {
    const start = format(new Date(startedAt), "HH'h'mm", { locale: ptBR });
    if (!endedAt) return `${start} — em andamento`;
    const end = format(new Date(endedAt), "HH'h'mm", { locale: ptBR });
    return `${start} às ${end}`;
  };

  // Force re-render every second for live timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!currentUser || currentUser.role !== 'admin') return null;

  return (
    <div className="space-y-5">
      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Pessoas
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Relatório de Presença</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe presença, pausas e tempo online da equipe.
            </p>
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Real-time Status Grid */}
      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Circle className="w-4 h-4 text-green-500 fill-green-500" />
            Status em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allUsers.map((user) => {
              const status = getStatus(user.id);
              const pauseInfo = getPauseInfo(user.id);
              const livePause = status === 'paused' ? getLivePauseDuration(user.id) : null;
              const pauseMax =
                pauseInfo?.pauseType === 'almoco'
                  ? 3600
                  : pauseInfo?.pauseType === 'cafe'
                    ? 900
                    : 0;
              const overtime =
                livePause !== null && livePause > pauseMax ? livePause - pauseMax : 0;

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/20 p-3"
                >
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      status === 'online'
                        ? 'bg-green-500'
                        : status === 'paused'
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.name}
                      {user.role === 'admin' && (
                        <span className="text-[10px] text-muted-foreground ml-1">(Admin)</span>
                      )}
                    </p>
                    <p className={`text-xs ${getStatusColor(user.id)}`}>
                      {getStatusLabel(user.id)}
                    </p>
                  </div>
                  {status === 'paused' && livePause !== null && (
                    <div className="text-right space-y-0.5">
                      <Badge variant="secondary" className="text-xs">
                        {pauseInfo?.pauseType === 'almoco' ? (
                          <UtensilsCrossed className="w-3 h-3 mr-1" />
                        ) : (
                          <Coffee className="w-3 h-3 mr-1" />
                        )}
                        {formatDuration(livePause)}
                      </Badge>
                      {overtime > 0 && (
                        <Badge variant="destructive" className="text-[10px] block">
                          +{formatDuration(overtime)} excedido
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-user detailed stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {allUsers.map((user) => {
          const stats = getUserPauseStats(user.id);
          const onlineTime = getUserOnlineTime(user.id);

          if (stats.pauses.length === 0 && onlineTime === 0 && dateFilter === 'today') return null;

          return (
            <Card key={user.id} className="rounded-2xl border-border/70 shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>
                    {user.name}
                    {user.role === 'admin' && (
                      <span className="text-[10px] text-muted-foreground ml-1">(Admin)</span>
                    )}
                  </span>
                  {stats.totalOvertime > 0 && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />+{formatDuration(stats.totalOvertime)}{' '}
                      excedido
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Monitor className="w-3 h-3 text-green-500" />
                    </div>
                    <p className="text-lg font-bold text-green-500">{formatDuration(onlineTime)}</p>
                    <p className="text-[10px] text-muted-foreground">Tempo Online</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <UtensilsCrossed className="w-3 h-3 text-orange-400" />
                    </div>
                    <p className="text-lg font-bold">{stats.lunchCount}x</p>
                    <p className="text-[10px] text-muted-foreground">
                      Almoço ({formatDuration(stats.totalLunchTime)})
                    </p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Coffee className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-lg font-bold">{stats.coffeeCount}x</p>
                    <p className="text-[10px] text-muted-foreground">
                      Café ({formatDuration(stats.totalCoffeeTime)})
                    </p>
                  </div>
                </div>

                {stats.pauses.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Histórico de Pausas
                    </p>
                    {stats.pauses.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0 gap-2"
                      >
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.pause_type === 'almoco' ? (
                            <UtensilsCrossed className="w-3 h-3 text-orange-400" />
                          ) : (
                            <Coffee className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{p.pause_type === 'almoco' ? 'Almoço' : 'Café'}</span>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          {format(new Date(p.started_at), 'dd/MM')} —{' '}
                          {formatTimeRange(p.started_at, p.ended_at)}
                        </span>
                        <span className="shrink-0">{formatDuration(p.duration_seconds)}</span>
                        {(p.overtime_seconds || 0) > 0 && (
                          <span className="text-destructive font-medium shrink-0">
                            +{formatDuration(p.overtime_seconds)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TimeReportsPage;
