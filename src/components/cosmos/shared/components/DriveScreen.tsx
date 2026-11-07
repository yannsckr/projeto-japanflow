import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Folder,
  FolderPlus,
  File,
  Download,
  Upload,
  ArrowLeft,
  Trash2,
  Search,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  watchDriveFolders,
  watchDriveFiles,
  createDriveFolder,
  uploadDriveFile,
  downloadDriveFile,
  deleteDriveFile,
  deleteDriveFolder,
} from '../services/driveService';
import type { DriveFile, DriveFolder } from '../types/drive';

const formatSize = (size: number) =>
  size >= 1048576
    ? `${(size / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(size / 1024))} KB`;

export default function DriveScreen() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folderId, setFolderId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState({ folders: false, files: false });
  const uploadInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fail = (error: Error) => {
      console.error(error);
      toast.error('Não foi possível carregar o Drive');
    };
    const stopFolders = watchDriveFolders((value) => {
      setFolders(value);
      setLoaded((previous) => ({ ...previous, folders: true }));
    }, fail);
    const stopFiles = watchDriveFiles((value) => {
      setFiles(value);
      setLoaded((previous) => ({ ...previous, files: true }));
    }, fail);
    return () => {
      stopFolders();
      stopFiles();
    };
  }, []);

  const currentFolder = folders.find((folder) => folder.id === folderId);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matches = (name: string) => name.toLocaleLowerCase('pt-BR').includes(term);
    return {
      folders: folders.filter((folder) => folder.parent_id === folderId && matches(folder.name)),
      files: files.filter(
        (file) => file.folder_id === folderId && file.status === 'ready' && matches(file.name)
      ),
    };
  }, [files, folders, folderId, search]);
  const busyAction = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Operação não concluída');
    } finally {
      setBusy(false);
    }
  };
  const createFolder = () => {
    if (!currentUser || !isAdmin) return;
    const name = window.prompt('Nome da nova pasta:');
    if (name === null) return;
    void busyAction(() => createDriveFolder(name, folderId, currentUser.id), 'Pasta criada');
  };
  const upload = (selected?: File) => {
    if (!selected || !currentUser || !isAdmin) return;
    void busyAction(() => uploadDriveFile(selected, folderId, currentUser.id), 'Arquivo enviado');
  };
  const removeFolder = (folder: DriveFolder) => {
    if (
      folders.some((entry) => entry.parent_id === folder.id) ||
      files.some((entry) => entry.folder_id === folder.id)
    ) {
      toast.error('Esvazie a pasta antes de excluí-la');
      return;
    }
    if (!window.confirm(`Excluir a pasta "${folder.name}"?`)) return;
    void busyAction(() => deleteDriveFolder(folder), 'Pasta excluída');
  };
  const removeFile = (file: DriveFile) => {
    if (!window.confirm(`Excluir definitivamente "${file.name}"?`)) return;
    void busyAction(() => deleteDriveFile(file), 'Arquivo excluído');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-600">
            <HardDrive className="h-4 w-4" /> Biblioteca
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">JapanFlow Drive</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identidade visual e documentos corporativos.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={createFolder}>
              <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
            </Button>
            <input
              ref={uploadInput}
              type="file"
              className="hidden"
              onChange={(event) => {
                upload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <Button disabled={busy} onClick={() => uploadInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Enviar arquivo
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!folderId}
          onClick={() => setFolderId(currentFolder?.parent_id || '')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {currentFolder?.name || 'Meu Drive / Raiz'}
        </span>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar na pasta"
            placeholder="Buscar nesta pasta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.folders.map((folder) => (
          <div
            key={folder.id}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <button
              type="button"
              onClick={() => {
                setFolderId(folder.id);
                setSearch('');
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium"
            >
              <Folder className="h-5 w-5 shrink-0 text-cyan-600" />
              <span className="truncate">{folder.name}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                aria-label={`Excluir ${folder.name}`}
                onClick={() => removeFolder(folder)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
        {visible.files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <File className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              aria-label={`Baixar ${file.name}`}
              onClick={() => void busyAction(() => downloadDriveFile(file), 'Download iniciado')}
            >
              <Download className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                aria-label={`Excluir ${file.name}`}
                onClick={() => removeFile(file)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>
      {loaded.files &&
        loaded.folders &&
        visible.folders.length === 0 &&
        visible.files.length === 0 && (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            Nenhum arquivo ou pasta aqui.
          </div>
        )}
      {!loaded.files || !loaded.folders ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando arquivos...
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Arquivos de até 30 MB. Nesta primeira versão, funcionários ativos podem consultar;
        administradores organizam e enviam.
      </p>
    </div>
  );
}
