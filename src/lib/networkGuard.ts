// Restringe acesso à rede da empresa (IP público liberado).
// Admins podem acessar de qualquer lugar.

export const COMPANY_ALLOWED_IPS = ['187.90.96.37'];

let cachedIp: string | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

export async function getClientPublicIp(): Promise<string | null> {
  const now = Date.now();
  if (cachedIp && now - cachedAt < CACHE_MS) return cachedIp;

  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://ipv4.icanhazip.com',
    'https://api64.ipify.org?format=json',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      let ip: string | null = null;
      if (ct.includes('json')) {
        const data = await res.json();
        ip = data.ip || null;
      } else {
        ip = (await res.text()).trim();
      }
      if (ip) {
        cachedIp = ip;
        cachedAt = now;
        return ip;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function isIpAllowed(ip: string | null): boolean {
  if (!ip) return false;
  return COMPANY_ALLOWED_IPS.includes(ip.trim());
}
