import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft,
  ChevronRight,
  CircleDot,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  REFERENCE_BRANDS,
  REFERENCE_SYSTEMS,
  asDiagram,
  positionFromPoint,
  type AlternativePart,
  type ReferenceBrand,
  type ReferenceDiagram,
  type ReferenceMarker,
  type ReferenceSystem,
} from '@/lib/referenceDiagrams';

type NewDiagram = { title: string; vehicle: string; yearRange: string; system: ReferenceSystem };
const emptyDiagram = (): NewDiagram => ({
  title: '',
  vehicle: '',
  yearRange: '',
  system: 'Suspensão',
});
const newPart = (): AlternativePart => ({
  id: crypto.randomUUID(),
  name: '',
  manufacturer: '',
  model: '',
  code: '',
  notes: '',
});
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function ImageCanvas({
  url,
  title,
  markers,
  selectedId,
  canEdit,
  placing,
  onSelect,
  onPlace,
}: {
  url: string;
  title: string;
  markers: ReferenceMarker[];
  selectedId: string | null;
  canEdit: boolean;
  placing: boolean;
  onSelect: (id: string) => void;
  onPlace: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = markers.find((m) => m.id === selectedId);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border bg-muted/30" ref={ref}>
      <div
        className="relative w-full"
        onClick={(e) => {
          if (!canEdit || !placing || !ref.current) return;
          const rect = ref.current.getBoundingClientRect();
          const p = positionFromPoint(e.clientX, e.clientY, rect);
          onPlace(p.x, p.y);
        }}
      >
        <img
          src={url}
          alt={`Vista técnica: ${title}`}
          draggable={false}
          className={`block h-auto w-full select-none ${placing ? 'cursor-crosshair' : ''}`}
        />
        {/* SVG follows the same responsive coordinate system as the displayed image. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {selected && (
            <line
              x1={selected.x}
              y1={selected.y}
              x2="100"
              y2={selected.y}
              stroke="currentColor"
              strokeWidth=".28"
              strokeDasharray="1.5 1"
              className="text-primary"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {markers.map((m, index) => (
          <button
            key={m.id}
            type="button"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg ring-2 ring-background transition hover:scale-110 sm:h-10 sm:w-10 ${m.id === selectedId ? 'border-white bg-primary text-primary-foreground' : 'border-white bg-amber-500 text-black'}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(m.id);
            }}
            title={m.label}
            aria-label={`Ponto ${index + 1}: ${m.label}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      {canEdit && placing && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-background/95 px-3 py-2 text-xs shadow">
          Clique no sistema para posicionar um círculo.
        </div>
      )}
    </div>
  );
}

export default function ReferenceDiagramCatalogPage() {
  const { currentUser } = useApp();
  const admin = currentUser?.role === 'admin' && currentUser?.active !== false;
  const allowed = Boolean(
    currentUser?.active !== false && (admin || currentUser?.sectors?.includes('vendas'))
  );
  const [brand, setBrand] = useState<ReferenceBrand | null>(null);
  const [system, setSystem] = useState<ReferenceSystem | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<ReferenceDiagram[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [editor, setEditor] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [markerId, setMarkerId] = useState<string | null>(null);
  const [draftMarkers, setDraftMarkers] = useState<ReferenceMarker[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<NewDiagram>(emptyDiagram);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!brand || !allowed) {
      setDiagrams([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'reference_diagrams'), where('brand', '==', brand));
    return onSnapshot(
      q,
      (snapshot) => {
        setDiagrams(
          snapshot.docs
            .map((d) => asDiagram(d.id, d.data()))
            .filter((d): d is ReferenceDiagram => d !== null)
        );
        setLoading(false);
      },
      (e) => {
        console.error(e);
        toast.error('Não foi possível carregar os diagramas.');
        setLoading(false);
      }
    );
  }, [brand, allowed]);

  const diagram = diagrams.find((d) => d.id === diagramId) ?? null;
  const visible = useMemo(
    () =>
      diagrams.filter(
        (d) =>
          (!system || d.system === system) &&
          `${d.title} ${d.vehicle} ${d.yearRange}`.toLowerCase().includes(queryText.toLowerCase())
      ),
    [diagrams, system, queryText]
  );
  const markers = editor ? draftMarkers : (diagram?.markers ?? []);
  const selectedMarker = markers.find((m) => m.id === markerId) ?? null;

  useEffect(() => {
    const paths = diagrams
      .map((d) => d.imagePath)
      .filter((path) => path.startsWith('reference_diagrams/') && !imageUrls[path]);
    if (!allowed || paths.length === 0) return;
    let cancelled = false;
    void Promise.all(
      paths.map(async (path) => {
        try {
          const url = await getDownloadURL(storageRef(storage, path));
          if (!cancelled) setImageUrls((old) => ({ ...old, [path]: url }));
        } catch (e) {
          console.warn('Imagem de referência indisponível', path, e);
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [diagrams, allowed, imageUrls]);

  const choose = (id: string) => {
    setDiagramId(id);
    setMarkerId(null);
    setEditor(false);
    setPlacing(false);
    setDirty(false);
  };
  const back = () => {
    if (dirty && !window.confirm('Descartar alterações não salvas?')) return;
    if (diagramId) {
      setDiagramId(null);
      setEditor(false);
      setDirty(false);
      setMarkerId(null);
    } else if (system) {
      setSystem(null);
      setQueryText('');
    } else {
      setBrand(null);
      setQueryText('');
    }
  };
  const editMarkers = () => {
    if (!admin || !diagram) return;
    setDraftMarkers(structuredClone(diagram.markers));
    setEditor(true);
    setDirty(false);
    setMarkerId(null);
  };
  const modifyMarker = useCallback(
    (id: string, transform: (m: ReferenceMarker) => ReferenceMarker) => {
      setDraftMarkers((previous) => previous.map((m) => (m.id === id ? transform(m) : m)));
      setDirty(true);
    },
    []
  );
  const place = (x: number, y: number) => {
    if (!admin || !editor) return;
    const id = crypto.randomUUID();
    setDraftMarkers((old) => [...old, { id, x, y, label: `Ponto ${old.length + 1}`, parts: [] }]);
    setMarkerId(id);
    setPlacing(false);
    setDirty(true);
  };
  const saveMarkers = async () => {
    if (!admin || !diagram || saving) return;
    if (
      draftMarkers.length > 60 ||
      draftMarkers.some(
        (m) =>
          !m.label.trim() ||
          m.parts.length > 20 ||
          m.parts.some((p) => !p.name.trim() || !p.manufacturer.trim() || !p.model.trim())
      )
    ) {
      toast.error(
        'Revise os pontos: informe identificação e marca/modelo das peças. Máximo: 60 pontos e 20 opções por ponto.'
      );
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'reference_diagrams', diagram.id), {
        markers: draftMarkers,
        updated_at: serverTimestamp(),
      });
      toast.success('Marcações salvas para toda a equipe.');
      setEditor(false);
      setDirty(false);
      setPlacing(false);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar as marcações.');
    } finally {
      setSaving(false);
    }
  };
  const createDiagram = async () => {
    if (!admin || !brand || !currentUser || saving) return;
    if (
      !file ||
      !form.title.trim() ||
      !form.vehicle.trim() ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > MAX_IMAGE_SIZE ||
      file.size === 0
    ) {
      toast.error('Informe título, veículo e uma imagem JPG/PNG/WebP de até 8 MB.');
      return;
    }
    setSaving(true);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `reference_diagrams/${currentUser.id}/${crypto.randomUUID()}.${ext}`;
      await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
      const record = await addDoc(collection(db, 'reference_diagrams'), {
        brand,
        system: form.system,
        title: form.title.trim(),
        vehicle: form.vehicle.trim(),
        year_range: form.yearRange.trim(),
        image_path: path,
        markers: [],
        created_by: currentUser.id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setCreating(false);
      setFile(null);
      setForm(emptyDiagram());
      setSystem(form.system);
      choose(record.id);
      toast.success('Sistema cadastrado. Abra o editor para adicionar círculos.');
    } catch (e) {
      console.error(e);
      toast.error('Falha no cadastro. Um upload incompleto pode exigir limpeza administrativa.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed)
    return (
      <div role="alert" className="rounded-xl border bg-card p-6">
        Acesso restrito ao setor de Vendas e administradores.
      </div>
    );
  return (
    <main className="w-full min-w-0 space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            JapanFlow / Referências técnicas
          </p>
          <h1 className="text-2xl font-semibold">
            {diagram?.title ?? system ?? brand ?? 'Catálogo visual de peças'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {diagram
              ? `${diagram.brand} · ${diagram.system} · ${diagram.vehicle}`
              : 'Selecione a marca, o sistema e uma vista técnica para consultar as peças.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {brand && (
            <Button variant="outline" onClick={back}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          {admin && brand && !diagram && (
            <Button
              onClick={() => {
                setForm({ ...emptyDiagram(), system: system ?? 'Suspensão' });
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar sistema
            </Button>
          )}
          {admin && diagram && !editor && (
            <Button onClick={editMarkers}>
              <MapPin className="mr-2 h-4 w-4" />
              Editar círculos
            </Button>
          )}
          {admin && diagram && editor && (
            <>
              <Button variant="outline" onClick={() => setPlacing((v) => !v)}>
                <CircleDot className="mr-2 h-4 w-4" />
                {placing ? 'Cancelar ponto' : 'Adicionar círculo'}
              </Button>
              <Button onClick={() => void saveMarkers()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar marcações'}
              </Button>
            </>
          )}
        </div>
      </div>

      {!brand && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {REFERENCE_BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => {
                setBrand(b);
                setSystem(null);
              }}
              className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <img
                src={`/${b.toLowerCase()}.svg`}
                alt={`Logo ${b}`}
                className="h-14 w-28 object-contain"
              />
              <span className="font-semibold">{b}</span>
            </button>
          ))}
        </div>
      )}

      {brand && !system && !diagram && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {REFERENCE_SYSTEMS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSystem(s);
                setQueryText('');
              }}
              className="rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <ImagePlus className="h-6 w-6 text-primary" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="font-semibold">{s}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {diagrams.filter((d) => d.system === s).length} vista(s) técnica(s)
              </p>
            </button>
          ))}
        </div>
      )}

      {brand && system && !diagram && (
        <section className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar veículo ou sistema..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </div>
          {loading ? (
            <p>Carregando sistemas...</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhuma imagem cadastrada nessa categoria.{' '}
              {admin && 'Use Adicionar sistema para começar.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary hover:shadow-md"
                  onClick={() => choose(d.id)}
                >
                  <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                    {imageUrls[d.imagePath] ? (
                      <img
                        src={imageUrls[d.imagePath]}
                        alt={d.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-semibold">{d.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {d.vehicle} {d.yearRange}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {d.markers.length} ponto(s) cadastrado(s)
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {diagram && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
            <span>
              <strong>Veículo:</strong> {diagram.vehicle}
            </span>
            <span>
              <strong>Anos:</strong> {diagram.yearRange || 'Não informado'}
            </span>
            <span>
              <strong>Marcações:</strong> {markers.length}
            </span>
          </div>
          {imageUrls[diagram.imagePath] ? (
            <ImageCanvas
              url={imageUrls[diagram.imagePath]}
              title={diagram.title}
              markers={markers}
              selectedId={markerId}
              canEdit={admin}
              placing={placing && editor}
              onSelect={setMarkerId}
              onPlace={place}
            />
          ) : (
            <div className="rounded-xl border bg-muted p-12 text-center text-sm text-muted-foreground">
              Carregando imagem técnica...
            </div>
          )}
          <div className="space-y-3">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Pontos identificados</h2>
              {markers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há círculos cadastrados nesta imagem.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {markers.map((m, i) => (
                    <Button
                      key={m.id}
                      size="sm"
                      variant={m.id === markerId ? 'default' : 'outline'}
                      onClick={() => setMarkerId(m.id)}
                    >
                      {i + 1}. {m.label}
                    </Button>
                  ))}
                </div>
              )}
            </section>
            {selectedMarker && (
              <aside
                className="fixed inset-y-0 right-0 z-40 w-[min(92vw,420px)] overflow-y-auto border-l bg-background p-5 shadow-2xl"
                aria-label="Peças compatíveis com o ponto selecionado"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Referências vinculadas
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar painel"
                    onClick={() => setMarkerId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {!selectedMarker ? (
                  <div className="text-sm text-muted-foreground">
                    <CircleDot className="mb-3 h-7 w-7" />
                    Selecione um círculo na imagem para ver as peças e alternativas compatíveis.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{selectedMarker.label}</h2>
                      {editor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir círculo"
                          onClick={() => {
                            setDraftMarkers((old) => old.filter((m) => m.id !== selectedMarker.id));
                            setMarkerId(null);
                            setDirty(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {editor && (
                      <label className="block text-xs">
                        Identificação do ponto
                        <Input
                          className="mt-1"
                          value={selectedMarker.label}
                          maxLength={100}
                          onChange={(e) =>
                            modifyMarker(selectedMarker.id, (m) => ({
                              ...m,
                              label: e.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Peças e marcas aplicáveis a este local:
                    </p>
                    {selectedMarker.parts.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma peça vinculada ainda.</p>
                    )}
                    {selectedMarker.parts.map((p) => (
                      <div key={p.id} className="space-y-2 rounded-lg border p-3">
                        {editor ? (
                          <>
                            {(
                              [
                                ['name', 'Nome da peça'],
                                ['manufacturer', 'Marca da peça'],
                                ['model', 'Modelo do veículo'],
                                ['code', 'Código / OEM'],
                                ['notes', 'Observações'],
                              ] as const
                            ).map(([k, label]) => (
                              <label key={k} className="block text-xs">
                                {label}
                                <Input
                                  className="mt-1"
                                  value={p[k]}
                                  onChange={(e) =>
                                    modifyMarker(selectedMarker.id, (m) => ({
                                      ...m,
                                      parts: m.parts.map((x) =>
                                        x.id === p.id ? { ...x, [k]: e.target.value } : x
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                modifyMarker(selectedMarker.id, (m) => ({
                                  ...m,
                                  parts: m.parts.filter((x) => x.id !== p.id),
                                }))
                              }
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              Remover alternativa
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold">{p.name}</p>
                            <p className="text-xs">
                              <strong>Marca:</strong> {p.manufacturer}
                            </p>
                            <p className="text-xs">
                              <strong>Modelo:</strong> {p.model}
                            </p>
                            {p.code && (
                              <p className="text-xs">
                                <strong>Código:</strong> {p.code}
                              </p>
                            )}
                            {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                          </>
                        )}
                      </div>
                    ))}
                    {editor && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          modifyMarker(selectedMarker.id, (m) => ({
                            ...m,
                            parts: [...m.parts, newPart()],
                          }))
                        }
                        disabled={selectedMarker.parts.length >= 20}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar peça alternativa
                      </Button>
                    )}
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      )}

      {creating && admin && brand && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Adicionar sistema"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
        >
          <div className="max-h-[94vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova imagem técnica — {brand}</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCreating(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <label className="block text-sm">
              Sistema
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={form.system}
                onChange={(e) =>
                  setForm((f) => ({ ...f, system: e.target.value as ReferenceSystem }))
                }
              >
                {REFERENCE_SYSTEMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Nome do conjunto
              <Input
                className="mt-1"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Suspensão dianteira"
              />
            </label>
            <label className="block text-sm">
              Veículo / modelo
              <Input
                className="mt-1"
                value={form.vehicle}
                onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                placeholder="Ex.: Lancer 2.0"
              />
            </label>
            <label className="block text-sm">
              Anos compatíveis
              <Input
                className="mt-1"
                value={form.yearRange}
                onChange={(e) => setForm((f) => ({ ...f, yearRange: e.target.value }))}
                placeholder="Ex.: 2011–2018"
              />
            </label>
            <label className="block text-sm">
              Imagem do sistema (JPG, PNG ou WebP; até 8 MB)
              <Input
                className="mt-1"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Após cadastrar, abra a imagem e use Editar círculos → Adicionar círculo para marcar as
              posições.
            </p>
            <Button className="w-full" disabled={saving} onClick={() => void createDiagram()}>
              {saving ? 'Enviando...' : 'Cadastrar sistema'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
