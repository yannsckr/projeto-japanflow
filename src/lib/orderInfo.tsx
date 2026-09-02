import { cn } from '@/lib/utils';

export interface OrderInfo {
  pago?: boolean | null; // true=Pago, false=Não pago, null=não informado
  maquininha?: boolean | null;
  nf?: boolean | null;
  boleto?: boolean | null;
  usarCreditos?: boolean | null;
}

/** Parses notes string with optional [INFO:TAG1,TAG2,...] block. */
export function parseOrderInfo(notes: string | null | undefined): OrderInfo {
  if (!notes) return {};
  const m = notes.match(/\[INFO:([^\]]+)\]/);
  if (!m) return {};
  const tags = m[1].split(',').map((t) => t.trim());
  const info: OrderInfo = {};
  if (tags.includes('PAGO')) info.pago = true;
  if (tags.includes('NAO_PAGO')) info.pago = false;
  if (tags.includes('MAQUININHA')) info.maquininha = true;
  if (tags.includes('SEM_MAQUININHA')) info.maquininha = false;
  if (tags.includes('NF')) info.nf = true;
  if (tags.includes('SEM_NF')) info.nf = false;
  if (tags.includes('BOLETO')) info.boleto = true;
  if (tags.includes('SEM_BOLETO')) info.boleto = false;
  if (tags.includes('USAR_CREDITOS')) info.usarCreditos = true;
  return info;
}

/** Returns notes with the [INFO:...] tag stripped, for clean display. */
export function stripOrderInfo(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/\s*\[INFO:[^\]]+\]\s*/g, '').trim();
}

interface OrderInfoBadgesProps {
  info: OrderInfo;
  size?: 'sm' | 'xs';
  className?: string;
}

/** Renders a row of small badges for the order info flags. */
export const OrderInfoBadges = ({ info, size = 'xs', className }: OrderInfoBadgesProps) => {
  const items: { label: string; positive: boolean; emphasis?: boolean }[] = [];
  if (info.pago !== undefined && info.pago !== null)
    items.push({ label: info.pago ? '💰 Pago' : '💰 Não Pago', positive: !!info.pago });
  if (info.usarCreditos)
    items.push({ label: '🪙 Usar Créditos', positive: true, emphasis: true });
  if (info.maquininha !== undefined && info.maquininha !== null)
    items.push({
      label: info.maquininha ? '💳 Maquininha' : '💳 Sem Maq.',
      positive: !!info.maquininha,
    });
  if (info.nf !== undefined && info.nf !== null)
    items.push({ label: info.nf ? '🧾 NF' : '🧾 Sem NF', positive: !!info.nf });
  if (info.boleto !== undefined && info.boleto !== null)
    items.push({ label: info.boleto ? '📄 Boleto' : '📄 Sem Boleto', positive: !!info.boleto });
  if (items.length === 0) return null;
  const sizeCls = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[9px] px-1 py-0.5';
  return (
    <div className={cn('flex flex-wrap gap-0.5', className)}>
      {items.map((it, i) => (
        <span
          key={i}
          className={cn(
            'rounded font-medium border whitespace-nowrap',
            sizeCls,
            it.emphasis
              ? 'bg-primary/20 text-primary border-primary/40'
              : it.positive
                ? 'bg-success/15 text-success border-success/30'
                : 'bg-warning/15 text-warning border-warning/30'
          )}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
};
