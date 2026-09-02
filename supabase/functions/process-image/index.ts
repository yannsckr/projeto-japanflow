// Processa imagem recém-enviada:
// 1) Extrai texto via Lovable AI (OCR). Se não houver texto, gera descrição.
// 2) Gera miniatura ~300px (PNG) e faz upload para o bucket.
// 3) Atualiza a linha em public.image_assets com image_text, thumb_path, processed_at.
//
// Body esperado (JSON):
//   { assetId: string }            -> usa storage_path da linha existente
//   ou
//   { storagePath: string, sourceTable?, sourceId?, sourceField?, uploadedBy?, preserve?, mimeType?, sizeBytes? }
//     -> cria a linha em image_assets e processa.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-expect-error esm
import { decode as decodeJpeg } from 'https://esm.sh/jpeg-js@0.4.4';
// @ts-expect-error esm
import { PNG } from 'https://esm.sh/pngjs@7.0.0?bundle';
// @ts-expect-error esm
import { decode as decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const BUCKET = 'attachments';
const TARGET_THUMB = 300;

function b64ToBytes(b64: string): Uint8Array {
  return decodeBase64(b64);
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function resizeNearest(
  src: Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Uint8Array {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor((y * sh) / dh);
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor((x * sw) / dw);
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

async function makeThumb(bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  try {
    let rgba: Uint8Array, width: number, height: number;
    if (mime.includes('jpeg') || mime.includes('jpg')) {
      const img = decodeJpeg(bytes, { useTArray: true });
      rgba = img.data;
      width = img.width;
      height = img.height;
    } else if (mime.includes('png')) {
      const png = PNG.sync.read(Buffer.from(bytes));
      rgba = new Uint8Array(png.data);
      width = png.width;
      height = png.height;
    } else {
      return null;
    }
    const scale = Math.min(1, TARGET_THUMB / Math.max(width, height));
    const dw = Math.max(1, Math.round(width * scale));
    const dh = Math.max(1, Math.round(height * scale));
    const resized = resizeNearest(rgba, width, height, dw, dh);
    const out = new PNG({ width: dw, height: dh });
    out.data = Buffer.from(resized);
    const buf: Uint8Array = PNG.sync.write(out);
    return new Uint8Array(buf);
  } catch (e) {
    console.error('thumb error', e);
    return null;
  }
}

async function aiExtractOrDescribe(b64: string, mime: string): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return '';
  const dataUrl = `data:${mime};base64,${b64}`;
  const prompt = `Extraia TODO o texto visível desta imagem, preservando quebras de linha. \
Se NÃO houver nenhum texto legível, descreva a imagem em 1-2 frases objetivas em português. \
Responda apenas com o conteúdo extraído ou a descrição — sem comentários.`;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    console.error('AI gateway error', resp.status, await resp.text());
    return '';
  }
  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content || '').toString().trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const {
      assetId,
      storagePath,
      sourceTable,
      sourceId,
      sourceField,
      uploadedBy,
      preserve,
      mimeType,
      sizeBytes,
    } = body || {};

    let row: any = null;
    if (assetId) {
      const { data, error } = await supabase
        .from('image_assets')
        .select('*')
        .eq('id', assetId)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return new Response(JSON.stringify({ error: 'asset not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      row = data;
      storagePath = data.storage_path;
      mimeType = mimeType || data.mime_type;
    } else if (storagePath) {
      const { data, error } = await supabase
        .from('image_assets')
        .insert({
          storage_path: storagePath,
          mime_type: mimeType || null,
          size_bytes: sizeBytes || null,
          source_table: sourceTable || null,
          source_id: sourceId || null,
          source_field: sourceField || null,
          uploaded_by: uploadedBy || null,
          preserve: !!preserve,
        })
        .select('*')
        .single();
      if (error) throw error;
      row = data;
    } else {
      return new Response(JSON.stringify({ error: 'assetId or storagePath required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Baixa a imagem
    const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
    if (dlErr || !file) throw dlErr || new Error('download failed');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = mimeType || file.type || 'image/jpeg';
    const b64 = bytesToB64(bytes);

    // OCR/descrição em paralelo com thumbnail
    const [text, thumb] = await Promise.all([
      aiExtractOrDescribe(b64, mime),
      makeThumb(bytes, mime),
    ]);

    let thumbPath: string | null = null;
    if (thumb) {
      thumbPath = `thumbs/${row.id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumb, { contentType: 'image/png', upsert: true });
      if (upErr) {
        console.error('thumb upload error', upErr);
        thumbPath = null;
      }
    }

    const { data: updated, error: upErr2 } = await supabase
      .from('image_assets')
      .update({
        image_text: text || null,
        thumb_path: thumbPath,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (upErr2) throw upErr2;

    return new Response(JSON.stringify({ ok: true, asset: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('process-image error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
