import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Archive, Download, RefreshCw, Search, MessageSquare } from 'lucide-react';
import JSZip from 'jszip';
import { getSignedUrl } from '@/lib/signedUrl';

interface Msg {
  id: string;
  sender_username: string;
  receiver_username: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type?: string | null;
  created_at: string;
}

interface Conversation {
  key: string;
  a: string;
  b: string;
  messages: Msg[];
}

const STORAGE_PREFIX = 'chatcache::v1::';

const readLocalCache = (): Msg[] => {
  const out: Msg[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...(parsed as Msg[]));
    }
  } catch {
    /* ignore */
  }
  return out;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

const sanitize = (s: string) => s.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'usuario';

const sanitizeFile = (s: string) => s.replace(/[^\p{L}\p{N}\-_. ]/gu, '_').trim() || 'arquivo';

const extFromMime = (mime?: string | null) => {
  if (!mime) return 'bin';
  const m = mime.split(';')[0].split('/')[1] || 'bin';
  return m === 'jpeg' ? 'jpg' : m.replace(/[^a-z0-9]/gi, '') || 'bin';
};

/** Nome final do anexo (sempre com extensão). */
const attachmentFileName = (m: Msg): string => {
  const raw = (m.attachment_name || '').trim();
  if (raw && /\.[a-z0-9]{2,5}$/i.test(raw)) return sanitizeFile(raw);
  const url = m.attachment_url || '';
  let ext = '';
  if (url.startsWith('data:')) {
    ext = extFromMime(url.slice(5).split(',')[0]);
  } else {
    const clean = url.split('?')[0];
    const guess = clean.split('/').pop() || '';
    if (/\.[a-z0-9]{2,5}$/i.test(guess)) return sanitizeFile(decodeURIComponent(guess));
    ext = m.attachment_type === 'image' ? 'jpg' : 'bin';
  }
  return sanitizeFile(`${raw || 'anexo'}.${ext}`);
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};


const ChatHistoryPage = () => {
  const { currentUser } = useApp();
  const [names, setNames] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdminSector =
    currentUser?.role === 'admin' ||
    (currentUser?.sectors as string[] | undefined)?.includes('administracao');

  const load = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'app_users'));
      const nameMap: Record<string, string> = {};
      const usernameById = new Map<string, string>();

      usersSnapshot.docs.forEach((userDoc) => {
        const data = userDoc.data();
        const username = String(data.username || '').trim();
        const name = String(data.name || username || userDoc.id);
        if (username) {
          nameMap[username] = name;
          usernameById.set(userDoc.id, username);
        }
      });
      setNames(nameMap);

      const messagesSnapshot = await getDocs(collection(db, 'messages'));
      const all: Msg[] = messagesSnapshot.docs
        .map((messageDoc) => {
          const data = messageDoc.data();

          const senderUsername =
            data.sender_username ||
            (data.senderId ? usernameById.get(data.senderId) : undefined);

          const receiverUsername =
            data.receiver_username ||
            (data.receiverId ? usernameById.get(data.receiverId) : undefined);

          const createdValue =
            data.created_at ||
            data.timestamp ||
            data.createdAt;

          const createdAt = createdValue?.toDate
            ? createdValue.toDate().toISOString()
            : typeof createdValue === 'string'
              ? createdValue
              : '';

          if (!senderUsername || !receiverUsername) return null;

          return {
            id: messageDoc.id,
            sender_username: senderUsername,
            receiver_username: receiverUsername,
            content: String(data.content || ''),
            attachment_url:
              data.attachment_url ||
              data.attachmentUrl ||
              null,
            attachment_name:
              data.attachment_name ||
              data.attachmentName ||
              null,
            attachment_type:
              data.attachment_type ||
              data.attachmentType ||
              null,
            created_at: createdAt,
          } as Msg;
        })
        .filter((message): message is Msg => !!message)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );

      // Mescla o cache local deste navegador (mensagens antigas que já não estão no servidor)
      const merged = new Map<string, Msg>();
      for (const m of [...readLocalCache(), ...all]) {
        if (!m?.id || !m.sender_username || !m.receiver_username) continue;
        merged.set(m.id, m);
      }

      const byPair = new Map<string, Conversation>();
      for (const m of merged.values()) {
        const [a, b] = [m.sender_username, m.receiver_username].sort();
        const key = `${a}::${b}`;
        if (!byPair.has(key)) byPair.set(key, { key, a, b, messages: [] });
        byPair.get(key)!.messages.push(m);
      }
      const list = Array.from(byPair.values());
      list.forEach((c) =>
        c.messages.sort(
          (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
        )
      );
      list.sort((x, y) => {
        const lx = x.messages[x.messages.length - 1]?.created_at || '';
        const ly = y.messages[y.messages.length - 1]?.created_at || '';
        return ly.localeCompare(lx);
      });
      setConversations(list);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar histórico de conversas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminSector) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminSector]);

  const nameOf = (u: string) => names[u] || u;

  const buildTxt = (c: Conversation, fileNames: Map<string, string>) => {
    const header = `Conversa do usuário ${nameOf(c.a)} com o usuário ${nameOf(c.b)}\nTotal de mensagens: ${c.messages.length}\nExportado em: ${fmt(new Date().toISOString())}\n${'='.repeat(70)}\n\n`;
    const body = c.messages
      .map((m) => {
        const attach = m.attachment_url ? `\n    ${fileNames.get(m.id) || attachmentFileName(m)}` : '';
        return `[${fmt(m.created_at)}] ${nameOf(m.sender_username)}: ${m.content || ''}${attach}`;
      })
      .join('\n');
    return header + body + '\n';
  };

  const fetchAttachment = async (m: Msg): Promise<Blob | null> => {
    const url = m.attachment_url;
    if (!url) return null;
    try {
      const target = url.startsWith('http') ? await getSignedUrl(url) : url;
      const res = await fetch(target);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  const exportOne = async (c: Conversation) => {
    const base = `Conversa - ${sanitize(nameOf(c.a))} e ${sanitize(nameOf(c.b))}`;
    const withAttachments = c.messages.filter((m) => m.attachment_url);
    const fileNames = new Map<string, string>();
    const used = new Set<string>();
    for (const m of withAttachments) {
      let name = attachmentFileName(m);
      if (used.has(name)) {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let i = 2;
        while (used.has(`${stem} (${i})${ext}`)) i++;
        name = `${stem} (${i})${ext}`;
      }
      used.add(name);
      fileNames.set(m.id, name);
    }

    const txt = buildTxt(c, fileNames);

    if (withAttachments.length === 0) {
      downloadBlob(`${base}.txt`, new Blob([txt], { type: 'text/plain;charset=utf-8' }));
      return;
    }

    const zip = new JSZip();
    zip.file(`${base}.txt`, txt);
    const folder = zip.folder('anexos')!;
    for (const m of withAttachments) {
      const blob = await fetchAttachment(m);
      if (blob) folder.file(fileNames.get(m.id)!, blob);
    }
    const out = await zip.generateAsync({ type: 'blob' });
    downloadBlob(`${base}.zip`, out);
  };

  const exportAll = async () => {
    if (filtered.length === 0) return;
    toast.info('Preparando exportação...');
    for (let i = 0; i < filtered.length; i++) {
      await exportOne(filtered[i]);
      await new Promise((r) => setTimeout(r, 350));
    }
    toast.success(`${filtered.length} arquivo(s) exportado(s)`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      `${nameOf(c.a)} ${nameOf(c.b)} ${c.a} ${c.b}`.toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search, names]);

  if (!isAdminSector) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">
          Esta aba está disponível apenas para o setor Administração.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          <h1 className="text-xl font-bold">Histórico de Conversas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={exportAll} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Baixar todas ({filtered.length})
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando conversas...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma conversa encontrada.</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <div
                key={c.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      Conversa do usuário {nameOf(c.a)} com o usuário {nameOf(c.b)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.messages.length} mensagem(ns)
                    {last ? ` · última em ${fmt(last.created_at)}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportOne(c)}>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Observação: mensagens apagadas definitivamente pelos usuários não podem ser recuperadas do
        servidor; quando existirem no cache local deste navegador, elas são incluídas na exportação.
      </p>
    </div>
  );
};

export default ChatHistoryPage;
