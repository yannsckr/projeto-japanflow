import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, where, Timestamp } from "firebase/firestore";
import { useApp } from "@/contexts/AppContext";
import { ChatMessage } from "@/types";
import { sendPushToUser } from "./usePushNotifications";

interface MessageData {
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Timestamp;
  read: boolean;
  edited?: boolean;
  deleted?: boolean;
}

export const useSupabaseChat = () => {
  const { currentUser } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc"),
      where("receiverId", "==", userId)
    );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as MessageData;
        fetchedMessages.push({
          id: doc.id,
          content: data.content,
          senderId: data.senderId,
          receiverId: data.receiverId,
          timestamp: data.timestamp.toDate().toISOString(),
          read: data.read,
          edited: data.edited,
          deleted: data.deleted,
        });
      });
      setMessages(fetchedMessages);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]);

  const sendMessage = useCallback(async (msg: Omit<ChatMessage, "id" | "timestamp" | "read">) => {
    if (!userId) return;
    const newMessage: MessageData = {
      ...msg,
      timestamp: Timestamp.fromDate(new Date()),
      read: false,
    };
    try {
      await addDoc(collection(db, "messages"), newMessage);
      if (msg.receiverId) {
        await sendPushToUser(msg.receiverId, "Nova mensagem", msg.content);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [userId]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { content: newContent, edited: true });
    } catch (error) {
      console.error("Error editing message:", error);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { deleted: true, content: "Mensagem apagada" });
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { read: true });
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }, []);

  const getMessagesForChat = useCallback((user1Id: string, user2Id: string) => {
    const chatQuery = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc"),
      where("senderId", "in", [user1Id, user2Id]),
      where("receiverId", "in", [user1Id, user2Id]),
    );
    return onSnapshot(chatQuery, (snapshot) => {
      const chatMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as MessageData;
        // Ensure that messages are strictly between user1Id and user2Id
        if (
          (data.senderId === user1Id && data.receiverId === user2Id) ||
          (data.senderId === user2Id && data.receiverId === user1Id)
        ) {
          chatMessages.push({
            id: doc.id,
            content: data.content,
            senderId: data.senderId,
            receiverId: data.receiverId,
            timestamp: data.timestamp.toDate().toISOString(),
            read: data.read,
            edited: data.edited,
            deleted: data.deleted,
          });
        }
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
