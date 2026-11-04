import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
const DISCOVERY_BATCH = 8;

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

export function useChatPreviews(
  currentUsername: string | null,
  directory?: Array<{ id: string; username: string }>
) {
  const [previews, setPreviews] = useState<ChatPreview[]>([]);
  const [usersMap, setUsersMap] = useState({
    idToUsername: new Map<string, string>(),
    usernameToId: new Map<string, string>(),
  });
  const [messagesSnapshot, setMessagesSnapshot] = useState<any[]>([]);
  // Conversas fora da janela recente são consultadas apenas quando solicitado.
  // A descoberta é limitada a 8 contatos por ação, duas leituras limit(1) por contato.
  const [olderMessages, setOlderMessages] = useState<any[]>([]);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderHasMore, setOlderHasMore] = useState(true);
  const discoveryCursor = useRef(0);
  const discoveryBusy = useRef(false);
  const discoveryGeneration = useRef(0);
  const userId = currentUsername ? usersMap.usernameToId.get(currentUsername) || null : null;
  const partnerIds = Array.from(usersMap.idToUsername.keys()).filter((id) => id !== userId);
  const allMessages = useMemo(
    () => [...messagesSnapshot, ...olderMessages],
    [messagesSnapshot, olderMessages]
  );
  const { privateByPartner, refresh: refreshCounts } = useChatUnreadCounts(userId, partnerIds);

  useEffect(() => {
    if (directory) {
      const idToUsername = new Map<string, string>();
      const usernameToId = new Map<string, string>();
      directory.forEach((user) => {
        const name = user.username?.trim();
        if (!name) return;
        idToUsername.set(user.id, name);
        usernameToId.set(name, user.id);
      });
      setUsersMap({ idToUsername, usernameToId });
      return;
    }
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
  }, [directory]);

  useEffect(() => {
    discoveryGeneration.current += 1;
    discoveryCursor.current = 0;
    discoveryBusy.current = false;
    setOlderMessages([]);
    setOlderHasMore(true);
    setOlderLoading(false);
  }, [userId, usersMap]);

  useEffect(() => {
    const userId = currentUsername ? usersMap.usernameToId.get(currentUsername) : null;

    if (!userId) {
      setMessagesSnapshot([]);
      return;
    }

    // Busca mensagens recentes nos dois sentidos. O limite anterior sem
    // orderBy podia retornar mensagens antigas em vez das mais recentes.
    // Os contadores refletem a janela carregada, não todo o histórico.
    const sentQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const receivedQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    let sent: any[] = [];
    let received: any[] = [];
    const publish = () => {
      const merged = new Map<string, any>();
      for (const message of [...sent, ...received]) merged.set(message.id, message);
      setMessagesSnapshot([...merged.values()]);
    };
    const handleError = (error: Error) => {
      console.error('Erro ao carregar mensagens para previews:', error);
    };
    const unsubSent = onSnapshot(
      sentQuery,
      (snapshot) => {
        sent = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        publish();
      },
      handleError
    );
    const unsubReceived = onSnapshot(
      receivedQuery,
      (snapshot) => {
        received = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        publish();
      },
      handleError
    );
    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [currentUsername, usersMap]);

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

    const rows = allMessages
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

    const chatMap = new Map<string, { lastMsg: any }>();

    for (const message of rows) {
      const partnerId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      const partnerUsername = usersMap.idToUsername.get(partnerId);
      if (!partnerUsername) continue;

      if (!chatMap.has(partnerUsername)) {
        chatMap.set(partnerUsername, { lastMsg: message });
      }
    }

    const result = Array.from(chatMap.entries()).map(([partnerUsername, value]): ChatPreview => ({
      partnerUsername,
      lastMessageAt: value.lastMsg.createdAt,
      lastMessageContent: value.lastMsg.deleted ? 'Mensagem apagada' : value.lastMsg.content,
      unreadCount: privateByPartner[usersMap.usernameToId.get(partnerUsername) || ''] ?? 0,
    }));

    result.sort(
      (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );

    setPreviews(result);
  }, [currentUsername, allMessages, usersMap, privateByPartner]);

  useEffect(() => rebuildPreviews(), [rebuildPreviews]);

  const findOlderConversations = useCallback(async () => {
    if (!userId || discoveryBusy.current || !olderHasMore) return;
    discoveryBusy.current = true;
    setOlderLoading(true);
    const generation = discoveryGeneration.current;
    const allPartners = Array.from(usersMap.idToUsername.keys()).filter((id) => id !== userId);
    const start = discoveryCursor.current;
    const batch = allPartners.slice(start, start + DISCOVERY_BATCH);
    try {
      const discovered = await Promise.all(
        batch.map(async (partnerId) => {
          const direction = (senderId: string, receiverId: string) =>
            getDocs(
              query(
                collection(db, 'messages'),
                where('senderId', '==', senderId),
                where('receiverId', '==', receiverId),
                orderBy('timestamp', 'desc'),
                limit(1)
              )
            );
          const [sent, received] = await Promise.all([
            direction(userId, partnerId),
            direction(partnerId, userId),
          ]);
          return [...sent.docs, ...received.docs].map((entry) => ({
            id: entry.id,
            ...entry.data(),
          }));
        })
      );
      // Descarta resultados que chegaram após troca de sessão/diretório.
      if (discoveryGeneration.current !== generation) return;
      discoveryCursor.current = start + batch.length;
      setOlderHasMore(discoveryCursor.current < allPartners.length);
      setOlderMessages((previous) => {
        const merged = new Map(previous.map((message) => [message.id, message]));
        for (const message of discovered.flat()) merged.set(message.id, message);
        return [...merged.values()];
      });
    } catch (error) {
      // Não avança o cursor: a ação poderá ser repetida sem perder contatos.
      console.error('Falha ao procurar conversas antigas:', error);
      throw error;
    } finally {
      if (discoveryGeneration.current === generation) {
        discoveryBusy.current = false;
        setOlderLoading(false);
      }
    }
  }, [userId, usersMap, olderHasMore]);

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
      refreshCounts();
    },
    [currentUsername, usersMap, refreshCounts]
  );

  return { previews, markAsRead, findOlderConversations, olderLoading, olderHasMore };
}
