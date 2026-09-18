import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calculator, Loader2, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import JapanFlowIcon from '@/components/JapanFlowIcon';
import { freightCalcApi } from '@/lib/api';

const formatBRL = (v: number) =>
  isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

function SJCCalculator() {
  const [cost, setCost] = useState('');
  const [qty, setQty] = useState('1');

  const c = parseFloat(cost.replace(',', '.')) || 0;
  const q = parseInt(qty) || 0;
  const sale = cost === '' ? 0 : (c * q + 18) * 1.6;

  const now = new Date();
  const afterCutoff = now.getHours() > 15 || (now.getHours() === 15 && now.getMinutes() >= 30);

  let deadline = '';
  if (c > 0) {
    if (afterCutoff) {
      deadline = 'Encomenda para o próximo dia útil (após 15h30)';
    } else if (c < 120) {
      deadline = 'Prazo de encomenda: 4 horas';
    } else {
      deadline = 'Prazo de encomenda: 2 horas';
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Valor de custo do item (R$)</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0,00"
        />
      </div>
      <div className="space-y-2">
        <Label>Quantidade de itens</Label>
        <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Fórmula: (Custo × Qtd + 18) + 60%</p>
        <p className="text-2xl font-bold text-primary">{formatBRL(sale)}</p>
        {deadline && <p className="text-sm font-medium text-foreground">{deadline}</p>}
      </div>
    </div>
  );
}

function SPCalculator() {
  const [cost, setCost] = useState('');
  const [qty, setQty] = useState('1');
  const [bigItem, setBigItem] = useState(false);

  const c = parseFloat(cost.replace(',', '.')) || 0;
  const q = parseInt(qty) || 0;
  const fee = bigItem ? 120 : 60;
  const sale = cost === '' ? 0 : (c * q + fee) * 1.6;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Valor de custo do item (R$)</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0,00"
        />
      </div>
      <div className="space-y-2">
        <Label>Quantidade de itens</Label>
        <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="big-item">Item Grande?</Label>
          <p className="text-xs text-muted-foreground">Ex.: Turbinas, Caixas de Direção</p>
        </div>
        <Switch id="big-item" checked={bigItem} onCheckedChange={setBigItem} />
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Fórmula: (Custo × Qtd + {fee}) + 60%</p>
        <p className="text-2xl font-bold text-primary">{formatBRL(sale)}</p>
        <p className="text-sm font-medium text-foreground">Prazo: 2 dias úteis</p>
        <p className="text-xs text-muted-foreground">Exceto Takao: 4 dias úteis</p>
      </div>
    </div>
  );
}

const DIFAL_PERCENTUAIS: Record<string, number> = {
  AC: 12.0,
  AL: 12.0,
  AP: 16.25,
  AM: 13.0,
  BA: 16.981,
  CE: 13.0,
  DF: 13.0,
  ES: 12.048,
  GO: 12.0,
  MA: 20.779,
  MT: 12.048,
  MS: 12.048,
  MG: 7.317,
  PA: 12.0,
  PB: 16.25,
  PR: 9.317,
  PE: 16.981,
  PI: 20.0,
  RJ: 10.0,
  RN: 16.25,
  RS: 6.024,
  RO: 15.528,
  RR: 13.0,
  SC: 6.024,
  SP: 0.0,
  SE: 14.815,
  TO: 13.0,
};

function DIFALCalculator() {
  const [estado, setEstado] = useState('');
  const [valor, setValor] = useState('');

  const v = parseFloat(valor.replace(',', '.')) || 0;
  const pct = estado ? DIFAL_PERCENTUAIS[estado] : 0;
  const difal = estado && valor !== '' ? v * (pct / 100) : 0;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`DIFAL: ${formatBRL(difal)}`);
    } catch {}
  };

  const limpar = () => {
    setEstado('');
    setValor('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Estado de destino</Label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Selecione</option>
          {Object.keys(DIFAL_PERCENTUAIS).map((uf) => (
            <option key={uf} value={uf}>
              {uf} ({DIFAL_PERCENTUAIS[uf].toFixed(3)}%)
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Valor da Nota Fiscal (R$)</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
        />
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Fórmula: Valor NF × Alíquota DIFAL do estado
        </p>
        <p className="text-2xl font-bold text-primary">DIFAL: {formatBRL(difal)}</p>
        {estado && (
          <p className="text-xs text-muted-foreground">
            Alíquota {estado}: {pct.toFixed(3)}%
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={limpar}
          className="h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
        >
          Limpar
        </button>
        <button
          onClick={copiar}
          className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Copiar Resultado
        </button>
      </div>
    </div>
  );
}

// Calcula Páscoa (algoritmo de Meeus/Jones/Butcher) para feriados móveis
function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBRHolidays(year: number): Set<string> {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const easter = easterDate(year);
  const carnavalSeg = new Date(easter);
  carnavalSeg.setDate(easter.getDate() - 48);
  const carnavalTer = new Date(easter);
  carnavalTer.setDate(easter.getDate() - 47);
  const sextaSanta = new Date(easter);
  sextaSanta.setDate(easter.getDate() - 2);
  const corpus = new Date(easter);
  corpus.setDate(easter.getDate() + 60);

  const fixos = [
    `${year}-01-01`, // Confraternização
    `${year}-01-25`, // Aniversário de São Paulo (SP)
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Trabalho
    `${year}-07-09`, // Revolução Constitucionalista (SP)
    `${year}-09-07`, // Independência
    `${year}-10-12`, // N. Sra. Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra
    `${year}-12-25`, // Natal
  ];
  return new Set([...fixos, fmt(carnavalSeg), fmt(carnavalTer), fmt(sextaSanta), fmt(corpus)]);
}

function BusinessDaysCalculator() {
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState('');

  const result = useMemo(() => {
    if (!startDate || !days) return null;
    const n = parseInt(days);
    if (!n || n < 1) return null;
    const [y, m, d] = startDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    const current = new Date(y, m - 1, d);
    const holidaysCache: Record<number, Set<string>> = {};
    const getHol = (yr: number) => holidaysCache[yr] || (holidaysCache[yr] = getBRHolidays(yr));
    let counted = 0;
    while (counted < n) {
      current.setDate(current.getDate() + 1);
      const dow = current.getDay();
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      if (dow !== 0 && dow !== 6 && !getHol(current.getFullYear()).has(key)) {
        counted++;
      }
    }
    return current;
  }, [startDate, days]);

  const formatted = result
    ? result.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  const limpar = () => {
    setStartDate('');
    setDays('');
  };
  const copiar = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(`Data prevista: ${formatted}`);
      } catch {}
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Data inicial</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Quantidade de dias úteis</Label>
        <Input
          type="number"
          min="1"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Desconsidera sábados, domingos e feriados nacionais brasileiros
        </p>
        <p className="text-2xl font-bold text-primary">{formatted}</p>
        {result && (
          <p className="text-xs text-muted-foreground">
            {days} dia(s) útil(eis) após{' '}
            {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={limpar}
          className="h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
        >
          Limpar
        </button>
        <button
          onClick={copiar}
          className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Copiar Resultado
        </button>
      </div>
    </div>
  );
}

function MLCalculator() {
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');

  const p = parseFloat(price.replace(',', '.')) || 0;
  const q = parseInt(qty) || 0;
  const sale = price === '' ? 0 : (p * q + 50) * 1.23;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Valor de venda no balcão (R$)</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0,00"
        />
      </div>
      <div className="space-y-2">
        <Label>Quantidade de itens</Label>
        <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Fórmula: (Venda Balcão × Qtd + 50) + 23%</p>
        <p className="text-2xl font-bold text-primary">{formatBRL(sale)}</p>
        <p className="text-sm font-medium text-foreground">Valor de venda no Mercado Livre</p>
      </div>
    </div>
  );
}

interface FreightResult {
  city: string | null;
  state: string | null;
  carrier: string;
  price: string;
  deadline: string;
  notes?: string;
  distanceKm?: number;
  resolvedAddress?: string;
  options?: Array<{ carrier: string; price: string; deadline: string; notes?: string }>;
}

function FreightCalculator() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreightResult | null>(null);

  const calcular = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await freightCalcApi({
        address: address.trim(),
      });

      setResult(data as FreightResult);
    } catch (e: any) {
      setError(e?.message || 'Erro ao calcular o frete');
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setAddress('');
    setResult(null);
    setError(null);
  };

  const copiar = async () => {
    if (!result) return;
    const lines = [
      `Cidade: ${result.city ?? '—'}${result.state ? ' / ' + result.state : ''}`,
      `Transportador: ${result.carrier}`,
      `Valor: ${result.price}`,
      `Prazo: ${result.deadline}`,
      result.notes ? `Obs.: ${result.notes}` : '',
    ].filter(Boolean);
    if (result.options?.length) {
      lines.push('Opções:');
      result.options.forEach((o) => {
        lines.push(
          `- ${o.carrier}: ${o.price} — ${o.deadline}${o.notes ? ' (' + o.notes + ')' : ''}`
        );
      });
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Endereço do cliente</Label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, número, bairro, cidade"
          onKeyDown={(e) => {
            if (e.key === 'Enter') calcular();
          }}
        />
        <p className="text-xs text-muted-foreground">
          Origem fixa: Av. das Rosas, 111 — Jardim Motorama, SJC
        </p>
      </div>

      <button
        onClick={calcular}
        disabled={loading || !address.trim()}
        className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
        {loading ? 'Calculando...' : 'Calcular Frete'}
      </button>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          {result.resolvedAddress && (
            <p className="text-xs text-muted-foreground">{result.resolvedAddress}</p>
          )}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor do frete</p>
            <p className="text-2xl font-bold text-primary">{result.price}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Quem realiza: </span>
              <span className="font-medium text-foreground">{result.carrier}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Prazo: </span>
              <span className="font-medium text-foreground">{result.deadline}</span>
            </div>
            {result.distanceKm !== undefined && (
              <div>
                <span className="text-muted-foreground">Distância (ida + volta): </span>
                <span className="font-medium text-foreground">
                  {result.distanceKm.toFixed(2)} km
                </span>
              </div>
            )}
            {result.notes && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                {result.notes}
              </div>
            )}
          </div>
          {result.options && result.options.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Opções disponíveis
              </p>
              {result.options.map((o, i) => (
                <div key={i} className="rounded-md border bg-background p-2 text-sm">
                  <p className="font-medium text-foreground">
                    {o.carrier} — {o.price}
                  </p>
                  <p className="text-xs text-muted-foreground">{o.deadline}</p>
                  {o.notes && <p className="text-xs text-muted-foreground italic">{o.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={limpar}
          className="h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
        >
          Limpar
        </button>
        <button
          onClick={copiar}
          disabled={!result}
          className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Copiar Resultado
        </button>
      </div>
    </div>
  );
}

interface Props {
  triggerClassName?: string;
  trigger?: React.ReactNode;
}

const SalesCalculatorDialog = ({ triggerClassName, trigger }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            className={cn(
              'jf-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              triggerClassName
            )}
          >
            <JapanFlowIcon name="calculadora-de-vendas" className="h-[18px] w-[18px]" />
            Calculadora de Vendas
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <JapanFlowIcon name="calculadora-de-vendas" className="h-5 w-5 text-primary" />
            Calculadora de Vendas
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="sjc" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="sjc">SJC</TabsTrigger>
            <TabsTrigger value="sp">SP</TabsTrigger>
            <TabsTrigger value="ml">ML</TabsTrigger>
            <TabsTrigger value="difal">DIFAL</TabsTrigger>
            <TabsTrigger value="dias">Dias Úteis</TabsTrigger>
            <TabsTrigger value="frete">Fretes</TabsTrigger>
          </TabsList>
          <TabsContent value="sjc" className="mt-4">
            <SJCCalculator />
          </TabsContent>
          <TabsContent value="sp" className="mt-4">
            <SPCalculator />
          </TabsContent>
          <TabsContent value="ml" className="mt-4">
            <MLCalculator />
          </TabsContent>
          <TabsContent value="difal" className="mt-4">
            <DIFALCalculator />
          </TabsContent>
          <TabsContent value="dias" className="mt-4">
            <BusinessDaysCalculator />
          </TabsContent>
          <TabsContent value="frete" className="mt-4">
            <FreightCalculator />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SalesCalculatorDialog;
