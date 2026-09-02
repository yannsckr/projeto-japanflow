import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  User,
  Task,
  ChatMessage,
  Notification,
  TaskStatus,
  Priority,
  CalendarEvent,
  Sector,
} from '@/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { useFirebaseTasks } from '@/hooks/useFirebaseTasks';
import { useFirebaseCalendar } from '@/hooks/useFirebaseCalendar';
import { useFirebaseNotifications } from '@/hooks/useFirebaseNotifications';
import { useFirebaseUsers } from '@/hooks/useFirebaseUsers';
import { saveSession, loadSession, clearSession } from '@/hooks/useSessionPersistence';
import { sendPushToUser } from '@/hooks/usePushNotifications';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  usersLoading: boolean;
  usersError: string | null;
  tasks: Task[];
  messages: ChatMessage[];
  notifications: Notification[];
  calendarEvents: CalendarEvent[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (
    userId: string,
    updates: Partial<Pick<User, 'name' | 'username' | 'password' | 'sectors' | 'function'>>
  ) => void;
  deleteUser: (userId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => void;
  updateTask: (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
  ) => void;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskPriority: (taskId: string, priority: Priority) => void;
  claimSectorTask: (taskId: string) => void;
  sendMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  editMessage: (msgId: string, newContent: string) => void;
  deleteMessage: (msgId: string) => void;
  markNotificationRead: (id: string) => void;
  getTasksForUser: (userId: string) => Task[];
  getSectorTasks: (sector: Sector) => Task[];
  getMessagesForChat: (userId1: string, userId2: string) => ChatMessage[];
  getTaskMessages: (taskId: string) => ChatMessage[];
  getGroupMessages: (groupId: string) => ChatMessage[];
  addCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  updateCalendarEvent: (
    eventId: string,
    updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>>
  ) => void;
  deleteCalendarEvent: (eventId: string) => void;
  getEventsForUser: (userId: string) => CalendarEvent[];
  playNotificationSound: () => void;
  updateProfile: (updates: { avatar?: string; backgroundColor?: string }) => void;
  sectorAssignEnabled: boolean;
  setSectorAssignEnabled: (enabled: boolean) => void;
  nfToCarolEnabled: boolean;
  setNfToCarolEnabled: (enabled: boolean) => void;
  nfBoletoToCarolEnabled: boolean;
  setNfBoletoToCarolEnabled: (enabled: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';

  const [currentUser, setCurrentUser] = useState<User | null>(() => loadSession());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sectorAssignEnabled, setSectorAssignEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('sectorAssignEnabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [nfToCarolEnabled, setNfToCarolEnabledState] = useState<boolean>(false);
  const [nfBoletoToCarolEnabled, setNfBoletoToCarolEnabledState] = useState<boolean>(false);

  const handleSetSectorAssignEnabled = useCallback((enabled: boolean) => {
    setSectorAssignEnabled(enabled);
    localStorage.setItem('sectorAssignEnabled', String(enabled));
  }, []);

  // Monitorar configurações globais em tempo real no Firestore (app_settings)
  useEffect(() => {
    if (isLoginRoute) return;

    const settingsRef = doc(db, 'app_settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.nfToCarolEnabled !== 'undefined') {
          setNfToCarolEnabledState(data.nfToCarolEnabled);
        }
        if (typeof data.nfBoletoToCarolEnabled !== 'undefined') {
          setNfBoletoToCarolEnabledState(data.nfBoletoToCarolEnabled);
        }
      }
    });

    return () => unsubscribe();
  }, [isLoginRoute]);

  const persistSetting = useCallback(async (key: string, value: boolean) => {
    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(
      settingsRef,
      { [key]: value, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }, []);

  const handleSetNfToCarolEnabled = useCallback(
    (enabled: boolean) => {
      setNfToCarolEnabledState(enabled);
      persistSetting('nfToCarolEnabled', enabled);
    },
    [persistSetting]
  );

  const handleSetNfBoletoToCarolEnabled = useCallback(
    (enabled: boolean) => {
      setNfBoletoToCarolEnabledState(enabled);
      persistSetting('nfBoletoToCarolEnabled', enabled);
    },
    [persistSetting]
  );

  // Hooks do Firebase
  const firebaseUsers = useFirebaseUsers();
  const users = firebaseUsers.users;

  const usersForAutoAssign = users.map((u) => ({ id: u.id, role: u.role, sectors: u.sectors }));
  const firebaseTasks = useFirebaseTasks(usersForAutoAssign, !isLoginRoute);
  const tasks = firebaseTasks.tasks;

  const firebaseCalendar = useFirebaseCalendar(!isLoginRoute);
  const calendarEvents = firebaseCalendar.events;

  const firebaseNotifications = useFirebaseNotifications(!isLoginRoute);
  const notifications = firebaseNotifications.notifications;

  const prevNotifCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG2Mj5KNiYJ7dG59hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7'
    );
    audioRef.current = audio;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!currentUser || isLoginRoute) return;
    const userNotifs = notifications.filter((n) => n.userId === currentUser.id && !n.read);
    if (userNotifs.length > prevNotifCount.current) {
      playNotificationSound();
    }
    prevNotifCount.current = userNotifs.length;
  }, [notifications, currentUser, playNotificationSound, isLoginRoute]);

  // Sincronizar currentUser quando a lista de usuários atualizar
  useEffect(() => {
    if (!currentUser) return;
    const updated = users.find((u) => u.id === currentUser.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
      setCurrentUser(updated);
      saveSession(updated);
    }
  }, [users, currentUser]);

  const login = useCallback(
    (username: string, password: string) => {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedPassword = password.trim();
      const user = users.find(
        (u) =>
          u.username.trim().toLowerCase() === normalizedUsername &&
          (u.password === password || u.password === normalizedPassword)
      );
      if (user) {
        setCurrentUser(user);
        saveSession(user);
        return true;
      }
      return false;
    },
    [users]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    clearSession();
  }, []);

  const addUser = useCallback(
    (user: Omit<User, 'id'>) => {
      firebaseUsers.addUser(user);
    },
    [firebaseUsers]
  );

  const updateUser = useCallback(
    (
      userId: string,
      updates: Partial<Pick<User, 'name' | 'username' | 'password' | 'sectors' | 'function'>>
    ) => {
      firebaseUsers.updateUser(userId, updates);
    },
    [firebaseUsers]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      firebaseUsers.deleteUser(userId);
    },
    [firebaseUsers]
  );

  const updateProfile = useCallback(
    (updates: { avatar?: string; backgroundColor?: string }) => {
      if (!currentUser) return;
      firebaseUsers.updateProfile(currentUser.id, updates);
    },
    [currentUser, firebaseUsers]
  );

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
      firebaseTasks.addTask(task);
      if (task.assigneeId) {
        firebaseNotifications.addNotification(
          task.assigneeId,
          `Nova tarefa atribuída: ${task.title}`,
          'task_created'
        );
        sendPushToUser(task.assigneeId, 'Nova tarefa', task.title);
      }
    },
    [firebaseTasks, firebaseNotifications]
  );

  const updateTask = useCallback(
    (
      taskId: string,
      updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
    ) => {
      firebaseTasks.updateTask(taskId, updates);
    },
    [firebaseTasks]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      firebaseTasks.deleteTask(taskId);
    },
    [firebaseTasks]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      firebaseTasks.updateTaskStatus(taskId, status);
    },
    [firebaseTasks]
  );

  const updateTaskPriority = useCallback(
    (taskId: string, priority: Priority) => {
      firebaseTasks.updateTaskPriority(taskId, priority);
    },
    [firebaseTasks]
  );

  const claimSectorTask = useCallback(
    (taskId: string) => {
      if (!currentUser) return;
      firebaseTasks.claimSectorTask(taskId, currentUser.id);
    },
    [currentUser, firebaseTasks]
  );

  const sendMessage = useCallback(
    (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const newMsg: ChatMessage = {
        ...msg,
        id: `msg-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      if (msg.receiverId) {
        firebaseNotifications.addNotification(
          msg.receiverId,
          'Nova mensagem recebida',
          'new_message'
        );
      }
    },
    [firebaseNotifications]
  );

  const editMessage = useCallback((msgId: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, content: newContent, edited: true } : m))
    );
  }, []);

  const deleteMessage = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, deleted: true, content: 'Mensagem apagada' } : m))
    );
  }, []);

  const markNotificationRead = useCallback(
    (id: string) => {
      firebaseNotifications.markRead(id);
    },
    [firebaseNotifications]
  );

  const getTasksForUser = useCallback(
    (userId: string) => tasks.filter((t) => t.assigneeId === userId),
    [tasks]
  );
  const getSectorTasks = useCallback(
    (sector: Sector) => tasks.filter((t) => t.sector === sector && !t.assigneeId),
    [tasks]
  );

  const getMessagesForChat = useCallback(
    (userId1: string, userId2: string) => {
      return messages
        .filter(
          (m) =>
            !m.taskId &&
            !m.groupId &&
            ((m.senderId === userId1 && m.receiverId === userId2) ||
              (m.senderId === userId2 && m.receiverId === userId1))
        )
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    [messages]
  );

  const getTaskMessages = useCallback(
    (taskId: string) => {
      return messages
        .filter((m) => m.taskId === taskId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    [messages]
  );

  const getGroupMessages = useCallback(
    (groupId: string) => {
      return messages
        .filter((m) => m.groupId === groupId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    [messages]
  );

  const addCalendarEvent = useCallback(
    (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
      firebaseCalendar.addEvent(event);
    },
    [firebaseCalendar]
  );

  const updateCalendarEvent = useCallback(
    (eventId: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt' | 'createdBy'>>) => {
      firebaseCalendar.updateEvent(eventId, updates);
    },
    [firebaseCalendar]
  );

  const deleteCalendarEvent = useCallback(
    (eventId: string) => {
      firebaseCalendar.deleteEvent(eventId);
    },
    [firebaseCalendar]
  );

  const getEventsForUser = useCallback(
    (userId: string) => {
      return firebaseCalendar.getEventsForUser(userId);
    },
    [firebaseCalendar]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        usersLoading: firebaseUsers.loading,
        usersError: firebaseUsers.error,
        tasks,
        messages,
        notifications,
        calendarEvents,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        addTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        updateTaskPriority,
        claimSectorTask,
        sendMessage,
        editMessage,
        deleteMessage,
        markNotificationRead,
        getTasksForUser,
        getSectorTasks,
        getMessagesForChat,
        getTaskMessages,
        getGroupMessages,
        addCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        getEventsForUser,
        playNotificationSound,
        updateProfile,
        sectorAssignEnabled,
        setSectorAssignEnabled: handleSetSectorAssignEnabled,
        nfToCarolEnabled,
        setNfToCarolEnabled: handleSetNfToCarolEnabled,
        nfBoletoToCarolEnabled,
        setNfBoletoToCarolEnabled: handleSetNfBoletoToCarolEnabled,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};