import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';

import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Download, FileIcon, Megaphone } from 'lucide-react';

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

interface AdminPopupFirestore {
  title: string;
  content: string;
  created_by: string;
  target_mode: 'all' | 'sector' | 'users';
  target_sectors?: string[];
  target_users?: string[];
  attachments?: PopupAttachment[];
  created_at?: Timestamp;
}

/**
 * Compatibilidade com pop-ups antigos que foram salvos contendo HTML.
 * Não renderizamos HTML diretamente: convertemos para texto seguro.
 */
const normalizePopupContent = (value: string) => {
  if (!value) return '';

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (!hasHtml) return value;

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '');

  const parsed = new DOMParser().parseFromString(withBreaks, 'text/html');

  return parsed.body.textContent?.trim() || '';
};

const userMatchesPopup = (popup: AdminPopupRow, userId: string, userSectors: string[]) => {
  if (popup.target_mode === 'all') return true;

  if (popup.target_mode === 'sector') {
    return (popup.target_sectors || []).some((sector) => userSectors.includes(sector));
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

    const popupsQuery = query(collection(db, 'admin_popups'), orderBy('created_at', 'asc'));

    const acksQuery = query(
      collection(db, 'admin_popup_acks'),
      where('user_id', '==', currentUser.id)
    );

    const [popupsSnapshot, acksSnapshot] = await Promise.all([
      getDocs(popupsQuery),
      getDocs(acksQuery),
    ]);

    const acked = new Set<string>();

    acksSnapshot.forEach((ackDoc) => {
      const data = ackDoc.data();

      if (data.popup_id) {
        acked.add(String(data.popup_id));
      }
    });

    const sectors = (currentUser.sectors || []) as string[];
    const unseen: AdminPopupRow[] = [];

    popupsSnapshot.forEach((popupDoc) => {
      const data = popupDoc.data() as AdminPopupFirestore;

      const popup: AdminPopupRow = {
        id: popupDoc.id,
        title: data.title,
        content: data.content,
        created_by: data.created_by,
        target_mode: data.target_mode,
        target_sectors: data.target_sectors || [],
        target_users: data.target_users || [],
        attachments: data.attachments || [],
        created_at: data.created_at?.toDate
          ? data.created_at.toDate().toISOString()
          : new Date().toISOString(),
      };

      if (!acked.has(popup.id) && userMatchesPopup(popup, currentUser.id, sectors)) {
        unseen.push(popup);
      }
    });

    setQueue(unseen);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    void fetchUnseen();

    const popupsQuery = query(collection(db, 'admin_popups'), orderBy('created_at', 'asc'));

    let initialized = false;

    const unsubscribe = onSnapshot(popupsQuery, (snapshot) => {
      if (!initialized) {
        initialized = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;

        const data = change.doc.data() as AdminPopupFirestore;

        const popup: AdminPopupRow = {
          id: change.doc.id,
          title: data.title,
          content: data.content,
          created_by: data.created_by,
          target_mode: data.target_mode,
          target_sectors: data.target_sectors || [],
          target_users: data.target_users || [],
          attachments: data.attachments || [],
          created_at: data.created_at?.toDate
            ? data.created_at.toDate().toISOString()
            : new Date().toISOString(),
        };

        const sectors = (currentUser.sectors || []) as string[];

        if (!userMatchesPopup(popup, currentUser.id, sectors)) {
          return;
        }

        setQueue((prev) =>
          prev.some((existing) => existing.id === popup.id) ? prev : [...prev, popup]
        );
      });
    });

    return () => unsubscribe();
  }, [currentUser, fetchUnseen]);

  const current = queue[0] || null;

  const handleClose = useCallback(async () => {
    if (!current || !currentUser) return;

    await addDoc(collection(db, 'admin_popup_acks'), {
      popup_id: current.id,
      user_id: currentUser.id,
      created_at: Timestamp.now(),
    });

    setQueue((prev) => prev.slice(1));
  }, [current, currentUser]);

  if (!current || !currentUser) return null;

  return (
    <Dialog
      open={!!current}
      onOpenChange={() => {
        // Bloqueado: precisa confirmar a leitura.
      }}
    >
      <DialogContent
        className="max-w-2xl border-2 border-primary/40 [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 animate-pulse text-primary" />
            <span>📣 Mensagem da Administração</span>
          </DialogTitle>

          <DialogDescription className="text-xs">
            {queue.length > 1 && (
              <span className="text-muted-foreground">(+{queue.length - 1} aguardando)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 text-base font-semibold">{current.title}</h4>

            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
              {normalizePopupContent(current.content)}
            </p>

            {Array.isArray(current.attachments) && current.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {current.attachments.map((attachment, index) =>
                  attachment.type?.startsWith('image/') ? (
                    <a
                      key={`${attachment.url}-${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="max-h-80 w-auto rounded-lg border border-border"
                      />
                    </a>
                  ) : (
                    <a
                      key={`${attachment.url}-${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 transition-colors hover:bg-muted"
                    >
                      <FileIcon className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate text-xs">{attachment.name}</span>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </a>
                  )
                )}
              </div>
            )}

            <p className="mt-3 text-[10px] text-muted-foreground">
              {new Date(current.created_at).toLocaleString('pt-BR')}
            </p>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Para confirmar que você leu este aviso, curta com 👍
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full gap-2">
            <span className="text-lg">👍</span>
            Curtir e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
