import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { preloadAllChats } from '@/hooks/useSupabaseChat';
import ChatPanel from '@/components/ChatPanel';
import GroupChatPanel from '@/components/GroupChatPanel';
import { User, Sector, SECTOR_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Plus, Trash2 } from 'lucide-react';
import { useChatPreviews } from '@/hooks/useChatPreviews';
import { useCustomGroups } from '@/hooks/useCustomGroups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Preload happens globally in AppLayout right after login (background, progressive).
  // Aqui apenas garantimos que se o usuário entrar direto no /chat, o preload rode também.
  useEffect(() => {
    if (currentUser?.username) {
      preloadAllChats(currentUser.username);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    if (selectedUser && currentUser) {
      markAsRead(selectedUser.username);
    }
  }, [selectedUser, currentUser, markAsRead]);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const chatPartners = users.filter((u) => u.id !== currentUser.id);

  // Sector-based groups the user can access
  const accessibleSectorGroups = SECTOR_CHATS.filter(
    (g) => isAdmin || currentUser.sectors.some((s) => g.sectors.includes(s))
  );

  // Custom groups the user participates in
  const accessibleCustomGroups = customGroups.filter(
    (g) => g.participants.includes(currentUser.id) || isAdmin
  );

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
    <div className="flex h-full max-h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card md:flex-row flex-1">
      <div
        className={cn(
          'border-r border-border flex flex-col min-h-0 overflow-hidden',
          selectedUser || selectedGroup ? 'hidden md:flex md:w-64' : 'w-full md:w-64'
        )}
      >
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setTab('private')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-semibold transition-colors',
              tab === 'private' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            )}
          >
            Conversas
          </button>
          <button
            onClick={() => setTab('groups')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-semibold transition-colors',
              tab === 'groups' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            )}
          >
            Grupos
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === 'private' ? (
            sortedPartners.map((user) => {
              const preview = previews.find((p) => p.partnerUsername === user.username);
              return (
                <button
                  key={user.id}
                  onClick={() => selectPrivate(user)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0',
                    selectedUser?.id === user.id && !selectedGroup && 'bg-secondary'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary overflow-hidden shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    {preview ? (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {preview.lastMessageContent}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {preview && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(preview.lastMessageAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {preview && preview.unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="min-w-[20px] h-5 text-[10px] flex items-center justify-center px-1.5 animate-pulse"
                      >
                        {preview.unreadCount > 99 ? '99+' : preview.unreadCount}
                      </Badge>
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
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border text-primary"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0',
                    selectedGroup === group.id && 'bg-secondary'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {group.sectors.length} setores
                    </p>
                  </div>
                </button>
              ))}
              {accessibleCustomGroups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0',
                    selectedGroup === group.id && 'bg-secondary'
                  )}
                >
                  <button
                    onClick={() => selectGroup(group.id, group.name)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {group.participants.length} participantes
                      </p>
                    </div>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm('Excluir este grupo?')) {
                          deleteGroup(group.id);
                          if (selectedGroup === group.id) setSelectedGroup(null);
                          toast.success('Grupo excluído');
                        }
                      }}
                      className="p-1 hover:bg-destructive/10 rounded shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 overflow-hidden',
          !selectedUser && !selectedGroup ? 'hidden md:flex' : 'flex'
        )}
      >
        {(selectedUser || selectedGroup) && (
          <button
            onClick={() => {
              setSelectedUser(null);
              setSelectedGroup(null);
            }}
            className="md:hidden flex items-center gap-2 px-4 py-3 text-sm text-primary border-b border-border shrink-0 bg-card"
          >
            ← Voltar
          </button>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {selectedGroup ? (
            <GroupChatPanel groupId={selectedGroup} groupName={selectedGroupName} />
          ) : selectedUser ? (
            <ChatPanel otherUser={selectedUser} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do grupo"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <div className="space-y-1 max-h-60 overflow-auto">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Selecionar participantes:
            </p>
            {users
              .filter((u) => u.id !== currentUser.id)
              .map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedParticipants.includes(user.id)}
                    onCheckedChange={() => toggleParticipant(user.id)}
                  />
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                    )}
                  </div>
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
          <div className="flex justify-end gap-2">
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
