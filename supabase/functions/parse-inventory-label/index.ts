import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

    const prompt = `Você analisa etiquetas de peças automotivas da JAPAN.
A etiqueta tem este layout:
- Linha(s) de DESCRIÇÃO em letras maiúsculas (ex: "COXIM AMORTECEDOR DIANTEIRO LE HONDA CIVIC").
- Um código alfanumérico do fabricante (ex: "ASMHO1009").
- Um código de barras.
- Abaixo do código de barras, um número com zeros à esquerda (ex: "00001015") — este é o CÓDIGO INTERNO do item.
- "L:" indica localização e "F:" indica código do fabricante — IGNORE ambos.

Extraia:
- "type": as PRIMEIRAS DUAS PALAVRAS da descrição (ex: "COXIM AMORTECEDOR").
- "code": o número abaixo do código de barras, REMOVENDO TODOS os zeros à esquerda (ex: "00001015" -> "1015").

Responda SOMENTE com JSON puro, sem markdown, no formato:
{"type":"...","code":"..."}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
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
      const t = await resp.text();
      return new Response(JSON.stringify({ error: 'IA falhou', detail: t }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed: { type?: string; code?: string } = {};
    try {
      const m = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : cleaned);
    } catch {
      parsed = {};
    }

    const type = (parsed.type || '').toString().trim().toUpperCase();
    const code = (parsed.code || '').toString().trim().replace(/^0+/, '');

    return new Response(JSON.stringify({ type, code }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
