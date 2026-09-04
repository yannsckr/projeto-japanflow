import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
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
  created_at: any;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

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
  createdAt: toIso(row.created_at),
});

export const useSupabaseCalendar = (enabled = true) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      return;
    }

    const eventsQuery = query(
      collection(db, 'calendar_events'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setEvents(
          snapshot.docs.map((eventDoc) =>
            rowToEvent({
              id: eventDoc.id,
              ...(eventDoc.data() as Omit<CalendarRow, 'id'>),
            })
          )
        );
      },
      (error) => {
        console.error('Error fetching calendar events:', error);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addEvent = useCallback(
    async (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
      await addDoc(collection(db, 'calendar_events'), {
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time || null,
        user_id: event.userId,
        created_by: event.createdBy,
        type: event.type,
        target_mode: event.targetMode || 'specific',
        target_users: event.targetUsers || [],
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const updateEvent = useCallback(
    async (
      eventId: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>>
    ) => {
      const dbUpdates: Record<string, any> = { updated_at: Timestamp.now() };

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.time !== undefined) dbUpdates.time = updates.time || null;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.targetMode !== undefined) dbUpdates.target_mode = updates.targetMode;
      if (updates.targetUsers !== undefined) dbUpdates.target_users = updates.targetUsers;
      if (updates.userId !== undefined) dbUpdates.user_id = updates.userId;

      await updateDoc(doc(db, 'calendar_events', eventId), dbUpdates);
    },
    []
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    await deleteDoc(doc(db, 'calendar_events', eventId));
  }, []);

  const getEventsForUser = useCallback(
    (userId: string) => {
      return events
        .filter((event) => {
          if (event.targetUsers && event.targetUsers.length > 0) {
            return event.targetUsers.includes(userId);
          }
          return event.userId === userId;
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [events]
  );

  return { events, addEvent, updateEvent, deleteEvent, getEventsForUser };
};
