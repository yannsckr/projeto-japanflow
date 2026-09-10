// src/lib/signedUrl.ts
// Compatibilidade entre URLs antigas (Supabase/Firebase) e novos arquivos no R2.
import { API_BASE_URL, storageFileUrl } from '@/lib/api';

const BUCKET_DEFAULT = 'attachments';

export function pathFromPublicUrl(publicUrl: string, bucket = BUCKET_DEFAULT): string | null {
  if (!publicUrl) return null;

  // Novas URLs servidas pelo JapanFlow Worker/R2.
  try {
    const url = new URL(publicUrl);
    const workerBase = new URL(API_BASE_URL);

    if (url.origin === workerBase.origin && url.pathname.startsWith('/storage/file/')) {
      return decodeURIComponent(url.pathname.slice('/storage/file/'.length));
    }
  } catch {
    // Pode ser um path interno.
  }

  // URLs antigas do Supabase.
  const supabaseMarker = `/storage/v1/object/public/${bucket}/`;
  const supabaseIdx = publicUrl.indexOf(supabaseMarker);
  if (supabaseIdx !== -1) {
    return decodeURIComponent(publicUrl.slice(supabaseIdx + supabaseMarker.length).split('?')[0]);
  }

  // URLs antigas do Firebase Storage.
  try {
    const url = new URL(publicUrl);
    const marker = '/o/';
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }
  } catch {
    // Não é URL válida.
  }

  return null;
}

export async function getSignedUrl(
  pathOrPublicUrl: string,
  bucket = BUCKET_DEFAULT,
  _ttl = 60 * 60
): Promise<string> {
  if (!pathOrPublicUrl) return pathOrPublicUrl;

  // URLs antigas continuam intactas até a migração histórica.
  if (/^https?:\/\//i.test(pathOrPublicUrl)) {
    try {
      const url = new URL(pathOrPublicUrl);
      const workerBase = new URL(API_BASE_URL);

      if (url.origin === workerBase.origin && url.pathname.startsWith('/storage/file/')) {
        return pathOrPublicUrl;
      }
    } catch {
      return pathOrPublicUrl;
    }

    return pathOrPublicUrl;
  }

  const path = pathOrPublicUrl.replace(/^\/+/, '');

  // Evita transformar paths de buckets legados diferentes.
  if (!path.startsWith(`${bucket}/`) && bucket === BUCKET_DEFAULT) {
    return storageFileUrl(path.startsWith('attachments/') ? path : `attachments/${path}`);
  }

  return storageFileUrl(path);
}