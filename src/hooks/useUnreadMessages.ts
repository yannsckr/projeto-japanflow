import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Contagem incremental de mensagens não lidas.
// - Uma consulta inicial calcula a base.
// - Depois, o Realtime incrementa/reseta em memória a partir do payload,
//   sem refazer a query pesada de todas as mensagens recebidas.
export function useUnreadMessages(currentUsername: string | null) {
  const [totalUnread, setTotalUnread] = useState(0);
  const prevCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG2Mj5KNiYJ7dG59hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7'
    );
    audioRef.current = audio;
  }, []);

  const bump = useCallback((next: number) => {
    if (next > prevCount.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    prevCount.current = next;
    setTotalUnread(next);
  }, []);

  const recomputeFromBase = useCallback(async () => {
    if (!currentUsername) {
      bump(0);
      return;
    }

    const { data: readData } = await supabase
      .from('chat_read_status')
      .select('partner_username, last_read_at')
      .eq('username', currentUsername);

    const readMap = new Map<string, string>();
    if (readData) {
      for (const r of readData) readMap.set(r.partner_username, r.last_read_at);
    }
    readMapRef.current = readMap;

    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_username, created_at')
      .eq('receiver_username', currentUsername)
      .eq('deleted', false);

    let count = 0;
    if (msgs) {
      for (const msg of msgs) {
        const lastRead = readMap.get(msg.sender_username);
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) count++;
      }
    }
    bump(count);
  }, [currentUsername, bump]);

  useEffect(() => {
    recomputeFromBase();
    if (!currentUsername) return;

    const channel = supabase
      .channel(`unread-msgs-${currentUsername}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as {
            sender_username: string;
            receiver_username: string;
            created_at: string;
            deleted: boolean;
          };
          if (msg.receiver_username !== currentUsername || msg.deleted) return;

          const lastRead = readMapRef.current.get(msg.sender_username);
          if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
            bump(prevCount.current + 1);
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
            last_read_at: string;
          } | null;
          if (!row || row.username !== currentUsername) return;
          // Marcações de leitura mudam quantos partners marcaram como lidos —
          // recomputa a base (uma query só, não custa muito).
          recomputeFromBase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUsername, recomputeFromBase, bump]);

  return { totalUnread };
}
