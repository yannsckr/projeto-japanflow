import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useSupabaseFinancial } from '@/hooks/useSupabaseFinancial';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, CreditCard, Plus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sector } from '@/types';

const WEEKDAYS = [
  { label: 'Segunda-feira', offset: 0 },
  { label: 'Terça-feira', offset: 1 },
  { label: 'Quarta-feira', offset: 2 },
  { label: 'Quinta-feira', offset: 3 },
  { label: 'Sexta-feira', offset: 4 },
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
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  mondayDate: Date;
  forecasts: any[];
  canEdit: boolean;
  addOrUpdateForecast: any;
  currentUserId: string;
  cardDueDates: CardDueDateInfo[];
}

const WeekForecast = ({
  title,
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          {title}: {formatDateBR(weekStartStr)} - {formatDateBR(fridayStr)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {weekDays.map((day) => (
            <div key={day.date} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{day.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateBR(day.date)}</p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleSaveDay(day)}
                  >
                    Salvar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">
                    Valor em caixa previsto
                  </label>
                  {canEdit ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={
                        editValues[day.date]?.cash !== undefined
                          ? editValues[day.date].cash
                          : day.cash
                            ? String(day.cash)
                            : ''
                      }
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [day.date]: {
                            ...prev[day.date],
                            cash: parseCurrencyInput(e.target.value),
                          },
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{formatCurrency(day.cash)}</p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">
                    Valor das despesas previstas
                  </label>
                  {(() => {
                    const cardsOnDay = cardDueDates.filter((cd) => cd.dueDate === day.date);
                    return cardsOnDay.length > 0 ? (
                      <div className="flex items-center gap-1.5 mt-0.5 mb-1">
                        {cardsOnDay.map((cd) => (
                          <span
                            key={cd.id}
                            className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium bg-destructive/10 rounded-full px-2 py-0.5"
                          >
                            <CreditCard className="w-3 h-3" />
                            {cd.description || 'Cartão'}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {canEdit ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={
                        editValues[day.date]?.expenses !== undefined
                          ? editValues[day.date].expenses
                          : day.expenses
                            ? String(day.expenses)
                            : ''
                      }
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [day.date]: {
                            ...prev[day.date],
                            expenses: parseCurrencyInput(e.target.value),
                          },
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{formatCurrency(day.expenses)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const FinancialPage = () => {
  const { currentUser } = useApp();
  const { forecasts, cardDueDates, addOrUpdateForecast, addCardDueDate, deleteCardDueDate } =
    useSupabaseFinancial();
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Setor Financeiro</h2>

      {/* Current Week */}
      <WeekForecast
        title="Semana Vigente"
        mondayDate={getCurrentMonday()}
        forecasts={forecasts}
        canEdit={canEdit}
        addOrUpdateForecast={addOrUpdateForecast}
        currentUserId={currentUser.id}
        cardDueDates={cardDueDates}
      />

      {/* Next Week */}
      <WeekForecast
        title="Próxima Semana"
        mondayDate={getNextMonday()}
        forecasts={forecasts}
        canEdit={canEdit}
        addOrUpdateForecast={addOrUpdateForecast}
        currentUserId={currentUser.id}
        cardDueDates={cardDueDates}
      />

      {/* Card Due Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Vencimentos de Cartões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <Button size="sm" onClick={() => setShowCardDialog(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Adicionar Vencimento
            </Button>
          )}
          {cardDueDates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma data de vencimento cadastrada
            </p>
          ) : (
            <div className="space-y-2">
              {cardDueDates.map((cd) => (
                <div
                  key={cd.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border border-border',
                    isCardDueSoon(cd.dueDate) && 'border-destructive/50 bg-destructive/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isCardDueSoon(cd.dueDate) && (
                      <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />
                    )}
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          isCardDueSoon(cd.dueDate) && 'text-destructive'
                        )}
                      >
                        {formatDateBR(cd.dueDate)}
                      </p>
                      {cd.description && (
                        <p className="text-xs text-muted-foreground">{cd.description}</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteCardDueDate(cd.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Vencimento de Cartão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Data de Vencimento</label>
              <Input type="date" value={cardDate} onChange={(e) => setCardDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input
                value={cardDesc}
                onChange={(e) => setCardDesc(e.target.value)}
                placeholder="Ex: Cartão Visa final 1234"
              />
            </div>
            <Button onClick={handleAddCardDue} disabled={!cardDate}>
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialPage;
