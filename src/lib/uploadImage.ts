import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { compressImage } from '@/lib/compressImage';
import { processImageApi, uploadStorageFileApi } from '@/lib/api';

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
 * Helper único de upload para Cloudflare R2 via JapanFlow Worker.
 *
 * - Imagens são comprimidas no cliente (WebP) antes do envio.
 * - Arquivos ficam no bucket privado R2 e são servidos pelo Worker.
 * - Registra image_assets no Firestore em best-effort.
 * - processImage é fire-and-forget e não bloqueia o upload principal.
 */
export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<UploadImageResult> {
  const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;

  const ext = (toUpload.name.split('.').pop() || 'bin').toLowerCase();
  const rnd = Math.random().toString(36).slice(2);

  const relativePath = opts.pathPrefix
    ? `${opts.pathPrefix.replace(/\/+$/, '')}/${Date.now()}-${rnd}.${ext}`
    : `uploads/${Date.now()}-${rnd}.${ext}`;

  const storagePath = `${ROOT_FOLDER}/${relativePath}`;
  const mime = toUpload.type || 'application/octet-stream';

  const uploaded = await uploadStorageFileApi(toUpload, {
    storagePath,
    sourceTable: opts.sourceTable ?? null,
    sourceId: opts.sourceId ?? null,
    sourceField: opts.sourceField ?? null,
    uploadedBy: opts.uploadedBy ?? null,
    preserve: !!opts.preserve,
  });

  const publicUrl = uploaded.publicUrl;
  const isImage = mime.startsWith('image/');

  // Registro de metadados no Firestore. Se as regras bloquearem, o arquivo
  // continua disponível no R2 e o upload principal não é perdido.
  try {
    await addDoc(collection(db, 'image_assets'), {
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mime,
      size_bytes: uploaded.sizeBytes ?? toUpload.size,
      source_table: opts.sourceTable ?? null,
      source_id: opts.sourceId ?? null,
      source_field: opts.sourceField ?? null,
      uploaded_by: opts.uploadedBy ?? null,
      preserve: !!opts.preserve,
      storage_provider: 'cloudflare-r2',
      processed_at: isImage ? Timestamp.now() : null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  } catch (error) {
    console.warn('[uploadImage] não foi possível registrar image_assets:', error);
  }

  if (isImage) {
    try {
      processImageApi({
        storagePath,
        mimeType: mime,
        sizeBytes: uploaded.sizeBytes ?? toUpload.size,
        sourceTable: opts.sourceTable ?? null,
        sourceId: opts.sourceId ?? null,
        sourceField: opts.sourceField ?? null,
        uploadedBy: opts.uploadedBy ?? null,
        preserve: !!opts.preserve,
      }).catch((error) => {
        console.warn('[uploadImage] processImage falhou:', error);
      });
    } catch (error) {
      console.warn('[uploadImage] processImage indisponível:', error);
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