import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

interface MessageData {
  senderId: string;
  receiverId: string;
  read?: boolean;
  deleted?: boolean;
}

export function useUnreadMessages(currentUserId: string | null) {
  const [totalUnread, setTotalUnread] = useState(0);

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

  useEffect(() => {
    if (!currentUserId) {
      setTotalUnread(0);
      previousCountRef.current = 0;
      initializedRef.current = false;
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        let unreadCount = 0;

        snapshot.forEach((messageDoc) => {
          const message = messageDoc.data() as MessageData;

          if (message.read !== true && message.deleted !== true) {
            unreadCount++;
          }
        });

        // Não toca som no primeiro carregamento da página.
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
    };
  }, [currentUserId]);

  return { totalUnread };
}
