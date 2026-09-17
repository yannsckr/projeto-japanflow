import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useCorporate } from '@/hooks/useCorporate';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Megaphone,
  Newspaper,
  Lightbulb,
  BarChart3,
  Pin,
  Trash2,
  Send,
  Plus,
  X,
  Printer,
  SmilePlus,
  Bell,
  Truck,
} from 'lucide-react';
import AdminPopupComposer from '@/components/AdminPopupComposer';
import CarriersPanel from '@/components/CarriersPanel';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

const CorporateToolsPage = () => {
  const { currentUser, users } = useApp();
  const corporate = useCorporate();
  const featPerms = useFeaturePermissions();
  const baseAdmin = currentUser?.role === 'admin';
  const isAdmin = baseAdmin || featPerms.hasFeature(currentUser?.id, 'corporate_tools');

  // Bulk announcement state
  const [bulkMsg, setBulkMsg] = useState('');
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Bulletin state
  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinContent, setBulletinContent] = useState('');
  const [showBulletinDialog, setShowBulletinDialog] = useState(false);

  // Suggestion state
  const [suggestionText, setSuggestionText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDeadline, setPollDeadline] = useState('');
  const [showPollDialog, setShowPollDialog] = useState(false);

  if (!currentUser) return null;

  const getName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const handlePrintPost = (post: {
    title: string;
    content: string;
    createdBy: string;
    createdAt: string;
  }) => {
    const authorName = getName(post.createdBy);
    const date = new Date(post.createdAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document
      .write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${post.title}</title>
<style>
@page { size: A4; margin: 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 20mm; }
.frame { border: 1.5px solid #222; padding: 30px 35px; min-height: calc(100vh - 40mm); display: flex; flex-direction: column; }
.header { display: flex; align-items: center; justify-content: center; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #ccc; }
.header img { height: 48px; filter: invert(1); }
.title { font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 8px; line-height: 1.3; }
.meta { font-size: 11px; color: #666; text-align: center; margin-bottom: 28px; }
.content { font-size: 14px; line-height: 1.85; white-space: pre-wrap; word-wrap: break-word; flex: 1; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #ccc; font-size: 10px; color: #999; text-align: center; }
@media print { body { padding: 0; } }
</style></head><body>
<div class="frame">
  <div class="header"><img src="/images/logo-print.png" alt="JapanFlow" /></div>
  <div class="title">${post.title}</div>
  <div class="meta">Publicado por ${authorName} em ${date}</div>
  <div class="content">${post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="footer">JapanFlow &bull; Comunicação Interna</div>
</div>
</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Bulk Announcement
  const handleBulkSend = async () => {
    if (!bulkMsg.trim()) return;
    const employees = users.filter((u) => u.role === 'employee');
    for (const emp of employees) {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.id,
        receiverId: emp.id,
        content: `📢 ${bulkMsg.trim()}`,
        timestamp: Timestamp.now(),
        read: false,
        edited: false,
        deleted: false,
      });
    }
    toast.success(`Aviso enviado para ${employees.length} funcionários`);
    setBulkMsg('');
    setShowBulkDialog(false);
  };

  // Bulletin
  const handleAddPost = async () => {
    if (!bulletinTitle.trim() || !bulletinContent.trim()) return;
    await corporate.addBulletinPost(bulletinTitle.trim(), bulletinContent.trim(), currentUser.id);
    toast.success('Publicação criada');
    setBulletinTitle('');
    setBulletinContent('');
    setShowBulletinDialog(false);
  };

  // Suggestion
  const handleAddSuggestion = async () => {
    if (!suggestionText.trim()) return;
    await corporate.addSuggestion(suggestionText.trim(), currentUser.id);
    toast.success('Sugestão enviada');
    setSuggestionText('');
  };

  const handleRespond = async (id: string) => {
    if (!responseText.trim()) return;
    await corporate.respondSuggestion(id, responseText.trim());
    toast.success('Resposta enviada');
    setResponseText('');
    setRespondingId(null);
  };

  // Poll
  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast.error('Informe a pergunta e pelo menos 2 opções');
      return;
    }
    await corporate.createPoll(
      pollQuestion.trim(),
      validOptions,
      currentUser.id,
      pollDeadline || undefined
    );
    toast.success('Enquete criada');
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDeadline('');
    setShowPollDialog(false);
  };

  const handleVote = async (pollId: string, optionId: string) => {
    await corporate.votePoll(pollId, optionId, currentUser.id);
    toast.success('Voto registrado');
  };

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <section className="jf-surface overflow-hidden p-4 md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Comunicação
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ferramentas Corporativas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Mural, avisos, enquetes e recursos internos da empresa.
        </p>
      </section>

      <Tabs defaultValue="bulletin" className="min-w-0 w-full">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <TabsList className="inline-flex h-10 w-max min-w-max justify-start gap-1">
            <TabsTrigger value="bulletin" className="shrink-0 text-xs">
              <Newspaper className="w-3 h-3 mr-1" />
              Mural
            </TabsTrigger>
            <TabsTrigger value="announcements" className="shrink-0 text-xs">
              <Megaphone className="w-3 h-3 mr-1" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="popups" className="shrink-0 text-xs">
              <Bell className="w-3 h-3 mr-1" />
              Pop-ups
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="shrink-0 text-xs">
              <Lightbulb className="w-3 h-3 mr-1" />
              Sugestões
            </TabsTrigger>
            <TabsTrigger value="polls" className="shrink-0 text-xs">
              <BarChart3 className="w-3 h-3 mr-1" />
              Enquetes
            </TabsTrigger>
            {baseAdmin && (
              <TabsTrigger value="carriers" className="shrink-0 text-xs">
                <Truck className="w-3 h-3 mr-1" />
                Transportadoras
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="popups" className="min-w-0 space-y-4">
          {isAdmin ? (
            <AdminPopupComposer />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Apenas administradores podem enviar pop-ups
            </p>
          )}
        </TabsContent>

        {baseAdmin && (
          <TabsContent value="carriers" className="space-y-4">
            <CarriersPanel />
          </TabsContent>
        )}

        {/* Mural */}
        <TabsContent value="bulletin" className="space-y-4">
          {isAdmin && (
            <Button
              onClick={() => setShowBulletinDialog(true)}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Plus className="w-3 h-3 mr-1" />
              Nova Publicação
            </Button>
          )}
          {corporate.bulletinPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma publicação no mural
            </p>
          ) : (
            <div className="space-y-3">
              {corporate.bulletinPosts.map((post) => (
                <div
                  key={post.id}
                  className={cn(
                    'bg-card border border-border rounded-xl p-4',
                    post.pinned && 'border-primary/30 bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {post.pinned && <Pin className="w-3 h-3 text-primary" />}
                      <h4 className="font-semibold text-sm">{post.title}</h4>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handlePrintPost(post)}
                        title="Imprimir"
                      >
                        <Printer className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => corporate.togglePinPost(post.id, post.pinned)}
                          >
                            <Pin className={cn('w-3 h-3', post.pinned && 'text-primary')} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => corporate.deleteBulletinPost(post.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{post.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Por {getName(post.createdBy)} •{' '}
                    {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                  </p>

                  {/* Emoji Reactions */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {(() => {
                      const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏'];
                      const grouped = EMOJIS.map((emoji) => {
                        const reactions = post.reactions.filter((r) => r.emoji === emoji);
                        const hasReacted = reactions.some((r) => r.userId === currentUser.id);
                        return { emoji, reactions, hasReacted };
                      }).filter((g) => g.reactions.length > 0);

                      return (
                        <>
                          {grouped.map(({ emoji, reactions, hasReacted }) => (
                            <TooltipProvider key={emoji}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      // Apenas administradores podem alterar/remover reações.
                                      // Usuários comuns: bloquear clique em emoji que já reagiram.
                                      if (!isAdmin && hasReacted) return;
                                      corporate.toggleReaction(post.id, currentUser.id, emoji);
                                    }}
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                                      hasReacted
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-secondary/50 hover:bg-secondary',
                                      !isAdmin && hasReacted && 'cursor-not-allowed opacity-90'
                                    )}
                                    title={
                                      !isAdmin && hasReacted
                                        ? 'Apenas administradores podem remover reações'
                                        : undefined
                                    }
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-medium">{reactions.length}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <div className="space-y-1">
                                    {reactions.map((r) => (
                                      <p key={r.id} className="shrink-0 text-xs">
                                        <span className="font-semibold">{getName(r.userId)}</span>
                                        {isAdmin && (
                                          <span className="text-muted-foreground ml-1">
                                            •{' '}
                                            {new Date(r.createdAt).toLocaleString('pt-BR', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        )}
                                      </p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}

                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border bg-secondary/50 hover:bg-secondary transition-colors">
                                <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" side="top">
                              <div className="flex gap-1">
                                {EMOJIS.map((emoji) => {
                                  const alreadyReacted = post.reactions.some(
                                    (r) => r.userId === currentUser.id && r.emoji === emoji
                                  );
                                  const blocked = !isAdmin && alreadyReacted;
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => {
                                        if (blocked) return;
                                        corporate.toggleReaction(post.id, currentUser.id, emoji);
                                      }}
                                      className={cn(
                                        'text-lg hover:scale-125 transition-transform p-1',
                                        blocked && 'opacity-40 cursor-not-allowed hover:scale-100'
                                      )}
                                      title={
                                        blocked
                                          ? 'Apenas administradores podem remover reações'
                                          : undefined
                                      }
                                    >
                                      {emoji}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Avisos em Massa */}
        <TabsContent value="announcements" className="space-y-4">
          {isAdmin ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envie uma mensagem privada para todos os funcionários simultaneamente.
              </p>
              <Button onClick={() => setShowBulkDialog(true)}>
                <Megaphone className="w-4 h-4 mr-2" />
                Enviar Aviso em Massa
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Apenas administradores podem enviar avisos em massa
            </p>
          )}
        </TabsContent>

        {/* Sugestões */}
        <TabsContent value="suggestions" className="space-y-4">
          {!isAdmin && (
            <div className="flex gap-2">
              <Textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder="Escreva sua sugestão..."
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={handleAddSuggestion}
                disabled={!suggestionText.trim()}
                size="icon"
                className="shrink-0 self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
          {(isAdmin
            ? corporate.suggestions
            : corporate.suggestions.filter((s) => s.createdBy === currentUser.id)
          ).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sugestão</p>
          ) : (
            <div className="space-y-3">
              {(isAdmin
                ? corporate.suggestions
                : corporate.suggestions.filter((s) => s.createdBy === currentUser.id)
              ).map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{s.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Por {getName(s.createdBy)} •{' '}
                        {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-7 w-7 text-destructive hover:text-destructive"
                        onClick={async () => {
                          await corporate.deleteSuggestion(s.id);
                          toast.success('Sugestão excluída');
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {s.adminResponse && (
                    <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs font-medium text-primary">Resposta do administrador:</p>
                      <p className="text-sm mt-1">{s.adminResponse}</p>
                    </div>
                  )}
                  {isAdmin &&
                    !s.adminResponse &&
                    (respondingId === s.id ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Responder..."
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => handleRespond(s.id)}>
                          Enviar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRespondingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setRespondingId(s.id);
                          setResponseText('');
                        }}
                      >
                        Responder
                      </Button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Enquetes */}
        <TabsContent value="polls" className="space-y-4">
          {isAdmin && (
            <Button onClick={() => setShowPollDialog(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="w-3 h-3 mr-1" />
              Nova Enquete
            </Button>
          )}
          {corporate.polls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma enquete</p>
          ) : (
            <div className="space-y-4">
              {corporate.polls.map((poll) => {
                const hasVoted = poll.votes.some((v) => v.voterId === currentUser.id);
                const totalVotes = poll.votes.length;
                return (
                  <div key={poll.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">{poll.question}</h4>
                      {isAdmin && poll.active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => corporate.closePoll(poll.id)}
                        >
                          Encerrar
                        </Button>
                      )}
                    </div>
                    {!poll.active && (
                      <p className="text-xs text-muted-foreground mb-2">Enquete encerrada</p>
                    )}
                    {poll.active && poll.expiresAt && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Encerra em: {new Date(poll.expiresAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                    <div className="space-y-2">
                      {poll.options.map((opt) => {
                        const optVotes = poll.votes.filter((v) => v.optionId === opt.id).length;
                        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                        return (
                          <div key={opt.id}>
                            {!hasVoted && poll.active ? (
                              <Button
                                variant="outline"
                                className="w-full justify-start text-sm"
                                onClick={() => handleVote(poll.id, opt.id)}
                              >
                                {opt.label}
                              </Button>
                            ) : (
                              <div className="relative bg-secondary rounded-lg overflow-hidden h-9">
                                <div
                                  className="absolute inset-y-0 left-0 bg-primary/20 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between px-3 h-full">
                                  <span className="text-sm">{opt.label}</span>
                                  <span className="text-xs font-semibold">
                                    {optVotes} ({pct}%)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Announcement Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aviso em Massa</DialogTitle>
          </DialogHeader>
          <Textarea
            value={bulkMsg}
            onChange={(e) => setBulkMsg(e.target.value)}
            placeholder="Mensagem para todos os funcionários..."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowBulkDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkSend} disabled={!bulkMsg.trim()}>
              Enviar para Todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulletin Dialog */}
      <Dialog open={showBulletinDialog} onOpenChange={setShowBulletinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Publicação</DialogTitle>
          </DialogHeader>
          <Input
            value={bulletinTitle}
            onChange={(e) => setBulletinTitle(e.target.value)}
            placeholder="Título"
          />
          <Textarea
            value={bulletinContent}
            onChange={(e) => setBulletinContent(e.target.value)}
            placeholder="Conteúdo"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowBulletinDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPost}>Publicar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Poll Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Enquete</DialogTitle>
          </DialogHeader>
          <Input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            placeholder="Pergunta da enquete"
          />
          <div>
            <label className="text-sm text-muted-foreground">
              Prazo de encerramento (opcional)
            </label>
            <Input
              type="datetime-local"
              value={pollDeadline}
              onChange={(e) => setPollDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const n = [...pollOptions];
                    n[i] = e.target.value;
                    setPollOptions(n);
                  }}
                  placeholder={`Opção ${i + 1}`}
                />
                {pollOptions.length > 2 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPollOptions([...pollOptions, ''])}
              >
                <Plus className="w-3 h-3 mr-1" />
                Opção
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowPollDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePoll}>Criar Enquete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CorporateToolsPage;
