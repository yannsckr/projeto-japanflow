import { useEffect, useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { uploadImage } from '@/lib/uploadImage';
import { toast } from 'sonner';
import { FileText, Upload, Download, Trash2, Users, Search, Paperclip } from 'lucide-react';

interface SharedDoc {
  id: string;
  owner_id: string;
  owner_name: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  shared_with: string[];
  share_all: boolean;
  created_at: string;
}

const ACCEPT = '.pdf,.xml,.jpeg,.jpg,.png,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*,application/pdf';

const formatSize = (b: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const SharedDocsPage = () => {
  const { currentUser, users } = useApp();
  const [docs, setDocs] = useState<SharedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [shareAll, setShareAll] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchDocs = async () => {
    // Mantido por compatibilidade; o listener abaixo já mantém os documentos atualizados.
  };

  useEffect(() => {
    const docsQuery = query(collection(db, 'shared_documents'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      docsQuery,
      (snapshot) => {
        setDocs(
          snapshot.docs.map((sharedDoc) => {
            const data = sharedDoc.data();
            return {
              id: sharedDoc.id,
              owner_id: data.owner_id || '',
              owner_name: data.owner_name || null,
              title: data.title || '',
              description: data.description || null,
              file_url: data.file_url || '',
              file_name: data.file_name || '',
              file_type: data.file_type || null,
              file_size: typeof data.file_size === 'number' ? data.file_size : null,
              shared_with: Array.isArray(data.shared_with) ? data.shared_with : [],
              share_all: data.share_all === true,
              created_at: data.created_at?.toDate
                ? data.created_at.toDate().toISOString()
                : data.created_at || '',
            } as SharedDoc;
          })
        );
        setLoading(false);
      },
      (error) => {
        console.error(error);
        toast.error('Erro ao carregar documentos');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const visibleDocs = useMemo(() => {
    if (!currentUser) return [];
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      const canSee =
        isAdmin ||
        d.owner_id === currentUser.id ||
        d.share_all ||
        d.shared_with.includes(currentUser.id);
      if (!canSee) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.owner_name || '').toLowerCase().includes(q)
      );
    });
  }, [docs, search, currentUser, isAdmin]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setShareAll(false);
    setSharedWith([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleRecipient = (id: string) => {
    setSharedWith((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleUpload = async () => {
    if (!currentUser) return;
    if (!file) return toast.error('Selecione um arquivo');
    if (!title.trim()) return toast.error('Informe um título');
    if (!shareAll && sharedWith.length === 0)
      return toast.error('Selecione ao menos um destinatário ou marque "Todos"');
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: `shared-docs/${currentUser.id}`,
        sourceTable: 'shared_documents',
        uploadedBy: currentUser.id,
        preserve: true,
      });
      await addDoc(collection(db, 'shared_documents'), {
        owner_id: currentUser.id,
        owner_name: currentUser.name,
        title: title.trim(),
        description: description.trim() || null,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        shared_with: shareAll ? [] : sharedWith,
        share_all: shareAll,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      toast.success('Documento compartilhado!');
      resetForm();
      setDialogOpen(false);
      fetchDocs();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: SharedDoc) => {
    if (!currentUser) return;
    if (doc.owner_id !== currentUser.id && !isAdmin) {
      return toast.error('Apenas o dono ou administrador pode excluir');
    }
    if (!confirm(`Excluir "${doc.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'shared_documents', doc.id));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir');
      return;
    }
    toast.success('Documento excluído');
    fetchDocs();
  };

  const recipientNames = (doc: SharedDoc) => {
    if (doc.share_all) return 'Todos os usuários';
    return doc.shared_with.map((id) => users.find((u) => u.id === id)?.name || id).join(', ');
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 md:p-6 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" /> Documentos Compartilhados
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie arquivos e escolha quem pode acessá-los.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" /> Enviar documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compartilhar documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Arquivo</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {file.name} ({formatSize(file.size)})
                  </p>
                )}
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Contrato Fornecedor X"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" /> Compartilhar com
                </Label>
                <label className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/50">
                  <Checkbox checked={shareAll} onCheckedChange={(v) => setShareAll(!!v)} />
                  <span className="font-semibold">Todos os usuários</span>
                </label>
                {!shareAll && (
                  <div className="border rounded-md max-h-56 overflow-y-auto p-2 space-y-1">
                    {users
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={sharedWith.includes(u.id)}
                            onCheckedChange={() => toggleRecipient(u.id)}
                          />
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {u.role === 'admin' ? 'Admin' : u.function || ''}
                          </span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Enviando...' : 'Compartilhar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por título, nome de arquivo, autor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && visibleDocs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Paperclip className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum documento disponível.</p>
          </div>
        )}
        {visibleDocs.map((doc) => (
          <div
            key={doc.id}
            className="border border-border rounded-lg p-3 bg-card flex flex-col md:flex-row gap-3 md:items-center hover:border-primary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{doc.title}</p>
              {doc.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                <span>📎 {doc.file_name}</span>
                {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
                <span>
                  Por <strong>{doc.owner_name || doc.owner_id}</strong>
                </span>
                <span>{new Date(doc.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                <Users className="w-3 h-3 inline mr-1" />
                {recipientNames(doc)}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button asChild size="sm" variant="secondary">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={doc.file_name}
                >
                  <Download className="w-4 h-4 mr-1" /> Baixar
                </a>
              </Button>
              {(doc.owner_id === currentUser.id || isAdmin) && (
                <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedDocsPage;
