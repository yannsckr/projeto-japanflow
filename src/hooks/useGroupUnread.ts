import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';

interface GroupMessageRow {
  id: string;
  groupId: string;
  senderUsername: string;
  createdAt: string;
  deleted: boolean;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useGroupUnread(
  currentUserId: string | null | undefined,
  currentUsername: string | null | undefined,
  accessibleGroupIds: string[]
) {
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [readStatuses, setReadStatuses] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'group_messages'),
      (snapshot) => {
        setMessages(
          snapshot.docs.map((messageDoc) => {
            const data = messageDoc.data();

            return {
              id: messageDoc.id,
              groupId: String(data.group_id || ''),
              senderUsername: String(data.sender_username || ''),
              createdAt: toIso(data.created_at),
              deleted: data.deleted === true,
            };
          })
        );
      },
      (error) => console.error('Erro ao acompanhar não lidas dos grupos:', error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'chat_read_status'),
      (snapshot) => {
        setReadStatuses(
          snapshot.docs.map((statusDoc) => ({
            id: statusDoc.id,
            ...statusDoc.data(),
          }))
        );
      },
      (error) => console.error('Erro ao acompanhar leitura dos grupos:', error)
    );

    return () => unsubscribe();
  }, []);

  const unreadByGroup = useMemo(() => {
    const result: Record<string, number> = {};

    if (!currentUserId || !currentUsername) return result;

    const groupIdSet = new Set(accessibleGroupIds);

    const lastReadByGroup = new Map<string, string>();
    for (const row of readStatuses) {
      if (row.user_id !== currentUserId) continue;
      if (!row.group_id) continue;
      lastReadByGroup.set(String(row.group_id), toIso(row.last_read_at));
    }

    for (const message of messages) {
      if (!groupIdSet.has(message.groupId)) continue;
      if (message.deleted) continue;
      if (message.senderUsername === currentUsername) continue;

      const lastRead = lastReadByGroup.get(message.groupId);

      if (
        !lastRead ||
        new Date(message.createdAt || 0).getTime() > new Date(lastRead || 0).getTime()
      ) {
        result[message.groupId] = (result[message.groupId] || 0) + 1;
      }
    }

    return result;
  }, [accessibleGroupIds, currentUserId, currentUsername, messages, readStatuses]);

  const totalUnread = useMemo(
    () => Object.values(unreadByGroup).reduce((sum, count) => sum + count, 0),
    [unreadByGroup]
  );

  const markGroupAsRead = useCallback(
    async (groupId: string) => {
      if (!currentUserId || !currentUsername || !groupId) return;

      const statusId = `${currentUserId}__group__${groupId}`;

      await setDoc(
        doc(db, 'chat_read_status', statusId),
        {
          user_id: currentUserId,
          username: currentUsername,
          group_id: groupId,
          last_read_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
    },
    [currentUserId, currentUsername]
  );

  return { unreadByGroup, totalUnread, markGroupAsRead };
}
