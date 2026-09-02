// Comprime imagens no cliente antes do upload:
// - Converte para WebP
// - Redimensiona para no máximo 1600px (lado maior)
// - Qualidade 75%
// - Remove EXIF (rasterizar via <canvas> descarta todos os metadados)
//
// Tipos não-imagem ou formatos não suportados (SVG, GIF animado, HEIC sem
// suporte do browser) retornam o arquivo original sem modificação.

const MAX_DIMENSION = 1600;
const QUALITY = 0.75;
const TARGET_MIME = 'image/webp';

const SKIP_MIMES = new Set(['image/svg+xml', 'image/gif', 'image/heic', 'image/heif']);

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mime?: string;
}

/**
 * Tenta comprimir o arquivo. Se algo der errado ou não compensar
 * (ex.: arquivo já é menor), retorna o arquivo original.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (SKIP_MIMES.has(file.type)) return file;

  const maxDim = opts.maxDimension ?? MAX_DIMENSION;
  const quality = opts.quality ?? QUALITY;
  const mime = opts.mime ?? TARGET_MIME;

  try {
    const img = await loadImage(file);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, dw, dh);

    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) return file;

    // Se a "compressão" aumentou o tamanho, mantém o original.
    if (blob.size >= file.size && file.type === mime) return file;

    const ext = mime === 'image/webp' ? 'webp' : mime.split('/')[1] || 'bin';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[compressImage] falhou, usando original:', err);
    return file;
  }
}
