// src/lib/signedUrl.ts
// Compatibilidade com a API antiga de signed URL.
// No Firebase Storage, o download URL já contém um token de acesso e não expira por TTL do cliente.
import { getDownloadURL, getStorage, ref } from 'firebase/storage';

const BUCKET_DEFAULT = 'attachments';
const TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expiresAt: number }>();

export function pathFromPublicUrl(
  publicUrl: string,
  bucket = BUCKET_DEFAULT
): string | null {
  if (!publicUrl) return null;

  // URLs antigas do Supabase.
  const supabaseMarker = `/storage/v1/object/public/${bucket}/`;
  const supabaseIdx = publicUrl.indexOf(supabaseMarker);
  if (supabaseIdx !== -1) {
    return decodeURIComponent(
      publicUrl.slice(supabaseIdx + supabaseMarker.length).split('?')[0]
    );
  }

  // Firebase Storage:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/attachments%2Farquivo.pdf?...
  try {
    const url = new URL(publicUrl);
    const marker = '/o/';
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }
  } catch {
    // Não é URL válida; pode já ser um path interno.
  }

  return null;
}

export async function getSignedUrl(
  pathOrPublicUrl: string,
  bucket = BUCKET_DEFAULT,
  ttl = TTL_SECONDS
): Promise<string> {
  if (!pathOrPublicUrl) return pathOrPublicUrl;

  // URLs HTTP que não são reconhecidas como Storage permanecem intactas.
  const path = pathOrPublicUrl.startsWith('http')
    ? pathFromPublicUrl(pathOrPublicUrl, bucket)
    : pathOrPublicUrl;

  if (!path) return pathOrPublicUrl;

  const key = `${bucket}:${path}`;
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now + 30_000) {
    return cached.url;
  }

  try {
    const storage = getStorage();
    const url = await getDownloadURL(ref(storage, path));
    cache.set(key, {
      url,
      expiresAt: now + ttl * 1000,
    });
    return url;
  } catch (error) {
    console.warn('Não foi possível gerar URL do Firebase Storage:', error);
    return pathOrPublicUrl;
  }
}
