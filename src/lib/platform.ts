/** Identificacao de plataforma somente para progressiva adaptacao da UX.
 *  Nao use este resultado para autorizar acesso a dados; isso e papel do backend.
 */
export type JapanFlowPlatform = 'web' | 'windows' | 'android';

export function detectPlatform(
  options: { userAgent?: string; isTauri?: boolean; isCapacitorNative?: boolean } = {}
): JapanFlowPlatform {
  // Native Android Capacitor: usamos identificacao explicita para nao classificar Chrome Android como app.
  if (options.isCapacitorNative) return 'android';
  if (options.isTauri) return 'windows';
  return 'web';
}

export type OperationalExperience = 'standard' | 'mobile-motoboy' | 'mobile-operations';

/** Apenas escolhe a experiencia visual; permissao de leitura continua no Firebase. */
export function selectOperationalExperience(
  platform: JapanFlowPlatform,
  sectorLabels: string[]
): OperationalExperience {
  if (platform !== 'android') return 'standard';
  const normalized = sectorLabels.map((value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
  );
  if (normalized.some((sector) => sector.includes('motoboy') || sector.includes('entrega')))
    return 'mobile-motoboy';
  return 'mobile-operations';
}
