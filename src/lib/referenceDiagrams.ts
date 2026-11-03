export const REFERENCE_BRANDS = ['Mitsubishi', 'Toyota', 'Honda', 'Suzuki', 'Subaru'] as const;
export type ReferenceBrand = (typeof REFERENCE_BRANDS)[number];
export const REFERENCE_SYSTEMS = [
  'Suspensão',
  'Câmbio',
  'Motor',
  'Direção',
  'Freios',
  'Transmissão',
  'Arrefecimento',
  'Elétrica',
  'Carroceria',
  'Outros',
] as const;
export type ReferenceSystem = (typeof REFERENCE_SYSTEMS)[number];

export type AlternativePart = {
  id: string;
  name: string;
  manufacturer: string;
  manufacturerHex?: string;
  model: string;
  compatibleModels?: string[];
  code: string;
  yearRange?: string;
  notes: string;
  photoUrl?: string;
  useTypes?: string[];
};

export type ReferenceMarker = {
  id: string;
  x: number;
  y: number;
  label: string;
  parts: AlternativePart[];
};

export type ReferenceDiagram = {
  id: string;
  brand: ReferenceBrand;
  system: ReferenceSystem;
  title: string;
  vehicle: string;
  yearRange: string;
  imagePath: string;
  createdBy: string;
  markers: ReferenceMarker[];
};

export type ReferencePartBrandConfig = {
  id: string;
  name: string;
  hex: string;
  uses: string[];
};

export type ReferenceAdminSettings = {
  vehicleModels: string[];
  years: string[];
  pieceTypes: string[];
  partBrands: ReferencePartBrandConfig[];
};

export const DEFAULT_REFERENCE_ADMIN_SETTINGS: ReferenceAdminSettings = {
  vehicleModels: [
    'Pajero TR4',
    'Lancer',
    'ASX',
    'Hilux',
    'Corolla',
    'Civic',
    'Fit',
    'Jimny',
    'Forester',
  ],
  years: ['2000-2005', '2006-2010', '2011-2015', '2016-2020', '2021-2026'],
  pieceTypes: [
    'Bucha',
    'Coxim',
    'Bieleta',
    'Rolamento',
    'Amortecedor',
    'Bandeja',
    'Pastilha',
    'Pivô',
  ],
  partBrands: [
    { id: 'nakata', name: 'Nakata', hex: '#0069ff', uses: ['Bucha', 'Bieleta', 'Amortecedor'] },
    { id: 'cofap', name: 'Cofap', hex: '#ff7a00', uses: ['Amortecedor', 'Coxim'] },
    { id: 'axios', name: 'Axios', hex: '#00a66b', uses: ['Bucha', 'Coxim'] },
  ],
};

export function positionPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function positionFromPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
) {
  return {
    x: positionPercent(((clientX - rect.left) / rect.width) * 100),
    y: positionPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export const safeText = (v: unknown, max = 200) =>
  String(v ?? '')
    .trim()
    .slice(0, max);

const safeList = (v: unknown, maxItems = 30, maxText = 120) =>
  Array.isArray(v)
    ? v
        .map((item) => safeText(item, maxText))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

export function asDiagram(id: string, data: Record<string, unknown>): ReferenceDiagram | null {
  if (
    !REFERENCE_BRANDS.includes(data.brand as ReferenceBrand) ||
    !REFERENCE_SYSTEMS.includes(data.system as ReferenceSystem)
  ) {
    return null;
  }

  const markers = Array.isArray(data.markers) ? data.markers : [];
  return {
    id,
    brand: data.brand as ReferenceBrand,
    system: data.system as ReferenceSystem,
    title: safeText(data.title),
    vehicle: safeText(data.vehicle),
    yearRange: safeText(data.year_range),
    imagePath: safeText(data.image_path, 500),
    createdBy: safeText(data.created_by),
    markers: markers
      .filter(
        (m): m is Record<string, unknown> =>
          Boolean(m) && typeof m === 'object' && !Array.isArray(m)
      )
      .map((m) => ({
        id: safeText(m.id, 90),
        x: positionPercent(Number(m.x) || 0),
        y: positionPercent(Number(m.y) || 0),
        label: safeText(m.label, 100),
        parts: (Array.isArray(m.parts) ? m.parts : [])
          .filter(
            (p): p is Record<string, unknown> =>
              Boolean(p) && typeof p === 'object' && !Array.isArray(p)
          )
          .map((p) => ({
            id: safeText(p.id, 90),
            name: safeText(p.name, 140),
            manufacturer: safeText(p.manufacturer, 120),
            manufacturerHex: safeText(p.manufacturerHex, 16) || undefined,
            model: safeText(p.model, 140),
            compatibleModels: safeList(p.compatibleModels, 15, 140),
            code: safeText(p.code, 100),
            yearRange: safeText(p.yearRange, 80) || undefined,
            notes: safeText(p.notes, 800),
            photoUrl: safeText(p.photoUrl, 600) || undefined,
            useTypes: safeList(p.useTypes, 15, 100),
          })),
      })),
  };
}
