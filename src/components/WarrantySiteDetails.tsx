import type { WarrantyClaim } from '@/hooks/useWarranties';

export default function WarrantySiteDetails({ claim }: { claim: WarrantyClaim }) {
  if (claim.origin !== 'site') return null;

  const details = [
    ['Protocolo', claim.siteProtocol],
    ['Pedido', claim.siteOrder],
    ['Canal', claim.siteContactChannel],
    ['Contato', claim.siteContact],
    ['Recebimento', claim.siteReceived ? claim.siteReceived.split('-').reverse().join('/') : ''],
    ['Peça instalada?', claim.siteInstalled],
    ['Veículo', claim.siteVehicle],
    ['Observações', claim.siteNotes],
  ];

  return (
    <section
      aria-label="Solicitação recebida pelo site"
      className="space-y-3 rounded border border-border p-4"
    >
      <h3 className="font-semibold">Recebida pelo Site</h3>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {details
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
