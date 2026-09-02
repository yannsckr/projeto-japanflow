// Edge function: cálculo de frete expresso via Google Maps
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ORIGIN_ADDRESS =
  'Avenida das Rosas, 111, Jardim Motorama, São José dos Campos, SP, 12224-000';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Aliases: se o Google devolver um nome levemente diferente do slug cadastrado
const ALIASES: Record<string, string> = {
  'ilha bela': 'ilhabela',
  'sao bernardo': 'sao bernardo do campo',
};

type Result = {
  city: string | null;
  state: string | null;
  carrier: string;
  price: string;
  deadline: string;
  notes?: string;
  distanceKm?: number;
};

async function geocode(address: string) {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY!,
    },
  });
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.results?.length) return null;
  const r = data.results[0];
  const comp = r.address_components as Array<{ long_name: string; types: string[] }>;
  const findComp = (t: string) => comp.find((c) => c.types.includes(t))?.long_name ?? null;
  return {
    city:
      findComp('administrative_area_level_2') ||
      findComp('locality') ||
      findComp('sublocality') ||
      null,
    state: findComp('administrative_area_level_1'),
    formatted: r.formatted_address as string,
  };
}

async function computeRoundTripKm(destination: string): Promise<number> {
  const body = {
    origin: { address: ORIGIN_ADDRESS },
    destination: { address: ORIGIN_ADDRESS },
    intermediates: [{ address: destination }],
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };
  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY!,
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Routes HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const meters = data.routes?.[0]?.distanceMeters;
  if (!meters) throw new Error('Sem rota disponível');
  return meters / 1000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error('Credenciais do Google Maps não configuradas');
    }
    const { address } = await req.json();
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Endereço inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geo = await geocode(address);
    if (!geo) {
      return new Response(JSON.stringify({ error: 'Endereço não encontrado no Google Maps' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rawSlug = normalize(geo.city || '');
    const slug = ALIASES[rawSlug] || rawSlug;

    const { data: dest } = await supa
      .from('freight_destinations')
      .select('*')
      .eq('city_slug', slug)
      .maybeSingle();

    let result: Result = {
      city: geo.city,
      state: geo.state,
      carrier: '',
      price: '',
      deadline: '',
    };

    if (!dest) {
      result = {
        ...result,
        carrier: 'Transportadora',
        price: '—',
        deadline: '—',
        notes:
          'Cidade não atendida por entrega expressa. Consultar fretes disponíveis no nosso site de vendas.',
      };
    } else if (dest.per_km_rate != null) {
      // Cálculo por km (motoboy próximo)
      const km = await computeRoundTripKm(geo.formatted);
      const rate = Number(dest.per_km_rate);
      const price = Math.ceil(km * rate);
      result = {
        ...result,
        carrier: dest.carrier || 'Motoboy particular Japan Imports',
        price: `R$ ${price.toFixed(2).replace('.', ',')}`,
        deadline: dest.deadline || 'Mesmo dia (sujeito à disponibilidade)',
        notes:
          (dest.notes ? `${dest.notes}. ` : '') +
          `Distância: ${km.toFixed(2)} km (ida + volta), taxa R$ ${rate.toFixed(2).replace('.', ',')} / km`,
        distanceKm: Math.round(km * 100) / 100,
      };
    } else {
      result = {
        ...result,
        carrier: dest.carrier,
        price: dest.price,
        deadline: dest.deadline,
        notes: dest.notes || undefined,
      };
    }

    return new Response(JSON.stringify({ ...result, resolvedAddress: geo.formatted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('freight-calc error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
