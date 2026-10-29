import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { Download, FileText, Film, Image as ImageIcon, Paperclip } from 'lucide-react';

import { storage } from '@/lib/firebase';
import { getSignedUrl, pathFromPublicUrl } from '@/lib/signedUrl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import WarrantyImageZoom from '@/components/WarrantyImageZoom';

type Props = {
  source: string;
  name: string;
  mimeType?: string;
  variant?: 'row' | 'thumbnail';
};

const MAX_BYTES = 25 * 1024 * 1024;

const SAFE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function inferMime(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();

  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };

  return types[extension || ''] || '';
}

function inferSourceMime(source: string): string {
  const path = pathFromPublicUrl(source) || source;
  const cleanPath = path.split('?')[0].split('#')[0];

  return inferMime(cleanPath);
}

async function detectBlobMime(blob: Blob): Promise<string> {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';

  const header = String.fromCharCode(...b);

  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';

  if (header.startsWith('GIF8')) return 'image/gif';
  if (header.startsWith('%PDF-')) return 'application/pdf';

  return '';
}

function safeMime(...types: string[]): string {
  return types.find((type) => SAFE_MIMES.has(type)) || 'application/octet-stream';
}

function fileKind(type: string) {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('video/')) return 'video';
  return 'other';
}

export default function WarrantyAttachmentViewer({
  source,
  name,
  mimeType = '',
  variant = 'row',
}: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [type, setType] = useState(safeMime(mimeType, inferMime(name), inferSourceMime(source)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  const shouldLoad = open || variant === 'thumbnail';

  useEffect(() => {
    if (!shouldLoad || !source) return;

    let active = true;
    let ownedUrl = '';

    setLoading(true);
    setError(false);
    setUrl('');
    setPreviewFailed(false);

    async function load() {
      const path = source.startsWith('attachments/') ? source : pathFromPublicUrl(source);

      // Preserva a validação dos anexos enviados pelo site.
      if (
        path?.startsWith('attachments/warranties/site/') &&
        !/^attachments\/warranties\/site\/[a-f0-9-]{36}\/[a-f0-9]{64}\/[0-4]$/.test(path)
      ) {
        throw new Error('Caminho de anexo inválido');
      }

      if (path?.startsWith('attachments/')) {
        try {
          const original = await getBlob(ref(storage, path), MAX_BYTES);

          if (!active) return;

          const detectedType = await detectBlobMime(original);

          if (!active) return;

          const finalType = safeMime(
            detectedType,
            original.type,
            mimeType,
            inferMime(name),
            inferSourceMime(source)
          );

          const typedBlob = new Blob([original], {
            type: finalType,
          });

          ownedUrl = URL.createObjectURL(typedBlob);

          setType(finalType);
          setUrl(ownedUrl);
          return;
        } catch (err) {
          // Arquivos privados do site não podem cair
          // em um link público alternativo.
          if (path.startsWith('attachments/warranties/site/')) {
            throw err;
          }

          // Mantém compatibilidade com links antigos.
          if (!/^https:\/\//i.test(source)) throw err;
        }
      }

      if (!/^https:\/\//i.test(source)) {
        throw new Error('Origem do anexo não suportada');
      }

      const legacyUrl = await getSignedUrl(source);

      if (!active) return;

      if (!legacyUrl.startsWith('blob:') && !/^https:\/\//i.test(legacyUrl)) {
        throw new Error('Endereço do anexo inválido');
      }

      setType(safeMime(mimeType, inferMime(name), inferSourceMime(source)));
      setUrl(legacyUrl);
    }

    load()
      .catch((err) => {
        if (active) {
          console.error('[Garantias] Anexo indisponível:', err);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;

      // Revoga apenas URLs criadas por este componente.
      // Não revoga URLs compartilhadas pelo SignedLink.
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [source, name, mimeType, shouldLoad, retry]);

  const kind = fileKind(type);
  const previewKind = variant === 'thumbnail' && kind === 'other' ? 'image' : kind;
  const initialKind = fileKind(safeMime(mimeType, inferMime(name)));

  const Icon =
    initialKind === 'image'
      ? ImageIcon
      : initialKind === 'pdf'
        ? FileText
        : initialKind === 'video'
          ? Film
          : Paperclip;

  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  const extension = extensions[type];

  const downloadName = extension && !/\.[a-z0-9]{2,5}$/i.test(name) ? `${name}.${extension}` : name;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'thumbnail'
            ? 'group flex h-28 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-muted/30 hover:bg-muted/60'
            : 'flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted/50'
        }
        title={'Visualizar ' + name}
      >
        {variant === 'thumbnail' && previewKind === 'image' && url && !previewFailed ? (
          <img
            src={url}
            alt={name}
            className="h-20 w-full object-contain"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}

        <span className="min-w-0 truncate text-xs" title={name}>
          {name}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-[1400px] max-h-[94dvh]">
          <DialogHeader>
            <DialogTitle className="break-words pr-6">{name}</DialogTitle>
          </DialogHeader>

          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando anexo...
            </p>
          )}

          {error && (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar este anexo.
              </p>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && url && (
            <div className="space-y-4">
              <div className="min-h-40 w-full overflow-hidden rounded-lg bg-muted/40">
                {previewKind === 'image' && !previewFailed ? (
                  <WarrantyImageZoom src={url} alt={name} onError={() => setPreviewFailed(true)} />
                ) : kind === 'pdf' ? (
                  <iframe
                    src={url}
                    title={'PDF: ' + name}
                    className="h-[65vh] w-full rounded-lg border-0"
                  />
                ) : kind === 'video' ? (
                  <video
                    src={url}
                    controls
                    preload="metadata"
                    className="max-h-[65vh] max-w-full"
                  />
                ) : (
                  <p className="p-5 text-center text-sm text-muted-foreground">
                    Prévia indisponível para este formato. Utilize a opção de baixar ou abrir o
                    arquivo.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <a
                  href={url}
                  download={downloadName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50"
                >
                  <Download className="h-4 w-4" />
                  Baixar / abrir arquivo
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
