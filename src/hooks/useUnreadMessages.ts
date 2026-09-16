import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

interface MessageData {
  senderId: string;
  receiverId: string;
  read?: boolean;
  deleted?: boolean;
}

export function useUnreadMessages(currentUserIdOrUsername: string | null) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const previousCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG2Mj5KNiYJ7dG59hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7'
    );
    audio.volume = 0.6;
    audioRef.current = audio;

    return () => {
      audioRef.current = null;
    };
  }, []);

  // Compatibilidade: algumas telas antigas passavam username; as novas podem passar id.
  useEffect(() => {
    if (!currentUserIdOrUsername) {
      setResolvedUserId(null);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'app_users'),
      (snapshot) => {
        const direct = snapshot.docs.find((userDoc) => userDoc.id === currentUserIdOrUsername);

        if (direct) {
          setResolvedUserId(direct.id);
          return;
        }

        const byUsername = snapshot.docs.find(
          (userDoc) => String(userDoc.data().username || '').trim() === currentUserIdOrUsername
        );

        setResolvedUserId(byUsername?.id || currentUserIdOrUsername);
      },
      (error) => {
        console.warn('Falha ao resolver usuário do contador de chat:', error);
        setResolvedUserId(currentUserIdOrUsername);
      }
    );

    return () => unsubscribe();
  }, [currentUserIdOrUsername]);

  useEffect(() => {
    if (!resolvedUserId) {
      setTotalUnread(0);
      previousCountRef.current = 0;
      initializedRef.current = false;
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', resolvedUserId)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        let unreadCount = 0;

        snapshot.forEach((messageDoc) => {
          const message = messageDoc.data() as MessageData;
          if (message.read !== true && message.deleted !== true) unreadCount += 1;
        });

        if (initializedRef.current && unreadCount > previousCountRef.current && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }

        initializedRef.current = true;
        previousCountRef.current = unreadCount;
        setTotalUnread(unreadCount);
      },
      (error) => {
        console.error('Erro ao acompanhar mensagens não lidas:', error);
      }
    );

    return () => {
      unsubscribe();
      initializedRef.current = false;
      previousCountRef.current = 0;
    };
  }, [resolvedUserId]);

  return { totalUnread };
}
