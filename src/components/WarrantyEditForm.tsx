import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { WarrantyClaim, WarrantyEditableFields } from '@/hooks/useWarranties';

interface Props {
  claim: WarrantyClaim;
  saving: boolean;
  onSave: (fields: WarrantyEditableFields) => Promise<void>;
  onCancel: () => void;
}

type FieldKey = keyof WarrantyEditableFields;

type FieldDefinition = {
  key: FieldKey;
  label: string;
  type?: string;
};

const basicFields: FieldDefinition[] = [
  { key: 'clientName', label: 'Cliente *' },
  { key: 'supplierName', label: 'Fornecedor' },
  { key: 'productBrand', label: 'Marca do produto' },
  { key: 'itemName', label: 'Item *' },
  { key: 'itemCode', label: 'Código do item' },
  { key: 'saleDate', label: 'Data da venda', type: 'date' },
  { key: 'invoiceNumber', label: 'Nº Nota/Pedido' },
  { key: 'installationMileage', label: 'Km instalação' },
  { key: 'currentMileage', label: 'Km atual' },
];

const siteFields: FieldDefinition[] = [
  { key: 'siteOrder', label: 'Pedido informado no site' },
  { key: 'siteContactChannel', label: 'Canal de contato' },
  { key: 'siteContact', label: 'Contato' },
  {
    key: 'siteReceived',
    label: 'Data de recebimento da peça',
    type: 'date',
  },
  { key: 'siteInstalled', label: 'Peça instalada?' },
  { key: 'siteVehicle', label: 'Veículo' },
];

export default function WarrantyEditForm({ claim, saving, onSave, onCancel }: Props) {
  const [form, setForm] = useState<WarrantyEditableFields>({
    clientName: claim.clientName,
    supplierName: claim.supplierName,
    productBrand: claim.productBrand,
    itemName: claim.itemName,
    itemCode: claim.itemCode,
    defectDescription: claim.defectDescription,
    saleDate: claim.saleDate,
    invoiceNumber: claim.invoiceNumber,
    installationMileage: claim.installationMileage,
    currentMileage: claim.currentMileage,
    siteOrder: claim.siteOrder || '',
    siteContactChannel: claim.siteContactChannel || '',
    siteContact: claim.siteContact || '',
    siteReceived: claim.siteReceived || '',
    siteInstalled: claim.siteInstalled || '',
    siteVehicle: claim.siteVehicle || '',
    siteNotes: claim.siteNotes || '',
  });

  const [validationError, setValidationError] = useState('');

  const change = (key: FieldKey, value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
    setValidationError('');
  };

  const renderField = (field: FieldDefinition) => (
    <div key={field.key} className="min-w-0 space-y-1">
      <Label className="text-xs">{field.label}</Label>
      <Input
        type={field.type || 'text'}
        value={form[field.key] ?? ''}
        disabled={saving}
        onChange={(event) => change(field.key, event.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.clientName.trim() || !form.itemName.trim()) {
      setValidationError('Preencha o nome do cliente e o nome do item.');
      return;
    }

    await onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{basicFields.map(renderField)}</div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição do defeito</Label>
        <Textarea
          value={form.defectDescription}
          disabled={saving}
          onChange={(event) => change('defectDescription', event.target.value)}
          rows={4}
        />
      </div>

      {claim.origin === 'site' && (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Informações complementares</h3>

          <p className="text-xs text-muted-foreground">
            Protocolo original: {claim.siteProtocol || '—'}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{siteFields.map(renderField)}</div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.siteNotes || ''}
              disabled={saving}
              onChange={(event) => change('siteNotes', event.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>

        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
