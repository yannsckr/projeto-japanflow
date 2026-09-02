import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: 'fileBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

    const isPdf = (mimeType || '').includes('pdf');
    const dataUrl = fileBase64.startsWith('data:')
      ? fileBase64
      : `data:${mimeType || 'image/png'};base64,${fileBase64}`;

    const userContent: any[] = [
      {
        type: 'text',
        text: 'Extraia os dados do fornecedor e os itens do pedido deste documento. Retorne APENAS JSON válido.',
      },
    ];
    if (isPdf) {
      userContent.push({ type: 'file', file: { filename: 'doc.pdf', file_data: dataUrl } });
    } else {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Extraia dados de um pedido/orçamento/nota e responda APENAS com JSON no formato:
{
  "supplier": {
    "razaoSocial": "",
    "cnpj": "",
    "celular": "",
    "endereco": "",
    "cep": "",
    "municipioUf": "",
    "email": "",
    "contato": "",
    "obs": ""
  },
  "items": [
    { "nome": "", "valor": 0, "quantidade": 1, "marca": "", "aplicacao": "", "codigo": "" }
  ]
}
REGRA IMPORTANTE para "codigo": use SEMPRE o "Cód. Fabricante" (código do fabricante/Part Number), NUNCA o código interno do sistema (coluna "Código"). Se houver apenas um código e estiver claro que é interno, deixe "codigo" vazio.
Para "marca" use a coluna "Fabricante". Para "nome" use a "Descrição". Para "valor" use "V. Custo Unit.". Para "quantidade" use "Qtd. Compra".
Use valores numéricos (não strings) para valor e quantidade. Campos sem dado devem ficar vazios ("") ou 0. Nunca inclua texto fora do JSON.`,
          },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI error', response.status, t);
      return new Response(JSON.stringify({ error: 'AI error', status: response.status }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let text: string = data.choices?.[0]?.message?.content || '{}';
    text = text
      .replace(/```json\s*/gi, '')
      .replace(/```/g, '')
      .trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { supplier: {}, items: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-purchase-order error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
