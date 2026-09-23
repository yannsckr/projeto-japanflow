import { useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import { sendPushToUser } from './usePushNotifications';

interface MessageData {
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Timestamp;
  read: boolean;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | 'audio' | null;
  attachmentName?: string | null;
  edited?: boolean;
  deleted?: boolean;
}

interface SendMessageInput {
  content: string;
  receiverId: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
}

export const useChat = () => {
  const { currentUser } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(
    async (msg: SendMessageInput) => {
      if (!currentUser?.id) return;

      const newMessage: MessageData = {
        content: msg.content,
        senderId: currentUser.id,
        receiverId: msg.receiverId,
        timestamp: Timestamp.now(),
        read: false,
        attachmentUrl: msg.attachmentUrl ?? null,
        attachmentType: msg.attachmentType ?? null,
        attachmentName: msg.attachmentName ?? null,
        edited: false,
        deleted: false,
      };

      try {
        await addDoc(collection(db, 'messages'), newMessage);

        const preferenceId = `${msg.receiverId}__${currentUser.id}`;
        const preferenceSnapshot = await getDoc(doc(db, 'chat_preferences', preferenceId)).catch(
          () => null
        );
        const mutedByReceiver = preferenceSnapshot?.data()?.muted === true;

        if (!mutedByReceiver) {
          await addDoc(collection(db, 'notifications'), {
            user_id: msg.receiverId,
            message: `Nova mensagem recebida de ${currentUser.name || currentUser.username}`,
            type: 'chat_message',
            read: false,
            created_at: Timestamp.now(),
          });

          try {
            await sendPushToUser(msg.receiverId, 'Nova mensagem', msg.content, '/chat');
          } catch (pushError) {
            console.warn('Mensagem enviada, mas o push falhou:', pushError);
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },
    [currentUser?.id, currentUser?.name, currentUser?.username]
  );

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        content: newContent,
        edited: true,
      });
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        deleted: true,
        content: 'Mensagem apagada',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), { read: true });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  const getMessagesForChat = useCallback((currentUserId: string, otherUserId: string) => {
    // Escuta a coleção em tempo real e filtra o par no cliente.
    // Isso evita dependência de índice composto e mantém mensagens novas instantâneas.
    const chatQuery = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));

    return onSnapshot(
      chatQuery,
      (snapshot) => {
        const chatMessages: ChatMessage[] = [];
        const unreadIncomingIds: string[] = [];

        snapshot.forEach((messageDoc) => {
          const data = messageDoc.data() as MessageData;

          const belongsToChat =
            (data.senderId === currentUserId && data.receiverId === otherUserId) ||
            (data.senderId === otherUserId && data.receiverId === currentUserId);

          if (!belongsToChat) return;

          chatMessages.push({
            id: messageDoc.id,
            content: data.content,
            senderId: data.senderId,
            receiverId: data.receiverId,
            timestamp: data.timestamp?.toDate
              ? data.timestamp.toDate().toISOString()
              : new Date().toISOString(),
            attachmentUrl: data.attachmentUrl ?? undefined,
            attachmentType: data.attachmentType ?? undefined,
            attachmentName: data.attachmentName ?? undefined,
            edited: data.edited ?? false,
            deleted: data.deleted ?? false,
            read: data.read === true,
          });

          if (
            data.receiverId === currentUserId &&
            data.senderId === otherUserId &&
            data.read !== true &&
            data.deleted !== true
          ) {
            unreadIncomingIds.push(messageDoc.id);
          }
        });

        setMessages(chatMessages);

        // Ao visualizar a conversa, sincroniza o campo read usado pelo badge global.
        for (const messageId of unreadIncomingIds) {
          void updateDoc(doc(db, 'messages', messageId), { read: true }).catch((error) =>
            console.warn('Falha ao marcar mensagem como lida:', error)
          );
        }
      },
      (error) => {
        console.error('Error loading chat messages:', error);
      }
    );
  }, []);

  return {
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    markMessageAsRead,
    getMessagesForChat,
  };
};
