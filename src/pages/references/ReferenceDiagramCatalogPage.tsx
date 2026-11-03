import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft,
  CircleDot,
  Filter,
  ImagePlus,
  Loader2,
  Move,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_REFERENCE_ADMIN_SETTINGS,
  REFERENCE_BRANDS,
  REFERENCE_SYSTEMS,
  asDiagram,
  positionFromPoint,
  type AlternativePart,
  type ReferenceAdminSettings,
  type ReferenceBrand,
  type ReferenceDiagram,
  type ReferenceMarker,
  type ReferencePartBrandConfig,
  type ReferenceSystem,
} from '@/lib/referenceDiagrams';

type NewDiagram = { title: string; vehicle: string; yearRange: string; system: ReferenceSystem };
type ReferenceFilters = {
  vehicle: string;
  year: string;
  partType: string;
  partBrand: string;
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const SETTINGS_DOC_ID = 'catalog';
const DEFAULT_FILTERS: ReferenceFilters = { vehicle: '', year: '', partType: '', partBrand: '' };

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
  manufacturers: [],
  manufacturerHex: '#1d4ed8',
  model: '',
  compatibleModels: [],
  code: '',
  yearRange: '',
  notes: '',
  photoUrl: '',
  useTypes: [],
});

const sanitizeList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function parseAdminSettings(value: unknown): ReferenceAdminSettings {
  if (!value || typeof value !== 'object') return DEFAULT_REFERENCE_ADMIN_SETTINGS;
  const parsed = value as Partial<ReferenceAdminSettings>;
  return {
    vehicleModels: Array.isArray(parsed.vehicleModels)
      ? parsed.vehicleModels.filter((v): v is string => typeof v === 'string')
      : DEFAULT_REFERENCE_ADMIN_SETTINGS.vehicleModels,
    years: Array.isArray(parsed.years)
      ? parsed.years.filter((v): v is string => typeof v === 'string')
      : DEFAULT_REFERENCE_ADMIN_SETTINGS.years,
    pieceTypes: Array.isArray(parsed.pieceTypes)
      ? parsed.pieceTypes.filter((v): v is string => typeof v === 'string')
      : DEFAULT_REFERENCE_ADMIN_SETTINGS.pieceTypes,
    partBrands: Array.isArray(parsed.partBrands)
      ? parsed.partBrands.filter((brand): brand is ReferencePartBrandConfig =>
          Boolean(brand && typeof brand.name === 'string' && typeof brand.hex === 'string')
        )
      : DEFAULT_REFERENCE_ADMIN_SETTINGS.partBrands,
  };
}

function settingsAreValid(settings: ReferenceAdminSettings): boolean {
  const isList = (v: string[], max: number) =>
    v.length <= max &&
    v.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 120);
  return (
    isList(settings.vehicleModels, 150) &&
    isList(settings.years, 150) &&
    isList(settings.pieceTypes, 150) &&
    settings.partBrands.length <= 100 &&
    settings.partBrands.every(
      (brand) =>
        brand.name.trim().length > 0 &&
        brand.name.length <= 120 &&
        /^#[0-9a-fA-F]{6}$/.test(brand.hex) &&
        isList(brand.uses, 30)
    )
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function matchesSearch(diagram: ReferenceDiagram, queryText: string) {
  const query = queryText.trim().toLowerCase();
  if (!query) return true;
  const stack = [
    diagram.brand,
    diagram.system,
    diagram.title,
    diagram.vehicle,
    diagram.yearRange,
    ...diagram.markers.flatMap((marker) => [
      marker.label,
      ...marker.parts.flatMap((part) => [
        part.name,
        part.manufacturer,
        ...(part.manufacturers ?? []),
        part.model,
        part.code,
        part.notes,
        ...(part.useTypes ?? []),
        ...(part.compatibleModels ?? []),
      ]),
    ]),
  ]
    .join(' ')
    .toLowerCase();
  return stack.includes(query);
}

function markerMatchesFilters(marker: ReferenceMarker, filters: ReferenceFilters) {
  return marker.parts.some((part) => {
    const matchesBrand =
      !filters.partBrand || (part.manufacturers ?? [part.manufacturer]).includes(filters.partBrand);
    const matchesType =
      !filters.partType ||
      (part.useTypes ?? []).includes(filters.partType) ||
      part.name.toLowerCase().includes(filters.partType.toLowerCase());
    const matchesVehicle =
      !filters.vehicle ||
      part.model === filters.vehicle ||
      (part.compatibleModels ?? []).includes(filters.vehicle) ||
      part.model.toLowerCase().includes(filters.vehicle.toLowerCase());
    const matchesYear = !filters.year || `${part.yearRange ?? ''}`.includes(filters.year);
    return matchesBrand && matchesType && matchesVehicle && matchesYear;
  });
}

function diagramMatchesFilters(diagram: ReferenceDiagram, filters: ReferenceFilters) {
  const vehicleMatches =
    !filters.vehicle || diagram.vehicle.toLowerCase().includes(filters.vehicle.toLowerCase());
  const yearMatches = !filters.year || diagram.yearRange.includes(filters.year);
  const markerMatches =
    !filters.partBrand && !filters.partType && !filters.vehicle && !filters.year
      ? true
      : diagram.markers.some((marker) => markerMatchesFilters(marker, filters));
  return vehicleMatches && yearMatches && markerMatches;
}

function BrandCard({
  brand,
  count,
  onClick,
}: {
  brand: ReferenceBrand;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 text-center shadow-sm transition hover:border-primary hover:shadow-md"
    >
      <img
        src={`/${brand.toLowerCase()}.svg`}
        alt={`Logo ${brand}`}
        className="h-14 w-28 object-contain"
      />
      <div>
        <p className="font-semibold">{brand}</p>
        <p className="text-xs text-muted-foreground">{count} sistema(s)</p>
      </div>
    </button>
  );
}

function ReferenceSearchBar({
  searchText,
  onSearchTextChange,
  filters,
  onFiltersChange,
  filtersOpen,
  setFiltersOpen,
  admin,
  onOpenAdmin,
  vehicleOptions,
  yearOptions,
  partTypeOptions,
  partBrandOptions,
}: {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  filters: ReferenceFilters;
  onFiltersChange: (value: ReferenceFilters) => void;
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
  admin: boolean;
  onOpenAdmin: () => void;
  vehicleOptions: string[];
  yearOptions: string[];
  partTypeOptions: string[];
  partBrandOptions: string[];
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Busca global: marca, sistema, veículo, peça, código ou observação"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          {admin && (
            <Button variant="outline" onClick={onOpenAdmin}>
              <Settings2 className="mr-2 h-4 w-4" />
              Painel administrativo
            </Button>
          )}
        </div>
      </div>
      {filtersOpen && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-muted-foreground">
            Veículo / modelo
            <select
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={filters.vehicle}
              onChange={(event) => onFiltersChange({ ...filters, vehicle: event.target.value })}
            >
              <option value="">Todos</option>
              {vehicleOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Ano / faixa
            <select
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={filters.year}
              onChange={(event) => onFiltersChange({ ...filters, year: event.target.value })}
            >
              <option value="">Todos</option>
              {yearOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Tipo de peça
            <select
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={filters.partType}
              onChange={(event) => onFiltersChange({ ...filters, partType: event.target.value })}
            >
              <option value="">Todos</option>
              {partTypeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Marca da peça
            <select
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={filters.partBrand}
              onChange={(event) => onFiltersChange({ ...filters, partBrand: event.target.value })}
            >
              <option value="">Todas</option>
              {partBrandOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex justify-end">
            <Button variant="ghost" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
              Limpar filtros
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CompactPartCard({ part }: { part: AlternativePart }) {
  return (
    <div className="rounded-xl border bg-card/70 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {part.photoUrl ? (
            <img src={part.photoUrl} alt={part.name} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <p className="truncate text-sm font-semibold">{part.name || 'Peça sem nome'}</p>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-3 w-3 rounded-full border"
              style={{ backgroundColor: part.manufacturerHex || '#111827' }}
            />
            <span className="truncate">
              <strong>Marca:</strong>{' '}
              {(part.manufacturers?.length ? part.manufacturers : [part.manufacturer])
                .filter(Boolean)
                .join(', ') || '—'}
            </span>
          </div>
          <p>
            <strong>Ref.:</strong> {part.code || '—'}
          </p>
          <p>
            <strong>Modelos:</strong>{' '}
            {(part.compatibleModels?.length ? part.compatibleModels : [part.model])
              .filter(Boolean)
              .join(', ') || '—'}
          </p>
          <p>
            <strong>Anos:</strong> {part.yearRange || '—'}
          </p>
          {!!part.useTypes?.length && (
            <p>
              <strong>Usos:</strong> {part.useTypes.join(', ')}
            </p>
          )}
          <p className="text-muted-foreground">
            <strong>Obs.:</strong> {part.notes || 'Sem observações.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function MarkerInfoPanel({
  marker,
  markerIndex,
  editor,
  adminSettings,
  onClose,
  onDelete,
  onChangeLabel,
  onChangeStyle,
  onAddPart,
  onChangePart,
  onRemovePart,
  onUploadPartPhoto,
}: {
  marker: ReferenceMarker;
  markerIndex: number;
  editor: boolean;
  adminSettings: ReferenceAdminSettings;
  onClose: () => void;
  onDelete: () => void;
  onChangeLabel: (value: string) => void;
  onChangeStyle: (patch: Partial<ReferenceMarker>) => void;
  onAddPart: () => void;
  onChangePart: (partId: string, patch: Partial<AlternativePart>) => void;
  onRemovePart: (partId: string) => void;
  onUploadPartPhoto: (partId: string, file: File) => void;
}) {
  return (
    <div className="w-full rounded-xl bg-background p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Ponto {markerIndex + 1}
          </p>
          {editor ? (
            <Input
              value={marker.label}
              onChange={(event) => onChangeLabel(event.target.value)}
              className="mt-1 h-9"
            />
          ) : (
            <p className="text-sm font-semibold">{marker.label}</p>
          )}
        </div>
        <div className="flex gap-1">
          {editor && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Excluir ponto">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar painel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editor && (
        <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border p-3 text-xs">
          <label className="font-semibold">
            Cor do traço
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                className="h-9 w-11 cursor-pointer"
                value={marker.strokeColor || '#f59e0b'}
                onChange={(event) => onChangeStyle({ strokeColor: event.target.value })}
              />
              <Input
                className="h-9 min-w-0"
                maxLength={7}
                value={marker.strokeColor || '#f59e0b'}
                onChange={(event) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(event.target.value))
                    onChangeStyle({ strokeColor: event.target.value });
                }}
              />
            </div>
          </label>
          <label className="font-semibold">
            Espessura: {marker.strokeWidth || 3}px
            <input
              className="mt-4 w-full"
              type="range"
              min={1}
              max={10}
              step={1}
              value={marker.strokeWidth || 3}
              onChange={(event) => onChangeStyle({ strokeWidth: Number(event.target.value) })}
            />
          </label>
        </div>
      )}
      <div className="space-y-3">
        {marker.parts.length === 0 && (
          <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            Nenhuma peça vinculada ainda.
          </div>
        )}
        {marker.parts.map((part) =>
          editor ? (
            <div key={part.id} className="space-y-2 rounded-xl border p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Nome da peça
                  <Input
                    className="mt-1 h-8"
                    value={part.name}
                    onChange={(event) => onChangePart(part.id, { name: event.target.value })}
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Número de referência
                  <Input
                    className="mt-1 h-8"
                    value={part.code}
                    onChange={(event) => onChangePart(part.id, { code: event.target.value })}
                  />
                </label>
                <fieldset className="space-y-1 rounded-lg border p-2 text-xs md:col-span-2">
                  <legend className="px-1 font-semibold">Marcas da peça (múltipla escolha)</legend>
                  <div className="grid max-h-28 grid-cols-2 gap-1 overflow-y-auto">
                    {adminSettings.partBrands.map((brand) => {
                      const picked = (
                        part.manufacturers?.length ? part.manufacturers : [part.manufacturer]
                      ).includes(brand.name);
                      return (
                        <label
                          key={brand.id}
                          className="flex items-center gap-2 rounded-md p-1 hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={picked}
                            onChange={(event) => {
                              const previous = part.manufacturers?.length
                                ? part.manufacturers
                                : [part.manufacturer].filter(Boolean);
                              const next = event.target.checked
                                ? Array.from(new Set([...previous, brand.name]))
                                : previous.filter((name) => name !== brand.name);
                              onChangePart(part.id, {
                                manufacturer: next[0] || '',
                                manufacturers: next,
                              });
                            }}
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: brand.hex }}
                          />
                          {brand.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="space-y-2 rounded-lg border p-2 text-xs md:col-span-2">
                  <legend className="px-1 font-semibold">Modelos atendidos (selecione)</legend>
                  <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                    {Array.from(
                      new Set(
                        [
                          ...adminSettings.vehicleModels,
                          ...(part.compatibleModels ?? []),
                          part.model,
                        ].filter(Boolean)
                      )
                    ).map((model) => {
                      const selectedModels = part.compatibleModels?.length
                        ? part.compatibleModels
                        : [part.model].filter(Boolean);
                      return (
                        <label key={model} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedModels.includes(model)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? Array.from(new Set([...selectedModels, model]))
                                : selectedModels.filter((item) => item !== model);
                              onChangePart(part.id, {
                                compatibleModels: next,
                                model: next[0] || '',
                              });
                            }}
                          />
                          {model}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Anos compatíveis
                  <Input
                    className="mt-1 h-8"
                    value={part.yearRange || ''}
                    onChange={(event) => onChangePart(part.id, { yearRange: event.target.value })}
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  URL da foto
                  <Input
                    className="mt-1 h-8"
                    value={part.photoUrl || ''}
                    onChange={(event) => onChangePart(part.id, { photoUrl: event.target.value })}
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground md:col-span-2">
                  Enviar foto da peça (JPG, PNG, WebP; até 8 MB)
                  <Input
                    className="mt-1 h-8"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0];
                      if (selectedFile) onUploadPartPhoto(part.id, selectedFile);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <fieldset className="space-y-2 rounded-lg border p-2 text-xs md:col-span-2">
                  <legend className="px-1 font-semibold">Usos da peça (múltipla escolha)</legend>
                  <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                    {Array.from(
                      new Set([...adminSettings.pieceTypes, ...(part.useTypes ?? [])])
                    ).map((useType) => (
                      <label key={useType} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(part.useTypes ?? []).includes(useType)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? Array.from(new Set([...(part.useTypes ?? []), useType]))
                              : (part.useTypes ?? []).filter((item) => item !== useType);
                            onChangePart(part.id, { useTypes: next });
                          }}
                        />
                        {useType}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-[11px] font-medium text-muted-foreground md:col-span-2">
                  Observações
                  <Input
                    className="mt-1 h-8"
                    value={part.notes}
                    onChange={(event) => onChangePart(part.id, { notes: event.target.value })}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => onRemovePart(part.id)}>
                  <Trash2 className="mr-2 h-3 w-3" />
                  Excluir peça
                </Button>
              </div>
            </div>
          ) : (
            <CompactPartCard key={part.id} part={part} />
          )
        )}
        {editor && marker.parts.length < 20 && (
          <Button variant="outline" size="sm" className="w-full" onClick={onAddPart}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar peça
          </Button>
        )}
        <label className="block text-xs font-semibold">
          Observação geral do ponto
          {editor ? (
            <textarea
              className="mt-1 min-h-20 w-full resize-y rounded-lg border bg-background p-2 font-normal"
              maxLength={1000}
              value={marker.notes || ''}
              onChange={(event) => onChangeStyle({ notes: event.target.value })}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-2 font-normal text-muted-foreground">
              {marker.notes || 'Sem observações.'}
            </p>
          )}
        </label>
      </div>
    </div>
  );
}

function ImageCanvas({
  url,
  title,
  markers,
  selectedId,
  canEdit,
  editor,
  placing,
  onSelect,
  onPlace,
  onMoveMarker,
  onMoveLabel,
  renderSelectedPanel,
}: {
  url: string;
  title: string;
  markers: ReferenceMarker[];
  selectedId: string | null;
  canEdit: boolean;
  editor: boolean;
  placing: boolean;
  onSelect: (id: string) => void;
  onPlace: (x: number, y: number, labelX: number, labelY: number) => void;
  onMoveMarker: (id: string, x: number, y: number) => void;
  onMoveLabel: (id: string, labelX: number, labelY: number) => void;
  renderSelectedPanel: (marker: ReferenceMarker, index: number) => JSX.Element | null;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [draggingLabelId, setDraggingLabelId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<{ x: number; y: number } | null>(null);
  const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const placementStart = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(
    null
  );
  const [panning, setPanning] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const draggingPanel = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null
  );
  const startRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [url]);

  useEffect(() => {
    if (!placing) {
      setPendingAnchor(null);
      setPreviewEnd(null);
      placementStart.current = null;
    }
  }, [placing]);

  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewportSize({ width: rect.width, height: rect.height });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullScreen(false);
    };
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [fullScreen]);

  // Native, non-passive listener prevents the page from scrolling while zooming the diagram.
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setScale((value) => clamp(value + (event.deltaY < 0 ? 0.12 : -0.12), 1, 6));
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [fullScreen, selectedId]);

  const fittedWidth = Math.min(
    viewportSize.width,
    viewportSize.height * (imageSize.width / imageSize.height)
  );
  const fittedHeight = fittedWidth * (imageSize.height / imageSize.width);
  const selectedMarker = markers.find((marker) => marker.id === selectedId) ?? null;
  const selectedIndex = selectedMarker
    ? markers.findIndex((marker) => marker.id === selectedMarker.id)
    : -1;

  const pointFromClient = (clientX: number, clientY: number) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    return positionFromPoint(clientX, clientY, rect);
  };

  const handlePointerDownCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    if (placing && canEdit && editor) {
      if (event.button !== 0) return;
      const point = pointFromClient(event.clientX, event.clientY);
      if (!point) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pendingAnchor) {
        onPlace(pendingAnchor.x, pendingAnchor.y, point.x, point.y);
        setPendingAnchor(null);
        setPreviewEnd(null);
        placementStart.current = null;
      } else {
        placementStart.current = { ...point, clientX: event.clientX, clientY: event.clientY };
        setPreviewEnd(point);
      }
      return;
    }
    if (event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMoveCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId || draggingLabelId) {
      const point = pointFromClient(event.clientX, event.clientY);
      if (!point) return;
      if (draggingMarkerId) onMoveMarker(draggingMarkerId, point.x, point.y);
      if (draggingLabelId) onMoveLabel(draggingLabelId, point.x, point.y);
      return;
    }
    if (placing && canEdit && editor && (placementStart.current || pendingAnchor)) {
      const point = pointFromClient(event.clientX, event.clientY);
      if (point) setPreviewEnd(point);
      return;
    }
    if (!panning) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    setPan({ x: startRef.current.panX + dx, y: startRef.current.panY + dy });
  };

  const handlePointerUpCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    if (placing && canEdit && editor && placementStart.current) {
      const point = pointFromClient(event.clientX, event.clientY);
      const start = placementStart.current;
      const moved = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
      if (moved > 8 && point) {
        onPlace(start.x, start.y, point.x, point.y);
        setPendingAnchor(null);
        setPreviewEnd(null);
      } else {
        setPendingAnchor({ x: start.x, y: start.y });
        setPreviewEnd(point ?? { x: start.x, y: start.y });
      }
      placementStart.current = null;
    }
    setDraggingMarkerId(null);
    setDraggingLabelId(null);
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={
        fullScreen
          ? 'fixed inset-0 z-[80] flex flex-col gap-3 overflow-hidden bg-white p-3 dark:bg-background'
          : 'space-y-3'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Move className="h-4 w-4" /> Arraste para navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <ZoomIn className="h-4 w-4" /> Scroll para zoom
          </span>
          {editor && (
            <span className="inline-flex items-center gap-1">
              <CircleDot className="h-4 w-4" /> Arraste o círculo ou a numeração para reposicionar
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale((value) => clamp(value - 0.15, 1, 4))}
          >
            <ZoomOut className="mr-2 h-4 w-4" /> Menos zoom
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale((value) => clamp(value + 0.15, 1, 4))}
          >
            <ZoomIn className="mr-2 h-4 w-4" /> Mais zoom
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Resetar vista
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFullScreen((value) => !value)}>
            {fullScreen ? (
              <Minimize2 className="mr-2 h-4 w-4" />
            ) : (
              <Maximize2 className="mr-2 h-4 w-4" />
            )}
            {fullScreen ? 'Sair da tela grande' : 'Tela grande'}
          </Button>
        </div>
      </div>
      <div
        className={`flex min-h-0 min-w-0 flex-col gap-3 lg:flex-row lg:items-start ${fullScreen ? 'flex-1' : ''}`}
      >
        {selectedMarker && selectedIndex >= 0 && (
          <aside
            aria-label="Detalhes do ponto selecionado"
            className="order-first w-full shrink-0 self-start lg:w-[395px]"
          >
            <div
              className="max-h-[80vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-lg dark:bg-background"
              style={{ transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)` }}
            >
              <div
                className="mb-2 flex touch-none cursor-grab items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  draggingPanel.current = {
                    x: event.clientX,
                    y: event.clientY,
                    offsetX: panelOffset.x,
                    offsetY: panelOffset.y,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = draggingPanel.current;
                  if (drag)
                    setPanelOffset({
                      x: drag.offsetX + event.clientX - drag.x,
                      y: drag.offsetY + event.clientY - drag.y,
                    });
                }}
                onPointerUp={() => {
                  draggingPanel.current = null;
                }}
                onPointerCancel={() => {
                  draggingPanel.current = null;
                }}
              >
                <GripVertical className="h-4 w-4" /> Arrastar painel
                <button
                  type="button"
                  className="ml-auto underline"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPanelOffset({ x: 0, y: 0 })}
                >
                  Recentrar
                </button>
              </div>
              {renderSelectedPanel(selectedMarker, selectedIndex)}
            </div>
          </aside>
        )}
        <div
          ref={frameRef}
          className={`relative min-w-0 flex-1 overflow-hidden rounded-[28px] border bg-white shadow-inner ${fullScreen ? 'h-full min-h-0' : 'h-[82vh] min-h-[650px]'}`}
        >
          <div
            ref={canvasRef}
            className={`absolute inset-0 touch-none ${placing ? 'cursor-crosshair' : panning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onDoubleClick={() => setFullScreen((value) => !value)}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="absolute origin-center"
              style={{
                width: fittedWidth,
                height: fittedHeight,
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                transition:
                  draggingMarkerId || draggingLabelId || panning
                    ? 'none'
                    : 'transform 120ms ease-out',
              }}
            >
              <div ref={imageRef} className="relative h-full w-full">
                <img
                  src={url}
                  onLoad={(event) =>
                    setImageSize({
                      width: event.currentTarget.naturalWidth || 1,
                      height: event.currentTarget.naturalHeight || 1,
                    })
                  }
                  alt={`Vista técnica: ${title}`}
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                />

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {markers.map((marker) => {
                    const labelX = marker.labelX ?? clamp(marker.x + 9, 0, 100);
                    const labelY = marker.labelY ?? marker.y;
                    return (
                      <line
                        key={marker.id}
                        x1={marker.x}
                        y1={marker.y}
                        x2={
                          labelX -
                          Math.sign(labelX - marker.x) *
                            Math.min(1.6, (16 / Math.max(1, fittedWidth)) * 100)
                        }
                        y2={labelY}
                        stroke={marker.strokeColor || '#f59e0b'}
                        strokeWidth={marker.strokeWidth || 3}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {(placementStart.current || pendingAnchor) && previewEnd && (
                    <line
                      x1={(placementStart.current ?? pendingAnchor)!.x}
                      y1={(placementStart.current ?? pendingAnchor)!.y}
                      x2={previewEnd.x}
                      y2={previewEnd.y}
                      stroke="#2563eb"
                      strokeWidth="1.6"
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
                {markers.map((marker, index) => {
                  const selected = marker.id === selectedId;
                  const labelX = marker.labelX ?? clamp(marker.x + 9, 0, 100);
                  const labelY = marker.labelY ?? marker.y;
                  return (
                    <div key={marker.id}>
                      <button
                        type="button"
                        style={{
                          left: `${marker.x}%`,
                          top: `${marker.y}%`,
                          borderColor: marker.strokeColor || '#f59e0b',
                          borderWidth: marker.strokeWidth || 3,
                        }}
                        className={`absolute z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-solid bg-transparent p-0 shadow-none outline-offset-4 focus-visible:outline sm:h-11 sm:w-11 ${selected ? 'ring-2 ring-offset-2' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(marker.id);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (!canEdit || !editor || placing) return;
                          setDraggingMarkerId(marker.id);
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (draggingMarkerId !== marker.id) return;
                          const point = pointFromClient(event.clientX, event.clientY);
                          if (point) onMoveMarker(marker.id, point.x, point.y);
                        }}
                        onPointerUp={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId))
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          setDraggingMarkerId(null);
                        }}
                        title={`Ponto ${index + 1}: ${marker.label}`}
                        aria-label={`Selecionar ponto ${index + 1}: ${marker.label}`}
                      />
                      <button
                        type="button"
                        style={{
                          left: `${labelX}%`,
                          top: `${labelY}%`,
                          color: marker.strokeColor || '#f59e0b',
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute z-20 flex h-8 min-w-8 items-center justify-center rounded-sm bg-transparent px-1 text-base font-bold leading-none shadow-none outline-offset-2 hover:underline focus-visible:outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(marker.id);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (!canEdit || !editor || placing) return;
                          setDraggingLabelId(marker.id);
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (draggingLabelId !== marker.id) return;
                          const point = pointFromClient(event.clientX, event.clientY);
                          if (point) onMoveLabel(marker.id, point.x, point.y);
                        }}
                        onPointerUp={(event) => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId))
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          setDraggingLabelId(null);
                        }}
                        title={editor ? 'Arraste para mover o número' : marker.label}
                        aria-label={`Número ${index + 1} — ${marker.label}`}
                      >
                        {index + 1}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {canEdit && placing && editor && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-background/95 px-4 py-2 text-xs shadow">
              Clique e arraste na imagem: comece no círculo e solte onde deseja o número. Também é
              possível clicar duas vezes, uma em cada posição.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({
  open,
  onClose,
  brand,
  settings,
  setSettings,
  form,
  setForm,
  file,
  setFile,
  onCreateDiagram,
  saving,
  onSaveSettings,
  savingSettings,
}: {
  open: boolean;
  onClose: () => void;
  brand: ReferenceBrand | null;
  settings: ReferenceAdminSettings;
  setSettings: Dispatch<SetStateAction<ReferenceAdminSettings>>;
  form: NewDiagram;
  setForm: Dispatch<SetStateAction<NewDiagram>>;
  file: File | null;
  setFile: (file: File | null) => void;
  onCreateDiagram: () => void;
  saving: boolean;
  onSaveSettings: () => void;
  savingSettings: boolean;
}) {
  const [newVehicle, setNewVehicle] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newType, setNewType] = useState('');
  const [newBrand, setNewBrand] = useState({ name: '', hex: '#2563eb', uses: '' });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l bg-background p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Configurações gerais
            </p>
            <h2 className="text-xl font-semibold">Painel administrativo de Referências</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
            <span>As configurações são compartilhadas com toda a equipe após salvar.</span>
            <Button size="sm" onClick={onSaveSettings} disabled={savingSettings}>
              <Save className="mr-2 h-4 w-4" />{' '}
              {savingSettings ? 'Salvando...' : 'Salvar parâmetros'}
            </Button>
          </div>
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Cadastrar imagem técnica</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Todos os cadastros de sistemas, diagramas e futuras parametrizações passam por este
              painel.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Marca atual
                <Input
                  className="mt-1"
                  value={brand ?? ''}
                  disabled
                  placeholder="Selecione uma marca"
                />
              </label>
              <label className="text-sm">
                Sistema
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={form.system}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      system: event.target.value as ReferenceSystem,
                    }))
                  }
                >
                  {REFERENCE_SYSTEMS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                Nome do conjunto
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex.: Suspensão traseira"
                />
              </label>
              <label className="text-sm">
                Veículo / modelo
                <Input
                  className="mt-1"
                  value={form.vehicle}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, vehicle: event.target.value }))
                  }
                  placeholder="Ex.: Pajero TR4"
                />
              </label>
              <label className="text-sm">
                Anos compatíveis
                <Input
                  className="mt-1"
                  value={form.yearRange}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, yearRange: event.target.value }))
                  }
                  placeholder="Ex.: 2010-2015"
                />
              </label>
              <label className="text-sm md:col-span-2">
                Imagem do sistema
                <Input
                  className="mt-1"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="mt-1 text-xs text-muted-foreground">Arquivo atual: {file.name}</p>
                )}
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={onCreateDiagram} disabled={saving || !brand}>
                {saving ? 'Cadastrando...' : 'Cadastrar sistema'}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Parâmetros de filtro</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Modelos
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newVehicle}
                    onChange={(event) => setNewVehicle(event.target.value)}
                    placeholder="Novo modelo"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!newVehicle.trim()) return;
                      setSettings((current) => ({
                        ...current,
                        vehicleModels: [...current.vehicleModels, newVehicle.trim()],
                      }));
                      setNewVehicle('');
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {settings.vehicleModels.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            vehicleModels: current.vehicleModels.filter((value) => value !== item),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Anos / faixas
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newYear}
                    onChange={(event) => setNewYear(event.target.value)}
                    placeholder="2016-2020"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!newYear.trim()) return;
                      setSettings((current) => ({
                        ...current,
                        years: [...current.years, newYear.trim()],
                      }));
                      setNewYear('');
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {settings.years.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            years: current.years.filter((value) => value !== item),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tipos de peça
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newType}
                    onChange={(event) => setNewType(event.target.value)}
                    placeholder="Bucha"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!newType.trim()) return;
                      setSettings((current) => ({
                        ...current,
                        pieceTypes: [...current.pieceTypes, newType.trim()],
                      }));
                      setNewType('');
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {settings.pieceTypes.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            pieceTypes: current.pieceTypes.filter((value) => value !== item),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Marcas de peças, cores HEX e usos</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                Marca da peça
                <Input
                  className="mt-1"
                  value={newBrand.name}
                  onChange={(event) =>
                    setNewBrand((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex.: Sampel"
                />
              </label>
              <label className="text-sm">
                Cor HEX
                <Input
                  className="mt-1"
                  value={newBrand.hex}
                  onChange={(event) =>
                    setNewBrand((current) => ({ ...current, hex: event.target.value }))
                  }
                  placeholder="#ff6600"
                />
              </label>
              <label className="text-sm">
                Usos (vírgula)
                <Input
                  className="mt-1"
                  value={newBrand.uses}
                  onChange={(event) =>
                    setNewBrand((current) => ({ ...current, uses: event.target.value }))
                  }
                  placeholder="Bucha, Coxim"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (!newBrand.name.trim()) return;
                  setSettings((current) => ({
                    ...current,
                    partBrands: [
                      ...current.partBrands,
                      {
                        id: crypto.randomUUID(),
                        name: newBrand.name.trim(),
                        hex: newBrand.hex.trim() || '#2563eb',
                        uses: sanitizeList(newBrand.uses),
                      },
                    ],
                  }));
                  setNewBrand({ name: '', hex: '#2563eb', uses: '' });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar marca
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {settings.partBrands.map((brandConfig) => (
                <div key={brandConfig.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-4 w-4 rounded-full border"
                        style={{ backgroundColor: brandConfig.hex }}
                      />
                      <div>
                        <p className="font-medium">{brandConfig.name}</p>
                        <p className="text-xs text-muted-foreground">
                          HEX: {brandConfig.hex} · Usos: {brandConfig.uses.join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          partBrands: current.partBrands.filter(
                            (item) => item.id !== brandConfig.id
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ReferenceDiagramCatalogPage() {
  const { currentUser } = useApp();
  const admin = currentUser?.role === 'admin' && currentUser?.active !== false;
  const allowed = Boolean(
    currentUser?.active !== false && (admin || currentUser?.sectors?.includes('vendas'))
  );

  const [allDiagrams, setAllDiagrams] = useState<ReferenceDiagram[]>([]);
  const [brand, setBrand] = useState<ReferenceBrand | null>(null);
  const [system, setSystem] = useState<ReferenceSystem | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<ReferenceFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editor, setEditor] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [markerId, setMarkerId] = useState<string | null>(null);
  const [draftMarkers, setDraftMarkers] = useState<ReferenceMarker[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<NewDiagram>(emptyDiagram);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<ReferenceAdminSettings>(
    DEFAULT_REFERENCE_ADMIN_SETTINGS
  );
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    return onSnapshot(
      doc(db, 'reference_settings', SETTINGS_DOC_ID),
      (snapshot) => {
        if (snapshot.exists()) setSettings(parseAdminSettings(snapshot.data()));
      },
      (error) => {
        console.error(error);
        toast.error('Não foi possível carregar os parâmetros de Referências.');
      }
    );
  }, [allowed]);

  const saveAdminSettings = async () => {
    if (!admin || settingsSaving) return;
    if (!settingsAreValid(settings)) {
      toast.error('Revise os parâmetros: use cores HEX #RRGGBB e evite listas excessivas.');
      return;
    }
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'reference_settings', SETTINGS_DOC_ID), settings);
      toast.success('Parâmetros publicados para toda a equipe.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível publicar os parâmetros.');
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!allowed) {
      setAllDiagrams([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'reference_diagrams'));
    return onSnapshot(
      q,
      (snapshot) => {
        setAllDiagrams(
          snapshot.docs
            .map((item) => asDiagram(item.id, item.data()))
            .filter((item): item is ReferenceDiagram => item !== null)
        );
        setLoading(false);
      },
      (error) => {
        console.error(error);
        toast.error('Não foi possível carregar o catálogo de referências.');
        setLoading(false);
      }
    );
  }, [allowed]);

  useEffect(() => {
    const paths = allDiagrams
      .map((diagram) => diagram.imagePath)
      .filter((path) => path.startsWith('reference_diagrams/') && !imageUrls[path]);
    if (!allowed || paths.length === 0) return;
    let cancelled = false;
    void Promise.all(
      paths.map(async (path) => {
        try {
          const url = await getDownloadURL(storageRef(storage, path));
          if (!cancelled) setImageUrls((current) => ({ ...current, [path]: url }));
        } catch (error) {
          console.warn('Imagem de referência indisponível', path, error);
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [allDiagrams, allowed, imageUrls]);

  const filteredDiagrams = useMemo(
    () =>
      allDiagrams.filter(
        (diagram) => matchesSearch(diagram, searchText) && diagramMatchesFilters(diagram, filters)
      ),
    [allDiagrams, searchText, filters]
  );

  const brandCounts = useMemo(
    () =>
      REFERENCE_BRANDS.map((item) => ({
        brand: item,
        count: filteredDiagrams.filter((diagram) => diagram.brand === item).length,
      })),
    [filteredDiagrams]
  );

  const systemsForBrand = useMemo(
    () =>
      REFERENCE_SYSTEMS.map((item) => ({
        system: item,
        count: filteredDiagrams.filter(
          (diagram) => diagram.brand === brand && diagram.system === item
        ).length,
      })),
    [filteredDiagrams, brand]
  );

  const visibleDiagrams = useMemo(
    () =>
      filteredDiagrams.filter(
        (diagram) => (!brand || diagram.brand === brand) && (!system || diagram.system === system)
      ),
    [filteredDiagrams, brand, system]
  );

  const diagram = useMemo(
    () =>
      visibleDiagrams.find((item) => item.id === diagramId) ??
      allDiagrams.find((item) => item.id === diagramId) ??
      null,
    [visibleDiagrams, allDiagrams, diagramId]
  );

  const markersSource = editor ? draftMarkers : (diagram?.markers ?? []);
  const markers = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const filtered = markersSource.filter((marker) => {
      const matchesMarkerSearch =
        !query ||
        Boolean(
          diagram &&
          [diagram.title, diagram.brand, diagram.system, diagram.vehicle, diagram.yearRange]
            .join(' ')
            .toLowerCase()
            .includes(query)
        ) ||
        [
          marker.label,
          ...marker.parts.flatMap((part) => [
            part.name,
            part.manufacturer,
            part.model,
            part.code,
            part.notes,
            ...(part.useTypes ?? []),
            ...(part.compatibleModels ?? []),
          ]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      if (!matchesMarkerSearch) return false;
      if (!filters.partBrand && !filters.partType && !filters.vehicle && !filters.year) return true;
      return markerMatchesFilters(marker, filters);
    });
    return filtered;
  }, [markersSource, searchText, filters, diagram]);

  useEffect(() => {
    if (markerId && !markers.some((marker) => marker.id === markerId)) {
      setMarkerId(markers[0]?.id ?? null);
    }
  }, [markerId, markers]);

  const selectedMarker = markers.find((item) => item.id === markerId) ?? null;

  const vehicleOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.vehicleModels,
          ...allDiagrams.map((item) => item.vehicle),
          ...allDiagrams.flatMap((item) =>
            item.markers.flatMap((marker) =>
              marker.parts.flatMap((part) =>
                part.compatibleModels?.length ? part.compatibleModels : [part.model]
              )
            )
          ),
        ])
      )
        .filter(Boolean)
        .sort(),
    [settings.vehicleModels, allDiagrams]
  );
  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.years,
          ...allDiagrams.map((item) => item.yearRange),
          ...allDiagrams.flatMap((item) =>
            item.markers.flatMap((marker) => marker.parts.map((part) => part.yearRange || ''))
          ),
        ])
      )
        .filter(Boolean)
        .sort(),
    [settings.years, allDiagrams]
  );
  const partTypeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.pieceTypes,
          ...allDiagrams.flatMap((item) =>
            item.markers.flatMap((marker) => marker.parts.flatMap((part) => part.useTypes ?? []))
          ),
        ])
      )
        .filter(Boolean)
        .sort(),
    [settings.pieceTypes, allDiagrams]
  );
  const partBrandOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.partBrands.map((item) => item.name),
          ...allDiagrams.flatMap((item) =>
            item.markers.flatMap((marker) => marker.parts.map((part) => part.manufacturer))
          ),
        ])
      )
        .filter(Boolean)
        .sort(),
    [settings.partBrands, allDiagrams]
  );

  const chooseDiagram = (id: string) => {
    setDiagramId(id);
    setMarkerId(null);
    setEditor(false);
    setPlacing(false);
    setDirty(false);
  };

  const goBack = () => {
    if (dirty && !window.confirm('Descartar alterações não salvas?')) return;
    if (diagramId) {
      setDiagramId(null);
      setMarkerId(null);
      setEditor(false);
      setPlacing(false);
      setDirty(false);
      return;
    }
    if (system) {
      setSystem(null);
      return;
    }
    if (brand) {
      setBrand(null);
    }
  };

  const startEditing = () => {
    if (!admin || !diagram) return;
    const clonedMarkers = JSON.parse(JSON.stringify(diagram.markers)) as ReferenceMarker[];
    setDraftMarkers(clonedMarkers);
    setMarkerId(clonedMarkers[0]?.id ?? null);
    setEditor(true);
    setDirty(false);
  };

  const updateMarker = (id: string, updater: (marker: ReferenceMarker) => ReferenceMarker) => {
    setDraftMarkers((current) =>
      current.map((marker) => (marker.id === id ? updater(marker) : marker))
    );
    setDirty(true);
  };

  const saveMarkers = async () => {
    if (!admin || !diagram || saving) return;
    const invalid = draftMarkers.some(
      (marker) =>
        !marker.label.trim() ||
        marker.parts.some(
          (part) =>
            !part.name.trim() ||
            !part.manufacturer.trim() ||
            !(part.compatibleModels?.length || part.model.trim())
        )
    );
    if (invalid || draftMarkers.length > 60) {
      toast.error(
        'Revise os pontos e preencha pelo menos nome da peça, marca e modelo compatível.'
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
    } catch (error) {
      console.error(error);
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
      setAdminOpen(false);
      setFile(null);
      setForm(emptyDiagram());
      setSystem(form.system);
      chooseDiagram(record.id);
      toast.success('Sistema cadastrado. Use o modo edição para adicionar círculos.');
    } catch (error) {
      console.error(error);
      toast.error('Falha no cadastro. Um upload incompleto pode exigir limpeza administrativa.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <div role="alert" className="rounded-xl border bg-card p-6">
        Acesso restrito ao setor de Vendas e administradores.
      </div>
    );
  }

  return (
    <main className="w-full min-w-0 space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              : 'Selecione a marca, o sistema e uma vista técnica para consultar, relacionar e cadastrar peças.'}
          </p>
        </div>
        {(brand || system || diagram) && (
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        )}
      </div>

      <ReferenceSearchBar
        searchText={searchText}
        onSearchTextChange={setSearchText}
        filters={filters}
        onFiltersChange={setFilters}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        admin={admin}
        onOpenAdmin={() => {
          if (!brand) {
            toast.message(
              'Selecione uma marca antes de abrir o painel administrativo para cadastrar imagens técnicas.'
            );
          }
          setAdminOpen(true);
        }}
        vehicleOptions={vehicleOptions}
        yearOptions={yearOptions}
        partTypeOptions={partTypeOptions}
        partBrandOptions={partBrandOptions}
      />

      {!brand && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {brandCounts.map(({ brand: currentBrand, count }) => (
            <BrandCard
              key={currentBrand}
              brand={currentBrand}
              count={count}
              onClick={() => {
                setBrand(currentBrand);
                setSystem(null);
                setDiagramId(null);
              }}
            />
          ))}
        </div>
      )}

      {brand && !system && !diagram && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {systemsForBrand.map(({ system: systemName, count }) => (
            <button
              key={systemName}
              onClick={() => {
                setSystem(systemName);
                setDiagramId(null);
              }}
              className="rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <ImagePlus className="h-6 w-6 text-primary" />
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  {count}
                </span>
              </div>
              <h2 className="font-semibold">{systemName}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Selecionar conjunto técnico</p>
            </button>
          ))}
        </div>
      )}

      {brand && system && !diagram && (
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Carregando sistemas...
            </div>
          ) : visibleDiagrams.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhuma imagem cadastrada nessa categoria.{' '}
              {admin && 'Use o painel administrativo para cadastrar um novo sistema.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDiagrams.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary hover:shadow-md"
                  onClick={() => chooseDiagram(item.id)}
                >
                  <div className="flex aspect-[16/10] items-center justify-center bg-muted">
                    {imageUrls[item.imagePath] ? (
                      <img
                        src={imageUrls[item.imagePath]}
                        alt={item.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {item.vehicle} · {item.yearRange || 'Ano não informado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.markers.length} ponto(s) cadastrado(s)
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <span>
                <strong className="text-foreground">Veículo:</strong> {diagram.vehicle}
              </span>
              <span>
                <strong className="text-foreground">Anos:</strong>{' '}
                {diagram.yearRange || 'Não informado'}
              </span>
              <span>
                <strong className="text-foreground">Pontos visíveis:</strong> {markers.length}
              </span>
            </div>
            {admin && (
              <div className="flex flex-wrap gap-2">
                {!editor ? (
                  <Button onClick={startEditing}>
                    <CircleDot className="mr-2 h-4 w-4" /> Editar círculos
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setPlacing((current) => !current)}>
                      <Plus className="mr-2 h-4 w-4" />{' '}
                      {placing ? 'Cancelar ponto' : 'Adicionar círculo'}
                    </Button>
                    <Button onClick={() => void saveMarkers()} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />{' '}
                      {saving ? 'Salvando...' : 'Salvar marcações'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          {imageUrls[diagram.imagePath] ? (
            <ImageCanvas
              url={imageUrls[diagram.imagePath]}
              title={diagram.title}
              markers={markers}
              selectedId={markerId}
              canEdit={admin}
              editor={editor}
              placing={placing}
              onSelect={setMarkerId}
              onPlace={(x, y, labelX, labelY) => {
                if (!admin || !editor) return;
                const id = crypto.randomUUID();
                setDraftMarkers((current) => [
                  ...current,
                  {
                    id,
                    x,
                    y,
                    labelX,
                    labelY,
                    label: `Ponto ${current.length + 1}`,
                    strokeColor: '#f59e0b',
                    strokeWidth: 3,
                    notes: '',
                    parts: [],
                  },
                ]);
                setMarkerId(id);
                setPlacing(false);
                setDirty(true);
              }}
              onMoveMarker={(id, x, y) => {
                if (!admin || !editor) return;
                updateMarker(id, (marker) => ({ ...marker, x, y }));
              }}
              onMoveLabel={(id, labelX, labelY) => {
                if (!admin || !editor) return;
                updateMarker(id, (marker) => ({ ...marker, labelX, labelY }));
              }}
              renderSelectedPanel={(marker, markerIndex) => (
                <MarkerInfoPanel
                  marker={marker}
                  markerIndex={markerIndex}
                  editor={editor}
                  adminSettings={settings}
                  onClose={() => setMarkerId(null)}
                  onDelete={() => {
                    setDraftMarkers((current) => current.filter((item) => item.id !== marker.id));
                    setMarkerId(null);
                    setDirty(true);
                  }}
                  onChangeLabel={(value) =>
                    updateMarker(marker.id, (current) => ({ ...current, label: value }))
                  }
                  onChangeStyle={(patch) =>
                    updateMarker(marker.id, (current) => ({ ...current, ...patch }))
                  }
                  onAddPart={() =>
                    updateMarker(marker.id, (current) => ({
                      ...current,
                      parts: [...current.parts, newPart()],
                    }))
                  }
                  onChangePart={(partId, patch) =>
                    updateMarker(marker.id, (current) => ({
                      ...current,
                      parts: current.parts.map((part) =>
                        part.id === partId ? { ...part, ...patch } : part
                      ),
                    }))
                  }
                  onRemovePart={(partId) =>
                    updateMarker(marker.id, (current) => ({
                      ...current,
                      parts: current.parts.filter((part) => part.id !== partId),
                    }))
                  }
                  onUploadPartPhoto={(partId, photo) => {
                    if (!admin || !editor || !currentUser) return;
                    if (
                      !['image/png', 'image/jpeg', 'image/webp'].includes(photo.type) ||
                      !photo.size ||
                      photo.size > MAX_IMAGE_SIZE
                    ) {
                      toast.error('Envie uma imagem PNG/JPG/WebP com até 8 MB.');
                      return;
                    }
                    const ext =
                      photo.type === 'image/png'
                        ? 'png'
                        : photo.type === 'image/webp'
                          ? 'webp'
                          : 'jpg';
                    const path = `reference_diagrams/${currentUser.id}/${crypto.randomUUID()}.${ext}`;
                    void uploadBytes(storageRef(storage, path), photo, { contentType: photo.type })
                      .then(() => getDownloadURL(storageRef(storage, path)))
                      .then((photoUrl) => {
                        updateMarker(marker.id, (current) => ({
                          ...current,
                          parts: current.parts.map((part) =>
                            part.id === partId ? { ...part, photoUrl } : part
                          ),
                        }));
                        toast.success('Foto enviada. Salve as marcações para publicar o vínculo.');
                      })
                      .catch((error) => {
                        console.error(error);
                        toast.error('Falha no envio da foto da peça.');
                      });
                  }}
                />
              )}
            />
          ) : (
            <div className="rounded-xl border bg-muted p-12 text-center text-sm text-muted-foreground">
              Carregando imagem técnica...
            </div>
          )}
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Legenda dos traços e peças</h2>
            {markers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum ponto adicionado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {markers.map((marker, index) => (
                  <button
                    key={marker.id}
                    type="button"
                    className="flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/30"
                    onClick={() => setMarkerId(marker.id)}
                  >
                    <span
                      className="mt-1 h-5 w-5 shrink-0 rounded-full border-solid bg-transparent"
                      style={{
                        borderColor: marker.strokeColor || '#f59e0b',
                        borderWidth: marker.strokeWidth || 3,
                      }}
                    />
                    <span className="text-xs">
                      <strong>
                        {index + 1}. {marker.label}
                      </strong>
                      <br />
                      {marker.parts
                        .map((part) => part.name)
                        .filter(Boolean)
                        .join(' · ') || 'Sem peças cadastradas'}
                      <br />
                      <span className="text-muted-foreground">
                        {marker.notes || 'Sem observações do ponto'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Pontos identificados</h2>
              <p className="text-xs text-muted-foreground">
                Clique em um círculo ou selecione abaixo.
              </p>
            </div>
            {markers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há círculos cadastrados nesta imagem.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {markers.map((marker, index) => (
                  <Button
                    key={marker.id}
                    size="sm"
                    variant={marker.id === markerId ? 'default' : 'outline'}
                    onClick={() => setMarkerId(marker.id)}
                  >
                    {index + 1}. {marker.label}
                  </Button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <AdminPanel
        open={adminOpen && admin}
        onClose={() => setAdminOpen(false)}
        brand={brand}
        settings={settings}
        setSettings={setSettings}
        form={form}
        setForm={setForm}
        file={file}
        setFile={setFile}
        onCreateDiagram={() => void createDiagram()}
        saving={saving}
        onSaveSettings={() => void saveAdminSettings()}
        savingSettings={settingsSaving}
      />
    </main>
  );
}
