import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent } from '@/types';

interface CalendarRow {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  user_id: string;
  created_by: string;
  type: string;
  target_mode: string;
  target_users: any;
  created_at: string;
}

const rowToEvent = (row: CalendarRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  date: row.date,
  time: row.time || undefined,
  userId: row.user_id,
  createdBy: row.created_by,
  type: row.type as 'event' | 'reminder',
  targetMode: (row.target_mode as CalendarEvent['targetMode']) || 'specific',
  targetUsers: Array.isArray(row.target_users) ? row.target_users : [],
  createdAt: row.created_at,
});

export const useSupabaseCalendar = (enabled = true) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase.from('calendar_events').select('*').order('date');
      if (error) {
        console.error('Error fetching calendar events:', error);
        return;
      }
      setEvents(data.map((r: any) => rowToEvent(r)));
    };
    fetch();

    const channel = supabase
      .channel('calendar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const e = rowToEvent(payload.new as CalendarRow);
            setEvents((prev) => (prev.find((x) => x.id === e.id) ? prev : [...prev, e]));
          } else if (payload.eventType === 'UPDATE') {
            const e = rowToEvent(payload.new as CalendarRow);
            setEvents((prev) => prev.map((x) => (x.id === e.id ? e : x)));
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((x) => x.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    await supabase.from('calendar_events').insert({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time || null,
      user_id: event.userId,
      created_by: event.createdBy,
      type: event.type,
      target_mode: event.targetMode || 'specific',
      target_users: event.targetUsers || [],
    } as any);
  }, []);

  const updateEvent = useCallback(
    async (
      eventId: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>>
    ) => {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.time !== undefined) dbUpdates.time = updates.time || null;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.targetUsers !== undefined) dbUpdates.target_users = updates.targetUsers;
      await supabase.from('calendar_events').update(dbUpdates).eq('id', eventId);
    },
    []
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    await supabase.from('calendar_events').delete().eq('id', eventId);
  }, []);

  const getEventsForUser = useCallback(
    (userId: string) => {
      return events
        .filter((e) => {
          // Event is visible if user is in targetUsers array, or if user_id matches (legacy/specific)
          if (e.targetUsers && e.targetUsers.length > 0) {
            return e.targetUsers.includes(userId);
          }
          return e.userId === userId;
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [events]
  );

  return { events, addEvent, updateEvent, deleteEvent, getEventsForUser };
};
