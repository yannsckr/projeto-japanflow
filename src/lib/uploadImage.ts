import { storage } from '@/lib/firebase';
import { compressImage } from '@/lib/compressImage';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ROOT_FOLDER = 'attachments';

export interface UploadImageOptions {
  /** Caminho relativo dentro de "attachments". Se omitido, usa "uploads/<timestamp>-<rnd>". */
  pathPrefix?: string;

  /** Coleção/tabela de origem (ex.: 'tasks', 'receipts'). */
  sourceTable?: string;

  /** ID do registro de origem, se já conhecido no momento do upload. */
  sourceId?: string | null;

  /** Campo do registro onde a URL é gravada (ex.: 'image_url', 'photo_url'). */
  sourceField?: string;

  /** ID do usuário que enviou. */
  uploadedBy?: string | null;

  /** Marca como preservado (nunca expira). */
  preserve?: boolean;
}

export interface UploadImageResult {
  publicUrl: string;
  storagePath: string;
  isImage: boolean;
}

/**
 * Helper único de upload para o Firebase Storage.
 *
 * - Faz upload e retorna a URL de download.
 * - Para imagens, tenta chamar em background a Cloud Function "processImage".
 * - A Cloud Function precisa ser criada no Firebase antes de remover
 *   definitivamente a antiga Edge Function do Supabase.
 */
export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<UploadImageResult> {
  // Comprime imagens no cliente (WebP, max 1600px, q=0.75, remove EXIF).
  // Não-imagens passam direto.
  const toUpload = file.type.startsWith('image/')
    ? await compressImage(file)
    : file;

  const ext = (toUpload.name.split('.').pop() || 'bin').toLowerCase();
  const rnd = Math.random().toString(36).slice(2);

  const relativePath = opts.pathPrefix
    ? `${opts.pathPrefix.replace(/\/+$/, '')}/${Date.now()}-${rnd}.${ext}`
    : `uploads/${Date.now()}-${rnd}.${ext}`;

  const storagePath = `${ROOT_FOLDER}/${relativePath}`;
  const mime = toUpload.type || 'application/octet-stream';

  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, toUpload, {
    contentType: mime,
    customMetadata: {
      sourceTable: opts.sourceTable ?? '',
      sourceId: opts.sourceId ?? '',
      sourceField: opts.sourceField ?? '',
      uploadedBy: opts.uploadedBy ?? '',
      preserve: opts.preserve ? 'true' : 'false',
    },
  });

  const publicUrl = await getDownloadURL(storageRef);
  const isImage = mime.startsWith('image/');

  if (isImage) {
    // Fire-and-forget: o upload principal não depende do processamento secundário.
    try {
      const functions = getFunctions();
      const processImage = httpsCallable(functions, 'processImage');

      processImage({
        storagePath,
        mimeType: mime,
        sizeBytes: toUpload.size,
        sourceTable: opts.sourceTable ?? null,
        sourceId: opts.sourceId ?? null,
        sourceField: opts.sourceField ?? null,
        uploadedBy: opts.uploadedBy ?? null,
        preserve: !!opts.preserve,
      }).catch((err) => {
        console.warn('[uploadImage] processImage failed:', err);
      });
    } catch (err) {
      console.warn('[uploadImage] processImage unavailable:', err);
    }
  }

  return {
    publicUrl,
    storagePath,
    isImage,
  };
}

/** Versão em lote, mesmas opções aplicadas a cada arquivo. */
export async function uploadImages(
  files: File[],
  opts: UploadImageOptions = {}
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    try {
      const result = await uploadImage(file, opts);
      urls.push(result.publicUrl);
    } catch (error) {
      console.error('[uploadImages] erro:', error);
    }
  }

  return urls;
}
