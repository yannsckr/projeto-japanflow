// supabase/functions/storage-audit-report/index.ts
// Varre o bucket `attachments` e identifica arquivos órfãos (sem registro em image_assets).
// Grava o resultado em `storage_audit_log` com action='reported'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'attachments';
const SKIP_PREFIXES = ['thumbs/'];

interface StorageItem {
  path: string;
  size: number | null;
  mime: string | null;
}

async function listAll(supabase: any): Promise<StorageItem[]> {
  const out: StorageItem[] = [];
  const stack: string[] = [''];
  while (stack.length) {
    const current = stack.pop()!;
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(current, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const full = current ? `${current}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          if (SKIP_PREFIXES.some((p) => full.startsWith(p.replace(/\/$/, '')))) continue;
          stack.push(full);
        } else {
          out.push({
            path: full,
            size: item.metadata?.size ?? null,
            mime: item.metadata?.mimetype ?? null,
          });
        }
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const writeLog: boolean = body?.writeLog !== false; // padrão: grava
    const olderThanDays: number = Number(body?.olderThanDays ?? 0); // 0 = qualquer idade

    // 1. lista o bucket
    const files = await listAll(supabase);

    // 2. busca todos os storage_path conhecidos em image_assets (paginado)
    const known = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('image_assets')
        .select('storage_path')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) if (r.storage_path) known.add(r.storage_path);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // 3. identifica órfãos
    const cutoffMs = olderThanDays > 0 ? Date.now() - olderThanDays * 86400000 : 0;
    const orphans: StorageItem[] = [];
    for (const f of files) {
      if (known.has(f.path)) continue;
      // se houver filtro de idade e o size carrega metadata.lastModified? — list() não traz timestamp.
      // Pular esse filtro por enquanto (apenas órfãos puros)
      orphans.push(f);
    }

    const totalBytes = orphans.reduce((acc, o) => acc + (o.size || 0), 0);
    const runId = crypto.randomUUID();

    // 4. grava no log em lotes
    if (writeLog && orphans.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < orphans.length; i += batchSize) {
        const batch = orphans.slice(i, i + batchSize).map((o) => ({
          run_id: runId,
          bucket: BUCKET,
          storage_path: o.path,
          size_bytes: o.size,
          mime_type: o.mime,
          category: 'orphan',
          action: 'reported',
          notes: 'arquivo no Storage sem linha em image_assets',
        }));
        const { error } = await supabase.from('storage_audit_log').insert(batch);
        if (error) throw error;
      }
    }

    return new Response(
      JSON.stringify({
        runId,
        totalFiles: files.length,
        knownAssets: known.size,
        orphans: orphans.length,
        orphanBytes: totalBytes,
        sample: orphans.slice(0, 20).map((o) => o.path),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
