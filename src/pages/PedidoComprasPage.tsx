import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, FileUp, Loader2, Eye, Pencil, Printer, Save } from 'lucide-react';
import logoImg from '@/assets/logo_japan_imports.png';
import { parsePurchaseOrderApi } from '@/lib/api';

interface Supplier {
  id: string;
  razao_social: string;
  cnpj?: string;
  celular?: string;
  endereco?: string;
  cep?: string;
  municipio_uf?: string;
  email?: string;
  contato?: string;
  obs?: string;
}

interface PurchaseItem {
  nome: string;
  valor: number;
  quantidade: number;
  marca: string;
  aplicacao: string;
  codigo: string;
}

interface PurchaseOrder {
  id: string;
  order_number: number;
  comprador_nome?: string;
  escopo?: string;
  supplier_id?: string;
  supplier_snapshot?: Supplier | null;
  items: PurchaseItem[];
  total: number;
  order_date: string;
  created_at: string;
}

const emptyItem = (): PurchaseItem => ({
  nome: '',
  valor: 0,
  quantidade: 1,
  marca: '',
  aplicacao: '',
  codigo: '',
});
const emptySupplier = (): Supplier => ({
  id: '',
  razao_social: '',
  cnpj: '',
  celular: '',
  endereco: '',
  cep: '',
  municipio_uf: '',
  email: '',
  contato: '',
  obs: '',
});

const PedidoComprasPage = () => {
  const { currentUser } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [escopo, setEscopo] = useState('Reposição Estoque / Encomenda Balcão');
  const [supplierId, setSupplierId] = useState<string>('new');
  const [supplierData, setSupplierData] = useState<Supplier>(emptySupplier());
  const [previewOrder, setPreviewOrder] = useState<PurchaseOrder | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierManagerOpen, setSupplierManagerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdminSector =
    currentUser?.sectors?.includes('administracao') || currentUser?.role === 'admin';

  const fetchAll = async () => {
    // Mantido por compatibilidade; os listeners abaixo já atualizam os dados.
  };

  useEffect(() => {
    const suppliersQuery = query(collection(db, 'suppliers'), orderBy('razao_social', 'asc'));
    const ordersQuery = query(collection(db, 'purchase_orders'), orderBy('order_number', 'desc'));

    const unsubscribeSuppliers = onSnapshot(
      suppliersQuery,
      (snapshot) => {
        setSuppliers(
          snapshot.docs.map((supplierDoc) => ({
            id: supplierDoc.id,
            ...supplierDoc.data(),
          })) as Supplier[]
        );
      },
      (error) => console.error('Erro ao carregar fornecedores:', error)
    );

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((orderDoc) => ({
            id: orderDoc.id,
            ...orderDoc.data(),
            items: Array.isArray(orderDoc.data().items) ? orderDoc.data().items : [],
            created_at: orderDoc.data().created_at?.toDate
              ? orderDoc.data().created_at.toDate().toISOString()
              : orderDoc.data().created_at || '',
          })) as PurchaseOrder[]
        );
      },
      (error) => console.error('Erro ao carregar pedidos de compra:', error)
    );

    return () => {
      unsubscribeSuppliers();
      unsubscribeOrders();
    };
  }, []);

  useEffect(() => {
    if (supplierId === 'new') {
      setSupplierData(emptySupplier());
    } else {
      const s = suppliers.find((x) => x.id === supplierId);
      if (s) setSupplierData(s);
    }
  }, [supplierId, suppliers]);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.valor) || 0) * (Number(it.quantidade) || 0), 0),
    [items]
  );

  const updateItem = (i: number, field: keyof PurchaseItem, val: string | number) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  };

  const addItem = () => {
    if (items.length >= 20) {
      toast.error('Limite de 20 itens por pedido.');
      return;
    }
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const parsed = (await parsePurchaseOrderApi({
        fileBase64: dataUrl,
        mimeType: file.type,
      })) as {
        supplier?: Partial<Supplier> & {
          razaoSocial?: string;
          municipioUf?: string;
        };
        items?: PurchaseItem[];
      };
      if (parsed.supplier) {
        setSupplierId('new');
        setSupplierData({
          ...emptySupplier(),
          razao_social: parsed.supplier.razao_social || (parsed.supplier as any).razaoSocial || '',
          cnpj: parsed.supplier.cnpj || '',
          celular: parsed.supplier.celular || '',
          endereco: parsed.supplier.endereco || '',
          cep: parsed.supplier.cep || '',
          municipio_uf: parsed.supplier.municipio_uf || (parsed.supplier as any).municipioUf || '',
          email: parsed.supplier.email || '',
          contato: parsed.supplier.contato || '',
          obs: parsed.supplier.obs || '',
        });
      }
      if (parsed.items && parsed.items.length > 0) {
        setItems(
          parsed.items.slice(0, 20).map((it) => ({
            nome: it.nome || '',
            valor: Number(it.valor) || 0,
            quantidade: Number(it.quantidade) || 1,
            marca: it.marca || '',
            aplicacao: it.aplicacao || '',
            codigo: it.codigo || '',
          }))
        );
      }
      toast.success('Dados extraídos. Revise antes de finalizar.');
    } catch (e: any) {
      toast.error('Não foi possível extrair dados: ' + (e?.message || ''));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveSupplierIfNeeded = async (): Promise<{ id: string | null; snapshot: Supplier }> => {
    if (!supplierData.razao_social.trim()) return { id: null, snapshot: supplierData };
    if (supplierId !== 'new') {
      await updateDoc(doc(db, 'suppliers', supplierId), {
        razao_social: supplierData.razao_social,
        cnpj: supplierData.cnpj,
        celular: supplierData.celular,
        endereco: supplierData.endereco,
        cep: supplierData.cep,
        municipio_uf: supplierData.municipio_uf,
        email: supplierData.email,
        contato: supplierData.contato,
        obs: supplierData.obs,
        updated_at: Timestamp.now(),
      });
      return { id: supplierId, snapshot: supplierData };
    }

    const supplierRef = await addDoc(collection(db, 'suppliers'), {
      razao_social: supplierData.razao_social,
      cnpj: supplierData.cnpj,
      celular: supplierData.celular,
      endereco: supplierData.endereco,
      cep: supplierData.cep,
      municipio_uf: supplierData.municipio_uf,
      email: supplierData.email,
      contato: supplierData.contato,
      obs: supplierData.obs,
      created_by: currentUser?.id || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    return {
      id: supplierRef.id,
      snapshot: { ...supplierData, id: supplierRef.id },
    };
  };

  const finalize = async () => {
    const cleanItems = items.filter((it) => it.nome.trim());
    if (cleanItems.length === 0) {
      toast.error('Adicione ao menos 1 item.');
      return;
    }
    setSaving(true);
    try {
      const { id: supId, snapshot } = await saveSupplierIfNeeded();
      const existingNumbers = orders.map((order) => Number(order.order_number) || 0);
      const nextOrderNumber = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;

      const orderRef = await addDoc(collection(db, 'purchase_orders'), {
        order_number: nextOrderNumber,
        comprador_id: currentUser?.id || null,
        comprador_nome: currentUser?.name || null,
        escopo,
        supplier_id: supId,
        supplier_snapshot: snapshot,
        items: cleanItems,
        total,
        order_date: new Date().toISOString().slice(0, 10),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      const order: PurchaseOrder = {
        id: orderRef.id,
        order_number: nextOrderNumber,
        comprador_nome: currentUser?.name,
        escopo,
        supplier_id: supId || undefined,
        supplier_snapshot: snapshot,
        items: cleanItems,
        total,
        order_date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
      };
      setPreviewOrder(order);
      // reset
      setItems([emptyItem()]);
      setSupplierId('new');
      setSupplierData(emptySupplier());
      toast.success(`Pedido #${order.order_number} criado.`);
    } catch (e: any) {
      toast.error('Erro ao finalizar: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdminSector) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito ao setor Administração.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Pedido de Compras</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setSupplierManagerOpen(true)}>
            Fornecedores
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4 mr-2" />
            )}
            Importar PDF/Imagem
          </Button>
        </div>
      </div>

      {/* Supplier card */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold">Fornecedor</h2>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">+ Novo fornecedor</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Razão Social"
            value={supplierData.razao_social}
            onChange={(v) => setSupplierData((s) => ({ ...s, razao_social: v }))}
          />
          <Field
            label="CNPJ"
            value={supplierData.cnpj || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, cnpj: v }))}
          />
          <Field
            label="Endereço"
            value={supplierData.endereco || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, endereco: v }))}
          />
          <Field
            label="CEP"
            value={supplierData.cep || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, cep: v }))}
          />
          <Field
            label="Município / UF"
            value={supplierData.municipio_uf || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, municipio_uf: v }))}
          />
          <Field
            label="Celular"
            value={supplierData.celular || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, celular: v }))}
          />
          <Field
            label="Email"
            value={supplierData.email || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, email: v }))}
          />
          <Field
            label="Contato"
            value={supplierData.contato || ''}
            onChange={(v) => setSupplierData((s) => ({ ...s, contato: v }))}
          />
          <div className="md:col-span-2">
            <Label>OBS</Label>
            <Textarea
              value={supplierData.obs || ''}
              onChange={(e) => setSupplierData((s) => ({ ...s, obs: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Escopo */}
      <div className="rounded-lg border bg-card p-4">
        <Label>Escopo</Label>
        <Input value={escopo} onChange={(e) => setEscopo(e.target.value)} />
      </div>

      {/* Items */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Itens ({items.length}/20)</h2>
          <Button size="sm" onClick={addItem} disabled={items.length >= 20}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar item
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3">
              <div className="col-span-12 md:col-span-3">
                <Label>Nome do Item</Label>
                <Input value={it.nome} onChange={(e) => updateItem(i, 'nome', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-1">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min={0}
                  value={it.quantidade}
                  onChange={(e) => updateItem(i, 'quantidade', Number(e.target.value))}
                />
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.valor}
                  onChange={(e) => updateItem(i, 'valor', Number(e.target.value))}
                />
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Marca</Label>
                <Input value={it.marca} onChange={(e) => updateItem(i, 'marca', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-2">
                <Label>Aplicação</Label>
                <Input
                  value={it.aplicacao}
                  onChange={(e) => updateItem(i, 'aplicacao', e.target.value)}
                />
              </div>
              <div className="col-span-10 md:col-span-1">
                <Label>Código</Label>
                <Input
                  value={it.codigo}
                  onChange={(e) => updateItem(i, 'codigo', e.target.value)}
                />
              </div>
              <div className="col-span-2 md:col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="font-semibold">TOTAL</span>
          <span className="font-bold text-lg">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={finalize} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Eye className="w-4 h-4 mr-2" />
          )}
          Finalizar e visualizar
        </Button>
      </div>

      {/* History */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Pedidos anteriores</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          )}
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setPreviewOrder(o)}
              className="w-full text-left flex justify-between items-center px-3 py-2 rounded hover:bg-accent text-sm"
            >
              <span>
                Pedido #{o.order_number} —{' '}
                {(o.supplier_snapshot as any)?.razao_social || 'Sem fornecedor'}
              </span>
              <span className="text-muted-foreground">
                R$ {Number(o.total).toFixed(2)} ·{' '}
                {new Date(o.order_date).toLocaleDateString('pt-BR')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewOrder} onOpenChange={(o) => !o && setPreviewOrder(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 print:hidden border-b flex-row items-center justify-between">
            <DialogTitle>Pré-visualização — Pedido #{previewOrder?.order_number}</DialogTitle>
            <Button onClick={() => window.print()} size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </DialogHeader>
          {previewOrder && <PrintablePedido order={previewOrder} />}
        </DialogContent>
      </Dialog>

      {/* Supplier manager */}
      <Dialog open={supplierManagerOpen} onOpenChange={setSupplierManagerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fornecedores cadastrados</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.id} className="border rounded-md p-3">
                {editingSupplier?.id === s.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field
                        label="Razão Social"
                        value={editingSupplier.razao_social}
                        onChange={(v) =>
                          setEditingSupplier({ ...editingSupplier, razao_social: v })
                        }
                      />
                      <Field
                        label="CNPJ"
                        value={editingSupplier.cnpj || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, cnpj: v })}
                      />
                      <Field
                        label="Endereço"
                        value={editingSupplier.endereco || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, endereco: v })}
                      />
                      <Field
                        label="CEP"
                        value={editingSupplier.cep || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, cep: v })}
                      />
                      <Field
                        label="Município / UF"
                        value={editingSupplier.municipio_uf || ''}
                        onChange={(v) =>
                          setEditingSupplier({ ...editingSupplier, municipio_uf: v })
                        }
                      />
                      <Field
                        label="Celular"
                        value={editingSupplier.celular || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, celular: v })}
                      />
                      <Field
                        label="Email"
                        value={editingSupplier.email || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, email: v })}
                      />
                      <Field
                        label="Contato"
                        value={editingSupplier.contato || ''}
                        onChange={(v) => setEditingSupplier({ ...editingSupplier, contato: v })}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
                            razao_social: editingSupplier.razao_social,
                            cnpj: editingSupplier.cnpj,
                            celular: editingSupplier.celular,
                            endereco: editingSupplier.endereco,
                            cep: editingSupplier.cep,
                            municipio_uf: editingSupplier.municipio_uf,
                            email: editingSupplier.email,
                            contato: editingSupplier.contato,
                            obs: editingSupplier.obs,
                            updated_at: Timestamp.now(),
                          });
                          setEditingSupplier(null);
                          toast.success('Fornecedor atualizado.');
                        }}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{s.razao_social}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.cnpj} · {s.municipio_uf}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditingSupplier(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm('Remover fornecedor?')) return;
                          await deleteDoc(doc(db, 'suppliers', s.id));
                          toast.success('Fornecedor removido.');
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {suppliers.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum fornecedor.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const PrintablePedido = ({ order }: { order: PurchaseOrder }) => {
  const s = (order.supplier_snapshot as Supplier) || ({} as Supplier);
  return (
    <div className="bg-white text-black p-8 print:p-6" id="printable-pedido">
      <style>{`@media print { body * { visibility: hidden; } #printable-pedido, #printable-pedido * { visibility: visible; } #printable-pedido { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="flex justify-between items-start border-b-2 border-black pb-3">
        <img src={logoImg} alt="Japan Imports" className="w-28 h-auto" />
        <div className="text-right">
          <p className="font-bold text-lg">
            JL Borges de Moura Comércio de Peças e Acessórios Automotores Eireli
          </p>
          <p className="text-sm">Av. das Rosas, 111 - 12224-000 - Jd Motorama</p>
          <p className="text-sm">São José dos Campos - SP</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4 items-center">
        <div className="border border-black p-2">
          <p className="text-xs">Número do Pedido:</p>
          <p className="font-bold text-lg">{order.order_number}</p>
        </div>
        <div className="text-center">
          <p className="text-3xl italic font-light tracking-wider">PEDIDO DE COMPRA</p>
        </div>
        <div className="border border-black p-2">
          <p className="text-xs">Data do Pedido:</p>
          <p className="font-bold">{new Date(order.order_date).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
      <div className="border border-black p-2 mt-2">
        <p className="text-xs">Comprador:</p>
        <p className="font-semibold">{order.comprador_nome || '—'}</p>
      </div>

      <p className="mt-3 text-sm">
        <span className="font-semibold">Escopo:</span> {order.escopo}
      </p>

      <div className="mt-4 bg-gray-200 text-center font-bold py-1">DADOS DO FORNECEDOR</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
        <p>
          <span className="font-semibold">Razão Social:</span> {s.razao_social || '—'}
        </p>
        <p>
          <span className="font-semibold">CNPJ:</span> {s.cnpj || '—'}
        </p>
        <p>
          <span className="font-semibold">Endereço:</span> {s.endereco || '—'}
        </p>
        <p>
          <span className="font-semibold">Celular:</span> {s.celular || '—'}
        </p>
        <p>
          <span className="font-semibold">CEP:</span> {s.cep || '—'}
        </p>
        <p>
          <span className="font-semibold">MUN. / UF:</span> {s.municipio_uf || '—'}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {s.email || '—'}
        </p>
        <p>
          <span className="font-semibold">Contato:</span> {s.contato || '—'}
        </p>
        <p className="col-span-2">
          <span className="font-semibold">OBS:</span> {s.obs || '—'}
        </p>
      </div>

      <table className="w-full mt-4 text-sm border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-400 p-1 text-left">ITEM</th>
            <th className="border border-gray-400 p-1 text-left">QTDE</th>
            <th className="border border-gray-400 p-1 text-left">DESCRIÇÃO DO PRODUTO</th>
            <th className="border border-gray-400 p-1 text-left">MARCA</th>
            <th className="border border-gray-400 p-1 text-left">APLICAÇÃO</th>
            <th className="border border-gray-400 p-1 text-left">CÓDIGO</th>
            <th className="border border-gray-400 p-1 text-right">UNIT (R$)</th>
            <th className="border border-gray-400 p-1 text-right">TOTAL (R$)</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i}>
              <td className="border border-gray-400 p-1">{i + 1}</td>
              <td className="border border-gray-400 p-1">{Number(it.quantidade).toFixed(2)}</td>
              <td className="border border-gray-400 p-1">{it.nome}</td>
              <td className="border border-gray-400 p-1">{it.marca}</td>
              <td className="border border-gray-400 p-1">{it.aplicacao}</td>
              <td className="border border-gray-400 p-1">{it.codigo}</td>
              <td className="border border-gray-400 p-1 text-right">
                {Number(it.valor).toFixed(2)}
              </td>
              <td className="border border-gray-400 p-1 text-right">
                {(Number(it.valor) * Number(it.quantidade)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end mt-2 gap-4 font-bold">
        <span>TOTAL</span>
        <span>R$ {Number(order.total).toFixed(2)}</span>
      </div>
    </div>
  );
};

export default PedidoComprasPage;
