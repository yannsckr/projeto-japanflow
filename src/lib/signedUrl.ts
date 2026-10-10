import { getBlob, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { API_BASE_URL } from '@/lib/api';

const BUCKET_DEFAULT = 'attachments';
const cachedUrls = new Map<string, string>();
const pendingUrls = new Map<string, Promise<string>>();

function normalizePath(value: string): string | null {
  const path = value.replace(/^\/+/, '');
  if (!path.startsWith('attachments/')) return null;
  if (path.includes('\0') || path.split('/').includes('..')) return null;
  return path;
}

function workerPath(value: string): string | null {
  try {
    const url = new URL(value);
    const worker = new URL(API_BASE_URL);
    if (url.origin !== worker.origin || !url.pathname.startsWith('/storage/file/')) {
      return null;
    }

    const encoded = url.pathname.slice('/storage/file/'.length);
    return normalizePath(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

export function pathFromPublicUrl(publicUrl: string, bucket = BUCKET_DEFAULT): string | null {
  if (!publicUrl) return null;

  const legacyPath = workerPath(publicUrl);
  if (legacyPath) return legacyPath;

  const supabaseMarker = `/storage/v1/object/public/${bucket}/`;
  const supabaseIndex = publicUrl.indexOf(supabaseMarker);

  if (supabaseIndex !== -1) {
    return decodeURIComponent(publicUrl.slice(supabaseIndex + supabaseMarker.length).split('?')[0]);
  }

  try {
    const url = new URL(publicUrl);
    const isFirebaseHost =
      url.hostname === 'firebasestorage.googleapis.com' ||
      url.hostname === 'storage.googleapis.com';

    if (isFirebaseHost) {
      const index = url.pathname.indexOf('/o/');
      if (index !== -1) {
        return decodeURIComponent(url.pathname.slice(index + 3));
      }
    }
  } catch {
    const path = normalizePath(publicUrl);
    if (path) return path;
  }

  return null;
}

async function authenticatedFileUrl(path: string): Promise<string> {
  const cached = cachedUrls.get(path);
  if (cached) return cached;

  const pending = pendingUrls.get(path);
  if (pending) return pending;

  const operation = (async () => {
    const blob = await getBlob(ref(storage, path));
    const objectUrl = URL.createObjectURL(blob);
    cachedUrls.set(path, objectUrl);
    return objectUrl;
  })();

  pendingUrls.set(path, operation);

  try {
    return await operation;
  } finally {
    pendingUrls.delete(path);
  }
}

export async function getSignedUrl(
  pathOrPublicUrl: string,
  bucket = BUCKET_DEFAULT,
  _ttl = 60 * 60
): Promise<string> {
  if (!pathOrPublicUrl) return pathOrPublicUrl;

  const isHttp = /^https?:\/\//i.test(pathOrPublicUrl);
  const legacyPath = isHttp ? workerPath(pathOrPublicUrl) : null;

  if (isHttp && !legacyPath) {
    return pathOrPublicUrl;
  }

  const rawPath = legacyPath || pathOrPublicUrl.replace(/^\/+/, '');
  const path = normalizePath(rawPath.startsWith(`${bucket}/`) ? rawPath : `${bucket}/${rawPath}`);

  if (!path) return pathOrPublicUrl;

  try {
    return await authenticatedFileUrl(path);
  } catch (error) {
    console.warn('[signedUrl] Firebase Storage indisponível:', path, error);
    return isHttp
      ? pathOrPublicUrl
      : `${API_BASE_URL}/storage/file/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
}
