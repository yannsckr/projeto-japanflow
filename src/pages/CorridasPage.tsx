import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useDepartmental } from '@/hooks/useDepartmental';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bike, ChevronLeft, ChevronRight, DollarSign, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sector } from '@/types';
import { parseOrderInfo, stripOrderInfo, OrderInfoBadges } from '@/lib/orderInfo';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CorridasPage = () => {
  const { currentUser, users } = useApp();
  const { motoboyAssignments } = useDepartmental();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMotoboy, setSelectedMotoboy] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const userSectors = currentUser?.sectors || [];
  const isPatricia = currentUser?.id === 'emp-1';
  const isFinanceiro = userSectors.includes('financeiro' as Sector);
  const isMotoboy =
    userSectors.includes('motoboys' as Sector) && !isAdmin && !isPatricia && !isFinanceiro;
  const canAccess =
    isAdmin || userSectors.includes('motoboys' as Sector) || isPatricia || isFinanceiro;
  const motoboys = users.filter((u) => u.sectors?.includes('motoboys' as Sector));
  const getName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const currentMonday = useMemo(() => {
    const m = getMondayOfWeek(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      return formatDate(d);
    });
  }, [currentMonday]);

  const sundayStr = weekDates[6];
  const mondayStr = weekDates[0];

  // Returns the effective date for grouping: scheduled date if set, else creation date
  const getEffectiveDate = useCallback(
    (ma: (typeof motoboyAssignments)[number]) => {
      return (ma.scheduledFor || ma.createdAt).split('T')[0];
    },
    []
  );

  // Filter assignments for this week (motoboys only see their own)
  const weekAssignments = useMemo(() => {
    return motoboyAssignments.filter((ma) => {
      const dateStr = getEffectiveDate(ma);
      const inWeek = dateStr >= mondayStr && dateStr <= sundayStr;
      if (isMotoboy) return inWeek && ma.assignedTo === currentUser?.id;
      return inWeek;
    });
  }, [motoboyAssignments, mondayStr, sundayStr, isMotoboy, currentUser?.id, getEffectiveDate]);

  // Apply search and additional filters
  const filteredAssignments = useMemo(() => {
    let result = weekAssignments;
    if (selectedMotoboy !== 'all') {
      result = result.filter((a) => a.assignedTo === selectedMotoboy);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          (a.clientName || '').toLowerCase().includes(q) ||
          (a.location || '').toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }
    if (filterDate) {
      result = result.filter((a) => getEffectiveDate(a) === filterDate);
    }
    return result;
  }, [weekAssignments, selectedMotoboy, searchQuery, filterDate, getEffectiveDate]);

  // Get unique motoboys from filtered assignments
  const activeMotoboys = useMemo(() => {
    const ids = new Set(filteredAssignments.map((a) => a.assignedTo));
    return Array.from(ids);
  }, [filteredAssignments]);

  const getAssignmentsForMotoboyDay = (motoboyId: string, dateStr: string) => {
    return filteredAssignments.filter(
      (a) => a.assignedTo === motoboyId && getEffectiveDate(a) === dateStr
    );
  };

  const getTotalForMotoboy = (motoboyId: string) => {
    return filteredAssignments
      .filter((a) => a.assignedTo === motoboyId)
      .reduce((sum, a) => sum + (a.rideValue || 0), 0);
  };

  const grandTotal = filteredAssignments.reduce((sum, a) => sum + (a.rideValue || 0), 0);

  if (!currentUser || !canAccess) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-6">
      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Operação de entregas
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <Bike className="h-5 w-5 text-primary" />
              Relatório de Corridas
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe corridas, valores e desempenho semanal dos motoboys.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total filtrado
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(grandTotal)}</p>
          </div>
        </div>
      </section>

      {/* Week navigation */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-card">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium">
          {formatDateBR(mondayStr)} - {formatDateBR(sundayStr)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => o + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
            Semana Atual
          </Button>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, local ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="h-9 text-sm w-full sm:w-40"
        />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate('')} className="h-9">
            <X className="h-4 w-4" />
          </Button>
        )}
        {!isMotoboy && (
          <Select value={selectedMotoboy} onValueChange={setSelectedMotoboy}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="Todos os motoboys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Motoboys</SelectItem>
              {motoboys.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {/* Per-motoboy reports */}
      {activeMotoboys.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma corrida registrada nesta semana
        </p>
      ) : (
        activeMotoboys.map((motoboyId) => {
          const total = getTotalForMotoboy(motoboyId);
          return (
            <Card
              key={motoboyId}
              className="overflow-hidden rounded-2xl border-border/70 shadow-card"
            >
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Bike className="w-4 h-4" />
                    {getName(motoboyId)}
                  </span>
                  <span className="text-primary font-bold">{formatCurrency(total)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {WEEKDAYS.map((d) => (
                    <p key={d} className="text-[10px] font-semibold text-muted-foreground">
                      {d}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDates.map((dateStr) => {
                    const dayAssignments = getAssignmentsForMotoboyDay(motoboyId, dateStr);
                    const dayTotal = dayAssignments.reduce((s, a) => s + (a.rideValue || 0), 0);
                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          'min-h-[72px] rounded-xl border border-border/60 p-2 text-xs',
                          dayAssignments.length > 0 ? 'bg-primary/[0.04]' : 'bg-background/20'
                        )}
                      >
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {dateStr.split('-')[2]}
                        </p>
                        {dayAssignments.length > 0 ? (
                          <>
                            <p className="font-semibold text-[10px]">
                              {dayAssignments.length} corrida{dayAssignments.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-[10px] font-bold text-primary">
                              {formatCurrency(dayTotal)}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">—</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Detail list */}
                {filteredAssignments.filter((a) => a.assignedTo === motoboyId).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {filteredAssignments
                      .filter((a) => a.assignedTo === motoboyId)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-col gap-1 text-xs bg-secondary/30 rounded px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{a.description}</span>
                              {(() => {
                                const cleaned = stripOrderInfo(a.notes);
                                return cleaned ? (
                                  <span className="text-primary ml-2">• {cleaned}</span>
                                ) : null;
                              })()}
                              {a.clientName && (
                                <span className="text-muted-foreground ml-2">• {a.clientName}</span>
                              )}
                              {a.location && (
                                <span className="text-muted-foreground ml-1">• {a.location}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 ml-2 shrink-0">
                              <div className="text-right">
                                {a.scheduledFor ? (
                                  <span className="text-[10px] font-bold text-destructive">
                                    📅{' '}
                                    {new Date(a.scheduledFor).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {a.completedAt && (
                                  <span className="text-[10px] text-success ml-2">
                                    ✅{' '}
                                    {new Date(a.completedAt).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  'font-bold',
                                  a.rideValue > 0 ? 'text-primary' : 'text-muted-foreground'
                                )}
                              >
                                {formatCurrency(a.rideValue || 0)}
                              </span>
                            </div>
                          </div>
                          <OrderInfoBadges info={parseOrderInfo(a.notes)} size="xs" />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default CorridasPage;