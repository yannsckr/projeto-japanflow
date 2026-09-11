import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { sendPushToUser } from './usePushNotifications';

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_username: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  edited: boolean;
  deleted: boolean;
  created_at: string;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

const mapMessage = (id: string, data: any): GroupMessage => ({
  id,
  group_id: data.group_id || '',
  sender_username: data.sender_username || '',
  content: data.content || '',
  attachment_url: data.attachment_url || null,
  attachment_type: data.attachment_type || null,
  attachment_name: data.attachment_name || null,
  edited: data.edited === true,
  deleted: data.deleted === true,
  created_at: toIso(data.created_at),
});

export function useGroupChat(groupId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'group_messages'),
      where('group_id', '==', groupId),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) =>
        setMessages(
          snapshot.docs.map((messageDoc) => mapMessage(messageDoc.id, messageDoc.data()))
        ),
      (error) => console.error('Erro ao carregar mensagens do grupo:', error)
    );

    return () => unsubscribe();
  }, [groupId]);

  const sendMessage = useCallback(
    async (
      senderUsername: string,
      msg: {
        content: string;
        attachmentUrl?: string;
        attachmentType?: string;
        attachmentName?: string;
      }
    ) => {
      if (!groupId) return;

      await addDoc(collection(db, 'group_messages'), {
        group_id: groupId,
        sender_username: senderUsername,
        content: msg.content,
        attachment_url: msg.attachmentUrl || null,
        attachment_type: msg.attachmentType || null,
        attachment_name: msg.attachmentName || null,
        edited: false,
        deleted: false,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      try {
        const groupSnapshot = await getDoc(doc(db, 'custom_groups', groupId));
        if (!groupSnapshot.exists()) return;

        const participants = Array.isArray(groupSnapshot.data().participants)
          ? groupSnapshot.data().participants
          : [];
        if (participants.length === 0) return;

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const matchingUsers = usersSnapshot.docs
          .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
          .filter(
            (user: any) => participants.includes(user.id) || participants.includes(user.username)
          );

        for (const user of matchingUsers as any[]) {
          if (user.username === senderUsername || user.active === false) continue;
          sendPushToUser(
            user.id,
            'Nova mensagem de grupo',
            `${senderUsername}: ${msg.content.substring(0, 100)}`
          );
        }
      } catch (error) {
        console.warn('Falha ao enviar push do grupo:', error);
      }
    },
    [groupId]
  );

  const editMessage = useCallback(async (msgId: string, newContent: string) => {
    await updateDoc(doc(db, 'group_messages', msgId), {
      content: newContent,
      edited: true,
      updated_at: Timestamp.now(),
    });
  }, []);

  const deleteMessage = useCallback(async (msgId: string) => {
    await updateDoc(doc(db, 'group_messages', msgId), {
      deleted: true,
      content: 'Mensagem apagada',
      updated_at: Timestamp.now(),
    });
  }, []);

  return { messages, sendMessage, editMessage, deleteMessage };
}
