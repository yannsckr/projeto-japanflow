import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CalendarEvent } from '@/types';

export function useFirebaseCalendar(enabled: boolean = true) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const calendarCol = collection(db, 'calendar_events');
    const q = query(calendarCol, orderBy('startDate', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CalendarEvent[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CalendarEvent[];
      setEvents(list);
    });

    return () => unsubscribe();
  }, [enabled]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    try {
      const docRef = doc(collection(db, 'calendar_events'));
      const newEvent: CalendarEvent = {
        ...event,
        id: docRef.id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(docRef, newEvent);
    } catch (err) {
      console.error('Erro ao adicionar evento:', err);
    }
  }, []);

  const updateEvent = useCallback(
    async (
      eventId: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>>
    ) => {
      try {
        const docRef = doc(db, 'calendar_events', eventId);
        await updateDoc(docRef, updates);
      } catch (err) {
        console.error('Erro ao atualizar evento:', err);
      }
    },
    []
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'calendar_events', eventId));
    } catch (err) {
      console.error('Erro ao deletar evento:', err);
    }
  }, []);

  const getEventsForUser = useCallback(
    (userId: string) => {
      return events.filter(
        (e: any) => e.userId === userId || e.createdBy === userId || (e.participants && e.participants.includes(userId))
      );
    },
    [events]
  );

  return { events, addEvent, updateEvent, deleteEvent, getEventsForUser };
}