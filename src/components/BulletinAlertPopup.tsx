import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Megaphone, Pin } from 'lucide-react';

interface BulletinPostRow {
  id: string;
  title: string;
  content: string;
  created_by: string;
  pinned: boolean;
  created_at: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '🎉', '👏', '🔥', '😮'];

export default function BulletinAlertPopup() {
  const { currentUser } = useApp();
  const [queue, setQueue] = useState<BulletinPostRow[]>([]);
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const audioRef = useState(() => {
    const a = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG2Mj5KNiYJ7dG59hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7hoyRkIyGfHRwdX+Gi46OioR9dnFzfIaOk5KOh390bHJ7'
    );
    a.volume = 0.6;
    return a;
  })[0];

  const fetchUnseen = useCallback(async () => {
    if (!currentUser) return;
    const [postsRes, acksRes] = await Promise.all([
      supabase.from('bulletin_posts').select('*').order('created_at', { ascending: true }),
      (supabase as any).from('bulletin_acks').select('post_id').eq('user_id', currentUser.id),
    ]);
    if (!postsRes.data) return;
    const ackedIds = new Set<string>((acksRes.data || []).map((r: any) => r.post_id));
    const unseen = (postsRes.data as BulletinPostRow[]).filter((p) => !ackedIds.has(p.id));
    setQueue(unseen);
  }, [currentUser]);

  // Load my reactions for current popup
  const loadMyReactions = useCallback(
    async (postId: string) => {
      if (!currentUser) return;
      const { data } = await supabase
        .from('bulletin_reactions')
        .select('emoji')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id);
      setMyReactions(new Set((data || []).map((r: any) => r.emoji)));
    },
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchUnseen();

    const channel = supabase
      .channel(`bulletin-alerts-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bulletin_posts' },
        (payload) => {
          const post = payload.new as BulletinPostRow;
          setQueue((prev) => (prev.some((p) => p.id === post.id) ? prev : [...prev, post]));
          try {
            audioRef.currentTime = 0;
            audioRef.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchUnseen, audioRef]);

  const current = queue[0] || null;

  useEffect(() => {
    if (current) loadMyReactions(current.id);
    else setMyReactions(new Set());
  }, [current, loadMyReactions]);

  const handleClose = useCallback(async () => {
    if (!current || !currentUser) return;
    // Garante que o usuário curtiu (👍) — registra o like com data/horário
    if (!myReactions.has('👍')) {
      await supabase
        .from('bulletin_reactions')
        .insert({ post_id: current.id, user_id: currentUser.id, emoji: '👍' });
    }
    await (supabase as any)
      .from('bulletin_acks')
      .insert({ post_id: current.id, user_id: currentUser.id });
    setQueue((prev) => prev.slice(1));
  }, [current, currentUser, myReactions]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!current || !currentUser) return;
      const isAdmin = currentUser.role === 'admin';
      const { data: existing } = await supabase
        .from('bulletin_reactions')
        .select('id')
        .eq('post_id', current.id)
        .eq('user_id', currentUser.id)
        .eq('emoji', emoji)
        .maybeSingle();
      if (existing) {
        // Apenas administradores podem remover reações
        if (!isAdmin) return;
        await supabase.from('bulletin_reactions').delete().eq('id', existing.id);
        setMyReactions((prev) => {
          const n = new Set(prev);
          n.delete(emoji);
          return n;
        });
      } else {
        await supabase
          .from('bulletin_reactions')
          .insert({ post_id: current.id, user_id: currentUser.id, emoji });
        setMyReactions((prev) => new Set(prev).add(emoji));
      }
    },
    [current, currentUser]
  );

  if (!current || !currentUser) return null;

  // Strip HTML for preview
  const plainContent = current.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <Dialog
      open={!!current}
      onOpenChange={() => {
        /* bloqueado: precisa curtir */
      }}
    >
      <DialogContent
        className="max-w-2xl border-2 border-primary/40 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {current.pinned ? (
              <Pin className="w-4 h-4 text-destructive" />
            ) : (
              <Megaphone className="w-4 h-4 text-primary animate-pulse" />
            )}
            <span>📢 Novo Aviso no Mural</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Por <span className="font-semibold text-foreground">{current.created_by}</span>
            {queue.length > 1 && (
              <span className="ml-2 text-muted-foreground">(+{queue.length - 1} aguardando)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className={`bg-card border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto ${current.pinned ? 'border-primary/30 bg-primary/5' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {current.pinned && <Pin className="w-3 h-3 text-primary" />}
              <h4 className="font-semibold text-base">{current.title}</h4>
            </div>
            <div
              className="text-sm mt-2 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: current.content || `<p>${plainContent}</p>` }}
            />
            <p className="text-[10px] text-muted-foreground mt-3">
              Por {current.created_by} • {new Date(current.created_at).toLocaleString('pt-BR')}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Reaja a este aviso:</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_EMOJIS.map((emoji) => {
                const active = myReactions.has(emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(emoji)}
                    className={`text-2xl px-3 py-1.5 rounded-lg border transition-all hover:scale-110 ${
                      active
                        ? 'bg-primary/20 border-primary'
                        : 'bg-muted/50 border-border hover:bg-muted'
                    }`}
                    aria-label={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Curta com 👍 para confirmar a leitura e fechar este aviso
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full gap-2">
            <span className="text-lg">👍</span> Curtir e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
