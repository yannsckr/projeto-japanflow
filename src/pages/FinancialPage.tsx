import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  DollarSign,
  Plus,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

import { useApp } from '@/contexts/AppContext';
import { useFinancial } from '@/hooks/useFinancial';
import { Sector } from '@/types';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WEEKDAYS = [
  { label: 'Segunda-feira', shortLabel: 'Seg', offset: 0 },
  { label: 'Terça-feira', shortLabel: 'Ter', offset: 1 },
  { label: 'Quarta-feira', shortLabel: 'Qua', offset: 2 },
  { label: 'Quinta-feira', shortLabel: 'Qui', offset: 3 },
  { label: 'Sexta-feira', shortLabel: 'Sex', offset: 4 },
];

function getCurrentMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getNextMonday(): Date {
  const current = getCurrentMonday();
  const next = new Date(current);
  next.setDate(current.getDate() + 7);
  return next;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parseCurrencyInput(raw: string): string {
  return raw.replace(/[^\d,.]/g, '').replace(',', '.');
}

interface CardDueDateInfo {
  id: string;
  dueDate: string;
  description: string;
}

interface WeekForecastProps {
  title: string;
  eyebrow: string;
  mondayDate: Date;
  forecasts: any[];
  canEdit: boolean;
  addOrUpdateForecast: any;
  currentUserId: string;
  cardDueDates: CardDueDateInfo[];
}

const WeekForecast = ({
  title,
  eyebrow,
  mondayDate,
  forecasts,
  canEdit,
  addOrUpdateForecast,
  currentUserId,
  cardDueDates,
}: WeekForecastProps) => {
  const [editValues, setEditValues] = useState<Record<string, { cash: string; expenses: string }>>(
    {}
  );

  const weekStartStr = formatDate(mondayDate);

  const weekDays = WEEKDAYS.map((wd, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    const dateStr = formatDate(d);
    const existing = forecasts.find(
      (f) => f.dayDate === dateStr && f.weekStartDate === weekStartStr
    );

    return {
      ...wd,
      date: dateStr,
      cash: existing?.predictedCash ?? 0,
      expenses: existing?.predictedExpenses ?? 0,
    };
  });

  const totals = useMemo(
    () =>
      weekDays.reduce(
        (acc, day) => {
          acc.cash += day.cash;
          acc.expenses += day.expenses;
          return acc;
        },
        { cash: 0, expenses: 0 }
      ),
    [weekDays]
  );

  const projectedBalance = totals.cash - totals.expenses;

  const handleSaveDay = async (day: (typeof weekDays)[0]) => {
    const cash =
      parseFloat(
        editValues[day.date]?.cash !== undefined ? editValues[day.date].cash : String(day.cash)
      ) || 0;

    const expenses =
      parseFloat(
        editValues[day.date]?.expenses !== undefined
          ? editValues[day.date].expenses
          : String(day.expenses)
      ) || 0;

    await addOrUpdateForecast(weekStartStr, day.label, day.date, cash, expenses, currentUserId);

    toast.success(`${day.label} salvo`);
  };

  const fridayStr = formatDate(new Date(mondayDate.getTime() + 4 * 86400000));

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <div className="border-b border-border/70 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <span className="text-xs text-muted-foreground">
                {formatDateBR(weekStartStr)} – {formatDateBR(fridayStr)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            <div className="rounded-xl border border-border/60 bg-background/25 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Caixa</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{formatCurrency(totals.cash)}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/25 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Despesas</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{formatCurrency(totals.expenses)}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/25 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign
                  className={cn(
                    'h-3.5 w-3.5',
                    projectedBalance >= 0 ? 'text-success' : 'text-destructive'
                  )}
                />
                <span className="text-[10px] font-medium uppercase tracking-wide">Saldo</span>
              </div>
              <p
                className={cn(
                  'mt-1 text-sm font-semibold',
                  projectedBalance >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {formatCurrency(projectedBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-border/50 xl:grid-cols-5">
        {weekDays.map((day) => {
          const cardsOnDay = cardDueDates.filter((cd) => cd.dueDate === day.date);

          const displayedCash =
            editValues[day.date]?.cash !== undefined
              ? editValues[day.date].cash
              : day.cash
                ? String(day.cash)
                : '';

          const displayedExpenses =
            editValues[day.date]?.expenses !== undefined
              ? editValues[day.date].expenses
              : day.expenses
                ? String(day.expenses)
                : '';

          return (
            <div key={day.date} className="bg-card p-4">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                      {day.shortLabel}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{day.label}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateBR(day.date)}</p>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => handleSaveDay(day)}
                  >
                    Salvar
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Caixa previsto
                  </label>

                  {canEdit ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={displayedCash}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [day.date]: {
                            ...prev[day.date],
                            cash: parseCurrencyInput(e.target.value),
                          },
                        }))
                      }
                      className="h-9"
                    />
                  ) : (
                    <p className="text-base font-semibold">{formatCurrency(day.cash)}</p>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Despesas previstas
                    </label>
                    {cardsOnDay.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-semibold text-destructive">
                        <CreditCard className="h-3 w-3" />
                        {cardsOnDay.length}
                      </span>
                    )}
                  </div>

                  {cardsOnDay.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {cardsOnDay.map((cd) => (
                        <span
                          key={cd.id}
                          className="inline-flex items-center rounded-md border border-destructive/15 bg-destructive/[0.05] px-1.5 py-0.5 text-[9px] text-destructive"
                        >
                          {cd.description || 'Cartão'}
                        </span>
                      ))}
                    </div>
                  )}

                  {canEdit ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={displayedExpenses}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [day.date]: {
                            ...prev[day.date],
                            expenses: parseCurrencyInput(e.target.value),
                          },
                        }))
                      }
                      className="h-9"
                    />
                  ) : (
                    <p className="text-base font-semibold">{formatCurrency(day.expenses)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const FinancialPage = () => {
  const { currentUser } = useApp();

  const { forecasts, cardDueDates, addOrUpdateForecast, addCardDueDate, deleteCardDueDate } =
    useFinancial();

  const [showCardDialog, setShowCardDialog] = useState(false);
  const [cardDate, setCardDate] = useState('');
  const [cardDesc, setCardDesc] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const isFinanceiro = currentUser?.sectors?.includes('financeiro' as Sector);

  if (!currentUser || (!isAdmin && !isFinanceiro)) {
    return <Navigate to="/login" replace />;
  }

  const canEdit = isAdmin || isFinanceiro;

  const handleAddCardDue = async () => {
    if (!cardDate) return;

    await addCardDueDate(cardDate, cardDesc.trim(), currentUser.id);

    toast.success('Data de vencimento adicionada');

    setShowCardDialog(false);
    setCardDate('');
    setCardDesc('');
  };

  const isCardDueSoon = (dateStr: string) => {
    const dueDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = dueDate.getTime() - today.getTime();

    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  };

  const currentMonday = getCurrentMonday();
  const nextMonday = getNextMonday();

  const currentWeekStart = formatDate(currentMonday);
  const nextWeekStart = formatDate(nextMonday);

  const currentWeekForecasts = forecasts.filter(
    (forecast) => forecast.weekStartDate === currentWeekStart
  );

  const nextWeekForecasts = forecasts.filter(
    (forecast) => forecast.weekStartDate === nextWeekStart
  );

  const currentWeekTotals = currentWeekForecasts.reduce(
    (acc, item) => {
      acc.cash += item.predictedCash;
      acc.expenses += item.predictedExpenses;
      return acc;
    },
    { cash: 0, expenses: 0 }
  );

  const nextWeekTotals = nextWeekForecasts.reduce(
    (acc, item) => {
      acc.cash += item.predictedCash;
      acc.expenses += item.predictedExpenses;
      return acc;
    },
    { cash: 0, expenses: 0 }
  );

  const dueSoonCount = cardDueDates.filter((item) => isCardDueSoon(item.dueDate)).length;

  return (
    <div className="space-y-6">
      <section className="jf-diagonal-accent overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Gestão financeira
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Visão Financeira
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Acompanhe previsões de caixa, despesas da semana e vencimentos importantes em uma
              única visão.
            </p>
          </div>

          {canEdit && (
            <Button onClick={() => setShowCardDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo vencimento
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Caixa — semana atual</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
              <WalletCards className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-xl font-semibold">{formatCurrency(currentWeekTotals.cash)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Previsão consolidada</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Despesas — semana atual
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-xl font-semibold">{formatCurrency(currentWeekTotals.expenses)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Saídas previstas</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Saldo — próxima semana
            </span>
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl',
                nextWeekTotals.cash - nextWeekTotals.expenses >= 0
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p
            className={cn(
              'mt-3 text-xl font-semibold',
              nextWeekTotals.cash - nextWeekTotals.expenses >= 0
                ? 'text-success'
                : 'text-destructive'
            )}
          >
            {formatCurrency(nextWeekTotals.cash - nextWeekTotals.expenses)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Projeção líquida</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Vencimentos próximos</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-xl font-semibold">{dueSoonCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Nos próximos 7 dias</p>
        </div>
      </section>

      <WeekForecast
        eyebrow="Planejamento"
        title="Semana Vigente"
        mondayDate={currentMonday}
        forecasts={forecasts}
        canEdit={canEdit}
        addOrUpdateForecast={addOrUpdateForecast}
        currentUserId={currentUser.id}
        cardDueDates={cardDueDates}
      />

      <WeekForecast
        eyebrow="Projeção"
        title="Próxima Semana"
        mondayDate={nextMonday}
        forecasts={forecasts}
        canEdit={canEdit}
        addOrUpdateForecast={addOrUpdateForecast}
        currentUserId={currentUser.id}
        cardDueDates={cardDueDates}
      />

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Agenda financeira
            </p>
            <div className="mt-1 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Vencimentos de cartões</h2>
            </div>
          </div>

          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowCardDialog(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar
            </Button>
          )}
        </div>

        <div className="p-3 md:p-4">
          {cardDueDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Nenhum vencimento cadastrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adicione datas para destacar compromissos financeiros importantes.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {cardDueDates.map((cd) => {
                const dueSoon = isCardDueSoon(cd.dueDate);

                return (
                  <div
                    key={cd.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border p-3',
                      dueSoon
                        ? 'border-destructive/25 bg-destructive/[0.04]'
                        : 'border-border/60 bg-background/20'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          dueSoon
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {dueSoon ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', dueSoon && 'text-destructive')}>
                          {formatDateBR(cd.dueDate)}
                        </p>

                        <p className="truncate text-xs text-muted-foreground">
                          {cd.description || 'Cartão sem descrição'}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCardDueDate(cd.id)}
                        aria-label="Excluir vencimento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar vencimento de cartão</DialogTitle>
            <DialogDescription>
              Cadastre uma data importante para destacá-la no planejamento financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Data de vencimento</label>
              <Input type="date" value={cardDate} onChange={(e) => setCardDate(e.target.value)} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                value={cardDesc}
                onChange={(e) => setCardDesc(e.target.value)}
                placeholder="Ex: Cartão Visa final 1234"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setShowCardDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddCardDue} disabled={!cardDate}>
                Adicionar vencimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialPage;
