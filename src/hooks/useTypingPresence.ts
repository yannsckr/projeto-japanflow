import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const TYPING_TTL_MS = 5_000;
const STOP_DELAY_MS = 2_200;

const timestampMs = (value: any): number => {
  if (!value) return 0;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export function usePrivateTyping(
  currentUserId: string | null | undefined,
  otherUserId: string | null | undefined
) {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const rowsRef = useRef<Array<{ id: string; data: any }>>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) {
      setIsOtherTyping(false);
      return;
    }

    const evaluate = () => {
      const now = Date.now();

      const otherRow = rowsRef.current.find(
        (row) =>
          row.id === otherUserId ||
          row.data?.user_id === otherUserId ||
          row.data?.userId === otherUserId
      );

      const fresh = !!otherRow && now - timestampMs(otherRow.data?.typing_at) < TYPING_TTL_MS;

      setIsOtherTyping(Boolean(otherRow?.data?.typing_to_user_id === currentUserId && fresh));
    };

    // Escuta a coleção inteira, igual ao indicador de grupos.
    // Isso evita depender de o documentId ser exatamente igual ao legacy user id.
    const unsubscribe = onSnapshot(
      collection(db, 'user_presence'),
      (snapshot) => {
        rowsRef.current = snapshot.docs.map((presenceDoc) => ({
          id: presenceDoc.id,
          data: presenceDoc.data(),
        }));
        evaluate();
      },
      (error) => console.warn('Falha ao acompanhar digitação privada:', error)
    );

    const interval = window.setInterval(evaluate, 500);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [currentUserId, otherUserId]);

  const setTyping = useCallback(
    async (active: boolean) => {
      if (!currentUserId) return;

      try {
        await setDoc(
          doc(db, 'user_presence', currentUserId),
          {
            user_id: currentUserId,
            typing_to_user_id: active ? (otherUserId ?? null) : null,
            typing_group_id: null,
            typing_at: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn('Falha ao atualizar indicador de digitação:', error);
      }
    },
    [currentUserId, otherUserId]
  );

  const pingTyping = useCallback(() => {
    void setTyping(true);

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      void setTyping(false);
    }, STOP_DELAY_MS);
  }, [setTyping]);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    void setTyping(false);
  }, [setTyping]);

  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      void setTyping(false);
    },
    [setTyping]
  );

  return { isOtherTyping, pingTyping, stopTyping };
}

export function useGroupTyping(
  currentUserId: string | null | undefined,
  groupId: string | null | undefined
) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const rowsRef = useRef<Array<{ id: string; data: any }>>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId || !groupId) {
      setTypingUserIds([]);
      return;
    }

    const evaluate = () => {
      const now = Date.now();
      setTypingUserIds(
        rowsRef.current
          .filter(
            (row) =>
              row.id !== currentUserId &&
              row.data?.typing_group_id === groupId &&
              now - timestampMs(row.data?.typing_at) < TYPING_TTL_MS
          )
          .map((row) => row.id)
      );
    };

    const unsubscribe = onSnapshot(
      collection(db, 'user_presence'),
      (snapshot) => {
        rowsRef.current = snapshot.docs.map((presenceDoc) => ({
          id: presenceDoc.id,
          data: presenceDoc.data(),
        }));
        evaluate();
      },
      (error) => console.warn('Falha ao acompanhar digitação do grupo:', error)
    );

    const interval = window.setInterval(evaluate, 1_000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [currentUserId, groupId]);

  const setTyping = useCallback(
    async (active: boolean) => {
      if (!currentUserId) return;

      try {
        await setDoc(
          doc(db, 'user_presence', currentUserId),
          {
            typing_to_user_id: null,
            typing_group_id: active ? (groupId ?? null) : null,
            typing_at: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn('Falha ao atualizar digitação do grupo:', error);
      }
    },
    [currentUserId, groupId]
  );

  const pingTyping = useCallback(() => {
    void setTyping(true);

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      void setTyping(false);
    }, STOP_DELAY_MS);
  }, [setTyping]);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    void setTyping(false);
  }, [setTyping]);

  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      void setTyping(false);
    },
    [setTyping]
  );

  return { typingUserIds, pingTyping, stopTyping };
}

export function usePrivateTypingUsers(currentUserId: string | null | undefined) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const rowsRef = useRef<Array<{ id: string; data: any }>>([]);

  useEffect(() => {
    if (!currentUserId) {
      setTypingUserIds([]);
      return;
    }

    const evaluate = () => {
      const now = Date.now();

      setTypingUserIds(
        rowsRef.current
          .filter(
            (row) =>
              row.data?.typing_to_user_id === currentUserId &&
              now - timestampMs(row.data?.typing_at) < TYPING_TTL_MS
          )
          .map((row) => row.id)
      );
    };

    const unsubscribe = onSnapshot(
      collection(db, 'user_presence'),
      (snapshot) => {
        rowsRef.current = snapshot.docs.map((presenceDoc) => ({
          id: presenceDoc.id,
          data: presenceDoc.data(),
        }));
        evaluate();
      },
      (error) => console.warn('Falha ao acompanhar digitação privada:', error)
    );

    const interval = window.setInterval(evaluate, 1_000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [currentUserId]);

  return typingUserIds;
}
