import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import { WeekDays, emptyWeek } from '@/lib/workSchedule';

export interface WorkSchedule {
  id: string;
  user_id: string;
  week_start: string;
  days: WeekDays;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkScheduleFirestore {
  userId: string;
  weekStart: string;
  days: WeekDays;
  createdBy?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function useWorkSchedules(userId?: string) {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!userId) {
      setSchedules([]);
      return;
    }

    setLoading(true);

    try {
      const schedulesQuery = query(collection(db, 'work_schedules'), where('userId', '==', userId));

      const snapshot = await getDocs(schedulesQuery);

      const nextSchedules = snapshot.docs.map((scheduleDoc) => {
        const data = scheduleDoc.data() as WorkScheduleFirestore;

        return {
          id: scheduleDoc.id,
          user_id: data.userId,
          week_start: data.weekStart,
          days: {
            ...emptyWeek(),
            ...(data.days || {}),
          },
          created_by: data.createdBy || null,
          created_at: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : '',
          updated_at: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : '',
        };
      });

      nextSchedules.sort((a, b) => a.week_start.localeCompare(b.week_start));

      setSchedules(nextSchedules);
    } catch (error) {
      console.error('Erro ao carregar escalas de trabalho:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    refetch: fetchSchedules,
  };
}

export async function upsertSchedule(params: {
  userId: string;
  weekStart: string;
  days: WeekDays;
  createdBy?: string;
}) {
  const scheduleId = `${params.userId}__${params.weekStart}`;

  const scheduleRef = doc(db, 'work_schedules', scheduleId);

  const now = Timestamp.now();

  const existingSchedule = await getDoc(scheduleRef);

  await setDoc(
    scheduleRef,
    {
      userId: params.userId,
      weekStart: params.weekStart,
      days: params.days,
      createdBy: params.createdBy || null,
      updatedAt: now,
      ...(!existingSchedule.exists() ? { createdAt: now } : {}),
    },
    { merge: true }
  );
}

export async function deleteSchedule(id: string) {
  await deleteDoc(doc(db, 'work_schedules', id));
}
