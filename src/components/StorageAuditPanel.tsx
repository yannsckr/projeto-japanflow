// src/components/StorageAuditPanel.tsx
import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

const toIso = (value: any): string => {
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

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
      // Pega o registro mais recente de qualquer ação.
      // Assim evitamos depender de índice composto action + created_at.
      const latestQuery = query(
        collection(db, 'storage_audit_log'),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const latestSnapshot = await getDocs(latestQuery);

      if (latestSnapshot.empty) {
        setLatestRows([]);
        return;
      }

      const runId = latestSnapshot.docs[0].data().run_id;

      if (!runId) {
        setLatestRows([]);
        return;
      }

      // Busca todas as linhas desse run e ordena no cliente.
      // Evita índice composto run_id + size_bytes.
      const rowsQuery = query(
        collection(db, 'storage_audit_log'),
        where('run_id', '==', runId)
      );

      const rowsSnapshot = await getDocs(rowsQuery);

      const rows: AuditRow[] = rowsSnapshot.docs
        .map((rowDoc) => {
          const data = rowDoc.data();

          return {
            id: rowDoc.id,
            run_id: data.run_id || '',
            storage_path: data.storage_path || '',
            size_bytes:
              typeof data.size_bytes === 'number'
                ? data.size_bytes
                : null,
            category: data.category || '',
            action: data.action || 'reported',
            created_at: toIso(data.created_at),
          };
        })
        .sort(
          (a, b) =>
            (b.size_bytes || 0) - (a.size_bytes || 0)
        )
        .slice(0, 500);

      setLatestRows(rows);
    } catch (error) {
      console.error('Erro ao carregar auditoria de storage:', error);
      toast.error('Erro ao carregar último relatório');
      setLatestRows([]);
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
      const functions = getFunctions();
      const storageAuditReport = httpsCallable<
        { writeLog: boolean },
        AuditResult & { error?: string }
      >(functions, 'storageAuditReport');

      const response = await storageAuditReport({
        writeLog: true,
      });

      const data = response.data;

      if (data?.error) {
        throw new Error(data.error);
      }

      setResult(data);

      toast.success(
        `Auditoria concluída: ${data.orphans} órfãos / ${data.totalFiles} arquivos.`
      );

      await loadLatestRun();
    } catch (error: any) {
      console.error('Erro na auditoria de storage:', error);
      toast.error(`Falha: ${error?.message || error}`);
    } finally {
      setRunning(false);
    }
  };

  const deleteOrphans = async () => {
    if (confirmText !== 'APAGAR') {
      toast.error('Digite APAGAR para confirmar.');
      return;
    }

    const pendingRows = latestRows.filter(
      (row) => row.action === 'reported'
    );

    if (pendingRows.length === 0) {
      toast.info('Nada para apagar.');
      return;
    }

    setDeleting(true);
    setDeleteProgress({
      done: 0,
      total: pendingRows.length,
    });

    const batchSize = 100;
    let done = 0;

    try {
      for (let i = 0; i < pendingRows.length; i += batchSize) {
        const currentBatch = pendingRows.slice(i, i + batchSize);

        const deletedRows: AuditRow[] = [];

        for (const row of currentBatch) {
          try {
            // Os novos uploads usam caminhos como:
            // attachments/tasks/...
            await deleteObject(ref(storage, row.storage_path));
            deletedRows.push(row);
          } catch (error: any) {
            // Se o arquivo já não existe, podemos considerar o órfão resolvido.
            if (error?.code === 'storage/object-not-found') {
              deletedRows.push(row);
              continue;
            }

            console.error(
              `Erro ao apagar ${row.storage_path}:`,
              error
            );
          }
        }

        if (deletedRows.length > 0) {
          const firestoreBatch = writeBatch(db);

          for (const row of deletedRows) {
            firestoreBatch.update(
              doc(db, 'storage_audit_log', row.id),
              {
                action: 'deleted',
                notes: 'apagado via auditoria admin',
              }
            );
          }

          await firestoreBatch.commit();
        }

        done += deletedRows.length;

        setDeleteProgress({
          done,
          total: pendingRows.length,
        });
      }

      if (done === pendingRows.length) {
        toast.success(
          `${done} arquivos órfãos removidos do Storage.`
        );
      } else {
        toast.warning(
          `${done} de ${pendingRows.length} arquivos foram removidos. Verifique o console para os que falharam.`
        );
      }

      setConfirmText('');
      await loadLatestRun();
    } catch (error) {
      console.error('Erro ao apagar órfãos:', error);
      toast.error('Erro durante a limpeza do Storage');
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = latestRows.filter(
    (row) => row.action === 'reported'
  ).length;

  const totalBytes = latestRows
    .filter((row) => row.action === 'reported')
    .reduce(
      (total, row) =>
        total + (row.size_bytes || 0),
      0
    );

  const totalMB = (
    totalBytes /
    1024 /
    1024
  ).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Auditoria de Storage (Órfãos)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Lista arquivos presentes no Firebase Storage que <strong>não</strong> têm
          registro em <code>image_assets</code> (uploads esquecidos, antigos, ou que
          falharam ao registrar). O relatório fica salvo em{' '}
          <code>storage_audit_log</code> para auditoria.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={runAudit} disabled={running}>
            <FileSearch
              className={`w-4 h-4 mr-2 ${
                running ? 'animate-pulse' : ''
              }`}
            />

            {running
              ? 'Auditando...'
              : 'Executar auditoria'}
          </Button>

          <Button
            onClick={loadLatestRun}
            variant="outline"
            disabled={loadingRows}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${
                loadingRows ? 'animate-spin' : ''
              }`}
            />

            Recarregar último relatório
          </Button>
        </div>

        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border rounded-md p-3">
            <div>
              <div className="text-muted-foreground">
                Arquivos no Storage
              </div>
              <div className="font-bold">
                {result.totalFiles}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground">
                Registros em image_assets
              </div>
              <div className="font-bold">
                {result.knownAssets}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground">
                Órfãos
              </div>
              <div className="font-bold text-destructive">
                {result.orphans}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground">
                Tamanho órfãos
              </div>
              <div className="font-bold">
                {(result.orphanBytes / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
        )}

        {latestRows.length > 0 && (
          <>
            <div className="text-sm">
              Último relatório:{' '}
              <strong>{pendingCount}</strong>{' '}
              órfãos pendentes ({totalMB} MB)
              {latestRows.length >= 500
                ? ' (mostrando os 500 maiores)'
                : ''}
              .
            </div>

            <div className="max-h-72 overflow-auto border rounded-md text-xs font-mono">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">
                      Path
                    </th>
                    <th className="text-right p-2">
                      KB
                    </th>
                    <th className="text-left p-2">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {latestRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t"
                    >
                      <td className="p-2 break-all">
                        {row.storage_path}
                      </td>

                      <td className="p-2 text-right">
                        {row.size_bytes
                          ? (
                              row.size_bytes /
                              1024
                            ).toFixed(0)
                          : '?'}
                      </td>

                      <td
                        className={`p-2 ${
                          row.action === 'deleted'
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {row.action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendingCount > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label
                  htmlFor="confirm"
                  className="text-destructive"
                >
                  Para apagar permanentemente os{' '}
                  {pendingCount} arquivos órfãos,
                  digite <strong>APAGAR</strong>:
                </Label>

                <div className="flex gap-2">
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) =>
                      setConfirmText(e.target.value)
                    }
                    placeholder="APAGAR"
                    className="max-w-xs"
                  />

                  <Button
                    onClick={deleteOrphans}
                    disabled={
                      deleting ||
                      confirmText !== 'APAGAR'
                    }
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
