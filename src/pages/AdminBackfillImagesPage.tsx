import { useState, useRef, useCallback, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Play, Square, RefreshCw, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import StorageAuditPanel from '@/components/StorageAuditPanel';
import { backfillWebpApi, listAllStorageFilesApi } from '@/lib/api';

const BUCKET = 'attachments';
const SKIP_PREFIXES = ['attachments/thumbs/', 'thumbs/'];
const IMAGE_EXT = /\.(jpe?g|png)$/i;
const STORAGE_KEY = 'backfill-webp-state-v2';

interface StorageFile {
  path: string;
  size: number | null;
  mimetype: string | null;
}

interface LogEntry {
  path: string;
  status: 'ok' | 'skip' | 'error';
  reason?: string;
  before?: number;
  after?: number;
}

interface RunStats {
  scanned: number;
  converted: number;
  skipped: number;
  errors: number;
  bytesBefore: number;
  bytesAfter: number;
  logs: LogEntry[];
}

interface PersistedState {
  files: StorageFile[];
  done: string[]; // paths já processados (ok/skip/error)
  stats: RunStats;
  updatedAt: string;
}

const emptyStats = (): RunStats => ({
  scanned: 0,
  converted: 0,
  skipped: 0,
  errors: 0,
  bytesBefore: 0,
  bytesAfter: 0,
  logs: [],
});

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearPersisted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

async function listAll(prefix = 'attachments/'): Promise<StorageFile[]> {
  const objects = await listAllStorageFilesApi(prefix || 'attachments/');

  return objects
    .filter((object) => !SKIP_PREFIXES.some((p) => object.path.startsWith(p)))
    .map((object) => ({
      path: object.path,
      size: object.size,
      mimetype: object.mimetype,
    }));
}

function isConvertible(f: StorageFile): boolean {
  if (SKIP_PREFIXES.some((p) => f.path.startsWith(p))) return false;
  if (f.mimetype && /^image\/(jpe?g|png)$/i.test(f.mimetype)) return true;
  if (!f.mimetype && IMAGE_EXT.test(f.path)) return true;
  return false;
}

const AdminBackfillImagesPage = () => {
  const { currentUser } = useApp();
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<RunStats>(emptyStats());
  const [maxDimension, setMaxDimension] = useState(1600);
  const [quality, setQuality] = useState(0.75);
  const [updateAssetsRow, setUpdateAssetsRow] = useState(true);
  const [onlyMissingAssets, setOnlyMissingAssets] = useState(false);
  const [resumedAt, setResumedAt] = useState<string | null>(null);
  const stopRef = useRef(false);
  const doneRef = useRef<Set<string>>(new Set());
  const statsRef = useRef<RunStats>(emptyStats());
  const filesRef = useRef<StorageFile[]>([]);

  // Hidrata de localStorage no mount
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.files?.length) {
      setFiles(persisted.files);
      filesRef.current = persisted.files;
      const ds = new Set(persisted.done || []);
      setDone(ds);
      doneRef.current = ds;
      setStats(persisted.stats || emptyStats());
      statsRef.current = persisted.stats || emptyStats();
      setResumedAt(persisted.updatedAt);
      toast.info(
        `Progresso anterior restaurado: ${ds.size}/${persisted.files.length} já processados.`
      );
    }
  }, []);

  const persistNow = () => {
    savePersisted({
      files: filesRef.current,
      done: Array.from(doneRef.current),
      stats: statsRef.current,
      updatedAt: new Date().toISOString(),
    });
  };

  const scan = async () => {
    setScanning(true);
    try {
      const all = await listAll('attachments/');
      const candidates = all.filter(isConvertible);
      setFiles(candidates);
      filesRef.current = candidates;
      // mantém `done` existente — só remove entradas que não existem mais
      const validPaths = new Set(candidates.map((c) => c.path));
      const filteredDone = new Set(Array.from(doneRef.current).filter((p) => validPaths.has(p)));
      doneRef.current = filteredDone;
      setDone(filteredDone);
      persistNow();
      const remaining = candidates.length - filteredDone.size;
      toast.success(
        `${candidates.length} candidatos (${filteredDone.size} já feitos, ${remaining} pendentes).`
      );
    } catch (e: any) {
      toast.error(`Falha ao listar: ${e?.message || e}`);
    } finally {
      setScanning(false);
    }
  };

  const processOne = useCallback(
    async (file: StorageFile): Promise<LogEntry> => {
      try {
        if (onlyMissingAssets) {
          const existingSnapshot = await getDocs(
            query(collection(db, 'image_assets'), where('storage_path', '==', file.path))
          );

          const alreadyWebp = existingSnapshot.docs.some(
            (assetDoc) => assetDoc.data().mime_type === 'image/webp'
          );

          if (alreadyWebp) {
            return {
              path: file.path,
              status: 'skip',
              reason: 'já é webp em image_assets',
            };
          }
        }

        const response = await backfillWebpApi({
          mode: 'paths',
          paths: [file.path],
          maxDimension,
          quality,
          updateAssetsRow,
          inPlace: true,
          skipIfLarger: true,
        });

        const result = response.results?.[0];
        if (!result) throw new Error('resposta vazia do backend');

        if (result.status === 'ok') {
          return {
            path: file.path,
            status: 'ok',
            before: result.beforeBytes,
            after: result.afterBytes,
          };
        }
        if (result.status === 'skipped') {
          return { path: file.path, status: 'skip', reason: result.reason };
        }
        return { path: file.path, status: 'error', reason: result.reason || 'erro no backend' };
      } catch (e: any) {
        return { path: file.path, status: 'error', reason: String(e?.message || e) };
      }
    },
    [maxDimension, quality, updateAssetsRow, onlyMissingAssets]
  );

  const run = async () => {
    if (!filesRef.current.length) return;
    setRunning(true);
    stopRef.current = false;
    setResumedAt(null);
    // Mantém stats acumuladas (resume) — apenas garante scanned correto
    statsRef.current = { ...statsRef.current, scanned: filesRef.current.length };
    setStats(statsRef.current);

    const total = filesRef.current.length;
    let processedSinceSave = 0;

    for (let i = 0; i < total; i++) {
      if (stopRef.current) break;
      const f = filesRef.current[i];
      if (doneRef.current.has(f.path)) continue;

      const log = await processOne(f);
      if (log.status !== 'error') {
        doneRef.current.add(f.path);
      }
      const next: RunStats = {
        ...statsRef.current,
        converted: statsRef.current.converted + (log.status === 'ok' ? 1 : 0),
        skipped: statsRef.current.skipped + (log.status === 'skip' ? 1 : 0),
        errors: statsRef.current.errors + (log.status === 'error' ? 1 : 0),
        bytesBefore: statsRef.current.bytesBefore + (log.before || 0),
        bytesAfter: statsRef.current.bytesAfter + (log.after || 0),
        logs: [log, ...statsRef.current.logs].slice(0, 300),
      };
      statsRef.current = next;
      setStats(next);
      setDone(new Set(doneRef.current));

      processedSinceSave++;
      // Persistir a cada arquivo (sobrevive a refresh / fechamento da aba)
      persistNow();
      processedSinceSave = 0;
    }

    setRunning(false);
    toast.success(
      `Backfill ${stopRef.current ? 'pausado' : 'finalizado'}. Convertidas: ${statsRef.current.converted}. Erros: ${statsRef.current.errors}.`
    );
  };

  const stop = () => {
    stopRef.current = true;
  };

  const clearProgress = () => {
    if (running) return;
    clearPersisted();
    setFiles([]);
    filesRef.current = [];
    doneRef.current = new Set();
    setDone(new Set());
    statsRef.current = emptyStats();
    setStats(emptyStats());
    setResumedAt(null);
    toast.success('Progresso salvo foi apagado.');
  };

  const processedCount = done.size;
  const remaining = Math.max(0, files.length - processedCount);
  const progress = files.length ? Math.round((processedCount / files.length) * 100) : 0;
  const savedKB = Math.max(0, stats.bytesBefore - stats.bytesAfter) / 1024;

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/board" replace />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <ImageIcon className="w-6 h-6" />
        <h1 className="min-w-0 break-words text-xl font-bold sm:text-2xl">
          Backfill de Imagens (WebP)
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Escaneia imagens JPEG/PNG já presentes no Cloudflare R2. Neste estágio, arquivos históricos
        são preservados sem conversão destrutiva; novos uploads já chegam comprimidos em WebP pelo
        cliente. O progresso é salvo no navegador a cada arquivo — você pode atualizar a página ou
        parar, e ao voltar basta clicar em <strong>Continuar</strong>.
      </p>

      {resumedAt && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
          Progresso restaurado de <strong>{new Date(resumedAt).toLocaleString()}</strong> —{' '}
          {processedCount}/{files.length} processados, {remaining} pendentes.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="maxDim">Lado máximo (px)</Label>
            <Input
              id="maxDim"
              type="number"
              min={320}
              max={4000}
              value={maxDimension}
              onChange={(e) => setMaxDimension(Number(e.target.value) || 1600)}
            />
          </div>
          <div>
            <Label htmlFor="qual">Qualidade (0–1)</Label>
            <Input
              id="qual"
              type="number"
              step={0.05}
              min={0.3}
              max={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value) || 0.75)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch id="updRow" checked={updateAssetsRow} onCheckedChange={setUpdateAssetsRow} />
            <Label htmlFor="updRow">Atualizar image_assets</Label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="onlyMiss"
              checked={onlyMissingAssets}
              onCheckedChange={setOnlyMissingAssets}
            />
            <Label htmlFor="onlyMiss">Pular já marcados webp</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={scan} disabled={scanning || running} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Escaneando...' : 'Escanear bucket'}
        </Button>
        <Button onClick={run} disabled={!files.length || running || remaining === 0}>
          <Play className="w-4 h-4 mr-2" />
          {processedCount > 0 && remaining > 0
            ? `Continuar (${remaining} restantes)`
            : `Iniciar conversão (${files.length})`}
        </Button>
        {running && (
          <Button onClick={stop} variant="destructive">
            <Square className="w-4 h-4 mr-2" /> Parar
          </Button>
        )}
        <Button onClick={clearProgress} disabled={running} variant="ghost">
          <Trash2 className="w-4 h-4 mr-2" /> Limpar progresso salvo
        </Button>
      </div>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-bold">{files.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Processados</div>
                <div className="font-bold">{processedCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pendentes</div>
                <div className="font-bold">{remaining}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Convertidas</div>
                <div className="font-bold text-green-600">{stats.converted}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Puladas</div>
                <div className="font-bold">{stats.skipped}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Erros</div>
                <div className="font-bold text-destructive">{stats.errors}</div>
              </div>
            </div>
            <div className="text-sm">
              Espaço economizado:{' '}
              <span className="font-bold">
                {savedKB > 1024 ? `${(savedKB / 1024).toFixed(2)} MB` : `${savedKB.toFixed(1)} KB`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas 300 ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto text-xs font-mono space-y-1">
              {stats.logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.status === 'ok'
                      ? 'text-green-600'
                      : l.status === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }
                >
                  [{l.status.toUpperCase()}] {l.path}
                  {l.before && l.after
                    ? ` — ${(l.before / 1024).toFixed(0)}KB → ${(l.after / 1024).toFixed(0)}KB`
                    : ''}
                  {l.reason ? ` (${l.reason})` : ''}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <StorageAuditPanel />
    </div>
  );
};

export default AdminBackfillImagesPage;
