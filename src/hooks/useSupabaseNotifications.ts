import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/types';

interface NotifRow {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  type: string;
  created_at: string;
}

const rowToNotif = (row: NotifRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  message: row.message,
  read: row.read,
  type: row.type as Notification['type'],
  timestamp: row.created_at,
});

export const useSupabaseNotifications = (enabled = true) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      setNotifications(data.map((r: any) => rowToNotif(r)));
    };
    fetch();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const n = rowToNotif(payload.new as NotifRow);
            setNotifications((prev) => (prev.find((x) => x.id === n.id) ? prev : [n, ...prev]));
          } else if (payload.eventType === 'UPDATE') {
            const n = rowToNotif(payload.new as NotifRow);
            setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const addNotification = useCallback(
    async (userId: string, message: string, type: Notification['type']) => {
      await supabase.from('notifications').insert({ user_id: userId, message, type });
    },
    []
  );

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  return { notifications, addNotification, markRead };
};
