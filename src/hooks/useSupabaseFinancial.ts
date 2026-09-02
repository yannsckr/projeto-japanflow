import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialForecast {
  id: string;
  weekStartDate: string;
  dayLabel: string;
  dayDate: string;
  predictedCash: number;
  predictedExpenses: number;
  createdBy: string;
  createdAt: string;
}

export interface CardDueDate {
  id: string;
  dueDate: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export function useSupabaseFinancial() {
  const [forecasts, setForecasts] = useState<FinancialForecast[]>([]);
  const [cardDueDates, setCardDueDates] = useState<CardDueDate[]>([]);

  const fetchForecasts = useCallback(async () => {
    const { data } = await supabase
      .from('financial_forecasts')
      .select('*')
      .order('day_date', { ascending: true });
    if (data) {
      setForecasts(
        data.map((d: any) => ({
          id: d.id,
          weekStartDate: d.week_start_date,
          dayLabel: d.day_label,
          dayDate: d.day_date,
          predictedCash: Number(d.predicted_cash),
          predictedExpenses: Number(d.predicted_expenses),
          createdBy: d.created_by,
          createdAt: d.created_at,
        }))
      );
    }
  }, []);

  const fetchCardDueDates = useCallback(async () => {
    const { data } = await supabase
      .from('card_due_dates')
      .select('*')
      .order('due_date', { ascending: true });
    if (data) {
      setCardDueDates(
        data.map((d: any) => ({
          id: d.id,
          dueDate: d.due_date,
          description: d.description,
          createdBy: d.created_by,
          createdAt: d.created_at,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchForecasts();
    fetchCardDueDates();

    const ch1 = supabase
      .channel('financial-forecasts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_forecasts' }, () =>
        fetchForecasts()
      )
      .subscribe();

    const ch2 = supabase
      .channel('card-due-dates-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_due_dates' }, () =>
        fetchCardDueDates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [fetchForecasts, fetchCardDueDates]);

  const addOrUpdateForecast = useCallback(
    async (
      weekStartDate: string,
      dayLabel: string,
      dayDate: string,
      predictedCash: number,
      predictedExpenses: number,
      createdBy: string
    ) => {
      // Check if entry exists for this day_date
      const { data: existing } = await supabase
        .from('financial_forecasts')
        .select('id')
        .eq('day_date', dayDate)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('financial_forecasts')
          .update({
            predicted_cash: predictedCash,
            predicted_expenses: predictedExpenses,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('financial_forecasts').insert({
          week_start_date: weekStartDate,
          day_label: dayLabel,
          day_date: dayDate,
          predicted_cash: predictedCash,
          predicted_expenses: predictedExpenses,
          created_by: createdBy,
        });
      }
    },
    []
  );

  const addCardDueDate = useCallback(
    async (dueDate: string, description: string, createdBy: string) => {
      await supabase.from('card_due_dates').insert({
        due_date: dueDate,
        description: description,
        created_by: createdBy,
      });
    },
    []
  );

  const deleteCardDueDate = useCallback(async (id: string) => {
    await supabase.from('card_due_dates').delete().eq('id', id);
  }, []);

  return { forecasts, cardDueDates, addOrUpdateForecast, addCardDueDate, deleteCardDueDate };
}
