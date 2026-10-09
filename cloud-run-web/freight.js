const ORIGIN_ADDRESS =
  'Avenida das Rosas, 111, Jardim Motorama, São José dos Campos, SP, 12224-000';
const ALIASES = {
  'ilha bela': 'ilhabela',
  'sao bernardo': 'sao bernardo do campo',
};
const STATE_NAMES = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};
const USER_AGENT = 'JapanFlow/1.0 (freight-service)';
const normalizeCity = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const pickAddressPart = (address, keys) => {
  for (const key of keys) {
    const value = address?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};
function parseCityStateFromInput(address) {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { city: null, state: null };
  const rawState = parts.at(-1).toUpperCase();
  return {
    city: parts.at(-2) || null,
    state: STATE_NAMES[rawState] || parts.at(-1),
  };
}
async function fetchJson(url, timeoutMs = 12000) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Serviço de mapas HTTP ${response.status}`);
  return response.json();
}
function geoPoint(data, fallback, city = null, state = null) {
  if (!Array.isArray(data) || !data.length) return null;
  const result = data[0];
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = result.address || {};
  return {
    city:
      pickAddressPart(address, [
        'city',
        'municipality',
        'town',
        'village',
        'county',
        'city_district',
      ]) || city,
    state: pickAddressPart(address, ['state', 'region']) || state,
    formatted: String(result.display_name || fallback),
    lat: latitude,
    lon: longitude,
  };
}
async function searchFreeText(value) {
  const params = new URLSearchParams({
    q: value,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'br',
  });
  const data = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`);
  return geoPoint(data, value);
}
async function searchStructured(city, state) {
  const params = new URLSearchParams({
    city,
    country: 'Brasil',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'br',
  });
  if (state) params.set('state', state);
  const data = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`);
  return geoPoint(data, `${city}, ${state || ''}, Brasil`, city, state);
}
async function geocode(address) {
  const parsed = parseCityStateFromInput(address);
  const stateName = parsed.state && (STATE_NAMES[parsed.state.toUpperCase()] || parsed.state);
  const candidates = [
    address.trim(),
    `${address.trim()}, Brasil`,
    parsed.city && stateName ? `${parsed.city}, ${stateName}, Brasil` : '',
    parsed.city ? `${parsed.city}, Brasil` : '',
  ].filter(Boolean);
  for (const candidate of new Set(candidates)) {
    try {
      const found = await searchFreeText(candidate);
      if (found) {
        found.city ||= parsed.city;
        found.state ||= stateName;
        return found;
      }
    } catch (error) {
      console.warn('freight geocode free-text:', error.message);
    }
  }
  if (parsed.city) {
    try {
      return await searchStructured(parsed.city, stateName);
    } catch (error) {
      console.warn('freight geocode structured:', error.message);
    }
  }
  return null;
}
async function routeDistanceKm(from, to) {
  const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const data = await fetchJson(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`
  );
  const meters = Number(data?.routes?.[0]?.distance);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new Error('Sem rota disponível');
  }
  return meters / 1000;
}
let originGeoCache = null;
async function getOriginGeo() {
  if (originGeoCache) return originGeoCache;
  const result = await geocode(ORIGIN_ADDRESS);
  if (!result) throw new Error('Não foi possível localizar o endereço de origem');
  originGeoCache = result;
  return result;
}
async function computeRoundTripKm(destination) {
  const origin = await getOriginGeo();
  const oneWayKm = await routeDistanceKm(origin, destination);
  return oneWayKm * 2;
}
async function getFreightDestination(db, city) {
  const slug = ALIASES[normalizeCity(city)] || normalizeCity(city);
  if (!slug) return null;
  const documentId = slug.replace(/\s+/g, '-');
  const snapshot = await db.collection('freight_destinations').doc(documentId).get();
  return snapshot.exists ? snapshot.data() : null;
}
const unserved = {
  carrier: 'Transportadora',
  price: '—',
  deadline: '—',
  notes: 'Cidade não atendida por entrega expressa. Consultar fretes disponíveis no site.',
};
export async function handleFreightCalc(body, db) {
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  if (address.length < 5 || address.length > 500) {
    return { status: 400, body: { error: 'Endereço inválido' } };
  }
  try {
    const parsed = parseCityStateFromInput(address);
    const geo = await geocode(address);
    if (!geo) {
      if (!parsed.city) {
        return {
          status: 404,
          body: { error: 'Não foi possível identificar a cidade do endereço' },
        };
      }
      const destination = await getFreightDestination(db, parsed.city);
      if (!destination) {
        return {
          status: 200,
          body: {
            city: parsed.city,
            state: parsed.state,
            ...unserved,
            resolvedAddress: address,
            provider: 'input-fallback',
          },
        };
      }
      if (destination.per_km_rate != null) {
        return {
          status: 502,
          body: {
            error:
              'A cidade foi identificada, mas não foi possível calcular a distância para o frete por km.',
            city: parsed.city,
            state: parsed.state,
          },
        };
      }
      return {
        status: 200,
        body: {
          city: parsed.city,
          state: parsed.state,
          carrier: destination.carrier || '',
          price: destination.price || '',
          deadline: destination.deadline || '',
          notes: destination.notes || undefined,
          resolvedAddress: address,
          provider: 'input-fallback',
        },
      };
    }
    const city = geo.city || parsed.city;
    const state = geo.state || parsed.state;
    const destination = await getFreightDestination(db, city);
    let result = { city, state };
    if (!destination) {
      result = { ...result, ...unserved };
    } else if (destination.per_km_rate != null) {
      const km = await computeRoundTripKm(geo);
      const rate = Number(destination.per_km_rate);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error('Taxa por km inválida no Firestore');
      }
      const price = Math.ceil(km * rate);
      result = {
        ...result,
        carrier: destination.carrier || 'Motoboy particular Japan Imports',
        price: `R$ ${price.toFixed(2).replace('.', ',')}`,
        deadline: destination.deadline || 'Mesmo dia (sujeito à disponibilidade)',
        notes:
          `${destination.notes ? `${destination.notes}. ` : ''}` +
          `Distância estimada: ${km.toFixed(2)} km (ida + volta), taxa R$ ${rate.toFixed(2).replace('.', ',')} / km`,
        distanceKm: Math.round(km * 100) / 100,
      };
    } else {
      result = {
        ...result,
        carrier: destination.carrier || '',
        price: destination.price || '',
        deadline: destination.deadline || '',
        notes: destination.notes || undefined,
      };
    }
    return {
      status: 200,
      body: {
        ...result,
        resolvedAddress: geo.formatted,
        provider: 'openstreetmap-osrm',
      },
    };
  } catch (error) {
    console.error('freight-calc', error);
    return {
      status: 502,
      body: { error: 'Não foi possível calcular o frete. Tente novamente.' },
    };
  }
}
