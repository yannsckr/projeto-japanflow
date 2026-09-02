// Backfill: converte imagens antigas no bucket "attachments" para WebP (q=75, max 1600px),
// remove EXIF, atualiza public.image_assets e tenta atualizar a referência na tabela de origem.
//
// Body (JSON):
//   {
//     mode?: "assets" | "storage" | "paths"  // padrão: "assets"
//     batch?: number               // padrão: 8 (limite por chamada)
//     dryRun?: boolean             // padrão: false
//     paths?: string[]              // usado quando mode="paths"
//     inPlace?: boolean             // padrão false; true sobrescreve o mesmo caminho
//     updateAssetsRow?: boolean     // padrão true
//     skipIfLarger?: boolean        // padrão false
//     maxDimension?: number         // padrão 1600
//     quality?: number              // 0-1 ou 1-100; padrão 75
//   }
//
// mode "assets": percorre image_assets onde mime_type NÃO é image/webp e processed_at IS NOT NULL.
// mode "storage": lista o bucket recursivamente e processa arquivos de imagem não-webp;
//                 cria a linha em image_assets quando ausente.
//
// Para cada item:
//  1) Baixa o arquivo original.
//  2) Decodifica (JPEG/PNG), redimensiona p/ máx 1600px, encoda WebP q=75.
//  3) Faz upload do .webp em novo storage_path (mesmo prefixo).
//  4) Atualiza image_assets (storage_path, mime_type, size_bytes).
//  5) Se houver source_table/source_id/source_field, faz UPDATE substituindo a URL antiga
//     pela nova (somente colunas TEXT; JSONB é registrado como "skipped").
//  6) Apaga o arquivo antigo do bucket.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Carregamento sob demanda dos codecs (evita estouro de memória no boot).
// Sem `?bundle` para não inlinear o WASM como base64.
let _jpegDec: any = null;
let _pngDec: any = null;
let _webpEnc: any = null;
let _resize: any = null;

async function getJpegDecoder() {
  if (!_jpegDec) {
    const mod = await import('https://esm.sh/@jsquash/jpeg@1.5.0');
    _jpegDec = mod.decode;
  }
  return _jpegDec;
}
async function getPngDecoder() {
  if (!_pngDec) {
    const mod = await import('https://esm.sh/@jsquash/png@3.0.1');
    _pngDec = mod.decode;
  }
  return _pngDec;
}
async function getWebpEncoder() {
  if (!_webpEnc) {
    const mod = await import('https://esm.sh/@jsquash/webp@1.4.0');
    _webpEnc = mod.encode;
  }
  return _webpEnc;
}
async function getResize() {
  if (!_resize) {
    const mod = await import('https://esm.sh/@jsquash/resize@2.1.0');
    _resize = mod.default;
  }
  return _resize;
}

const BUCKET = 'attachments';
const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 75;

type ProcessResult = {
  storagePath: string;
  newPath?: string;
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  beforeBytes?: number;
  afterBytes?: number;
};

function isConvertibleImage(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return /image\/(jpeg|jpg|png)/i.test(mime);
}

function inferMime(path: string, mime: string | null | undefined): string {
  if (mime) return mime;
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  return 'image/jpeg';
}

function normalizeQuality(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_QUALITY;
  if (n <= 1) return Math.round(n * 100);
  return Math.min(100, Math.max(1, Math.round(n)));
}

function changeExt(path: string, ext: string): string {
  const i = path.lastIndexOf('.');
  if (i < 0) return `${path}.${ext}`;
  return `${path.slice(0, i)}.${ext}`;
}

async function decodeImage(bytes: Uint8Array, mime: string): Promise<ImageData> {
  if (/png/i.test(mime)) {
    const dec = await getPngDecoder();
    return await dec(bytes);
  }
  const dec = await getJpegDecoder();
  return await dec(bytes);
}

async function convertToWebp(
  bytes: Uint8Array,
  mime: string,
  maxDimension: number,
  quality: number
): Promise<Uint8Array> {
  let img: ImageData = await decodeImage(bytes, mime);
  const maxSide = Math.max(img.width, img.height);
  if (maxSide > maxDimension) {
    const scale = maxDimension / maxSide;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const rz = await getResize();
    img = await rz(img, { width: w, height: h });
  }
  const enc = await getWebpEncoder();
  const out = await enc(img, { quality });
  return new Uint8Array(out);
}

async function publicUrl(supabase: any, path: string): Promise<string> {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
}

async function updateSourceRef(
  supabase: any,
  sourceTable: string,
  sourceId: string | null,
  sourceField: string,
  oldUrl: string,
  newUrl: string
): Promise<{ updated: boolean; reason?: string }> {
  // Descobre o tipo da coluna
  const { data: col, error: colErr } = await supabase
    .from('information_schema.columns' as any)
    .select('data_type')
    .eq('table_schema', 'public')
    .eq('table_name', sourceTable)
    .eq('column_name', sourceField)
    .maybeSingle();
  // information_schema não é exposto via PostgREST em geral; tentamos rpc se falhar.
  let dataType: string | null = col?.data_type ?? null;
  if (!dataType) {
    const { data, error } = await supabase
      .rpc('noop_get_col_type', {
        _table: sourceTable,
        _column: sourceField,
      })
      .catch(() => ({ data: null, error: true }));
    if (data) dataType = data;
  }

  // Sem info do tipo: assume text e tenta. Se falhar, registra.
  if (!dataType || /text|character|varchar/i.test(dataType)) {
    if (!sourceId) {
      // Faz update por igualdade (perigoso se a URL se repete; aceitável aqui).
      const { error } = await supabase
        .from(sourceTable)
        .update({ [sourceField]: newUrl })
        .eq(sourceField, oldUrl);
      if (error) return { updated: false, reason: error.message };
      return { updated: true };
    }
    const { error } = await supabase
      .from(sourceTable)
      .update({ [sourceField]: newUrl })
      .eq('id', sourceId);
    if (error) return { updated: false, reason: error.message };
    return { updated: true };
  }

  // jsonb e demais tipos: pular (requer migração específica por tabela).
  return { updated: false, reason: `unsupported column type: ${dataType}` };
}

type ProcessOptions = {
  dryRun: boolean;
  inPlace: boolean;
  updateAssetsRow: boolean;
  skipIfLarger: boolean;
  maxDimension: number;
  quality: number;
};

async function processOne(
  supabase: any,
  asset: any,
  options: ProcessOptions
): Promise<ProcessResult> {
  const storagePath: string = asset.storage_path;
  const mime: string = inferMime(storagePath, asset.mime_type);
  if (!isConvertibleImage(mime)) {
    return { storagePath, status: 'skipped', reason: `mime ${mime} não conversível` };
  }
  if (storagePath.startsWith('thumbs/')) {
    return { storagePath, status: 'skipped', reason: 'thumbnail' };
  }

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
  if (dlErr || !file)
    return { storagePath, status: 'error', reason: dlErr?.message || 'download falhou' };
  const inBytes = new Uint8Array(await file.arrayBuffer());

  let webp: Uint8Array;
  try {
    webp = await convertToWebp(inBytes, mime, options.maxDimension, options.quality);
  } catch (e: any) {
    return { storagePath, status: 'error', reason: `encode: ${e?.message || e}` };
  }

  if (options.skipIfLarger && webp.length >= inBytes.length) {
    return {
      storagePath,
      status: 'skipped',
      reason: 'webp não menor que original',
      beforeBytes: inBytes.length,
      afterBytes: webp.length,
    };
  }

  const newPath = options.inPlace ? storagePath : changeExt(storagePath, 'webp');
  if (options.dryRun) {
    return {
      storagePath,
      newPath,
      status: 'ok',
      beforeBytes: inBytes.length,
      afterBytes: webp.length,
    };
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, webp, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (upErr) return { storagePath, status: 'error', reason: `upload: ${upErr.message}` };

  if (options.updateAssetsRow) {
    const now = new Date().toISOString();
    if (asset.id) {
      const { error: updErr } = await supabase
        .from('image_assets')
        .update({
          storage_path: newPath,
          mime_type: 'image/webp',
          size_bytes: webp.length,
          processed_at: now,
        })
        .eq('id', asset.id);
      if (updErr)
        return { storagePath, status: 'error', reason: `image_assets: ${updErr.message}` };
    } else {
      const { error: insErr } = await supabase.from('image_assets').insert({
        storage_path: newPath,
        mime_type: 'image/webp',
        size_bytes: webp.length,
        preserve: false,
        processed_at: now,
      });
      if (insErr)
        return { storagePath, status: 'error', reason: `image_assets: ${insErr.message}` };
    }
  }

  // Atualiza referência na tabela de origem (best-effort)
  if (!options.inPlace && asset.source_table && asset.source_field) {
    const oldUrl = await publicUrl(supabase, storagePath);
    const newUrl = await publicUrl(supabase, newPath);
    const r = await updateSourceRef(
      supabase,
      asset.source_table,
      asset.source_id,
      asset.source_field,
      oldUrl,
      newUrl
    );
    if (!r.updated) {
      console.warn(
        `[backfill] source update skipped (${asset.source_table}.${asset.source_field}): ${r.reason}`
      );
    }
  }

  // Remove o arquivo original (somente se difere do novo)
  if (!options.inPlace && newPath !== storagePath) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (rmErr) console.warn(`[backfill] remove falhou ${storagePath}: ${rmErr.message}`);
  }

  return {
    storagePath,
    newPath,
    status: 'ok',
    beforeBytes: inBytes.length,
    afterBytes: webp.length,
  };
}

async function listAssets(supabase: any, batch: number) {
  const { data, error } = await supabase
    .from('image_assets')
    .select('*')
    .is('deleted_at', null)
    .not('mime_type', 'ilike', 'image/webp%')
    .order('created_at', { ascending: true })
    .limit(batch);
  if (error) throw error;
  return data || [];
}

async function listStorageFiles(supabase: any, prefix = '', out: any[] = []): Promise<any[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  for (const it of data || []) {
    const full = prefix ? `${prefix}/${it.name}` : it.name;
    if (it.id === null) {
      // pasta
      if (full.startsWith('thumbs')) continue;
      await listStorageFiles(supabase, full, out);
    } else {
      out.push({ path: full, metadata: it.metadata });
    }
  }
  return out;
}

async function ensureAssetRow(supabase: any, path: string, meta: any) {
  const { data: existing } = await supabase
    .from('image_assets')
    .select('*')
    .eq('storage_path', path)
    .maybeSingle();
  if (existing) return existing;
  const mime = inferMime(path, meta?.mimetype || meta?.contentType || null);
  const size = meta?.size || null;
  const { data, error } = await supabase
    .from('image_assets')
    .insert({
      storage_path: path,
      mime_type: mime,
      size_bytes: size,
      preserve: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function getAssetTarget(supabase: any, path: string, meta: any, createIfMissing: boolean) {
  const { data: existing, error } = await supabase
    .from('image_assets')
    .select('*')
    .eq('storage_path', path)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;
  if (createIfMissing) return ensureAssetRow(supabase, path, meta);

  return {
    id: null,
    storage_path: path,
    mime_type: inferMime(path, meta?.mimetype || meta?.contentType || null),
    size_bytes: meta?.size || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const mode: 'assets' | 'storage' | 'paths' =
      body?.mode === 'storage' ? 'storage' : body?.mode === 'paths' ? 'paths' : 'assets';
    const batch: number = Math.min(Math.max(Number(body?.batch) || 8, 1), 50);
    const options: ProcessOptions = {
      dryRun: !!body?.dryRun,
      inPlace: !!body?.inPlace,
      updateAssetsRow: body?.updateAssetsRow !== false,
      skipIfLarger: !!body?.skipIfLarger,
      maxDimension: Math.min(Math.max(Number(body?.maxDimension) || DEFAULT_MAX_DIM, 320), 4000),
      quality: normalizeQuality(body?.quality),
    };

    let targets: any[] = [];
    if (mode === 'assets') {
      targets = await listAssets(supabase, batch);
    } else if (mode === 'paths') {
      const paths = Array.isArray(body?.paths) ? body.paths.slice(0, batch) : [];
      for (const path of paths) {
        if (typeof path !== 'string' || !path.trim()) continue;
        const cleanPath = path.replace(/^\/+/, '');
        if (cleanPath.startsWith('thumbs/')) continue;
        const existing = await getAssetTarget(supabase, cleanPath, {}, options.updateAssetsRow);
        targets.push(existing);
      }
    } else {
      const files = await listStorageFiles(supabase);
      const candidates = files
        .filter((f) => {
          const mime = f.metadata?.mimetype || f.metadata?.contentType || '';
          return isConvertibleImage(mime) || /\.(jpg|jpeg|png)$/i.test(f.path);
        })
        .slice(0, batch);
      for (const f of candidates) {
        const row = await ensureAssetRow(supabase, f.path, f.metadata);
        targets.push(row);
      }
    }

    const results: ProcessResult[] = [];
    for (const a of targets) {
      try {
        results.push(await processOne(supabase, a, options));
      } catch (e: any) {
        results.push({
          storagePath: a.storage_path,
          status: 'error',
          reason: String(e?.message || e),
        });
      }
    }

    const summary = {
      ok: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      bytesBefore: results.reduce((s, r) => s + (r.beforeBytes || 0), 0),
      bytesAfter: results.reduce((s, r) => s + (r.afterBytes || 0), 0),
    };

    return new Response(JSON.stringify({ mode, batch, dryRun: options.dryRun, summary, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('backfill-webp error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
