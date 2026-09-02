import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { text, users, sectors } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Texto é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });

    const systemPrompt = `Você é um assistente que extrai eventos e lembretes de calendário a partir de texto em português.
Hoje é ${today} (${dayOfWeek}).

Usuários disponíveis: ${JSON.stringify(users)}
Setores disponíveis: ${JSON.stringify(sectors)}

Para cada evento encontrado, retorne usando a tool "create_events" com um array de objetos contendo:
- title: string (título curto)
- description: string (descrição opcional)
- date: string (formato YYYY-MM-DD)
- time: string | null (formato HH:MM ou null)
- type: "event" | "reminder"
- targetMode: "all" | "sector" | "specific"
- targetInfo: string (nome do setor, "todos", ou nomes dos usuários separados por vírgula)

Regras:
- Se mencionar "todos" ou "empresa toda", targetMode = "all"
- Se mencionar um setor específico, targetMode = "sector" e targetInfo = nome do setor
- Se mencionar pessoas específicas, targetMode = "specific" e targetInfo = nomes
- Se não especificar destinatário, use targetMode = "all"
- Se disser "lembrete", type = "reminder", senão type = "event"
- Interprete datas relativas (amanhã, próxima segunda, dia 15, etc.) baseado na data de hoje
- Se não especificar horário, time = null`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_events',
              description: 'Cria eventos/lembretes no calendário',
              parameters: {
                type: 'object',
                properties: {
                  events: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        date: { type: 'string' },
                        time: { type: 'string', nullable: true },
                        type: { type: 'string', enum: ['event', 'reminder'] },
                        targetMode: { type: 'string', enum: ['all', 'sector', 'specific'] },
                        targetInfo: { type: 'string' },
                      },
                      required: ['title', 'date', 'type', 'targetMode', 'targetInfo'],
                    },
                  },
                },
                required: ['events'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'create_events' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Limite de requisições excedido. Tente novamente em alguns segundos.',
          }),
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
      console.error('AI error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-calendar-events error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
