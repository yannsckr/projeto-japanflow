import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function useWorkSchedules(userId?: string) {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!userId) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: true });
    if (!error && data) {
      setSchedules(
        data.map((d) => ({
          ...d,
          days: { ...emptyWeek(), ...((d.days as unknown) as WeekDays) },
        })) as WorkSchedule[]
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return { schedules, loading, refetch: fetchSchedules };
}

export async function upsertSchedule(params: {
  userId: string;
  weekStart: string;
  days: WeekDays;
  createdBy?: string;
}) {
  const { error } = await supabase
    .from('work_schedules')
    .upsert(
      [
        {
          user_id: params.userId,
          week_start: params.weekStart,
          days: params.days as unknown as never,
          created_by: params.createdBy,
        },
      ],
      { onConflict: 'user_id,week_start' }
    );
  if (error) throw error;
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from('work_schedules').delete().eq('id', id);
  if (error) throw error;
}
