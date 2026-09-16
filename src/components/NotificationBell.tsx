import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bell, MessageSquare } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface BellNotification {
  id: string;
  userId: string;
  message: string;
  type: string;
  read: boolean;
  timestamp: string;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

const formatNotificationDate = (timestamp: string | undefined | null) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

const NotificationBell = () => {
  const { currentUser, markNotificationRead } = useApp();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [userNotifs, setUserNotifs] = useState<BellNotification[]>([]);

  const prevCount = useRef(0);

  useEffect(() => {
    if (!currentUser?.id) {
      setUserNotifs([]);
      return;
    }

    // Listener próprio do sino para não depender do timing do AppContext.
    // Ordenamos no cliente para evitar índice composto user_id + created_at.
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((notificationDoc) => {
            const data = notificationDoc.data();

            return {
              id: notificationDoc.id,
              userId: String(data.user_id || ''),
              message: String(data.message || 'Nova notificação'),
              type: String(data.type || 'generic'),
              read: data.read === true,
              timestamp: toIso(data.created_at || data.timestamp),
            } satisfies BellNotification;
          })
          .sort(
            (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );

        setUserNotifs(next);
      },
      (error) => {
        console.error('Erro ao acompanhar notificações do sino:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id]);

  const unreadCount = userNotifs.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setFlash(true);

      const timer = window.setTimeout(() => {
        setFlash(false);
      }, 900);

      prevCount.current = unreadCount;
      return () => window.clearTimeout(timer);
    }

    prevCount.current = unreadCount;
  }, [unreadCount]);

  if (!currentUser) return null;

  const handleNotificationClick = async (notification: BellNotification) => {
    if (!notification.read) {
      await Promise.resolve(markNotificationRead(notification.id));
    }

    if (notification.type === 'chat_message') {
      setOpen(false);
      navigate('/chat');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'jf-interactive relative flex h-9 w-9 items-center justify-center rounded-xl',
            flash && 'scale-110'
          )}
          aria-label={
            unreadCount > 0
              ? `Notificações, ${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`
              : 'Notificações'
          }
        >
          <Bell
            className={cn(
              'h-[18px] w-[18px] transition-colors',
              unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'
            )}
          />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border-border/70 p-0 shadow-card"
        align="end"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Notificações</h3>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`
                : 'Tudo em dia'}
            </p>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {userNotifs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
          ) : (
            userNotifs.map((notification) => {
              const formattedDate = formatNotificationDate(notification.timestamp);
              const isChat = notification.type === 'chat_message';

              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => void handleNotificationClick(notification)}
                  className={cn(
                    'jf-interactive flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left',
                    !notification.read && 'bg-primary/[0.06]'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      isChat ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isChat ? <MessageSquare className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p
                        className={cn(
                          'min-w-0 flex-1 text-sm leading-snug',
                          !notification.read && 'font-medium'
                        )}
                      >
                        {notification.message}
                      </p>

                      {!notification.read && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Não lida"
                        />
                      )}
                    </div>

                    {formattedDate && (
                      <p className="mt-1 text-[10px] text-muted-foreground">{formattedDate}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
