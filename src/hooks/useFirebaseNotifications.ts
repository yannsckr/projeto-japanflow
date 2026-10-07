import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification } from '@/types';

export function useFirebaseNotifications(enabled: boolean = true, userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!enabled) return;

    if (!userId) {
      setNotifications([]);
      return;
    }

    const notifsCol = collection(db, 'notifications');

    const q = query(
      notifsCol,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[];
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [enabled, userId]);

  const addNotification = useCallback(
    async (userId: string, title: string, type: string = 'info') => {
      try {
        const docRef = doc(collection(db, 'notifications'));
        const newNotif = {
          id: docRef.id,
          userId,
          title,
          type,
          read: false,
          createdAt: new Date().toISOString(),
        };
        await setDoc(docRef, newNotif);
      } catch (err) {
        console.error('Erro ao adicionar notificação:', err);
      }
    },
    []
  );

  const markRead = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  }, []);

  return { notifications, addNotification, markRead };
}
