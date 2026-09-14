import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const formatNotificationDate = (timestamp: string | undefined | null) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

const NotificationBell = () => {
  const { currentUser, notifications, markNotificationRead } = useApp();

  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  const prevCount = useRef(0);

  const userNotifs = currentUser
    ? notifications
        .filter((notification) => notification.userId === currentUser.id)
        .sort((a, b) => {
          const aTime = a.timestamp
            ? new Date(a.timestamp).getTime()
            : 0;

          const bTime = b.timestamp
            ? new Date(b.timestamp).getTime()
            : 0;

          return (
            (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime)
          );
        })
    : [];

  const unreadCount = userNotifs.filter(
    (notification) => !notification.read
  ).length;

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setFlash(true);

      const timer = setTimeout(() => {
        setFlash(false);
      }, 2000);

      prevCount.current = unreadCount;

      return () => clearTimeout(timer);
    }

    prevCount.current = unreadCount;
  }, [unreadCount]);

  if (!currentUser) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative p-2 rounded-lg hover:bg-secondary transition-colors',
            flash && 'animate-bounce'
          )}
          aria-label="Notificações"
        >
          <Bell
            className={cn(
              'w-5 h-5',
              unreadCount > 0
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          />

          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold">Notificações</h3>
        </div>

        <div className="max-h-64 overflow-auto">
          {userNotifs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Nenhuma notificação
            </p>
          ) : (
            userNotifs.map((notification) => {
              const formattedDate = formatNotificationDate(
                notification.timestamp
              );

              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() =>
                    markNotificationRead(notification.id)
                  }
                  className={cn(
                    'w-full text-left p-3 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors',
                    !notification.read &&
                      'bg-primary/5 border-l-2 border-l-primary'
                  )}
                >
                  <p className="text-sm">
                    {notification.message}
                  </p>

                  {formattedDate && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formattedDate}
                    </p>
                  )}
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