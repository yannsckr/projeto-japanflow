import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();

    // Fetch open warranty claims (not concluded)
    const { data: claims, error } = await supabase
      .from('warranty_claims')
      .select('*')
      .neq('status', 'concluida');

    if (error) throw error;
    if (!claims || claims.length === 0) {
      return new Response(JSON.stringify({ message: 'No open claims' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find William's user ID
    const { data: williamUser } = await supabase
      .from('app_users')
      .select('id')
      .ilike('name', '%william%')
      .limit(1)
      .single();

    const williamId = williamUser?.id;

    let tasksCreated = 0;

    for (const claim of claims) {
      const createdAt = new Date(claim.created_at);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 7-day reminder for William
      if (williamId && daysSinceCreation >= 7) {
        const lastReminder = claim.last_7day_reminder_at
          ? new Date(claim.last_7day_reminder_at)
          : null;
        const daysSinceLastReminder = lastReminder
          ? Math.floor((now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSinceLastReminder >= 7) {
          const deadline = new Date();
          deadline.setHours(23, 59, 59, 999);
          const statusHistory = [{ status: 'todo', enteredAt: now.toISOString() }];

          await supabase.from('tasks').insert({
            title: `🔔 Checar Garantia: ${claim.client_name}`,
            description: `Verificar andamento do pedido de garantia do cliente ${claim.client_name} - Item: ${claim.item_name} (${claim.product_brand}). Aberto há ${daysSinceCreation} dias.`,
            status: 'todo',
            priority: 'medium',
            assignee_id: williamId,
            created_by: 'system',
            deadline: deadline.toISOString().split('T')[0],
            sector: 'garantias',
            status_history: statusHistory,
          });

          await supabase
            .from('warranty_claims')
            .update({ last_7day_reminder_at: now.toISOString() })
            .eq('id', claim.id);

          tasksCreated++;
        }
      }

      // 26-day reminder for the requester
      if (daysSinceCreation >= 26 && !claim.last_26day_notified) {
        const deadline = new Date();
        deadline.setHours(23, 59, 59, 999);
        const statusHistory = [{ status: 'todo', enteredAt: now.toISOString() }];

        await supabase.from('tasks').insert({
          title: `⚠️ Garantia pendente há ${daysSinceCreation} dias: ${claim.client_name}`,
          description: `O pedido de garantia do cliente ${claim.client_name} - Item: ${claim.item_name} está pendente há mais de 26 dias. Cobre os responsáveis pelo andamento.`,
          status: 'todo',
          priority: 'high',
          assignee_id: claim.requested_by,
          created_by: 'system',
          deadline: deadline.toISOString().split('T')[0],
          status_history: statusHistory,
        });

        await supabase
          .from('warranty_claims')
          .update({ last_26day_notified: true })
          .eq('id', claim.id);

        tasksCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${claims.length} claims, created ${tasksCreated} tasks`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
