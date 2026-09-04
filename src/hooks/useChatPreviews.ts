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

  const [usersMap, setUsersMap] = useState<{
    idToUsername: Map<string, string>;
    usernameToId: Map<string, string>;
  }>({
    idToUsername: new Map(),
    usernameToId: new Map(),
  });

  const [messagesSnapshot, setMessagesSnapshot] = useState<any[]>([]);
  const [readStatuses, setReadStatuses] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'app_users'),
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

        setUsersMap({
          idToUsername,
          usernameToId,
        });
      },
      (error) => {
        console.error('Erro ao carregar usuários para previews do chat:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeMessages = onSnapshot(
      collection(db, 'messages'),
      (snapshot) => {
        setMessagesSnapshot(
          snapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          }))
        );
      },
      (error) => {
        console.error('Erro ao carregar mensagens para previews:', error);
      }
    );

    const unsubscribeReadStatus = onSnapshot(
      collection(db, 'chat_read_status'),
      (snapshot) => {
        setReadStatuses(
          snapshot.docs.map((statusDoc) => ({
            id: statusDoc.id,
            ...statusDoc.data(),
          }))
        );
      },
      (error) => {
        console.error('Erro ao carregar status de leitura:', error);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeReadStatus();
    };
  }, []);

  const rebuildPreviews = useCallback(() => {
    if (!currentUsername) {
      setPreviews([]);
      return;
    }

    const currentUserId = usersMap.usernameToId.get(currentUsername) || null;

    const readMap = new Map<string, string>();

    for (const row of readStatuses) {
      if (row.username !== currentUsername) continue;

      const partnerUsername =
        row.partner_username ||
        (row.partnerId ? usersMap.idToUsername.get(row.partnerId) : undefined);

      if (!partnerUsername) continue;

      readMap.set(partnerUsername, toIso(row.last_read_at || row.lastReadAt));
    }

    const relevantMessages = messagesSnapshot
      .map((message) => {
        // Suporta tanto o schema antigo quanto o schema Firestore atual.
        const senderUsername =
          message.sender_username ||
          (message.senderId ? usersMap.idToUsername.get(message.senderId) : undefined);

        const receiverUsername =
          message.receiver_username ||
          (message.receiverId ? usersMap.idToUsername.get(message.receiverId) : undefined);

        const senderId = message.senderId || null;
        const receiverId = message.receiverId || null;

        const createdAt = toIso(message.created_at || message.timestamp || message.createdAt);

        return {
          ...message,
          senderUsername,
          receiverUsername,
          senderId,
          receiverId,
          createdAt,
          content: String(message.content || ''),
          deleted: message.deleted === true,
        };
      })
      .filter((message) => {
        const byUsername =
          message.senderUsername === currentUsername ||
          message.receiverUsername === currentUsername;

        const byId =
          !!currentUserId &&
          (message.senderId === currentUserId || message.receiverId === currentUserId);

        return byUsername || byId;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const chatMap = new Map<
      string,
      {
        lastMsg: any;
        unread: number;
      }
    >();

    for (const message of relevantMessages) {
      const partnerUsername =
        message.senderUsername === currentUsername
          ? message.receiverUsername
          : message.senderUsername;

      if (!partnerUsername) continue;

      if (!chatMap.has(partnerUsername)) {
        chatMap.set(partnerUsername, {
          lastMsg: message,
          unread: 0,
        });
      }

      const isFromPartner = message.senderUsername !== currentUsername;

      if (isFromPartner && !message.deleted) {
        const lastRead = readMap.get(partnerUsername);

        if (!lastRead || new Date(message.createdAt) > new Date(lastRead)) {
          chatMap.get(partnerUsername)!.unread += 1;
        }
      }
    }

    const result: ChatPreview[] = [];

    chatMap.forEach((value, partnerUsername) => {
      result.push({
        partnerUsername,
        lastMessageAt: value.lastMsg.createdAt,
        lastMessageContent: value.lastMsg.deleted ? 'Mensagem apagada' : value.lastMsg.content,
        unreadCount: value.unread,
      });
    });

    result.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    setPreviews(result);
  }, [currentUsername, messagesSnapshot, readStatuses, usersMap]);

  useEffect(() => {
    rebuildPreviews();
  }, [rebuildPreviews]);

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

  return {
    previews,
    markAsRead,
  };
}
