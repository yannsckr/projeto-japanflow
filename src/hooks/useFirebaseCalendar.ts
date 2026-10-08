import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CalendarEvent } from '@/types';

export function useFirebaseCalendar(enabled: boolean = true) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      return;
    }

    const calendarCol = collection(db, 'calendar_events');
    const q = query(calendarCol, limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CalendarEvent[] = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as CalendarEvent[];

        setEvents(list);
      },
      (error) => {
        console.error('Erro ao carregar eventos do calendário:', error);
        setEvents([]);
      }
    );

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
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
      throw error;
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
      } catch (error) {
        console.error('Erro ao atualizar evento:', error);
        throw error;
      }
    },
    []
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'calendar_events', eventId));
    } catch (error) {
      console.error('Erro ao deletar evento:', error);
      throw error;
    }
  }, []);

  const getEventsForUser = useCallback(
    (userId: string): CalendarEvent[] => {
      return events.filter((event) => {
        const eventWithUsers = event as CalendarEvent & {
          participants?: string[];
          targetUsers?: string[];
          userId?: string;
          createdBy?: string;
        };

        const participants = Array.isArray(eventWithUsers.participants)
          ? eventWithUsers.participants
          : [];

        const targetUsers = Array.isArray(eventWithUsers.targetUsers)
          ? eventWithUsers.targetUsers
          : [];

        return (
          eventWithUsers.userId === userId ||
          eventWithUsers.createdBy === userId ||
          participants.includes(userId) ||
          targetUsers.includes(userId)
        );
      });
    },
    [events]
  );

  return {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForUser,
  };
}
