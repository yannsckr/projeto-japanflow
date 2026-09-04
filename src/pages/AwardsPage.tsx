import { useEffect, useState, useCallback } from 'react';
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
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trophy, Paperclip, FileText, Trash2, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Sector } from '@/types';
import { uploadImage } from '@/lib/uploadImage';
import SignedLink from '@/components/SignedLink';

// Users (besides admins) who have access to this tab.
export const AWARDS_ALLOWED_USER_IDS = [
  'emp-6',
  'emp-7',
  'emp-4',
  'emp-8',
  'emp-10',
  'emp-3',
  'emp-11',
];

interface AwardRow {
  id: string;
  target_user_id: string;
  title: string;
  amount: number | null;
  period: string | null;
  notes: string | null;
  document_url: string | null;
  document_name: string | null;
  created_by: string;
  created_at: string;
}

const AwardsPage = () => {
  const { currentUser, users } = useApp();
  const [rows, setRows] = useState<AwardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // form state
  const [targetUserId, setTargetUserId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const inFinance = !!currentUser?.sectors?.includes('financeiro' as Sector);
  const inAdministracao = !!currentUser?.sectors?.includes('administracao' as Sector);
  const canManage = isAdmin || inFinance;
  const canSeeAll = isAdmin || inFinance || inAdministracao;

  const fetchRows = useCallback(async () => {
    // Mantido por compatibilidade com chamadas existentes.
  }, []);

  useEffect(() => {
    const awardsQuery = query(
      collection(db, 'awards'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      awardsQuery,
      (snapshot) => {
        setRows(
          snapshot.docs.map((awardDoc) => {
            const data = awardDoc.data();
            return {
              id: awardDoc.id,
              target_user_id: data.target_user_id || '',
              title: data.title || '',
              amount: typeof data.amount === 'number' ? data.amount : null,
              period: data.period || null,
              notes: data.notes || null,
              document_url: data.document_url || null,
              document_name: data.document_name || null,
              created_by: data.created_by || '',
              created_at: data.created_at?.toDate
                ? data.created_at.toDate().toISOString()
                : data.created_at || '',
            } as AwardRow;
          })
        );
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar premiações:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (!currentUser) return null;

  const visible = canSeeAll ? rows : rows.filter((r) => r.target_user_id === currentUser.id);

  const getName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const resetForm = () => {
    setTargetUserId('');
    setTitle('');
    setAmount('');
    setPeriod('');
    setNotes('');
    setDocUrl('');
    setDocName('');
  };

  const handleUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 20MB)');
      return;
    }
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: 'awards',
        sourceTable: 'awards',
        sourceField: 'document_url',
        uploadedBy: currentUser?.id ?? null,
        preserve: true,
      });
      setDocUrl(publicUrl);
      setDocName(file.name);
    } catch {
      toast.error('Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!targetUserId) {
      toast.error('Selecione o usuário alvo');
      return;
    }
    if (!title.trim()) {
      toast.error('Informe o título');
      return;
    }
    try {
      await addDoc(collection(db, 'awards'), {
        target_user_id: targetUserId,
        title: title.trim(),
        amount: amount ? Number(amount) : null,
        period: period.trim() || null,
        notes: notes.trim() || null,
        document_url: docUrl || null,
        document_name: docName || null,
        created_by: currentUser.id,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar');
      return;
    }
    toast.success('Premiação registrada');
    resetForm();
    setOpen(false);
    fetchRows();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta premiação?')) return;
    try {
      await deleteDoc(doc(db, 'awards', id));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir');
      return;
    }
    toast.success('Excluída');
    fetchRows();
  };

  // who can be a target: the allowed users list
  const targetCandidates = users.filter((u) => AWARDS_ALLOWED_USER_IDS.includes(u.id));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Premiações</h1>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Premiação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Premiação</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Usuário alvo</Label>
                  <Select value={targetUserId} onValueChange={setTargetUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetCandidates.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Premiação Outubro"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Período</Label>
                    <Input
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="Ex.: 10/2026"
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div>
                  <Label>Relatório (documento)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                      disabled={uploading}
                    />
                    {docName && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        {docName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={uploading}>
                    Salvar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canSeeAll && (
        <p className="text-sm text-muted-foreground">
          Você está vendo apenas as premiações destinadas a você.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma premiação registrada.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{r.title}</h3>
                    {r.period && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.period}</span>
                    )}
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Para: </span>
                    <span className="font-medium">{getName(r.target_user_id)}</span>
                  </p>
                  {r.amount != null && (
                    <p className="text-lg font-bold text-green-600">
                      R$ {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {r.notes && <p className="text-sm whitespace-pre-wrap">{r.notes}</p>}
                  {r.document_url && (
                    <SignedLink
                      url={r.document_url}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      {r.document_name || 'Relatório'}
                      <Download className="w-3 h-3" />
                    </SignedLink>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Registrado por {getName(r.created_by)} em{' '}
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AwardsPage;