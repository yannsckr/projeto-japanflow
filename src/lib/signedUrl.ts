// src/lib/signedUrl.ts
// Helper para gerar/cachear signed URLs do Storage (mais seguro que URL pública).
// Cache em memória; expira automaticamente conforme TTL.
import { supabase } from '@/integrations/supabase/client';

const BUCKET_DEFAULT = 'attachments';
const TTL_SECONDS = 60 * 60; // 1h
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Recebe URL pública do Supabase e devolve o path interno do bucket. */
export function pathFromPublicUrl(publicUrl: string, bucket = BUCKET_DEFAULT): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
}

export async function getSignedUrl(
  pathOrPublicUrl: string,
  bucket = BUCKET_DEFAULT,
  ttl = TTL_SECONDS
): Promise<string> {
  if (!pathOrPublicUrl) return pathOrPublicUrl;
  // se já for path, usa direto; se for URL pública, extrai o path
  const path = pathOrPublicUrl.startsWith('http')
    ? pathFromPublicUrl(pathOrPublicUrl, bucket)
    : pathOrPublicUrl;
  if (!path) return pathOrPublicUrl; // não é do bucket, devolve original
  const key = `${bucket}:${path}`;
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) return pathOrPublicUrl; // fallback graceful
  cache.set(key, { url: data.signedUrl, expiresAt: now + ttl * 1000 });
  return data.signedUrl;
}
