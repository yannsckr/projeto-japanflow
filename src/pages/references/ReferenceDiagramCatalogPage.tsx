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
    const matchesBrand = !filters.partBrand || part.manufacturer === filters.partBrand;
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
              <strong>Marca:</strong> {part.manufacturer || '—'}
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
  onAddPart: () => void;
  onChangePart: (partId: string, patch: Partial<AlternativePart>) => void;
  onRemovePart: (partId: string) => void;
  onUploadPartPhoto: (partId: string, file: File) => void;
}) {
  return (
    <div className="w-[290px] max-w-[78vw] rounded-2xl border bg-background/98 p-3 shadow-2xl backdrop-blur">
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
                <label className="text-[11px] font-medium text-muted-foreground">
                  Marca da peça
                  <select
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={part.manufacturer}
                    onChange={(event) => {
                      const selectedBrand = adminSettings.partBrands.find(
                        (item) => item.name === event.target.value
                      );
                      onChangePart(part.id, {
                        manufacturer: event.target.value,
                        manufacturerHex: selectedBrand?.hex ?? part.manufacturerHex,
                        useTypes:
                          selectedBrand && part.useTypes?.length === 0
                            ? selectedBrand.uses
                            : part.useTypes,
                      });
                    }}
                  >
                    <option value="">Selecione</option>
                    {adminSettings.partBrands.map((brand) => (
                      <option key={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Cor HEX
                  <Input
                    className="mt-1 h-8"
                    value={part.manufacturerHex || '#1d4ed8'}
                    onChange={(event) =>
                      onChangePart(part.id, { manufacturerHex: event.target.value })
                    }
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground md:col-span-2">
                  Modelos atendidos (separados por vírgula)
                  <Input
                    className="mt-1 h-8"
                    value={part.model}
                    onChange={(event) => {
                      const list = sanitizeList(event.target.value);
                      onChangePart(part.id, { model: event.target.value, compatibleModels: list });
                    }}
                  />
                </label>
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
                <label className="text-[11px] font-medium text-muted-foreground md:col-span-2">
                  Usos / tipos (separados por vírgula)
                  <Input
                    className="mt-1 h-8"
                    value={(part.useTypes ?? []).join(', ')}
                    onChange={(event) =>
                      onChangePart(part.id, { useTypes: sanitizeList(event.target.value) })
                    }
                  />
                </label>
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
  onPlace: (x: number, y: number) => void;
  onMoveMarker: (id: string, x: number, y: number) => void;
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
  const [panning, setPanning] = useState(false);
  const startRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [url]);

  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewportSize({ width: rect.width, height: rect.height });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

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
    if (placing && canEdit && editor) return;
    startRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMoveCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId) {
      const point = pointFromClient(event.clientX, event.clientY);
      if (point) onMoveMarker(draggingMarkerId, point.x, point.y);
      return;
    }
    if (!panning) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    setPan({ x: startRef.current.panX + dx, y: startRef.current.panY + dy });
  };

  const handlePointerUpCanvas = () => {
    setDraggingMarkerId(null);
    setPanning(false);
  };

  return (
    <div className="space-y-3">
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
              <CircleDot className="h-4 w-4" /> Arraste o círculo para reposicionar
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
        </div>
      </div>
      <div
        ref={frameRef}
        className="relative min-h-[72vh] overflow-hidden rounded-[28px] border bg-muted/30 shadow-inner"
      >
        <div
          ref={canvasRef}
          className={`absolute inset-0 touch-none ${placing ? 'cursor-crosshair' : panning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onClick={(event) => {
            if (!canEdit || !placing || !editor) return;
            const point = pointFromClient(event.clientX, event.clientY);
            if (point) onPlace(point.x, point.y);
          }}
          onPointerDown={handlePointerDownCanvas}
          onPointerMove={handlePointerMoveCanvas}
          onPointerUp={handlePointerUpCanvas}
          onPointerLeave={handlePointerUpCanvas}
          onWheel={(event) => {
            event.preventDefault();
            setScale((value) => clamp(value + (event.deltaY < 0 ? 0.12 : -0.12), 1, 4));
          }}
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
              transition: draggingMarkerId || panning ? 'none' : 'transform 120ms ease-out',
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
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {selectedMarker && (
                  <line
                    x1={selectedMarker.x}
                    y1={selectedMarker.y}
                    x2={selectedMarker.x > 58 ? selectedMarker.x - 20 : selectedMarker.x + 20}
                    y2={selectedMarker.y - 8}
                    stroke="currentColor"
                    strokeWidth=".25"
                    strokeDasharray="1.2 1.2"
                    className="text-primary"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {markers.map((marker, index) => {
                const selected = marker.id === selectedId;
                const alignLeft = marker.x > 70;
                return (
                  <div
                    key={marker.id}
                    className="absolute"
                    style={{
                      left: `${marker.x}%`,
                      top: `${marker.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <button
                      type="button"
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-background/65 text-xs font-bold shadow-md backdrop-blur sm:h-11 sm:w-11 ${selected ? 'border-primary text-primary' : 'border-amber-500 text-foreground'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(marker.id);
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        if (!canEdit || !editor) return;
                        setDraggingMarkerId(marker.id);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      title={marker.label}
                      aria-label={`Ponto ${index + 1}: ${marker.label}`}
                    >
                      {index + 1}
                    </button>
                    <div
                      className={`pointer-events-none absolute top-1/2 z-0 hidden -translate-y-1/2 rounded-full border bg-background/92 px-2 py-1 text-[10px] shadow md:block ${alignLeft ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]'}`}
                    >
                      <span className="font-semibold">{index + 1}</span> · {marker.label}
                    </div>
                  </div>
                );
              })}

              {selectedMarker && selectedIndex >= 0 && (
                <div
                  className="absolute z-20"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    left:
                      selectedMarker.x > 60
                        ? `calc(${selectedMarker.x}% - min(320px, 76vw))`
                        : `calc(${selectedMarker.x}% + 30px)`,
                    top: `calc(${clamp(selectedMarker.y - 6, 4, 70)}%)`,
                    transform: `scale(${1 / scale})`,
                    transformOrigin: selectedMarker.x > 60 ? 'top right' : 'top left',
                  }}
                >
                  {renderSelectedPanel(selectedMarker, selectedIndex)}
                </div>
              )}
            </div>
          </div>
        </div>
        {canEdit && placing && editor && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-background/95 px-4 py-2 text-xs shadow">
            Clique em qualquer ponto da imagem para criar o círculo com contorno.
          </div>
        )}
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
              onPlace={(x, y) => {
                if (!admin || !editor) return;
                const id = crypto.randomUUID();
                setDraftMarkers((current) => [
                  ...current,
                  { id, x, y, label: `Ponto ${current.length + 1}`, parts: [] },
                ]);
                setMarkerId(id);
                setPlacing(false);
                setDirty(true);
              }}
              onMoveMarker={(id, x, y) => {
                if (!admin || !editor) return;
                updateMarker(id, (marker) => ({ ...marker, x, y }));
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
