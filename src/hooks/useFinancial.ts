import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

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

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useFinancial() {
  const [forecasts, setForecasts] = useState<FinancialForecast[]>([]);
  const [cardDueDates, setCardDueDates] = useState<CardDueDate[]>([]);

  useEffect(() => {
    const unsubForecasts = onSnapshot(
      query(collection(db, 'financial_forecasts'), orderBy('day_date', 'asc')),
      (snapshot) => {
        setForecasts(
          snapshot.docs.map((row) => {
            const d = row.data();
            return {
              id: row.id,
              weekStartDate: d.week_start_date || '',
              dayLabel: d.day_label || '',
              dayDate: d.day_date || '',
              predictedCash: Number(d.predicted_cash) || 0,
              predictedExpenses: Number(d.predicted_expenses) || 0,
              createdBy: d.created_by || '',
              createdAt: toIso(d.created_at),
            };
          })
        );
      },
      (error) => console.error('Erro em financial_forecasts:', error)
    );

    const unsubCards = onSnapshot(
      query(collection(db, 'card_due_dates'), orderBy('due_date', 'asc')),
      (snapshot) => {
        setCardDueDates(
          snapshot.docs.map((row) => {
            const d = row.data();
            return {
              id: row.id,
              dueDate: d.due_date || '',
              description: d.description || '',
              createdBy: d.created_by || '',
              createdAt: toIso(d.created_at),
            };
          })
        );
      },
      (error) => console.error('Erro em card_due_dates:', error)
    );

    return () => {
      unsubForecasts();
      unsubCards();
    };
  }, []);

  const addOrUpdateForecast = useCallback(
    async (
      weekStartDate: string,
      dayLabel: string,
      dayDate: string,
      predictedCash: number,
      predictedExpenses: number,
      createdBy: string
    ) => {
      const forecastId = `${weekStartDate}__${dayDate}`;
      const forecastRef = doc(db, 'financial_forecasts', forecastId);
      const existing = await getDoc(forecastRef);

      await setDoc(
        forecastRef,
        {
          week_start_date: weekStartDate,
          day_label: dayLabel,
          day_date: dayDate,
          predicted_cash: predictedCash,
          predicted_expenses: predictedExpenses,
          created_by: createdBy,
          ...(existing.exists() ? {} : { created_at: Timestamp.now() }),
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
    },
    []
  );

  const addCardDueDate = useCallback(
    async (dueDate: string, description: string, createdBy: string) => {
      await addDoc(collection(db, 'card_due_dates'), {
        due_date: dueDate,
        description,
        created_by: createdBy,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const deleteCardDueDate = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'card_due_dates', id));
  }, []);

  return {
    forecasts,
    cardDueDates,
    addOrUpdateForecast,
    addCardDueDate,
    deleteCardDueDate,
  };
}
