import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, BellOff, MessageSquare, Pin, Star, UsersRound } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import ChatPanel from '@/components/ChatPanel';
import { User, Sector, SECTOR_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { useChatPreviews } from '@/hooks/useChatPreviews';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChatAvatar } from '@/components/ChatMedia';
import { usePrivateTypingUsers } from '@/hooks/useTypingPresence';
import { ChatPreference, useChatPreferences } from '@/hooks/useChatPreferences';

interface ConversationRowProps {
  user: User;
  preview?: {
    partnerUsername: string;
    lastMessageAt: string;
    lastMessageContent: string;
    unreadCount: number;
  };
  preference: ChatPreference;
  selected: boolean;
  typing: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

const SWIPE_THRESHOLD = 54;
const SWIPE_LIMIT = 86;

const sectorLabel = (sector: Sector) =>
  String(sector) === 'ti' ? 'TI' : SECTOR_LABELS[sector] || String(sector);

const ConversationRow = ({
  user,
  preview,
  preference,
  selected,
  typing,
  onOpen,
  onTogglePin,
  onArchive,
  onContextMenu,
}: ConversationRowProps) => {
  const [offsetX, setOffsetX] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const pointerId = useRef<number | null>(null);
  const dragged = useRef(false);

  const finishSwipe = () => {
    if (offsetX <= -SWIPE_THRESHOLD) onTogglePin();
    if (offsetX >= SWIPE_THRESHOLD) onArchive();
    setOffsetX(0);
    dragStartX.current = null;
    pointerId.current = null;
    window.setTimeout(() => {
      dragged.current = false;
    }, 0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl" onContextMenu={onContextMenu}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between overflow-hidden rounded-xl">
        <div
          className={cn(
            'flex h-full w-[86px] items-center justify-center gap-1.5 bg-muted text-xs font-semibold text-foreground transition-opacity',
            offsetX > 4 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Archive className="h-4 w-4" />
          Arquivar
        </div>
        <div
          className={cn(
            'flex h-full w-[86px] items-center justify-center gap-1.5 bg-primary/12 text-xs font-semibold text-primary transition-opacity',
            offsetX < -4 ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Pin className="h-4 w-4" />
          {preference.pinned ? 'Desfixar' : 'Fixar'}
        </div>
      </div>

      <button
        type="button"
        aria-label={`Abrir conversa com ${user.name}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragStartX.current = event.clientX;
          pointerId.current = event.pointerId;
          dragged.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartX.current === null || pointerId.current !== event.pointerId) return;
          const delta = event.clientX - dragStartX.current;
          if (Math.abs(delta) > 5) dragged.current = true;
          setOffsetX(Math.max(-SWIPE_LIMIT, Math.min(SWIPE_LIMIT, delta)));
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={() => {
          setOffsetX(0);
          dragStartX.current = null;
          pointerId.current = null;
          dragged.current = false;
        }}
        onClick={() => {
          if (!dragged.current) onOpen();
        }}
        className={cn(
          'jf-interactive relative z-10 flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left hover:bg-muted/45',
          selected && 'bg-primary/[0.07] ring-1 ring-primary/15',
          preview?.unreadCount && !selected && 'bg-primary/[0.035]'
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragStartX.current === null ? 'transform 180ms ease-out' : 'none',
          touchAction: 'pan-y',
        }}
      >
        <ChatAvatar src={user.avatar} name={user.name} className="h-10 w-10 rounded-xl" />

        <div className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                'truncate text-sm text-foreground',
                preview?.unreadCount ? 'font-bold' : 'font-medium'
              )}
            >
              {user.name}
            </p>
            {preference.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
            {preference.favorite && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
            {preference.muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </div>

          {preview ? (
            <p
              className={cn(
                'truncate text-[11px]',
                typing
                  ? 'animate-pulse font-bold italic text-primary [animation-duration:1.8s]'
                  : preview.unreadCount > 0
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
              )}
            >
              {typing ? 'Digitando...' : preview.lastMessageContent}
            </p>
          ) : (
            <p
              className={cn(
                'truncate text-[11px]',
                typing
                  ? 'animate-pulse font-bold italic text-primary [animation-duration:1.8s]'
                  : 'text-muted-foreground'
              )}
            >
              {typing
                ? 'Digitando...'
                : user.role === 'admin'
                  ? 'Administrador'
                  : user.function || user.sectors?.map(sectorLabel).join(', ') || 'Funcionário'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {preview && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(preview.lastMessageAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          {!!preview?.unreadCount && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <Badge
                variant="default"
                className="flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[10px]"
              >
                {preview.unreadCount > 99 ? '99+' : preview.unreadCount}
              </Badge>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

const ChatPage = () => {
  const { currentUser, users } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'conversations' | 'contacts'>('conversations');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    user: User;
  } | null>(null);

  const { previews, markAsRead } = useChatPreviews(currentUser?.username || null);
  const privateTypingUserIds = usePrivateTypingUsers(currentUser?.id);
  const { getPreference, updatePreference } = useChatPreferences(currentUser?.id);

  const activeUsers = useMemo(
    () => users.filter((user) => user.active !== false && user.id !== currentUser?.id),
    [users, currentUser?.id]
  );

  const previewByUsername = useMemo(
    () => new Map(previews.map((preview) => [preview.partnerUsername, preview])),
    [previews]
  );

  const privateUnreadTotal = previews.reduce((total, preview) => total + preview.unreadCount, 0);
  const selectedPreview = selectedUser ? previewByUsername.get(selectedUser.username) : undefined;

  const conversationUsers = useMemo(() => {
    return activeUsers
      .filter((user) => {
        const preference = getPreference(user.id);
        const hasConversation = previewByUsername.has(user.username);
        return (
          !preference.archived && (hasConversation || preference.pinned || preference.favorite)
        );
      })
      .sort((a, b) => {
        const prefA = getPreference(a.id);
        const prefB = getPreference(b.id);

        if (prefA.pinned !== prefB.pinned) return prefA.pinned ? -1 : 1;
        if (prefA.favorite !== prefB.favorite) return prefA.favorite ? -1 : 1;

        const previewA = previewByUsername.get(a.username);
        const previewB = previewByUsername.get(b.username);
        const timeA = previewA ? new Date(previewA.lastMessageAt || 0).getTime() : 0;
        const timeB = previewB ? new Date(previewB.lastMessageAt || 0).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;

        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [activeUsers, getPreference, previewByUsername]);

  const contactUsers = useMemo(
    () => [...activeUsers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [activeUsers]
  );

  const archivedUsers = useMemo(
    () =>
      activeUsers
        .filter((user) => getPreference(user.id).archived)
        .sort((a, b) => {
          const previewA = previewByUsername.get(a.username);
          const previewB = previewByUsername.get(b.username);
          return (
            new Date(previewB?.lastMessageAt || 0).getTime() -
            new Date(previewA?.lastMessageAt || 0).getTime()
          );
        }),
    [activeUsers, getPreference, previewByUsername]
  );

  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    void markAsRead(selectedUser.username);
  }, [
    selectedUser,
    currentUser,
    markAsRead,
    selectedPreview?.lastMessageAt,
    selectedPreview?.unreadCount,
  ]);

  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  if (!currentUser) return null;

  const openConversation = (user: User) => {
    setSelectedUser(user);
    void markAsRead(user.username);
  };

  const archiveConversation = async (user: User) => {
    await updatePreference(user.id, { archived: true });
    if (selectedUser?.id === user.id) setSelectedUser(null);
    toast.success('Conversa arquivada');
  };

  const togglePin = async (user: User) => {
    const preference = getPreference(user.id);
    const nextPinned = !preference.pinned;
    await updatePreference(user.id, {
      pinned: nextPinned,
      ...(nextPinned ? { archived: false } : {}),
    });
    toast.success(nextPinned ? 'Conversa fixada' : 'Conversa desfixada');
  };

  const toggleFavorite = async (user: User) => {
    const preference = getPreference(user.id);
    const nextFavorite = !preference.favorite;
    await updatePreference(user.id, {
      favorite: nextFavorite,
      ...(nextFavorite ? { archived: false } : {}),
    });
    toast.success(
      nextFavorite ? 'Conversa adicionada aos favoritos' : 'Conversa removida dos favoritos'
    );
  };

  const toggleMuted = async (user: User) => {
    const preference = getPreference(user.id);
    await updatePreference(user.id, { muted: !preference.muted });
    toast.success(preference.muted ? 'Som da conversa ativado' : 'Conversa silenciada');
  };

  const renderConversationRow = (user: User) => {
    const preview = previewByUsername.get(user.username);
    const preference = getPreference(user.id);

    return (
      <ConversationRow
        key={user.id}
        user={user}
        preview={preview}
        preference={preference}
        selected={selectedUser?.id === user.id}
        typing={privateTypingUserIds.includes(user.id)}
        onOpen={() => openConversation(user)}
        onTogglePin={() => void togglePin(user)}
        onArchive={() => void archiveConversation(user)}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({
            x: Math.min(event.clientX, Math.max(8, window.innerWidth - 220)),
            y: Math.min(event.clientY, Math.max(8, window.innerHeight - 140)),
            user,
          });
        }}
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card md:flex-row">
      <div
        className={cn(
          'min-h-0 flex-col overflow-hidden border-border/70 bg-card',
          selectedUser
            ? 'hidden md:flex md:w-[300px] md:min-w-[280px] md:border-r lg:w-[320px]'
            : 'flex w-full md:w-[300px] md:min-w-[280px] md:border-r lg:w-[320px]'
        )}
      >
        <div className="border-b border-border/70 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Comunicação interna
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Chat</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Conversas privadas da equipe</p>
            </div>
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="jf-interactive relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/15"
              aria-label="Abrir conversas arquivadas"
              title="Conversas arquivadas"
            >
              <Archive className="h-4 w-4" />
              {archivedUsers.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {archivedUsers.length > 99 ? '99+' : archivedUsers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border/70 p-2">
          <button
            type="button"
            aria-pressed={tab === 'conversations'}
            onClick={() => setTab('conversations')}
            className={cn(
              'jf-interactive flex-1 rounded-xl px-3 py-2 text-sm font-medium',
              tab === 'conversations'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              Conversas
              {privateUnreadTotal > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {privateUnreadTotal > 99 ? '99+' : privateUnreadTotal}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={tab === 'contacts'}
            onClick={() => setTab('contacts')}
            className={cn(
              'jf-interactive flex-1 rounded-xl px-3 py-2 text-sm font-medium',
              tab === 'contacts'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <UsersRound className="h-3.5 w-3.5" />
              Contatos
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === 'conversations' ? (
            conversationUsers.length > 0 ? (
              <div className="space-y-1">{conversationUsers.map(renderConversationRow)}</div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
                <MessageSquare className="mb-2 h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs font-medium text-foreground">Nenhuma conversa recente</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Abra Contatos para iniciar uma conversa.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-1">
              {contactUsers.map((user) => {
                const preview = previewByUsername.get(user.username);
                const preference = getPreference(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => openConversation(user)}
                    className={cn(
                      'jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/45',
                      selectedUser?.id === user.id && 'bg-primary/[0.07] ring-1 ring-primary/15'
                    )}
                  >
                    <ChatAvatar
                      src={user.avatar}
                      name={user.name}
                      className="h-10 w-10 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                        {preference.favorite && (
                          <Star className="h-3 w-3 fill-warning text-warning" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        @{user.username}
                        {user.role === 'admin'
                          ? ' • Administrador'
                          : user.function
                            ? ` • ${user.function}`
                            : user.sectors?.length
                              ? ` • ${user.sectors.map(sectorLabel).join(', ')}`
                              : ''}
                      </p>
                    </div>
                    {!!preview?.unreadCount && (
                      <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px]">
                        {preview.unreadCount > 99 ? '99+' : preview.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <section
        className={cn(
          'min-h-0 flex-1 flex-col overflow-hidden bg-background/20',
          !selectedUser ? 'hidden md:flex' : 'flex'
        )}
      >
        {selectedUser && (
          <button
            type="button"
            aria-label="Voltar para a lista de conversas"
            onClick={() => setSelectedUser(null)}
            className="jf-interactive flex shrink-0 items-center gap-2 border-b border-border/70 bg-card px-4 py-3 text-sm font-medium text-primary md:hidden"
          >
            ← Voltar
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedUser ? (
            <ChatPanel otherUser={selectedUser} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
              <p className="text-sm font-medium text-foreground">Selecione uma conversa</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Escolha uma conversa recente ou abra a aba Contatos para falar com alguém da equipe.
              </p>
            </div>
          )}
        </div>
      </section>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Conversas arquivadas</DialogTitle>
            <DialogDescription>
              Abra uma conversa arquivada ou restaure-a para a lista principal.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {archivedUsers.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border/70 text-center text-sm text-muted-foreground">
                Nenhuma conversa arquivada.
              </div>
            ) : (
              archivedUsers.map((user) => {
                const preview = previewByUsername.get(user.username);
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/15 p-2.5"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => {
                        openConversation(user);
                        setArchiveOpen(false);
                      }}
                    >
                      <ChatAvatar
                        src={user.avatar}
                        name={user.name}
                        className="h-9 w-9 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {preview?.lastMessageContent || `@${user.username}`}
                        </p>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void updatePreference(user.id, { archived: false })}
                    >
                      Restaurar
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {contextMenu && (
        <div
          role="menu"
          className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void toggleMuted(contextMenu.user);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <BellOff className="h-4 w-4" />
            {getPreference(contextMenu.user.id).muted ? 'Ativar som' : 'Silenciar'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void toggleFavorite(contextMenu.user);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <Star className="h-4 w-4" />
            {getPreference(contextMenu.user.id).favorite
              ? 'Remover dos favoritos'
              : 'Marcar como favorito'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
