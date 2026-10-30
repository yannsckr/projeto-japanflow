import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Download, FileUp, Info, RotateCcw, Upload, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#f97316'];
type Mapping = { group: string; color: string; referenceIds: string[] };
type MeshInfo = { id: string; name: string };
type Reference = { id: string; name: string; partType: string; description: string };
type MapFile = { schema: 'japanflow-r3d2-v1'; modelName: string; meshes: Record<string, Mapping> };

function Model({
  model,
  mappings,
  selected,
  onPick,
  exploded,
}: {
  model: Group;
  mappings: Record<string, Mapping>;
  selected: string | null;
  onPick: (id: string) => void;
  exploded: boolean;
}) {
  const rendered = useMemo(() => {
    const copy = model.clone(true);
    const box = new Box3().setFromObject(copy);
    const size = box.getSize(new Vector3());
    const max = Math.max(size.x, size.y, size.z, 0.001);
    const center = box.getCenter(new Vector3());
    copy.position.sub(center);
    copy.scale.setScalar(3.7 / max);
    let n = 0;
    copy.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const id = `mesh-${n++}`;
      o.userData.jfMeshId = id;
      // Visualização de inspeção, não representação dimensional de montagem.
      // Deslocamento baseado no centro mundial atual; não usar como referência CAD.
      if (exploded) {
        const bounds = new Box3().setFromObject(o);
        const direction = bounds.getCenter(new Vector3()).sub(center);
        if (direction.lengthSq() < 0.0001) direction.set(n % 2 ? 1 : -1, 0.5, 0.7);
        o.position.addScaledVector(direction.normalize(), 0.22);
      }
      const originals = Array.isArray(o.material) ? o.material : [o.material];
      const mapped = mappings[id];
      const recolored = originals.map((mat) => {
        const cloned = mat.clone();
        if (cloned instanceof MeshStandardMaterial) {
          if (mapped) cloned.color.set(mapped.color);
          if (id === selected) {
            cloned.emissive.set(mapped?.color ?? '#00aaff');
            cloned.emissiveIntensity = 0.35;
          }
        }
        return cloned;
      });
      o.material = Array.isArray(o.material) ? recolored : recolored[0];
    });
    return copy;
  }, [model, mappings, selected, exploded]);

  useEffect(
    () => () => {
      rendered.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((material) => material.dispose());
      });
    },
    [rendered]
  );

  return (
    <primitive
      object={rendered}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const id = event.object.userData.jfMeshId as string | undefined;
        if (id) onPick(id);
      }}
    />
  );
}

export function ReferenceGLBMapper({
  references,
  sharedModel,
}: {
  references: Reference[];
  sharedModel?: { url: string; name: string; map: Record<string, Mapping>; id: string } | null;
}) {
  const [model, setModel] = useState<Group | null>(null);
  const [modelName, setModelName] = useState('');
  const [meshes, setMeshes] = useState<MeshInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exploded, setExploded] = useState(false);
  const current = selected ? mappings[selected] : undefined;
  useEffect(() => {
    if (!sharedModel) return;
    let active = true;
    fetch(sharedModel.url)
      .then((response) => {
        if (!response.ok) throw new Error('Arquivo 3D indisponível.');
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        const file = new File(
          [blob],
          sharedModel.name.endsWith('.glb') ? sharedModel.name : `${sharedModel.name}.glb`,
          { type: 'model/gltf-binary' }
        );
        // O carregador local atual preserva todas as validações de formato e tamanho.
        load(file, sharedModel.map);
      })
      .catch(() => {
        if (active) setError('Falha ao carregar modelo compartilhado.');
      });
    return () => {
      active = false;
    };
    // A abertura depende do ID escolhido, não da URL temporária retornada pelo Storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedModel?.id]);

  const load = (file: File, initialMap: Record<string, Mapping> = {}) => {
    if (!file.name.toLowerCase().endsWith('.glb') || file.size > 30 * 1024 * 1024) {
      setError('Use um arquivo .glb válido com até 30 MB.');
      return;
    }
    setLoading(true);
    setExploded(false);
    setError('');
    const url = URL.createObjectURL(file);
    new GLTFLoader().load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const found: MeshInfo[] = [];
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh)
            found.push({
              id: `mesh-${found.length}`,
              name: o.name || `Componente ${found.length + 1}`,
            });
        });
        if (!found.length) {
          setError('O GLB não contém malhas 3D selecionáveis.');
          setLoading(false);
          return;
        }
        setModel(gltf.scene);
        setMeshes(found);
        setSelected(null);
        setMappings(initialMap);
        setModelName(file.name);
        setLoading(false);
      },
      undefined,
      () => {
        URL.revokeObjectURL(url);
        setError(
          'Não foi possível abrir o GLB. Confira se ele é válido e contém os recursos necessários.'
        );
        setLoading(false);
      }
    );
  };

  const update = (patch: Partial<Mapping>) => {
    if (!selected) return;
    setMappings((previous) => ({
      ...previous,
      [selected]: {
        group: '',
        color: COLORS[0],
        referenceIds: [],
        ...previous[selected],
        ...patch,
      },
    }));
  };

  const exportMap = () => {
    const data: MapFile = { schema: 'japanflow-r3d2-v1', modelName, meshes: mappings };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${modelName.replace(/\.glb$/i, '')}-mapeamento.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importMap = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as MapFile;
      if (
        data.schema !== 'japanflow-r3d2-v1' ||
        data.modelName !== modelName ||
        !data.meshes ||
        typeof data.meshes !== 'object' ||
        Array.isArray(data.meshes)
      ) {
        throw new Error('O mapeamento não corresponde ao modelo aberto.');
      }
      const allowed = new Set(meshes.map((m) => m.id));
      const result: Record<string, Mapping> = {};
      for (const [id, value] of Object.entries(data.meshes)) {
        if (
          !allowed.has(id) ||
          typeof value?.group !== 'string' ||
          !COLORS.includes(value.color) ||
          !Array.isArray(value.referenceIds) ||
          !value.referenceIds.every((ref) => typeof ref === 'string')
        )
          throw new Error('Mapeamento inválido.');
        result[id] = {
          group: value.group.slice(0, 100),
          color: value.color,
          referenceIds: value.referenceIds,
        };
      }
      setMappings(result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido.');
    }
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-card"
      aria-label="Mapeador de peças em modelo GLB"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <h3 className="font-semibold">R3D.2 · Identificador de componentes GLB</h3>
          <p className="text-xs text-muted-foreground">
            Mapeamento local para homologação; não é publicado no Firebase.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <FileUp className="h-4 w-4" /> {loading ? 'Carregando...' : 'Abrir modelo GLB'}
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            className="sr-only"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      {model && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExploded((value) => !value)}
            aria-pressed={exploded}
          >
            <Layers className="mr-2 h-4 w-4" />
            {exploded ? 'Reunir conjunto' : 'Inspecionar separação (prévia)'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Deslocamento visual ilustrativo, não uma sequência OEM de desmontagem.
          </span>
        </div>
      )}
      {error && (
        <p className="p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {!model ? (
        <div className="flex min-h-48 items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <Info className="h-5 w-5" /> Envie um modelo GLB para identificar as malhas e associar
          referências.
        </div>
      ) : (
        <div className="flex min-w-0 flex-col">
          <div className="relative h-[min(78vh,820px)] min-h-[420px] w-full bg-slate-100 dark:bg-slate-900">
            <Canvas
              dpr={[1, 1.75]}
              gl={{ powerPreference: 'high-performance' }}
              camera={{ position: [4, 3, 5], fov: 43 }}
              onPointerMissed={() => setSelected(null)}
            >
              <ambientLight intensity={1.4} />
              <directionalLight position={[5, 7, 5]} intensity={2.1} />
              <Suspense fallback={null}>
                <Model
                  model={model}
                  mappings={mappings}
                  selected={selected}
                  onPick={setSelected}
                  exploded={exploded}
                />
              </Suspense>
              <OrbitControls makeDefault minDistance={2} maxDistance={18} />
            </Canvas>
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs">
              Arraste para girar · Clique na malha · {modelName}
            </span>
          </div>
          <aside className="grid gap-4 border-t p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <strong className="text-sm">Componentes ({meshes.length})</strong>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {meshes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m.id)}
                    className={`block w-full truncate rounded border p-2 text-left text-xs ${selected === m.id ? 'border-primary bg-primary/10' : ''}`}
                  >
                    {m.name} · {m.id}
                  </button>
                ))}
              </div>
            </div>
            {selected ? (
              <div className="space-y-3 border-t pt-3">
                <strong className="text-sm">
                  Mapear {meshes.find((m) => m.id === selected)?.name}
                </strong>
                <label className="block text-xs">
                  Nome do grupo
                  <input
                    className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                    value={current?.group ?? ''}
                    maxLength={100}
                    onChange={(e) => update({ group: e.target.value })}
                    placeholder="Ex.: Rolamentos"
                  />
                </label>
                <div>
                  <span className="text-xs">Cor do grupo</span>
                  <div className="mt-2 flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Selecionar cor ${color}`}
                        aria-pressed={(current?.color ?? COLORS[0]) === color}
                        onClick={() => update({ color })}
                        style={{ backgroundColor: color }}
                        className={`h-7 w-7 rounded-full ${(current?.color ?? COLORS[0]) === color ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs">Vincular referências carregadas</span>
                  <div className="mt-1 max-h-52 space-y-1 overflow-y-auto">
                    {references.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-start gap-2 rounded border p-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={current?.referenceIds.includes(r.id) ?? false}
                          onChange={(e) =>
                            update({
                              referenceIds: e.target.checked
                                ? [...(current?.referenceIds ?? []), r.id]
                                : (current?.referenceIds ?? []).filter((id) => id !== r.id),
                            })
                          }
                        />
                        <span>
                          {r.name} <span className="text-muted-foreground">{r.partType}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {references.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Carregue as peças da marca para vinculá-las.
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selected)
                      setMappings((p) => {
                        const next = { ...p };
                        delete next[selected];
                        return next;
                      });
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Limpar marcação
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Clique no modelo ou na lista para selecionar um componente.
              </p>
            )}
            <div className="space-y-2 border-t pt-3">
              <Button variant="outline" size="sm" className="w-full" onClick={exportMap}>
                <Download className="mr-2 h-4 w-4" /> Exportar mapeamento JSON
              </Button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-2 text-sm">
                <Upload className="h-4 w-4" /> Importar mapeamento
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importMap(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
