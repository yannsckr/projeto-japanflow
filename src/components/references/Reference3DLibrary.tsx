import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type SharedModel = {
  id: string;
  name: string;
  brand: string;
  path: string;
  createdBy: string;
  modelFileName: string;
  map: Record<string, { group: string; color: string; referenceIds: string[] }>;
};
const BRANDS = ['Mitsubishi', 'Toyota', 'Honda', 'Suzuki', 'Subaru'];
const COLOR = /^#[a-fA-F0-9]{6}$/;

export function Reference3DLibrary({
  brand,
  userId,
  onOpen,
}: {
  brand: string;
  userId: string;
  onOpen: (model: { url: string; name: string; map: SharedModel['map']; id: string }) => void;
}) {
  const [models, setModels] = useState<SharedModel[]>([]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SharedModel | null>(null);
  const [editName, setEditName] = useState('');
  const [editMap, setEditMap] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SharedModel | null>(null);
  const [busyId, setBusyId] = useState('');
  useEffect(() => {
    if (!BRANDS.includes(brand)) return;
    const q = query(collection(db, 'reference_3d_models'), where('brand', '==', brand));
    return onSnapshot(
      q,
      (snap) => {
        setModels(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name),
              brand: String(data.brand),
              path: String(data.path),
              createdBy: String(data.created_by ?? ''),
              modelFileName: String(data.model_file_name ?? data.name + '.glb'),
              map: data.map ?? {},
            };
          })
        );
      },
      () => toast.error('Não foi possível consultar os modelos 3D.')
    );
  }, [brand]);

  // Compatível com o JSON exportado no R3D.2. Identificadores das malhas permanecem estáveis.
  const readMapping = async (source: File, fileName: string): Promise<SharedModel['map']> => {
    if (source.size > 350000) throw new Error('JSON muito grande. Máximo 350 KB.');
    const decoded: unknown = JSON.parse(await source.text());
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('schema' in decoded) ||
      decoded.schema !== 'japanflow-r3d2-v1' ||
      !('modelName' in decoded) ||
      decoded.modelName !== fileName ||
      !('meshes' in decoded)
    )
      throw new Error('O JSON precisa corresponder ao mesmo arquivo GLB.');
    const meshes = decoded.meshes;
    if (!meshes || typeof meshes !== 'object' || Array.isArray(meshes))
      throw new Error('Malhas inválidas.');
    if (Object.keys(meshes).length > 1000) throw new Error('Limite de 1000 malhas.');
    for (const [id, entry] of Object.entries(meshes)) {
      const m = entry as { group?: unknown; color?: unknown; referenceIds?: unknown };
      if (
        !/^mesh-\d+$/.test(id) ||
        typeof m?.group !== 'string' ||
        m.group.length > 100 ||
        typeof m.color !== 'string' ||
        !COLOR.test(m.color) ||
        !Array.isArray(m.referenceIds) ||
        m.referenceIds.length > 100 ||
        !m.referenceIds.every((x) => typeof x === 'string' && x.length < 180)
      )
        throw new Error('Vínculos do JSON inválidos.');
    }
    return meshes as SharedModel['map'];
  };

  const upload = async () => {
    if (!userId || !BRANDS.includes(brand) || !name.trim() || !file || saving) return;
    if (
      !file.name.toLowerCase().endsWith('.glb') ||
      file.size === 0 ||
      file.size > 30 * 1024 * 1024
    ) {
      toast.error('Selecione um GLB de até 30 MB.');
      return;
    }
    setSaving(true);
    try {
      const map = mapFile ? await readMapping(mapFile, file.name) : {};
      const id = crypto.randomUUID();
      const path = `reference_3d/${userId}/${id}.glb`;
      await uploadBytes(ref(storage, path), file, { contentType: 'model/gltf-binary' });
      await addDoc(collection(db, 'reference_3d_models'), {
        name: name.trim().slice(0, 120),
        model_file_name: file.name,
        brand,
        path,
        map,
        created_by: userId,
        created_at: serverTimestamp(),
      });
      setName('');
      setFile(null);
      setMapFile(null);
      toast.success('Modelo 3D compartilhado cadastrado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível publicar o modelo.');
    } finally {
      setSaving(false);
    }
  };

  const open = async (model: SharedModel) => {
    setOpening(model.id);
    try {
      const url = await getDownloadURL(ref(storage, model.path));
      onOpen({ url, name: model.name, map: model.map, id: model.id });
    } catch {
      toast.error('Não foi possível acessar o GLB.');
    } finally {
      setOpening('');
    }
  };

  const edit = async () => {
    if (!editing || !editName.trim() || busyId || editing.createdBy !== userId) return;
    setBusyId(editing.id);
    try {
      const patch: {
        name: string;
        updated_at: ReturnType<typeof serverTimestamp>;
        map?: SharedModel['map'];
      } = {
        name: editName.trim().slice(0, 120),
        updated_at: serverTimestamp(),
      };
      if (editMap) patch.map = await readMapping(editMap, editing.modelFileName);
      await updateDoc(doc(db, 'reference_3d_models', editing.id), patch);
      toast.success('Conjunto atualizado.');
      setEditing(null);
      setEditMap(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao editar conjunto.');
    } finally {
      setBusyId('');
    }
  };

  const remove = async () => {
    if (!pendingDelete || pendingDelete.createdBy !== userId || busyId) return;
    const target = pendingDelete;
    setBusyId(target.id);
    try {
      // Apagar primeiro o registro: impede novas aberturas. A exclusão do blob pode falhar;
      // nesse caso, um alerta explícito avisa que há um objeto órfão a revisar.
      await deleteDoc(doc(db, 'reference_3d_models', target.id));
      setPendingDelete(null);
      try {
        await deleteObject(ref(storage, target.path));
        toast.success('Conjunto e arquivo 3D excluídos.');
      } catch {
        toast.warning(
          'Registro excluído, mas o arquivo GLB pode permanecer no Storage. Solicite a limpeza do caminho: ' +
            target.path
        );
      }
    } catch {
      toast.error('Falha ao excluir conjunto. Verifique as permissões.');
    } finally {
      setBusyId('');
    }
  };

  const visibleModels = models.filter((m) =>
    m.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  );

  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-label="Biblioteca compartilhada de modelos 3D"
    >
      <div>
        <h3 className="font-semibold">Modelos 3D compartilhados · {brand}</h3>
        <p className="text-xs text-muted-foreground">
          Disponíveis aos usuários autorizados de Vendas.
        </p>
      </div>
      <label className="block text-xs">
        Filtrar biblioteca
        <input
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conjuntos desta marca"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibleModels.map((model) => (
          <article key={model.id} className="min-w-0 space-y-2 rounded-xl border p-3">
            <p className="truncate text-sm font-semibold" title={model.name}>
              {model.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(model.map).length} malhas mapeadas
            </p>
            <Button
              variant="outline"
              disabled={!!busyId || opening === model.id}
              onClick={() => void open(model)}
              className="h-10 w-full"
            >
              {opening === model.id ? 'Abrindo...' : 'Abrir conjunto'}
            </Button>
            {model.createdBy === userId && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busyId}
                  onClick={() => {
                    setEditing(model);
                    setEditName(model.name);
                    setEditMap(null);
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={!!busyId}
                  onClick={() => setPendingDelete(model)}
                >
                  Excluir
                </Button>
              </div>
            )}
          </article>
        ))}
        {visibleModels.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum conjunto encontrado.</p>
        )}
      </div>
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar conjunto"
          className="space-y-3 rounded-xl border border-primary/40 p-4"
        >
          <h4 className="font-semibold">Editar conjunto: {editing.name}</h4>
          <label className="block text-sm">
            Nome do conjunto
            <input
              className="mt-1 w-full rounded-md border bg-background p-2"
              maxLength={120}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Novo mapeamento JSON (opcional; arquivo GLB original: {editing.modelFileName})
            <input
              className="mt-1 block w-full text-xs"
              type="file"
              accept=".json,application/json"
              onChange={(e) => setEditMap(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            O GLB não será alterado. Para trocar geometria, cadastre uma nova versão.
          </p>
          <div className="flex gap-2">
            <Button disabled={!!busyId || !editName.trim()} onClick={() => void edit()}>
              Salvar edição
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
          className="space-y-3 rounded-xl border border-destructive/40 p-4"
        >
          <h4 className="font-semibold">Excluir definitivamente {pendingDelete.name}?</h4>
          <p className="text-xs text-muted-foreground">
            O cadastro e o GLB serão apagados. Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={!!busyId} onClick={() => void remove()}>
              Confirmar exclusão
            </Button>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Cadastrar novo conjunto GLB
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Nome do conjunto
            <input
              className="mt-1 w-full rounded-md border bg-background p-2"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Motor 4G63"
            />
          </label>
          <label className="text-sm">
            Modelo GLB (até 30 MB)
            <input
              className="mt-1 block w-full text-xs"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Mapeamento JSON exportado pelo R3D.2 (opcional)
            <input
              className="mt-1 block w-full text-xs"
              type="file"
              accept=".json,application/json"
              onChange={(e) => setMapFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={!name.trim() || !file || saving}
            onClick={() => void upload()}
          >
            {saving ? 'Enviando...' : 'Publicar modelo para Vendas'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cadastre apenas modelos com direitos de uso. Somente o autor pode editar ou excluir seus
          conjuntos. Para substituir um GLB, publique uma nova versão.
        </p>
      </details>
    </section>
  );
}
