import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function useSupabaseGroupChat(groupId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    const { data, error } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as GroupMessage[]);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new as GroupMessage;
            if (msg.group_id === groupId) {
              setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            }
          } else if (payload.eventType === 'UPDATE') {
            const msg = payload.new as GroupMessage;
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchMessages]);

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
      await supabase.from('group_messages').insert({
        group_id: groupId,
        sender_username: senderUsername,
        content: msg.content,
        attachment_url: msg.attachmentUrl || null,
        attachment_type: msg.attachmentType || null,
        attachment_name: msg.attachmentName || null,
      });
      // Send push to all group members except sender
      const { data: group } = await supabase
        .from('custom_groups')
        .select('participants')
        .eq('id', groupId)
        .single();
      if (group?.participants) {
        const participants = group.participants as string[];
        const { data: users } = await supabase
          .from('app_users')
          .select('id,username')
          .in('username', participants);
        if (users) {
          for (const u of users) {
            if (u.username !== senderUsername) {
              sendPushToUser(
                u.id,
                'Nova mensagem de grupo',
                `${senderUsername}: ${msg.content.substring(0, 100)}`
              );
            }
          }
        }
      }
    },
    [groupId]
  );

  const editMessage = useCallback(async (msgId: string, newContent: string) => {
    await supabase
      .from('group_messages')
      .update({ content: newContent, edited: true })
      .eq('id', msgId);
  }, []);

  const deleteMessage = useCallback(async (msgId: string) => {
    await supabase
      .from('group_messages')
      .update({ deleted: true, content: 'Mensagem apagada' })
      .eq('id', msgId);
  }, []);

  return { messages, sendMessage, editMessage, deleteMessage };
}
