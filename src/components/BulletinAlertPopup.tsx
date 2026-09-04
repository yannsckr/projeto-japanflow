import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  where,
  Timestamp,
} from 'firebase/firestore';

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

interface BulletinPostFirestore {
  title: string;
  content: string;
  created_by: string;
  pinned: boolean;
  created_at: Timestamp;
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

    const postsQuery = query(
      collection(db, 'bulletin_posts'),
      orderBy('created_at', 'asc')
    );

    const acksQuery = query(
      collection(db, 'bulletin_acks'),
      where('user_id', '==', currentUser.id)
    );

    const [postsSnapshot, acksSnapshot] = await Promise.all([
      getDocs(postsQuery),
      getDocs(acksQuery),
    ]);

    const ackedIds = new Set<string>();

    acksSnapshot.forEach((ackDoc) => {
      const data = ackDoc.data();
      if (data.post_id) {
        ackedIds.add(data.post_id);
      }
    });

    const unseen: BulletinPostRow[] = [];

    postsSnapshot.forEach((postDoc) => {
      const data = postDoc.data() as BulletinPostFirestore;

      if (!ackedIds.has(postDoc.id)) {
        unseen.push({
          id: postDoc.id,
          title: data.title,
          content: data.content,
          created_by: data.created_by,
          pinned: data.pinned,
          created_at: data.created_at?.toDate
            ? data.created_at.toDate().toISOString()
            : new Date().toISOString(),
        });
      }
    });

    setQueue(unseen);
  }, [currentUser]);

  const loadMyReactions = useCallback(
    async (postId: string) => {
      if (!currentUser) return;

      const reactionsQuery = query(
        collection(db, 'bulletin_reactions'),
        where('post_id', '==', postId),
        where('user_id', '==', currentUser.id)
      );

      const snapshot = await getDocs(reactionsQuery);

      const reactions = new Set<string>();

      snapshot.forEach((reactionDoc) => {
        const data = reactionDoc.data();

        if (data.emoji) {
          reactions.add(data.emoji);
        }
      });

      setMyReactions(reactions);
    },
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser) return;

    fetchUnseen();

    const postsQuery = query(
      collection(db, 'bulletin_posts'),
      orderBy('created_at', 'asc')
    );

    let initialized = false;

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      if (!initialized) {
        initialized = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;

        const data = change.doc.data() as BulletinPostFirestore;

        const post: BulletinPostRow = {
          id: change.doc.id,
          title: data.title,
          content: data.content,
          created_by: data.created_by,
          pinned: data.pinned,
          created_at: data.created_at?.toDate
            ? data.created_at.toDate().toISOString()
            : new Date().toISOString(),
        };

        setQueue((prev) =>
          prev.some((p) => p.id === post.id)
            ? prev
            : [...prev, post]
        );

        try {
          audioRef.currentTime = 0;
          audioRef.play().catch(() => {});
        } catch {}
      });
    });

    return () => unsubscribe();
  }, [currentUser, fetchUnseen, audioRef]);

  const current = queue[0] || null;

  useEffect(() => {
    if (current) {
      loadMyReactions(current.id);
    } else {
      setMyReactions(new Set());
    }
  }, [current, loadMyReactions]);

  const handleClose = useCallback(async () => {
    if (!current || !currentUser) return;

    if (!myReactions.has('👍')) {
      await addDoc(collection(db, 'bulletin_reactions'), {
        post_id: current.id,
        user_id: currentUser.id,
        emoji: '👍',
        created_at: Timestamp.now(),
      });
    }

    await addDoc(collection(db, 'bulletin_acks'), {
      post_id: current.id,
      user_id: currentUser.id,
      created_at: Timestamp.now(),
    });

    setQueue((prev) => prev.slice(1));
  }, [current, currentUser, myReactions]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!current || !currentUser) return;

      const isAdmin = currentUser.role === 'admin';

      const reactionQuery = query(
        collection(db, 'bulletin_reactions'),
        where('post_id', '==', current.id),
        where('user_id', '==', currentUser.id),
        where('emoji', '==', emoji)
      );

      const snapshot = await getDocs(reactionQuery);

      if (!snapshot.empty) {
        if (!isAdmin) return;

        await Promise.all(
          snapshot.docs.map((reactionDoc) =>
            deleteDoc(doc(db, 'bulletin_reactions', reactionDoc.id))
          )
        );

        setMyReactions((prev) => {
          const next = new Set(prev);
          next.delete(emoji);
          return next;
        });

        return;
      }

      await addDoc(collection(db, 'bulletin_reactions'), {
        post_id: current.id,
        user_id: currentUser.id,
        emoji,
        created_at: Timestamp.now(),
      });

      setMyReactions((prev) => new Set(prev).add(emoji));
    },
    [current, currentUser]
  );

  if (!current || !currentUser) return null;

  const plainContent = current.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <Dialog
      open={!!current}
      onOpenChange={() => {
        // bloqueado: precisa curtir
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
            Por{' '}
            <span className="font-semibold text-foreground">
              {current.created_by}
            </span>

            {queue.length > 1 && (
              <span className="ml-2 text-muted-foreground">
                (+{queue.length - 1} aguardando)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className={`bg-card border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto ${
              current.pinned
                ? 'border-primary/30 bg-primary/5'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {current.pinned && (
                <Pin className="w-3 h-3 text-primary" />
              )}

              <h4 className="font-semibold text-base">
                {current.title}
              </h4>
            </div>

            <div
              className="text-sm mt-2 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html:
                  current.content || `<p>${plainContent}</p>`,
              }}
            />

            <p className="text-[10px] text-muted-foreground mt-3">
              Por {current.created_by} •{' '}
              {new Date(current.created_at).toLocaleString('pt-BR')}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Reaja a este aviso:
            </p>

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
          <Button
            onClick={handleClose}
            className="w-full gap-2"
          >
            <span className="text-lg">👍</span>
            Curtir e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}