import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que extrai APENAS os seguintes dados de imagens de etiquetas/documentos de envio. Ignore qualquer outra informação.

DADOS A EXTRAIR (somente se existirem na imagem):
- Nome / Razão Social
- CPF / CNPJ
- CEP
- Tipo de Logradouro
- Nome do Logradouro
- Número
- Complemento
- Bairro
- UF
- Município

REGRAS:
1. Use EXATAMENTE o formato "Campo: valor", um por linha
2. Se um campo não existir na imagem, NÃO inclua na resposta
3. NÃO adicione campos extras além dos listados acima
4. Se não encontrar nenhum dos campos, responda "Nenhum dado de envio encontrado na imagem."

Exemplo de saída:
Nome / Razão Social: João da Silva
CPF / CNPJ: 123.456.789-00
CEP: 01000-000
Tipo de Logradouro: Avenida
Nome do Logradouro: Brasil
Número: 1234
Complemento: Sala 5
Bairro: Centro
UF: SP
Município: São Paulo`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageBase64 },
              },
              {
                type: 'text',
                text: 'Transcreva todo o texto visível nesta imagem.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido, tente novamente em breve.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Erro no serviço de IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || 'Nenhum texto encontrado.';

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('transcribe-image error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
