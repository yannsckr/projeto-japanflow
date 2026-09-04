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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { uploadImage } from '@/lib/uploadImage';
import { toast } from 'sonner';
import { ScrollText, Upload, Download, Trash2, Search, FileText, ImageIcon } from 'lucide-react';

interface PolicyDoc {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';

const formatSize = (b: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const InternalPoliciesPage = () => {
  const { currentUser } = useApp();
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchDocs = async () => {
    // Mantido por compatibilidade; o listener abaixo já mantém os documentos atualizados.
  };

  useEffect(() => {
    const docsQuery = query(collection(db, 'internal_policies'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      docsQuery,
      (snapshot) => {
        setDocs(
          snapshot.docs.map((policyDoc) => {
            const data = policyDoc.data();
            return {
              id: policyDoc.id,
              title: data.title || '',
              description: data.description || null,
              file_url: data.file_url || '',
              file_name: data.file_name || '',
              file_type: data.file_type || null,
              file_size: typeof data.file_size === 'number' ? data.file_size : null,
              created_by: data.created_by || '',
              created_by_name: data.created_by_name || null,
              created_at: data.created_at?.toDate
                ? data.created_at.toDate().toISOString()
                : data.created_at || '',
            } as PolicyDoc;
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
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
    );
  }, [docs, search]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!currentUser || !isAdmin) return;
    if (!file) return toast.error('Selecione um arquivo (imagem ou PDF)');
    if (!title.trim()) return toast.error('Informe um título');
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: 'internal-policies',
        sourceTable: 'internal_policies',
        uploadedBy: currentUser.id,
        preserve: true,
      });
      await addDoc(collection(db, 'internal_policies'), {
        title: title.trim(),
        description: description.trim() || null,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await addDoc(collection(db, 'admin_popups'), {
        title: '📄 Nova Política Interna disponível',
        content: `<p>Um novo documento foi disponibilizado na aba <strong>Políticas Internas</strong>:</p><p><strong>${title.trim()}</strong></p>${
          description.trim() ? `<p>${description.trim()}</p>` : ''
        }<p>Acesse a aba <strong>Políticas Internas</strong> no menu lateral para ler o documento.</p>`,
        created_by: currentUser.id,
        target_mode: 'all',
        target_sectors: [],
        target_users: [],
        attachments: [],
        created_at: Timestamp.now(),
      });

      toast.success('Documento publicado e usuários notificados!');
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

  const handleDelete = async (doc: PolicyDoc) => {
    if (!isAdmin) return toast.error('Apenas administradores podem excluir');
    if (!confirm(`Excluir "${doc.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'internal_policies', doc.id));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir');
      return;
    }
    toast.success('Documento excluído');
    fetchDocs();
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 md:p-6 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6" /> Políticas Internas
          </h1>
          <p className="text-sm text-muted-foreground">
            Documentos oficiais da empresa disponíveis para leitura de todos os usuários.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" /> Adicionar documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo documento de política interna</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Arquivo (Imagem ou PDF)</Label>
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
                    placeholder="Ex.: Política de Uso de Uniformes"
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
                <p className="text-xs text-muted-foreground">
                  Ao publicar, um pop-up será enviado a todos os usuários informando o novo
                  documento.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Publicar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por título ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && visibleDocs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma política interna publicada.</p>
          </div>
        )}
        {visibleDocs.map((doc) => {
          const isImage = (doc.file_type || '').startsWith('image/');
          return (
            <div
              key={doc.id}
              className="border border-border rounded-lg p-3 bg-card flex flex-col md:flex-row gap-3 md:items-center hover:border-primary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                {isImage ? (
                  <ImageIcon className="w-5 h-5 text-primary" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{doc.title}</p>
                {doc.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                  <span>📎 {doc.file_name}</span>
                  {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
                  {doc.created_by_name && (
                    <span>
                      Por <strong>{doc.created_by_name}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold px-2 py-1 rounded-md bg-secondary text-foreground whitespace-nowrap">
                  📅 {new Date(doc.created_at).toLocaleDateString('pt-BR')}{' '}
                  {new Date(doc.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <Button asChild size="sm" variant="secondary">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-1" /> Abrir
                  </a>
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InternalPoliciesPage;
