import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.3/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaTime = new Date(
      now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000
    );

    const currentHour = brasiliaTime.getHours().toString().padStart(2, '0');
    const currentMinute = brasiliaTime.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayStr = brasiliaTime.toISOString().split('T')[0];

    // Day of week: 0=Sunday, 1=Monday, etc.
    const dayOfWeek = brasiliaTime.getDay();

    // Fetch all active scheduled tasks
    const { data: schedules, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error fetching schedules:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let created = 0;

    for (const schedule of schedules || []) {
      // Check if already created today
      if (schedule.last_created_at === todayStr) continue;

      // Check time - allow a 2-minute window
      const [schedHour, schedMin] = schedule.schedule_time.split(':').map(Number);
      const schedMinutes = schedHour * 60 + schedMin;
      const currentMinutes = parseInt(currentHour) * 60 + parseInt(currentMinute);
      if (Math.abs(currentMinutes - schedMinutes) > 2) continue;

      // Check recurrence
      if (schedule.recurrence === 'specific_days') {
        const daysOfWeek = schedule.days_of_week as number[];
        if (!daysOfWeek.includes(dayOfWeek)) continue;
      }
      // 'daily' always runs

      // Create the task
      const taskData: Record<string, unknown> = {
        title: schedule.title,
        description: schedule.description,
        priority: schedule.priority,
        status: 'todo',
        created_by: schedule.created_by,
        deadline: todayStr,
        sector: schedule.assign_mode === 'sector' ? schedule.sector : null,
        assignee_id: schedule.assign_mode === 'employee' ? schedule.assignee_id : null,
        status_history: [{ status: 'todo', enteredAt: new Date().toISOString() }],
      };

      const { error: insertError } = await supabase.from('tasks').insert(taskData);
      if (insertError) {
        console.error('Error creating task from schedule:', insertError);
        continue;
      }

      // Mark as created today
      await supabase
        .from('scheduled_tasks')
        .update({ last_created_at: todayStr, updated_at: new Date().toISOString() })
        .eq('id', schedule.id);

      // Send notification
      if (schedule.assignee_id) {
        await supabase.from('notifications').insert({
          user_id: schedule.assignee_id,
          message: `Tarefa agendada "${schedule.title}" foi criada automaticamente`,
          type: 'task_created',
        });
      }

      created++;
    }

    return new Response(
      JSON.stringify({ success: true, created, time: currentTime, date: todayStr }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
