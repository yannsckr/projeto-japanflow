import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Megaphone, Plus, Trash2, Users, Paperclip, X, FileIcon, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SECTOR_LABELS, Sector } from '@/types';
import { uploadImage } from '@/lib/uploadImage';

interface PopupAttachment {
  url: string;
  name: string;
  type: string;
}

interface PopupRow {
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

export default function AdminPopupComposer() {
  const { currentUser, users } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'all' | 'sector' | 'users'>('all');
  const [selectedSectors, setSelectedSectors] = useState<Sector[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<PopupAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [acks, setAcks] = useState<
    Array<{ popup_id: string; user_id: string; acknowledged_at: string }>
  >([]);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchPopups = async () => {
    const [pRes, aRes] = await Promise.all([
      (supabase as any).from('admin_popups').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('admin_popup_acks').select('popup_id, user_id, acknowledged_at'),
    ]);
    if (pRes.data) setPopups(pRes.data as PopupRow[]);
    if (aRes.data) setAcks(aRes.data as any);
  };

  useEffect(() => {
    fetchPopups();
    const ch = supabase
      .channel('admin-popups-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_popups' }, () =>
        fetchPopups()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_popup_acks' }, () =>
        fetchPopups()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const getName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const reset = () => {
    setTitle('');
    setContent('');
    setMode('all');
    setSelectedSectors([]);
    setSelectedUsers([]);
    setAttachments([]);
  };

  const uploadFile = async (file: File): Promise<PopupAttachment | null> => {
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: 'popups',
        sourceTable: 'admin_popups',
        sourceField: 'attachments',
        preserve: true,
      });
      return { url: publicUrl, name: file.name, type: file.type || 'application/octet-stream' };
    } catch {
      toast.error('Erro ao enviar anexo');
      return null;
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    const uploaded: PopupAttachment[] = [];
    for (const f of list) {
      const a = await uploadFile(f);
      if (a) uploaded.push(a);
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  const handleSend = async () => {
    if (!currentUser) return;
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e mensagem');
      return;
    }
    if (mode === 'sector' && selectedSectors.length === 0) {
      toast.error('Selecione ao menos um setor');
      return;
    }
    if (mode === 'users' && selectedUsers.length === 0) {
      toast.error('Selecione ao menos um usuário');
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).from('admin_popups').insert({
      title: title.trim(),
      content: content.trim(),
      created_by: currentUser.id,
      target_mode: mode,
      target_sectors: mode === 'sector' ? selectedSectors : [],
      target_users: mode === 'users' ? selectedUsers : [],
      attachments,
    });
    setSending(false);
    if (error) {
      toast.error('Erro ao enviar');
      return;
    }
    toast.success('Pop-up enviado');
    reset();
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from('admin_popup_acks').delete().eq('popup_id', id);
    await (supabase as any).from('admin_popups').delete().eq('id', id);
    toast.success('Pop-up removido');
  };

  const toggleSector = (s: Sector) => {
    setSelectedSectors((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const describeTarget = (p: PopupRow) => {
    if (p.target_mode === 'all') return 'Todos os usuários';
    if (p.target_mode === 'sector')
      return `Setores: ${(p.target_sectors || []).map((s) => SECTOR_LABELS[s as Sector] || s).join(', ')}`;
    return `Usuários: ${(p.target_users || []).map(getName).join(', ')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Envie um pop-up para todos os usuários ou para setores específicos. Quem estiver offline
          verá ao fazer login.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Novo Pop-up
        </Button>
      </div>

      {popups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum pop-up enviado ainda
        </p>
      ) : (
        <div className="space-y-2">
          {popups.map((p) => {
            const popupAcks = acks
              .filter((a) => a.popup_id === p.id)
              .sort(
                (a, b) =>
                  new Date(b.acknowledged_at).getTime() - new Date(a.acknowledged_at).getTime()
              );
            const isOpen = !!expanded[p.id];
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Megaphone className="w-3 h-3 text-primary" />
                      {p.title}
                    </h4>
                    <p className="text-xs mt-1 whitespace-pre-wrap text-foreground/80 line-clamp-3">
                      {p.content}
                    </p>
                    {Array.isArray(p.attachments) && p.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.attachments.map((a, i) =>
                          a.type?.startsWith('image/') ? (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer">
                              <img
                                src={a.url}
                                alt={a.name}
                                className="w-12 h-12 object-cover rounded border border-border"
                              />
                            </a>
                          ) : (
                            <a
                              key={i}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-muted rounded border border-border text-[10px]"
                            >
                              <FileIcon className="w-3 h-3" />
                              <span className="max-w-[100px] truncate">{a.name}</span>
                            </a>
                          )
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {describeTarget(p)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Por {getName(p.created_by)} • {new Date(p.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="mt-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    👍 {popupAcks.length} curtida{popupAcks.length === 1 ? '' : 's'} (lido por)
                    <span className="text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {popupAcks.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Ninguém curtiu/leu ainda.
                        </p>
                      ) : (
                        popupAcks.map((a, i) => (
                          <p key={i} className="text-[11px] flex justify-between gap-2">
                            <span className="font-medium">{getName(a.user_id)}</span>
                            <span className="text-muted-foreground">
                              {new Date(a.acknowledged_at).toLocaleString('pt-BR')}
                            </span>
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Pop-up Administrativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Reunião amanhã"
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                rows={5}
                placeholder="Conteúdo do pop-up... (cole imagens diretamente aqui)"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Anexos (imagens / documentos)</Label>
                <label className="text-xs text-primary cursor-pointer flex items-center gap-1 hover:underline">
                  <Paperclip className="w-3 h-3" />
                  Adicionar arquivo
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {uploading && (
                <p className="text-[11px] text-muted-foreground mt-1">Enviando anexo(s)...</p>
              )}
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-muted/40 border border-border rounded p-1.5"
                    >
                      {a.type.startsWith('image/') ? (
                        <img src={a.url} alt={a.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
                          <FileIcon className="w-4 h-4" />
                        </div>
                      )}
                      <span className="flex-1 text-xs truncate">{a.name}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Destinatários</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as 'all' | 'sector' | 'users')}
                className="mt-2 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="pop-all" />
                  <Label htmlFor="pop-all" className="text-sm font-normal cursor-pointer">
                    Todos os usuários
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sector" id="pop-sector" />
                  <Label htmlFor="pop-sector" className="text-sm font-normal cursor-pointer">
                    Setor(es) específico(s)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="users" id="pop-users" />
                  <Label htmlFor="pop-users" className="text-sm font-normal cursor-pointer">
                    Usuário(s) específico(s)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {mode === 'sector' && (
              <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedSectors.includes(s)}
                      onCheckedChange={() => toggleSector(s)}
                    />
                    {SECTOR_LABELS[s]}
                  </label>
                ))}
              </div>
            )}

            {mode === 'users' && (
              <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedUsers.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || uploading}>
                <Megaphone className="w-3 h-3 mr-1" /> Enviar Pop-up
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
