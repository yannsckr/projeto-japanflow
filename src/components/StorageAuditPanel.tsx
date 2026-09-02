// src/components/StorageAuditPanel.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Trash2, RefreshCw, FileSearch } from 'lucide-react';
import { toast } from 'sonner';

interface AuditResult {
  runId: string;
  totalFiles: number;
  knownAssets: number;
  orphans: number;
  orphanBytes: number;
  sample: string[];
}

interface AuditRow {
  id: string;
  run_id: string;
  storage_path: string;
  size_bytes: number | null;
  category: string;
  action: string;
  created_at: string;
}

const StorageAuditPanel = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [latestRows, setLatestRows] = useState<AuditRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const loadLatestRun = async () => {
    setLoadingRows(true);
    try {
      const { data: latest } = await supabase
        .from('storage_audit_log')
        .select('run_id')
        .eq('action', 'reported')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!latest || latest.length === 0) {
        setLatestRows([]);
        return;
      }
      const runId = latest[0].run_id;
      const { data: rows } = await supabase
        .from('storage_audit_log')
        .select('id, run_id, storage_path, size_bytes, category, action, created_at')
        .eq('run_id', runId)
        .order('size_bytes', { ascending: false })
        .limit(500);
      setLatestRows((rows as AuditRow[]) || []);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadLatestRun();
  }, []);

  const runAudit = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('storage-audit-report', {
        body: { writeLog: true },
      });
      if (error) throw error;
      setResult(data as AuditResult);
      toast.success(`Auditoria concluída: ${data.orphans} órfãos / ${data.totalFiles} arquivos.`);
      await loadLatestRun();
    } catch (e: any) {
      toast.error(`Falha: ${e?.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  const deleteOrphans = async () => {
    if (confirmText !== 'APAGAR') {
      toast.error('Digite APAGAR para confirmar.');
      return;
    }
    const pendingRows = latestRows.filter((r) => r.action === 'reported');
    if (pendingRows.length === 0) {
      toast.info('Nada para apagar.');
      return;
    }
    setDeleting(true);
    setDeleteProgress({ done: 0, total: pendingRows.length });
    const batchSize = 100;
    let done = 0;
    try {
      for (let i = 0; i < pendingRows.length; i += batchSize) {
        const batch = pendingRows.slice(i, i + batchSize);
        const paths = batch.map((r) => r.storage_path);
        const { error: rmErr } = await supabase.storage.from('attachments').remove(paths);
        if (rmErr) {
          toast.error(`Erro ao remover lote: ${rmErr.message}`);
          continue;
        }
        // marca como deletado no log
        await supabase
          .from('storage_audit_log')
          .update({ action: 'deleted', notes: 'apagado via auditoria admin' })
          .in(
            'id',
            batch.map((r) => r.id)
          );
        done += batch.length;
        setDeleteProgress({ done, total: pendingRows.length });
      }
      toast.success(`${done} arquivos órfãos removidos do Storage.`);
      setConfirmText('');
      await loadLatestRun();
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = latestRows.filter((r) => r.action === 'reported').length;
  const totalBytes = latestRows
    .filter((r) => r.action === 'reported')
    .reduce((a, r) => a + (r.size_bytes || 0), 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Auditoria de Storage (Órfãos)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Lista arquivos presentes no bucket <code>attachments</code> que <strong>não</strong> têm
          registro em <code>image_assets</code> (uploads esquecidos, antigos, ou que falharam ao
          registrar). O relatório fica salvo em <code>storage_audit_log</code> para auditoria.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={runAudit} disabled={running}>
            <FileSearch className={`w-4 h-4 mr-2 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Auditando...' : 'Executar auditoria'}
          </Button>
          <Button onClick={loadLatestRun} variant="outline" disabled={loadingRows}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingRows ? 'animate-spin' : ''}`} />
            Recarregar último relatório
          </Button>
        </div>

        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border rounded-md p-3">
            <div>
              <div className="text-muted-foreground">Arquivos no bucket</div>
              <div className="font-bold">{result.totalFiles}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Registros em image_assets</div>
              <div className="font-bold">{result.knownAssets}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Órfãos</div>
              <div className="font-bold text-destructive">{result.orphans}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tamanho órfãos</div>
              <div className="font-bold">{(result.orphanBytes / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
        )}

        {latestRows.length > 0 && (
          <>
            <div className="text-sm">
              Último relatório: <strong>{pendingCount}</strong> órfãos pendentes ({totalMB} MB)
              {latestRows.length >= 500 ? ' (mostrando os 500 maiores)' : ''}.
            </div>

            <div className="max-h-72 overflow-auto border rounded-md text-xs font-mono">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Path</th>
                    <th className="text-right p-2">KB</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 break-all">{r.storage_path}</td>
                      <td className="p-2 text-right">
                        {r.size_bytes ? (r.size_bytes / 1024).toFixed(0) : '?'}
                      </td>
                      <td
                        className={`p-2 ${r.action === 'deleted' ? 'text-green-600' : 'text-amber-600'}`}
                      >
                        {r.action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendingCount > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="confirm" className="text-destructive">
                  Para apagar permanentemente os {pendingCount} arquivos órfãos, digite{' '}
                  <strong>APAGAR</strong>:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="APAGAR"
                    className="max-w-xs"
                  />
                  <Button
                    onClick={deleteOrphans}
                    disabled={deleting || confirmText !== 'APAGAR'}
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting
                      ? `Apagando ${deleteProgress.done}/${deleteProgress.total}...`
                      : 'Apagar órfãos'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageAuditPanel;
