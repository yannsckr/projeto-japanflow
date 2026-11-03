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
  model: string;
  code: string;
  notes: string;
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
export function asDiagram(id: string, data: Record<string, unknown>): ReferenceDiagram | null {
  if (
    !REFERENCE_BRANDS.includes(data.brand as ReferenceBrand) ||
    !REFERENCE_SYSTEMS.includes(data.system as ReferenceSystem)
  )
    return null;
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
      .filter((m): m is Record<string, unknown> => m && typeof m === 'object' && !Array.isArray(m))
      .map((m) => ({
        id: safeText(m.id, 90),
        x: positionPercent(Number(m.x) || 0),
        y: positionPercent(Number(m.y) || 0),
        label: safeText(m.label, 100),
        parts: (Array.isArray(m.parts) ? m.parts : [])
          .filter(
            (p): p is Record<string, unknown> => p && typeof p === 'object' && !Array.isArray(p)
          )
          .map((p) => ({
            id: safeText(p.id, 90),
            name: safeText(p.name, 140),
            manufacturer: safeText(p.manufacturer, 120),
            model: safeText(p.model, 140),
            code: safeText(p.code, 100),
            notes: safeText(p.notes, 500),
          })),
      })),
  };
}
