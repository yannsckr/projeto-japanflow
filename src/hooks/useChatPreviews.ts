import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';

export interface ChatPreview {
  partnerUsername: string;
  lastMessageAt: string;
  lastMessageContent: string;
  unreadCount: number;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useChatPreviews(currentUsername: string | null) {
  const [previews, setPreviews] = useState<ChatPreview[]>([]);
  const [usersMap, setUsersMap] = useState({
    idToUsername: new Map<string, string>(),
    usernameToId: new Map<string, string>(),
  });
  const [messagesSnapshot, setMessagesSnapshot] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const idToUsername = new Map<string, string>();
        const usernameToId = new Map<string, string>();

        snapshot.docs.forEach((userDoc) => {
          const data = userDoc.data();
          const username = String(data.username || '').trim();
          if (!username) return;
          idToUsername.set(userDoc.id, username);
          usernameToId.set(username, userDoc.id);
        });

        setUsersMap({ idToUsername, usernameToId });
      },
      (error) => console.error('Erro ao carregar usuários para previews do chat:', error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'messages'),
      (snapshot) =>
        setMessagesSnapshot(
          snapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          }))
        ),
      (error) => console.error('Erro ao carregar mensagens para previews:', error)
    );
  }, []);

  const rebuildPreviews = useCallback(() => {
    if (!currentUsername) {
      setPreviews([]);
      return;
    }

    const currentUserId = usersMap.usernameToId.get(currentUsername);
    if (!currentUserId) {
      setPreviews([]);
      return;
    }

    const rows = messagesSnapshot
      .map((message) => {
        const senderId = String(message.senderId || '');
        const receiverId = String(message.receiverId || '');
        const createdAt = toIso(message.timestamp || message.created_at || message.createdAt);

        return {
          ...message,
          senderId,
          receiverId,
          createdAt,
          deleted: message.deleted === true,
          read: message.read === true,
          content: String(message.content || ''),
        };
      })
      .filter(
        (message) => message.senderId === currentUserId || message.receiverId === currentUserId
      )
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const chatMap = new Map<string, { lastMsg: any; unread: number }>();

    for (const message of rows) {
      const partnerId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      const partnerUsername = usersMap.idToUsername.get(partnerId);
      if (!partnerUsername) continue;

      if (!chatMap.has(partnerUsername)) {
        chatMap.set(partnerUsername, { lastMsg: message, unread: 0 });
      }

      if (message.receiverId === currentUserId && !message.read && !message.deleted) {
        chatMap.get(partnerUsername)!.unread += 1;
      }
    }

    const result = Array.from(chatMap.entries()).map(([partnerUsername, value]): ChatPreview => ({
      partnerUsername,
      lastMessageAt: value.lastMsg.createdAt,
      lastMessageContent: value.lastMsg.deleted ? 'Mensagem apagada' : value.lastMsg.content,
      unreadCount: value.unread,
    }));

    result.sort(
      (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );

    setPreviews(result);
  }, [currentUsername, messagesSnapshot, usersMap]);

  useEffect(() => rebuildPreviews(), [rebuildPreviews]);

  const markAsRead = useCallback(
    async (partnerUsername: string) => {
      if (!currentUsername) return;

      const statusId = `${currentUsername}__${partnerUsername}`;
      await setDoc(
        doc(db, 'chat_read_status', statusId),
        {
          username: currentUsername,
          partner_username: partnerUsername,
          userId: usersMap.usernameToId.get(currentUsername) || null,
          partnerId: usersMap.usernameToId.get(partnerUsername) || null,
          last_read_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
    },
    [currentUsername, usersMap]
  );

  return { previews, markAsRead };
}
