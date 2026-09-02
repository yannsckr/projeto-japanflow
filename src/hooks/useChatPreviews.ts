import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatPreview {
  partnerUsername: string;
  lastMessageAt: string;
  lastMessageContent: string;
  unreadCount: number;
}

export function useChatPreviews(currentUsername: string | null) {
  const [previews, setPreviews] = useState<ChatPreview[]>([]);

  const fetchPreviews = useCallback(async () => {
    if (!currentUsername) return;

    // Get all messages involving current user
    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_username.eq.${currentUsername},receiver_username.eq.${currentUsername}`)
      .order('created_at', { ascending: false });

    // Get read statuses
    const { data: readData } = await supabase
      .from('chat_read_status')
      .select('*')
      .eq('username', currentUsername);

    if (!msgData) return;

    const readMap = new Map<string, string>();
    if (readData) {
      for (const r of readData) {
        readMap.set(r.partner_username, r.last_read_at);
      }
    }

    // Group by chat partner
    const chatMap = new Map<string, { lastMsg: any; unread: number }>();

    for (const msg of msgData) {
      const partner =
        msg.sender_username === currentUsername ? msg.receiver_username : msg.sender_username;
      if (!chatMap.has(partner)) {
        chatMap.set(partner, { lastMsg: msg, unread: 0 });
      }
      // Count unread: messages FROM partner, not deleted, after last_read_at
      if (msg.sender_username !== currentUsername && !msg.deleted) {
        const lastRead = readMap.get(partner);
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          chatMap.get(partner)!.unread++;
        }
      }
    }

    const result: ChatPreview[] = [];
    chatMap.forEach((val, partner) => {
      result.push({
        partnerUsername: partner,
        lastMessageAt: val.lastMsg.created_at,
        lastMessageContent: val.lastMsg.deleted ? 'Mensagem apagada' : val.lastMsg.content,
        unreadCount: val.unread,
      });
    });

    result.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
    setPreviews(result);
  }, [currentUsername]);

  // Atualização incremental a partir do payload do Realtime.
  // Evita refazer a query pesada de "todas as mensagens" a cada evento.
  const applyIncomingMessage = useCallback(
    (msg: {
      id: string;
      sender_username: string;
      receiver_username: string;
      content: string;
      created_at: string;
      deleted: boolean;
    }) => {
      if (!currentUsername) return;
      const partner =
        msg.sender_username === currentUsername ? msg.receiver_username : msg.sender_username;
      if (!partner) return;

      setPreviews((prev) => {
        const idx = prev.findIndex((p) => p.partnerUsername === partner);
        const existing = idx >= 0 ? prev[idx] : null;
        const isNewer =
          !existing || new Date(msg.created_at) >= new Date(existing.lastMessageAt);
        const shouldCountUnread =
          msg.sender_username !== currentUsername && !msg.deleted;

        const next = existing
          ? { ...existing }
          : {
              partnerUsername: partner,
              lastMessageAt: msg.created_at,
              lastMessageContent: msg.deleted ? 'Mensagem apagada' : msg.content,
              unreadCount: 0,
            };

        if (isNewer) {
          next.lastMessageAt = msg.created_at;
          next.lastMessageContent = msg.deleted ? 'Mensagem apagada' : msg.content;
        }
        if (shouldCountUnread) next.unreadCount = (next.unreadCount ?? 0) + 1;

        const list = idx >= 0 ? prev.map((p, i) => (i === idx ? next : p)) : [...prev, next];
        list.sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
        return list;
      });
    },
    [currentUsername]
  );

  const resetUnreadFor = useCallback((partnerUsername: string) => {
    setPreviews((prev) =>
      prev.map((p) =>
        p.partnerUsername === partnerUsername ? { ...p, unreadCount: 0 } : p
      )
    );
  }, []);

  useEffect(() => {
    fetchPreviews();

    if (!currentUsername) return;

    const channel = supabase
      .channel(`chat-previews-${currentUsername}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as {
            id: string;
            sender_username: string;
            receiver_username: string;
            content: string;
            created_at: string;
            deleted: boolean;
          };
          if (
            msg.sender_username === currentUsername ||
            msg.receiver_username === currentUsername
          ) {
            applyIncomingMessage(msg);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as {
            id: string;
            sender_username: string;
            receiver_username: string;
            content: string;
            created_at: string;
            deleted: boolean;
          };
          if (
            msg.sender_username === currentUsername ||
            msg.receiver_username === currentUsername
          ) {
            applyIncomingMessage(msg);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_read_status' },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            username: string;
            partner_username: string;
          } | null;
          if (!row || row.username !== currentUsername) return;
          resetUnreadFor(row.partner_username);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUsername, fetchPreviews, applyIncomingMessage, resetUnreadFor]);

  const markAsRead = useCallback(
    async (partnerUsername: string) => {
      if (!currentUsername) return;
      const now = new Date().toISOString();

      // Upsert read status
      const { data: existing } = await supabase
        .from('chat_read_status')
        .select('id')
        .eq('username', currentUsername)
        .eq('partner_username', partnerUsername)
        .maybeSingle();

      if (existing) {
        await supabase.from('chat_read_status').update({ last_read_at: now }).eq('id', existing.id);
      } else {
        await supabase.from('chat_read_status').insert({
          username: currentUsername,
          partner_username: partnerUsername,
          last_read_at: now,
        });
      }
    },
    [currentUsername]
  );

  return { previews, markAsRead };
}
