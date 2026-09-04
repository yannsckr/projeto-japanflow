import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Notification } from '@/types';

interface NotifRow {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  type: string;
  created_at: any;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

const rowToNotif = (row: NotifRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  message: row.message,
  read: row.read,
  type: row.type as Notification['type'],
  timestamp: toIso(row.created_at),
});

export const useSupabaseNotifications = (enabled = true) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((notificationDoc) =>
            rowToNotif({
              id: notificationDoc.id,
              ...(notificationDoc.data() as Omit<NotifRow, 'id'>),
            })
          )
        );
      },
      (error) => {
        console.error('Error fetching notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addNotification = useCallback(
    async (userId: string, message: string, type: Notification['type']) => {
      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        message,
        type,
        read: false,
        created_at: Timestamp.now(),
      });
    },
    []
  );

  const markRead = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  }, []);

  return { notifications, addNotification, markRead };
};
