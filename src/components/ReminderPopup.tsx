import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

const ReminderPopup = () => {
  const { currentUser, calendarEvents, users } = useApp();
  const [activeReminder, setActiveReminder] = useState<{
    id: string;
    title: string;
    description: string;
    time: string;
  } | null>(null);
  const shownReminders = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;

    const check = () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const userReminders = calendarEvents.filter((e) => {
        if (e.type !== 'reminder') return false;
        if (e.date !== todayStr || !e.time) return false;
        if (shownReminders.current.has(e.id)) return false;
        // Check if current user is a target
        if (e.targetUsers && e.targetUsers.length > 0) {
          return e.targetUsers.includes(currentUser.id);
        }
        return e.userId === currentUser.id;
      });

      for (const reminder of userReminders) {
        if (reminder.time === currentTime) {
          shownReminders.current.add(reminder.id);
          setActiveReminder({
            id: reminder.id,
            title: reminder.title,
            description: reminder.description,
            time: reminder.time!,
          });
          // Play sound
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
          } catch {}
          break;
        }
      }
    };

    check();
    const interval = setInterval(check, 10000); // check every 10 seconds
    return () => clearInterval(interval);
  }, [currentUser, calendarEvents]);

  if (!activeReminder) return null;

  return (
    <Dialog
      open={!!activeReminder}
      onOpenChange={(v) => {
        if (!v) setActiveReminder(null);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-600">
            <Bell className="w-5 h-5 animate-bounce" />
            Lembrete!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <h3 className="text-lg font-bold">{activeReminder.title}</h3>
          <p className="text-sm text-muted-foreground">Horário: {activeReminder.time}</p>
          {activeReminder.description && <p className="text-sm">{activeReminder.description}</p>}
          <div className="flex justify-end">
            <Button onClick={() => setActiveReminder(null)}>Entendido</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderPopup;
