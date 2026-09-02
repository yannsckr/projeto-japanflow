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
import { Megaphone, FileIcon, Download } from 'lucide-react';

interface PopupAttachment {
  url: string;
  name: string;
  type: string;
}

interface AdminPopupRow {
  id: string;
  title: string;
  content: string;
  created_by: string;
  target_mode: 'all' | 'sector' | 'users';
  target_sectors: string[];
  target_users: string[];
  attachments?: PopupAttachment[];
  created_at: string;
}

const userMatchesPopup = (popup: AdminPopupRow, userId: string, userSectors: string[]) => {
  if (popup.target_mode === 'all') return true;
  if (popup.target_mode === 'sector') {
    return (popup.target_sectors || []).some((s) => userSectors.includes(s));
  }
  if (popup.target_mode === 'users') {
    return (popup.target_users || []).includes(userId);
  }
  return false;
};

export default function AdminPopupAlert() {
  const { currentUser } = useApp();
  const [queue, setQueue] = useState<AdminPopupRow[]>([]);

  const fetchUnseen = useCallback(async () => {
    if (!currentUser) return;
    const [popupsRes, acksRes] = await Promise.all([
      (supabase as any).from('admin_popups').select('*').order('created_at', { ascending: true }),
      (supabase as any).from('admin_popup_acks').select('popup_id').eq('user_id', currentUser.id),
    ]);
    if (!popupsRes.data) return;
    const acked = new Set<string>((acksRes.data || []).map((r: any) => r.popup_id));
    const sectors = (currentUser.sectors || []) as string[];
    const unseen = (popupsRes.data as AdminPopupRow[]).filter(
      (p) => !acked.has(p.id) && userMatchesPopup(p, currentUser.id, sectors)
    );
    setQueue(unseen);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchUnseen();
    const channel = supabase
      .channel(`admin-popups-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_popups' },
        (payload) => {
          const p = payload.new as AdminPopupRow;
          const sectors = (currentUser.sectors || []) as string[];
          if (!userMatchesPopup(p, currentUser.id, sectors)) return;
          setQueue((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchUnseen]);

  const current = queue[0] || null;

  const handleClose = useCallback(async () => {
    if (!current || !currentUser) return;
    await (supabase as any)
      .from('admin_popup_acks')
      .insert({ popup_id: current.id, user_id: currentUser.id });
    setQueue((prev) => prev.slice(1));
  }, [current, currentUser]);

  if (!current || !currentUser) return null;

  return (
    <Dialog
      open={!!current}
      onOpenChange={() => {
        /* bloqueado: precisa curtir para fechar */
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
            <Megaphone className="w-4 h-4 text-primary animate-pulse" />
            <span>📣 Mensagem da Administração</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {queue.length > 1 && (
              <span className="text-muted-foreground">(+{queue.length - 1} aguardando)</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold text-base mb-2">{current.title}</h4>
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
              {current.content}
            </div>
            {Array.isArray(current.attachments) && current.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {current.attachments.map((a, i) =>
                  a.type?.startsWith('image/') ? (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={a.url}
                        alt={a.name}
                        className="max-h-80 w-auto rounded-lg border border-border"
                      />
                    </a>
                  ) : (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <FileIcon className="w-4 h-4 text-primary" />
                      <span className="flex-1 text-xs truncate">{a.name}</span>
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </a>
                  )
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">
              {new Date(current.created_at).toLocaleString('pt-BR')}
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Para confirmar que você leu este aviso, curta com 👍
          </p>
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
