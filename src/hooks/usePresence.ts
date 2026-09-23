import { useEffect, useRef, useCallback, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

export type PresenceStatus = 'online' | 'offline' | 'paused';

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  pause_type: string | null;
  pause_started_at: Date | null;
  last_seen_at: Date;
}

interface FirestorePresenceData {
  user_id?: string;
  status?: PresenceStatus;
  pause_type?: string | null;
  pause_started_at?: Date | Timestamp | null;
  last_seen_at?: Date | Timestamp | null;
}

const onlineUsers = new Map<string, UserPresence>();

const updateOnlineUser = (user: UserPresence) => {
  onlineUsers.set(user.user_id, user);
};

const toDate = (value: Date | Timestamp | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  return null;
};

export const usePresence = (userId: string | null) => {
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const stateRef = useRef<{
    status: PresenceStatus;
    pauseType: string | null;
    pauseStartedAt: Date | null;
  }>({
    status: 'online',
    pauseType: null,
    pauseStartedAt: null,
  });

  const currentUserId = userId;

  useEffect(() => {
    if (!currentUserId) return;

    const userPresenceDocRef = doc(db, 'presence', currentUserId);

    const updateFirestorePresence = async () => {
      const now = new Date();
      const presenceData: UserPresence = {
        user_id: currentUserId,
        status: stateRef.current.status,
        pause_type: stateRef.current.pauseType,
        pause_started_at: stateRef.current.pauseStartedAt,
        last_seen_at: now,
      };

      await setDoc(userPresenceDocRef, presenceData, { merge: true });
      updateOnlineUser(presenceData);
    };

    void updateFirestorePresence();

    const interval = window.setInterval(() => {
      void updateFirestorePresence();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Atualiza o heartbeat sem sobrescrever um estado ativo, como "paused".
        void updateFirestorePresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => {
      const offlineData = {
        status: 'offline' as PresenceStatus,
        last_seen_at: new Date(),
      };

      void updateDoc(userPresenceDocRef, offlineData);

      const existing = onlineUsers.get(currentUserId);
      if (existing) {
        onlineUsers.set(currentUserId, {
          ...existing,
          ...offlineData,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      void updateDoc(userPresenceDocRef, {
        status: 'offline',
        last_seen_at: new Date(),
      });

      onlineUsers.delete(currentUserId);
    };
  }, [currentUserId]);

  useEffect(() => {
    const presenceCollection = collection(db, 'presence');

    const unsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const currentPresences: UserPresence[] = [];

      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data() as FirestorePresenceData;

        currentPresences.push({
          user_id: data.user_id ?? snapshotDoc.id,
          status: data.status ?? 'offline',
          pause_type: data.pause_type ?? null,
          pause_started_at: toDate(data.pause_started_at),
          last_seen_at: toDate(data.last_seen_at) ?? new Date(),
        });
      });

      setPresences(currentPresences);
      currentPresences.forEach(updateOnlineUser);
    });

    return () => unsubscribe();
  }, []);

  const updatePresenceStatus = useCallback(
    async (status: PresenceStatus, pauseType?: string | null) => {
      if (!currentUserId) return;

      const now = new Date();
      const pauseStartedAt = status === 'paused' ? now : null;

      stateRef.current = {
        status,
        pauseType: pauseType ?? null,
        pauseStartedAt,
      };

      const userPresenceDocRef = doc(db, 'presence', currentUserId);

      await setDoc(
        userPresenceDocRef,
        {
          user_id: currentUserId,
          status,
          pause_type: pauseType ?? null,
          pause_started_at: pauseStartedAt,
          last_seen_at: now,
        },
        { merge: true }
      );

      const existing = onlineUsers.get(currentUserId);

      updateOnlineUser({
        ...(existing ?? {
          user_id: currentUserId,
          status,
          pause_type: pauseType ?? null,
          pause_started_at: pauseStartedAt,
          last_seen_at: now,
        }),
        user_id: currentUserId,
        status,
        pause_type: pauseType ?? null,
        pause_started_at: pauseStartedAt,
        last_seen_at: now,
      });
    },
    [currentUserId]
  );

  const startSession = useCallback(async () => {
    if (!currentUserId) return;

    const now = new Date();
    const sessionsCollection = collection(db, 'presence_sessions');

    const openSessionsQuery = query(
      sessionsCollection,
      where('user_id', '==', currentUserId),
      where('ended_at', '==', null)
    );

    const openSessionsSnapshot = await getDocs(openSessionsQuery);

    for (const sessionDoc of openSessionsSnapshot.docs) {
      const sessionData = sessionDoc.data();
      const startedAt = toDate(sessionData.started_at as Date | Timestamp | null);

      if (!startedAt) continue;

      const duration = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      await updateDoc(sessionDoc.ref, {
        ended_at: now,
        duration_seconds: duration,
      });
    }

    await addDoc(sessionsCollection, {
      user_id: currentUserId,
      status: 'online',
      started_at: now,
      ended_at: null,
    });
  }, [currentUserId]);

  const endSession = useCallback(async () => {
    if (!currentUserId) return;

    const now = new Date();
    const sessionsCollection = collection(db, 'presence_sessions');

    const sessionsQuery = query(
      sessionsCollection,
      where('user_id', '==', currentUserId),
      where('status', '==', 'online'),
      where('ended_at', '==', null)
    );

    const querySnapshot = await getDocs(sessionsQuery);
    if (querySnapshot.empty) return;

    const latestSessionDoc = querySnapshot.docs[0];
    const sessionData = latestSessionDoc.data();
    const startedAt = toDate(sessionData.started_at as Date | Timestamp | null);

    if (!startedAt) return;

    const duration = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    await updateDoc(latestSessionDoc.ref, {
      ended_at: now,
      duration_seconds: duration,
    });
  }, [currentUserId]);

  return {
    presences,
    updatePresenceStatus,
    startSession,
    endSession,
  };
};

export const useAllPresences = () => {
  const [presences, setPresences] = useState<UserPresence[]>([]);

  useEffect(() => {
    const presenceCollection = collection(db, 'presence');

    const unsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const allPresences: UserPresence[] = [];

      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data() as FirestorePresenceData;

        allPresences.push({
          user_id: data.user_id ?? snapshotDoc.id,
          status: data.status ?? 'offline',
          pause_type: data.pause_type ?? null,
          pause_started_at: toDate(data.pause_started_at),
          last_seen_at: toDate(data.last_seen_at) ?? new Date(),
        });
      });

      setPresences(allPresences);
    });

    return () => unsubscribe();
  }, []);

  const getStatus = (userId: string): PresenceStatus => {
    const presence = presences.find((item) => item.user_id === userId);
    return presence?.status ?? 'offline';
  };

  const getPauseInfo = (userId: string) => {
    const presence = presences.find((item) => item.user_id === userId);

    return presence
      ? {
          pauseType: presence.pause_type,
          pauseStartedAt: presence.pause_started_at,
        }
      : null;
  };

  return {
    presences,
    getStatus,
    getPauseInfo,
  };
};
