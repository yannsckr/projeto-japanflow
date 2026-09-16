import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import ChatPanel from '@/components/ChatPanel';
import GroupChatPanel from '@/components/GroupChatPanel';
import { User, Sector, SECTOR_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Plus, Trash2 } from 'lucide-react';
import { useChatPreviews } from '@/hooks/useChatPreviews';
import { useCustomGroups } from '@/hooks/useCustomGroups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChatAvatar } from '@/components/ChatMedia';
import { usePrivateTypingUsers } from '@/hooks/useTypingPresence';
import { useGroupUnread } from '@/hooks/useGroupUnread';

const SECTOR_CHATS = [
  {
    id: 'expedicao',
    name: 'Expedição',
    sectors: ['expedicao', 'vendas', 'administracao'] as Sector[],
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    sectors: ['vendas', 'financeiro', 'administracao'] as Sector[],
  },
];

const ChatPage = () => {
  const { currentUser, users } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [tab, setTab] = useState<'private' | 'groups'>('private');
  const { previews, markAsRead } = useChatPreviews(currentUser?.username || null);
  const { groups: customGroups, createGroup, deleteGroup } = useCustomGroups();
  const privateTypingUserIds = usePrivateTypingUsers(currentUser?.id);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const isAdmin = currentUser?.role === 'admin';
  const currentSectors = currentUser?.sectors || [];

  const accessibleSectorGroups = SECTOR_CHATS.filter(
    (group) => Boolean(isAdmin) || currentSectors.some((sector) => group.sectors.includes(sector))
  );

  const accessibleCustomGroups = customGroups.filter(
    (group) =>
      Boolean(currentUser) && (group.participants.includes(currentUser.id) || Boolean(isAdmin))
  );

  const accessibleGroupIds = [
    ...accessibleSectorGroups.map((group) => group.id),
    ...accessibleCustomGroups.map((group) => group.id),
  ];

  const {
    unreadByGroup,
    totalUnread: groupUnreadTotal,
    markGroupAsRead,
  } = useGroupUnread(currentUser?.id, currentUser?.username, accessibleGroupIds);

  const privateUnreadTotal = previews.reduce((total, preview) => total + preview.unreadCount, 0);

  // Preload happens globally in AppLayout right after login (background, progressive).
  // Aqui apenas garantimos que se o usuário entrar direto no /chat, o preload rode também.
  useEffect(() => {
    if (currentUser?.username) {
    }
  }, [currentUser?.username]);

  const selectedPreview = selectedUser
    ? previews.find((preview) => preview.partnerUsername === selectedUser.username)
    : undefined;

  useEffect(() => {
    if (selectedUser && currentUser) {
      void markAsRead(selectedUser.username);
    }
  }, [
    selectedUser,
    currentUser,
    markAsRead,
    selectedPreview?.lastMessageAt,
    selectedPreview?.unreadCount,
  ]);

  useEffect(() => {
    if (selectedGroup && (unreadByGroup[selectedGroup] || 0) > 0) {
      void markGroupAsRead(selectedGroup);
    }
  }, [selectedGroup, unreadByGroup, markGroupAsRead]);

  if (!currentUser) return null;

  const chatPartners = users.filter((u) => u.id !== currentUser.id);

  const sortedPartners = [...chatPartners].sort((a, b) => {
    const previewA = previews.find((p) => p.partnerUsername === a.username);
    const previewB = previews.find((p) => p.partnerUsername === b.username);
    if (!previewA && !previewB) return 0;
    if (!previewA) return 1;
    if (!previewB) return -1;
    return new Date(previewB.lastMessageAt).getTime() - new Date(previewA.lastMessageAt).getTime();
  });

  const selectPrivate = (user: User) => {
    setSelectedUser(user);
    setSelectedGroup(null);
  };

  const selectGroup = (groupId: string, name: string) => {
    setSelectedGroup(groupId);
    setSelectedGroupName(name);
    setSelectedUser(null);
    void markGroupAsRead(groupId);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }
    if (selectedParticipants.length === 0) {
      toast.error('Selecione ao menos um participante');
      return;
    }
    // Always include the creator
    const participants = [...new Set([currentUser.id, ...selectedParticipants])];
    await createGroup(newGroupName.trim(), participants, currentUser.id);
    toast.success('Grupo criado!');
    setShowCreateGroup(false);
    setNewGroupName('');
    setSelectedParticipants([]);
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-card md:flex-row">
      <div
        className={cn(
          'min-h-0 flex-col overflow-hidden border-border/70 bg-card',
          selectedUser || selectedGroup
            ? 'hidden md:flex md:w-[300px] md:border-r'
            : 'flex w-full md:w-[300px] md:border-r'
        )}
      >
        <div className="border-b border-border/70 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Comunicação interna
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Chat</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Conversas privadas e grupos da equipe
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border/70 p-2">
          <button
            onClick={() => setTab('private')}
            className={cn(
              'jf-interactive flex-1 rounded-xl px-3 py-2 text-sm font-medium',
              tab === 'private'
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
            onClick={() => setTab('groups')}
            className={cn(
              'jf-interactive flex-1 rounded-xl px-3 py-2 text-sm font-medium',
              tab === 'groups'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              Grupos
              {groupUnreadTotal > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {groupUnreadTotal > 99 ? '99+' : groupUnreadTotal}
                </span>
              )}
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === 'private' ? (
            sortedPartners.map((user) => {
              const preview = previews.find((p) => p.partnerUsername === user.username);
              return (
                <button
                  key={user.id}
                  onClick={() => selectPrivate(user)}
                  className={cn(
                    'jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/45',
                    selectedUser?.id === user.id &&
                      !selectedGroup &&
                      'bg-primary/[0.07] ring-1 ring-primary/15',
                    preview?.unreadCount && selectedUser?.id !== user.id && 'bg-primary/[0.035]'
                  )}
                >
                  <ChatAvatar src={user.avatar} name={user.name} className="h-10 w-10 rounded-xl" />
                  <div className="min-w-0 flex-1 text-left">
                    <p
                      className={cn(
                        'truncate text-sm text-foreground',
                        preview?.unreadCount ? 'font-bold' : 'font-medium'
                      )}
                    >
                      {user.name}
                    </p>
                    {preview ? (
                      <p
                        className={cn(
                          'truncate text-[11px]',
                          privateTypingUserIds.includes(user.id)
                            ? 'font-bold italic text-primary animate-pulse [animation-duration:1.8s]'
                            : preview.unreadCount > 0
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground'
                        )}
                      >
                        {privateTypingUserIds.includes(user.id)
                          ? 'Digitando...'
                          : preview.lastMessageContent}
                      </p>
                    ) : (
                      <p
                        className={cn(
                          'text-[11px] capitalize',
                          privateTypingUserIds.includes(user.id)
                            ? 'font-bold italic text-primary animate-pulse [animation-duration:1.8s]'
                            : 'text-muted-foreground'
                        )}
                      >
                        {privateTypingUserIds.includes(user.id)
                          ? 'Digitando...'
                          : user.role === 'admin'
                            ? 'Administrador'
                            : 'Funcionário'}
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
                    {preview && preview.unreadCount > 0 && (
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
              );
            })
          ) : (
            <>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="jf-interactive mb-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] px-3 py-2.5 text-primary hover:bg-primary/[0.07]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Plus className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-medium">Criar Novo Grupo</p>
                </button>
              )}
              {accessibleSectorGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => selectGroup(group.id, group.name)}
                  className={cn(
                    'jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/45',
                    selectedGroup === group.id && 'bg-primary/[0.07] ring-1 ring-primary/15',
                    (unreadByGroup[group.id] || 0) > 0 &&
                      selectedGroup !== group.id &&
                      'bg-primary/[0.035]'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p
                      className={cn(
                        'truncate text-sm text-foreground',
                        (unreadByGroup[group.id] || 0) > 0 ? 'font-bold' : 'font-medium'
                      )}
                    >
                      {group.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {group.sectors.length} setores
                    </p>
                  </div>
                  {(unreadByGroup[group.id] || 0) > 0 && (
                    <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px]">
                      {unreadByGroup[group.id] > 99 ? '99+' : unreadByGroup[group.id]}
                    </Badge>
                  )}
                </button>
              ))}
              {accessibleCustomGroups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    'jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/45',
                    selectedGroup === group.id && 'bg-primary/[0.07] ring-1 ring-primary/15',
                    (unreadByGroup[group.id] || 0) > 0 &&
                      selectedGroup !== group.id &&
                      'bg-primary/[0.035]'
                  )}
                >
                  <button
                    onClick={() => selectGroup(group.id, group.name)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p
                        className={cn(
                          'truncate text-sm text-foreground',
                          (unreadByGroup[group.id] || 0) > 0 ? 'font-bold' : 'font-medium'
                        )}
                      >
                        {group.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {group.participants.length} participantes
                      </p>
                    </div>
                  </button>

                  {(unreadByGroup[group.id] || 0) > 0 && (
                    <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px]">
                      {unreadByGroup[group.id] > 99 ? '99+' : unreadByGroup[group.id]}
                    </Badge>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm('Excluir este grupo?')) {
                          deleteGroup(group.id);
                          if (selectedGroup === group.id) setSelectedGroup(null);
                          toast.success('Grupo excluído');
                        }
                      }}
                      className="jf-interactive flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <section
        className={cn(
          'min-h-0 flex-1 flex-col overflow-hidden bg-background/20',
          !selectedUser && !selectedGroup ? 'hidden md:flex' : 'flex'
        )}
      >
        {(selectedUser || selectedGroup) && (
          <button
            onClick={() => {
              setSelectedUser(null);
              setSelectedGroup(null);
            }}
            className="jf-interactive flex shrink-0 items-center gap-2 border-b border-border/70 bg-card px-4 py-3 text-sm font-medium text-primary md:hidden"
          >
            ← Voltar
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedGroup ? (
            <GroupChatPanel groupId={selectedGroup} groupName={selectedGroupName} />
          ) : selectedUser ? (
            <ChatPanel otherUser={selectedUser} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
              <p className="text-sm font-medium text-foreground">Selecione uma conversa</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Escolha uma pessoa ou grupo ao lado para iniciar ou continuar uma conversa.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo</DialogTitle>
            <DialogDescription>
              Defina o nome do grupo e selecione os participantes.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nome do grupo"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Selecionar participantes:
            </p>
            {users
              .filter((u) => u.id !== currentUser.id)
              .map((user) => (
                <label
                  key={user.id}
                  className="jf-interactive flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-muted/45"
                >
                  <Checkbox
                    checked={selectedParticipants.includes(user.id)}
                    onCheckedChange={() => toggleParticipant(user.id)}
                  />
                  <ChatAvatar src={user.avatar} name={user.name} className="h-8 w-8 rounded-lg" />
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {user.role === 'admin'
                        ? 'Admin'
                        : user.sectors?.map((s) => SECTOR_LABELS[s]).join(', ') || 'Sem setor'}
                    </p>
                  </div>
                </label>
              ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateGroup(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateGroup}>Criar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
