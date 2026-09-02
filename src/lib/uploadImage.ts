import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/compressImage';

const BUCKET = 'attachments';

export interface UploadImageOptions {
  /** Caminho relativo no bucket (sem extensão). Se omitido, usa "uploads/<timestamp>-<rnd>". */
  pathPrefix?: string;
  /** Tabela de origem (ex.: 'tasks', 'receipts') — usada por image_assets. */
  sourceTable?: string;
  /** ID da linha de origem, se já conhecido no momento do upload. */
  sourceId?: string | null;
  /** Campo da tabela onde a URL é gravada (ex.: 'image_url', 'photo_url'). */
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
 * Helper único de upload para o bucket "attachments".
 * - Faz upload, retorna a URL pública (drop-in p/ código existente).
 * - Para imagens, dispara em background a edge function `process-image`,
 *   que cria o registro em `image_assets`, extrai texto (OCR/descrição)
 *   e gera miniatura ~300px.
 */
export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<UploadImageResult> {
  // Comprime imagens no cliente (WebP, max 1600px, q=0.75, remove EXIF).
  // Não-imagens passam direto.
  const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;

  const ext = (toUpload.name.split('.').pop() || 'bin').toLowerCase();
  const rnd = Math.random().toString(36).slice(2);
  const base = opts.pathPrefix
    ? `${opts.pathPrefix.replace(/\/+$/, '')}/${Date.now()}-${rnd}.${ext}`
    : `uploads/${Date.now()}-${rnd}.${ext}`;

  const mime = toUpload.type || 'application/octet-stream';
  const { error } = await supabase.storage.from(BUCKET).upload(base, toUpload, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(base);
  const publicUrl = pub.publicUrl;
  const isImage = mime.startsWith('image/');

  if (isImage) {
    // fire-and-forget — não bloqueia o fluxo principal
    supabase.functions
      .invoke('process-image', {
        body: {
          storagePath: base,
          mimeType: mime,
          sizeBytes: toUpload.size,
          sourceTable: opts.sourceTable ?? null,
          sourceId: opts.sourceId ?? null,
          sourceField: opts.sourceField ?? null,
          uploadedBy: opts.uploadedBy ?? null,
          preserve: !!opts.preserve,
        },
      })
      .catch((err) => console.warn('[uploadImage] process-image failed:', err));
  }

  return { publicUrl, storagePath: base, isImage };
}

/** Versão em lote, mesmas opções aplicadas a cada arquivo. */
export async function uploadImages(
  files: File[],
  opts: UploadImageOptions = {}
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    try {
      const r = await uploadImage(file, opts);
      urls.push(r.publicUrl);
    } catch (e) {
      console.error('[uploadImages] erro:', e);
    }
  }
  return urls;
}
