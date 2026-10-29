import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  limit,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
  serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft,
  Cog,
  Filter,
  ImagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BRANDS = ['Mitsubishi', 'Toyota', 'Honda', 'Suzuki', 'Subaru'] as const;
type Brand = (typeof BRANDS)[number];
type Reference = {
  id: string;
  name: string;
  description: string;
  vehicleBrand: Brand;
  vehicles: string[];
  manufacturer: string;
  partType: string;
  yearStart: number;
  yearEnd: number;
  photos: string[];
};
const PAGE_SIZE = 24;
const blank = {
  name: '',
  description: '',
  manufacturer: '',
  partType: '',
  vehicles: '',
  yearStart: '2000',
  yearEnd: String(new Date().getFullYear()),
};
const isBrand = (v: string): v is Brand => BRANDS.includes(v as Brand);
const clean = (x: unknown) => String(x ?? '').trim();

export default function ReferencesPage() {
  const { currentUser } = useApp();
  const allowed = Boolean(
    currentUser?.active !== false && currentUser?.sectors?.includes('vendas')
  );
  const [brand, setBrand] = useState<Brand | null>(null);
  const [items, setItems] = useState<Reference[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partFilter, setPartFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [imageIndex, setImageIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    setError('');
    setSearch('');
    setPartFilter('');
    setVehicleFilter('');
    if (!brand || !allowed) return;
    let cancelled = false;
    setLoading(true);
    void getDocs(
      query(
        collection(db, 'part_references'),
        where('vehicle_brand', '==', brand),
        limit(PAGE_SIZE)
      )
    )
      .then((snapshot) => {
        if (cancelled) return;
        setItems(
          snapshot.docs.map((d) => ({
            id: d.id,
            name: clean(d.data().name),
            description: clean(d.data().description),
            vehicleBrand: brand,
            vehicles: Array.isArray(d.data().vehicles) ? d.data().vehicles.map(String) : [],
            manufacturer: clean(d.data().manufacturer),
            partType: clean(d.data().part_type),
            yearStart: Number(d.data().year_start),
            yearEnd: Number(d.data().year_end),
            photos: Array.isArray(d.data().photos) ? d.data().photos.map(String) : [],
          }))
        );
        setCursor(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setError('Não foi possível carregar as peças desta marca.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand, allowed, reload]);

  const loadMore = async () => {
    if (!brand || !cursor || loading || !hasMore) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'part_references'),
          where('vehicle_brand', '==', brand),
          startAfter(cursor),
          limit(PAGE_SIZE)
        )
      );
      setItems((prev) => [
        ...prev,
        ...snapshot.docs.map((d) => ({
          id: d.id,
          name: clean(d.data().name),
          description: clean(d.data().description),
          vehicleBrand: brand,
          vehicles: Array.isArray(d.data().vehicles) ? d.data().vehicles.map(String) : [],
          manufacturer: clean(d.data().manufacturer),
          partType: clean(d.data().part_type),
          yearStart: Number(d.data().year_start),
          yearEnd: Number(d.data().year_end),
          photos: Array.isArray(d.data().photos) ? d.data().photos.map(String) : [],
        })),
      ]);
      setCursor(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar mais peças.');
    } finally {
      setLoading(false);
    }
  };
  const types = useMemo(
    () => [...new Set(items.map((i) => i.partType).filter(Boolean))].sort(),
    [items]
  );
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          [i.name, i.description, i.manufacturer, i.partType, ...i.vehicles]
            .join(' ')
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (!partFilter || i.partType === partFilter) &&
          (!vehicleFilter ||
            i.vehicles.some((v) => v.toLowerCase().includes(vehicleFilter.toLowerCase())))
      ),
    [items, search, partFilter, vehicleFilter]
  );

  const save = async () => {
    if (!brand || !currentUser || saving) return;
    const years = [Number(form.yearStart), Number(form.yearEnd)];
    const vehicles = form.vehicles
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (
      !form.name.trim() ||
      !form.partType.trim() ||
      !form.manufacturer.trim() ||
      vehicles.length === 0 ||
      files.length === 0 ||
      years.some((n) => !Number.isInteger(n)) ||
      years[0] < 1950 ||
      years[1] > 2100 ||
      years[0] > years[1]
    ) {
      toast.error('Preencha nome, tipo, fabricante, carros, anos válidos e ao menos uma foto.');
      return;
    }
    if (
      files.length > 6 ||
      files.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 8 * 1024 * 1024
      )
    ) {
      toast.error('Até 6 imagens JPG/PNG/WebP com até 8 MB cada.');
      return;
    }
    setSaving(true);
    try {
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        const extension =
          file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `sales_references/${currentUser.id}/${crypto.randomUUID()}-${i}.${extension}`;
        const target = ref(storage, path);
        await uploadBytes(target, file, { contentType: file.type });
        // As regras do Storage limitam o acesso autenticado ao setor vendas.
        paths.push(path);
      }
      await addDoc(collection(db, 'part_references'), {
        name: form.name.trim(),
        description: form.description.trim(),
        vehicle_brand: brand,
        vehicles,
        manufacturer: form.manufacturer.trim(),
        part_type: form.partType.trim(),
        year_start: years[0],
        year_end: years[1],
        photos: paths,
        created_by: currentUser.id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      toast.success('Peça cadastrada!');
      setCreateOpen(false);
      setForm(blank);
      setFiles([]);
      setReload((x) => x + 1);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível cadastrar a peça. Confira permissões do Firestore e Storage.');
    } finally {
      setSaving(false);
    }
  };

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const paths = visible
      .flatMap((i) => i.photos)
      .filter((p) => p.startsWith('sales_references/') && !photoUrls[p]);
    void Promise.all(
      paths.map(async (path) => {
        try {
          const url = await getDownloadURL(ref(storage, path));
          if (!cancelled) setPhotoUrls((prev) => ({ ...prev, [path]: url }));
        } catch {
          /* ausência de foto não impede listagem */
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [allowed, visible, photoUrls]);
  if (!allowed)
    return (
      <div className="rounded-xl border p-6" role="alert">
        Acesso restrito ao setor de Vendas.
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Referências de peças</h1>
          <p className="text-sm text-muted-foreground">
            Imagens e compatibilidade para atendimento aos clientes.
          </p>
        </div>
        {brand && (
          <Button variant="outline" onClick={() => setBrand(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Todas as marcas
          </Button>
        )}
      </div>
      {!brand ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className="group flex min-h-44 flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-3xl font-black tracking-tight"
                aria-hidden="true"
              >
                {b.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-xl font-semibold">{b}</span>
              <span className="text-xs text-muted-foreground">Abrir catálogo</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Pesquisar peças de ${brand}...`}
                aria-label="Pesquisar peças"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setFilterOpen((x) => !x)}
              aria-expanded={filterOpen}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => setSettingsOpen((x) => !x)}
              aria-label="Configurações de filtros"
              title="Configurações de filtros"
            >
              <Cog className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Peça
            </Button>
          </div>
          {filterOpen && (
            <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
              <label className="text-sm">
                Tipo de peça
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={partFilter}
                  onChange={(e) => setPartFilter(e.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Carro / modelo
                <Input
                  className="mt-1"
                  placeholder="Ex.: Civic, Lancer..."
                  value={vehicleFilter}
                  onChange={(e) => setVehicleFilter(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Marca selecionada: {brand}. Para outra marca, volte ao catálogo inicial.
              </p>
            </div>
          )}
          {settingsOpen && (
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
              <span>Configurações rápidas: limpar pesquisa e filtros.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setPartFilter('');
                  setVehicleFilter('');
                  setFilterOpen(false);
                  setSettingsOpen(false);
                }}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => {
              const index = imageIndex[item.id] ?? 0;
              const path = item.photos[index];
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border bg-card shadow-sm"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                    {photoUrls[path] ? (
                      <img
                        src={photoUrls[path]}
                        alt={`Peça ${item.name}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="h-10 w-10 text-muted-foreground" />
                    )}
                    {item.photos.length > 1 && (
                      <div className="absolute bottom-2 right-2 flex gap-1 rounded-full bg-background/90 p-1">
                        {item.photos.map((p, j) => (
                          <button
                            key={p}
                            type="button"
                            className={`h-2.5 w-2.5 rounded-full ${j === index ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                            aria-label={`Foto ${j + 1}`}
                            onClick={() => setImageIndex((s) => ({ ...s, [item.id]: j }))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <div className="text-xs">
                      <p>
                        <strong>Tipo:</strong> {item.partType}
                      </p>
                      <p>
                        <strong>Marca da peça:</strong> {item.manufacturer}
                      </p>
                      <p>
                        <strong>Carros:</strong> {item.vehicles.join(', ')}
                      </p>
                      <p>
                        <strong>Marca do carro:</strong> {item.vehicleBrand}
                      </p>
                      <p>
                        <strong>Anos:</strong> {item.yearStart}–{item.yearEnd}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!loading && !error && visible.length === 0 && (
            <p className="rounded-xl border p-8 text-center text-muted-foreground">
              Nenhuma peça encontrada nos registros carregados.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {items.length} peça(s) carregada(s). Pesquisa e filtros atuam nos registros
              carregados.
            </span>
            {hasMore && (
              <Button variant="outline" disabled={loading} onClick={() => void loadMore()}>
                {loading ? 'Carregando...' : 'Carregar mais peças'}
              </Button>
            )}
          </div>
          {createOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
              role="dialog"
              aria-modal="true"
              aria-label="Adicionar peça"
            >
              <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-auto rounded-2xl bg-background p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Adicionar peça — {brand}</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCreateOpen(false)}
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Nome da peça *
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    Tipo de peça *
                    <Input
                      placeholder="Ex.: Motor, suspensão"
                      value={form.partType}
                      onChange={(e) => setForm((f) => ({ ...f, partType: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Descrição
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-md border bg-background p-2"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    Marca / fabricante da peça *
                    <Input
                      value={form.manufacturer}
                      onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    Marca do carro
                    <Input value={brand} disabled />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Carros / modelos compatíveis * (separe por vírgula ou linha)
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-md border bg-background p-2"
                      value={form.vehicles}
                      onChange={(e) => setForm((f) => ({ ...f, vehicles: e.target.value }))}
                      placeholder="Lancer, ASX, Outlander"
                    />
                  </label>
                  <label className="text-sm">
                    Ano inicial *
                    <Input
                      type="number"
                      value={form.yearStart}
                      onChange={(e) => setForm((f) => ({ ...f, yearStart: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    Ano final *
                    <Input
                      type="number"
                      value={form.yearEnd}
                      onChange={(e) => setForm((f) => ({ ...f, yearEnd: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Fotos * (até 6, JPG/PNG/WebP, 8 MB cada)
                    <Input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                    <span className="text-xs text-muted-foreground">
                      {files.length} arquivo(s) selecionado(s)
                    </span>
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={saving} onClick={() => void save()}>
                    {saving ? 'Salvando...' : 'Salvar peça'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
