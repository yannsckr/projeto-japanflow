import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { useChatPreferences } from '@/hooks/useChatPreferences';

interface MessageData {
  senderId: string;
  receiverId: string;
  read?: boolean;
  deleted?: boolean;
}

export function useUnreadMessages(currentUserIdOrUsername: string | null) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const previousUnreadIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const mutedPartnerIdsRef = useRef<Set<string>>(new Set());

  const { mutedPartnerIds } = useChatPreferences(resolvedUserId);

  useEffect(() => {
    mutedPartnerIdsRef.current = mutedPartnerIds;
  }, [mutedPartnerIds]);

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

  // Compatibilidade: algumas telas antigas ainda podem passar username; as novas passam id.
  useEffect(() => {
    if (!currentUserIdOrUsername) {
      setResolvedUserId(null);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
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
      previousUnreadIdsRef.current = new Set();
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
        const unread = snapshot.docs
          .map((messageDoc) => ({
            id: messageDoc.id,
            ...(messageDoc.data() as MessageData),
          }))
          .filter((message) => message.read !== true && message.deleted !== true);

        const unreadIds = new Set(unread.map((message) => message.id));

        if (initializedRef.current && audioRef.current) {
          const newlyUnread = unread.filter(
            (message) => !previousUnreadIdsRef.current.has(message.id)
          );

          const hasAudibleMessage = newlyUnread.some(
            (message) => !mutedPartnerIdsRef.current.has(String(message.senderId || ''))
          );

          if (hasAudibleMessage) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => undefined);
          }
        }

        initializedRef.current = true;
        previousUnreadIdsRef.current = unreadIds;
        setTotalUnread(unread.length);
      },
      (error) => {
        console.error('Erro ao acompanhar mensagens não lidas:', error);
      }
    );

    return () => {
      unsubscribe();
      initializedRef.current = false;
      previousUnreadIdsRef.current = new Set();
    };
  }, [resolvedUserId]);

  return { totalUnread };
}
