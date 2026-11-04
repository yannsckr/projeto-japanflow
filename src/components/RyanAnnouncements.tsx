import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Megaphone, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { uploadImage } from '@/lib/uploadImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Announcement = {
  id: string;
  title: string;
  body: string;
  image_urls?: string[];
  media_types?: string[];
  created_by: string;
  batch_id?: string;
  batch_order?: number;
  target_user_ids?: string[];
};
type Draft = { id: number; title: string; body: string; files: File[] };
const empty = (id: number): Draft => ({ id, title: '', body: '', files: [] });

export default function RyanAnnouncements() {
  const { authenticatedUser, users } = useApp();
  const [items, setItems] = useState<Announcement[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [composer, setComposer] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([empty(0)]);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const eligibleUsers = users.filter((user) => user.active);
  const filteredUsers = eligibleUsers.filter((user) =>
    `${user.name} ${user.username}`
      .toLocaleLowerCase('pt-BR')
      .includes(recipientSearch.toLocaleLowerCase('pt-BR').trim())
  );
  const toggleRecipient = (userId: string) =>
    setSelectedUserIds((previous) => {
      if (previous.includes(userId)) return previous.filter((id) => id !== userId);
      if (previous.length >= 250) {
        toast.error('Selecione no máximo 250 destinatários por envio');
        return previous;
      }
      return [...previous, userId];
    });
  const [mediaIndex, setMediaIndex] = useState(0);
  const isRyan = authenticatedUser?.username?.trim().toLowerCase() === 'ryan';
  const uid = authenticatedUser?.id;
  const valid = drafts.length > 0 && drafts.every((d) => d.title.trim() && d.body.trim());
  const edit = (id: number, change: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...change } : d)));

  useEffect(() => {
    if (!uid) return;
    setLoaded(false);
    setSeen(new Set());
    return onSnapshot(
      query(collection(db, 'ryan_announcement_acks'), where('user_id', '==', uid)),
      (snap) => {
        setSeen(
          new Set(
            snap.docs
              .filter((d) => d.data().user_id === uid)
              .map((d) => String(d.data().announcement_id))
          )
        );
        setLoaded(true);
      },
      (e) => console.warn('Avisos: falha ao buscar confirmações', e)
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, 'ryan_announcements'), orderBy('created_at', 'asc')),
      (snap) =>
        setItems(
          snap.docs
            .map((d) => ({
              id: d.id,
              title: String(d.data().title || ''),
              body: String(d.data().body || ''),
              image_urls: Array.isArray(d.data().image_urls) ? d.data().image_urls : [],
              media_types: Array.isArray(d.data().media_types) ? d.data().media_types : [],
              created_by: String(d.data().created_by || ''),
              batch_id: String(d.data().batch_id || ''),
              batch_order: Number(d.data().batch_order || 0),
              target_user_ids: Array.isArray(d.data().target_user_ids)
                ? d
                    .data()
                    .target_user_ids.filter((id: unknown): id is string => typeof id === 'string')
                : undefined,
            }))
            .sort((a, b) =>
              a.batch_id && a.batch_id === b.batch_id ? a.batch_order - b.batch_order : 0
            )
        ),
      (e) => console.warn('Avisos: falha ao buscar anúncios', e)
    );
  }, [uid]);

  // Avisos antigos (sem target_user_ids) continuam visíveis a toda a equipe.
  const current = loaded
    ? items.find(
        (item) =>
          !seen.has(item.id) &&
          (!item.target_user_ids || (uid != null && item.target_user_ids.includes(uid)))
      )
    : undefined;
  useEffect(() => {
    setMediaIndex(0);
  }, [current?.id]);
  const acknowledge = async () => {
    if (!current || !uid) return;
    try {
      await setDoc(doc(db, 'ryan_announcement_acks', `${current.id}_${uid}`), {
        announcement_id: current.id,
        user_id: uid,
        acknowledged_at: serverTimestamp(),
      });
    } catch {
      toast.error('Não foi possível confirmar o aviso');
    }
  };
  const publish = async () => {
    if (!uid || !isRyan || !valid || sending) return;
    const recipients = selectedUserIds.filter((id) => eligibleUsers.some((user) => user.id === id));
    if (audience === 'selected' && recipients.length === 0) {
      toast.error('Selecione pelo menos um destinatário ativo');
      return;
    }
    setSending(true);
    try {
      const batch = writeBatch(db);
      const batchId = `${Date.now()}-${uid}`;
      for (let index = 0; index < drafts.length; index++) {
        const draft = drafts[index];
        const reference = doc(collection(db, 'ryan_announcements'));
        const imageUrls: string[] = [];
        const mediaTypes: string[] = [];
        for (const file of draft.files) {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/'))
            throw new Error('Anexe apenas fotos ou vídeos');
          if (file.type.startsWith('video/') && file.size > 25 * 1024 * 1024)
            throw new Error('Vídeo acima de 25 MB');
          const uploaded = await uploadImage(file, {
            pathPrefix: 'announcements',
            sourceTable: 'ryan_announcements',
            sourceId: reference.id,
            sourceField: 'image_urls',
            uploadedBy: uid,
          });
          imageUrls.push(uploaded.publicUrl);
          mediaTypes.push(file.type.startsWith('video/') ? 'video' : 'image');
        }
        batch.set(reference, {
          title: draft.title.trim().slice(0, 120),
          body: draft.body.trim().slice(0, 3000),
          image_urls: imageUrls,
          media_types: mediaTypes,
          batch_id: batchId,
          batch_order: index,
          created_by: uid,
          created_at: serverTimestamp(),
          ...(audience === 'selected' ? { target_user_ids: recipients } : {}),
        });
      }
      await batch.commit();
      toast.success(
        `${drafts.length} aviso(s) publicado(s) para ${audience === 'all' ? 'toda a equipe' : `${recipients.length} destinatário(s)`}`
      );
      setComposer(false);
      setDrafts([empty(0)]);
      setAudience('all');
      setSelectedUserIds([]);
      setRecipientSearch('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao publicar os avisos; confira os anexos');
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      {isRyan && (
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setComposer(true)}>
          <Megaphone className="h-4 w-4" /> Avisar equipe
        </Button>
      )}
      <Dialog
        open={composer}
        onOpenChange={(value) => {
          if (!sending) setComposer(value);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Enviar avisos do sistema</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Monte vários avisos. Eles serão publicados juntos e exibidos um após o outro, com
            confirmação individual.
          </p>
          <section
            className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3"
            aria-label="Destinatários dos avisos"
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Quem deve receber?
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="announcement-audience"
                  checked={audience === 'all'}
                  disabled={sending}
                  onChange={() => setAudience('all')}
                />
                Toda a equipe
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="announcement-audience"
                  checked={audience === 'selected'}
                  disabled={sending}
                  onChange={() => setAudience('selected')}
                />
                Selecionar pessoas
              </label>
            </div>
            {audience === 'selected' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar destinatário"
                    className="pl-9"
                    placeholder="Buscar por nome ou usuário"
                    value={recipientSearch}
                    disabled={sending}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                  />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                  {filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        disabled={sending}
                        onChange={() => toggleRecipient(user.id)}
                      />
                      <span className="min-w-0 truncate">
                        {user.name}{' '}
                        <span className="text-xs text-muted-foreground">@{user.username}</span>
                      </span>
                    </label>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground">
                      Nenhum usuário ativo encontrado.
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {
                    selectedUserIds.filter((id) => eligibleUsers.some((user) => user.id === id))
                      .length
                  }{' '}
                  destinatário(s) selecionado(s). A seleção vale para todos os avisos deste envio.
                </p>
              </div>
            )}
          </section>
          <div className="space-y-4">
            {drafts.map((draft, index) => (
              <div key={draft.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm">Aviso {index + 1}</strong>
                  {drafts.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={sending}
                      onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== draft.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  aria-label={`Título do aviso ${index + 1}`}
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) => edit(draft.id, { title: e.target.value })}
                  placeholder="Título da atualização"
                />
                <Textarea
                  onPaste={(event) => {
                    const images = Array.from(event.clipboardData.files).filter((file) =>
                      file.type.startsWith('image/')
                    );
                    if (!images.length || sending) return;
                    event.preventDefault();
                    edit(draft.id, { files: [...draft.files, ...images].slice(0, 5) });
                    toast.success('Imagem colada no aviso');
                  }}
                  aria-label={`Mensagem do aviso ${index + 1}`}
                  value={draft.body}
                  maxLength={3000}
                  onChange={(e) => edit(draft.id, { body: e.target.value })}
                  rows={4}
                  placeholder="O que mudou no sistema?"
                />
                <label className="block text-xs text-muted-foreground">
                  Anexar fotos ou vídeos (até 5 arquivos por aviso; vídeos até 25 MB)
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={sending}
                    className="mt-1 block w-full text-xs"
                    onChange={(e) => {
                      edit(draft.id, {
                        files: [...draft.files, ...Array.from(e.target.files || [])].slice(0, 5),
                      });
                      e.target.value = '';
                    }}
                  />
                </label>
                {!!draft.files.length && (
                  <p className="text-xs text-muted-foreground">
                    {draft.files.map((f) => f.name).join(', ')}{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => edit(draft.id, { files: [] })}
                    >
                      Limpar
                    </button>
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={sending || drafts.length >= 20}
              onClick={() =>
                setDrafts((prev) => [...prev, empty(Math.max(0, ...prev.map((d) => d.id)) + 1)])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Adicionar aviso
            </Button>
            <Button
              disabled={
                sending ||
                !valid ||
                (audience === 'selected' &&
                  !selectedUserIds.some((id) => eligibleUsers.some((user) => user.id === id)))
              }
              onClick={() => void publish()}
            >
              {sending ? 'Publicando...' : `Publicar ${drafts.length} aviso(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(current)} onOpenChange={() => {}}>
        <DialogContent
          className="max-h-[94vh] overflow-y-auto sm:max-w-4xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{current?.title || 'Atualização do JapanFlow'}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm">{current?.body}</p>
          {!!current?.image_urls?.length && (
            <div className="space-y-2">
              <div className="relative flex items-center justify-center overflow-hidden rounded-lg border bg-black/5 p-2">
                {current.media_types?.[mediaIndex] === 'video' ? (
                  <video
                    key={current.image_urls[mediaIndex]}
                    src={current.image_urls[mediaIndex]}
                    controls
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    className="max-h-[62vh] w-full rounded-lg bg-black object-contain"
                  />
                ) : (
                  <a
                    href={current.image_urls[mediaIndex]}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir imagem em tamanho original"
                    className="flex w-full justify-center"
                  >
                    <img
                      src={current.image_urls[mediaIndex]}
                      alt={`Imagem ${mediaIndex + 1} do aviso`}
                      className="max-h-[45vh] w-full rounded object-contain"
                    />
                  </a>
                )}
                {current.image_urls.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Anexo anterior"
                      title="Anexo anterior"
                      onClick={() =>
                        setMediaIndex(
                          (i) => (i - 1 + current.image_urls!.length) % current.image_urls!.length
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow transition hover:scale-110"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Próximo anexo"
                      title="Próximo anexo"
                      onClick={() => setMediaIndex((i) => (i + 1) % current.image_urls!.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow transition hover:scale-110"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {current.image_urls.length > 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  {mediaIndex + 1} de {current.image_urls.length} anexos
                </p>
              )}
            </div>
          )}
          <Button onClick={() => void acknowledge()}>Entendi</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
