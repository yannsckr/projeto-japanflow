import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface QueuedNotif {
  id: string;
  message: string;
}

const STORAGE_KEY = 'newTaskPopupSeen';
const INSTALL_TS_KEY = 'newTaskPopupInstallTs';

const loadSeen = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
};

const saveSeen = (seen: Set<string>) => {
  try {
    const arr = Array.from(seen).slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
};

const getInstallTs = (): number => {
  try {
    const raw = localStorage.getItem(INSTALL_TS_KEY);
    if (raw) return parseInt(raw, 10);
    const now = Date.now();
    localStorage.setItem(INSTALL_TS_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
};

const NewTaskPopup = () => {
  const { currentUser, notifications, tasks, markNotificationRead, playNotificationSound } =
    useApp();
  const [queue, setQueue] = useState<QueuedNotif[]>([]);
  const seenRef = useRef<Set<string>>(loadSeen());
  const installTsRef = useRef<number>(getInstallTs());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    const isTaskActive = (message: string) => {
      // Try to find a matching task by title contained in the message; if found and done, skip
      const match = tasks.find((t) => message.includes(t.title) && t.assigneeId === currentUser.id);
      if (match && match.status === 'done') return false;
      return true;
    };

    const userTaskNotifs = notifications.filter(
      (n) =>
        n.userId === currentUser.id &&
        n.type === 'task_created' &&
        new Date(n.timestamp).getTime() >= installTsRef.current &&
        isTaskActive(n.message)
    );

    // On first load, mark all existing as seen (avoid replaying historic notifs)
    if (!initializedRef.current) {
      notifications
        .filter((n) => n.userId === currentUser.id && n.type === 'task_created')
        .forEach((n) => seenRef.current.add(n.id));
      saveSeen(seenRef.current);
      initializedRef.current = true;
      return;
    }

    const fresh = userTaskNotifs.filter((n) => !seenRef.current.has(n.id));
    if (fresh.length === 0) return;

    fresh.forEach((n) => seenRef.current.add(n.id));
    saveSeen(seenRef.current);
    setQueue((prev) => [...prev, ...fresh.map((n) => ({ id: n.id, message: n.message }))]);
    playNotificationSound();
  }, [notifications, tasks, currentUser, playNotificationSound]);

  const current = queue[0];

  const handleClose = () => {
    if (current) markNotificationRead(current.id);
    setQueue((prev) => prev.slice(1));
  };

  if (!current) return null;

  return (
    <Dialog
      open={true}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Nova tarefa recebida
          </DialogTitle>
          <DialogDescription className="pt-2 text-base text-foreground">
            {current.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewTaskPopup;
