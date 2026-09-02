// Cron: remove originais expirados (>7 dias) que não estejam preservados.
// - Mantém a linha em image_assets (com image_text + thumb_path) marcando deleted_at.
// - Remove o arquivo original do Storage. A miniatura permanece para visualização.
//
// Pode ser disparado por pg_cron via net.http_post. Aceita GET e POST.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'attachments';
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const nowIso = new Date().toISOString();

    const { data: expired, error } = await supabase
      .from('image_assets')
      .select('id, storage_path')
      .lt('expires_at', nowIso)
      .eq('preserve', false)
      .is('deleted_at', null)
      .limit(BATCH);
    if (error) throw error;

    let removed = 0;
    if (expired && expired.length > 0) {
      const paths = expired.map((r: any) => r.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (rmErr) console.error('storage remove error', rmErr);
      }
      const ids = expired.map((r: any) => r.id);
      const { error: updErr } = await supabase
        .from('image_assets')
        .update({ deleted_at: nowIso })
        .in('id', ids);
      if (updErr) throw updErr;
      removed = expired.length;
    }

    return new Response(JSON.stringify({ ok: true, removed, at: nowIso }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('cleanup-images-cron error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
