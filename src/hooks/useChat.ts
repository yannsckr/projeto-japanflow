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
  where,
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
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
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
        attachmentUrl: msg.attachmentUrl,
        attachmentType: msg.attachmentType,
        attachmentName: msg.attachmentName,
      };

      try {
        await addDoc(collection(db, 'messages'), newMessage);
        await sendPushToUser(msg.receiverId, 'Nova mensagem', msg.content);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },
    [currentUser?.id]
  );

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, { content: newContent, edited: true });
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, { deleted: true, content: 'Mensagem apagada' });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, { read: true });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  const getMessagesForChat = useCallback((user1Id: string, user2Id: string) => {
    const chatQuery = query(
      collection(db, 'messages'),
      where('senderId', 'in', [user1Id, user2Id]),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(chatQuery, (snapshot) => {
      const chatMessages: ChatMessage[] = [];

      snapshot.forEach((messageDoc) => {
        const data = messageDoc.data() as MessageData;

        const belongsToChat =
          (data.senderId === user1Id && data.receiverId === user2Id) ||
          (data.senderId === user2Id && data.receiverId === user1Id);

        if (!belongsToChat) return;

        chatMessages.push({
          id: messageDoc.id,
          content: data.content,
          senderId: data.senderId,
          receiverId: data.receiverId,
          timestamp: data.timestamp.toDate().toISOString(),
          attachmentUrl: data.attachmentUrl,
          attachmentType: data.attachmentType,
          attachmentName: data.attachmentName,
          edited: data.edited,
          deleted: data.deleted,
          read: data.read,
        });
      });

      setMessages(chatMessages);
    });
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
