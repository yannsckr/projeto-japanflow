import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskStatus, Priority, Sector, StatusHistoryEntry } from '@/types';

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
  created_by: string;
  deadline: string;
  sector: string | null;
  created_at: string;
  updated_at: string;
  status_history: unknown;
  image_url: string | null;
  image_urls: unknown;
  response: string | null;
}

const rowToTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status as TaskStatus,
  priority: row.priority as Priority,
  assigneeId: row.assignee_id,
  createdBy: row.created_by,
  deadline: row.deadline,
  sector: row.sector as Sector | undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  statusHistory: (row.status_history as StatusHistoryEntry[]) || [],
  imageUrl: row.image_url || undefined,
  imageUrls: (Array.isArray(row.image_urls) ? row.image_urls : []) as string[],
  response: row.response || undefined,
});

export const useSupabaseTasks = (
  allUsers?: { id: string; role: string; sectors: string[] }[],
  enabled = true
) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const tasksRef = useRef<Task[]>([]);

  // Keep ref in sync
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Fetch all tasks + polling every 30s (realtime handles instant updates)
  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Error fetching tasks:', error);
          setLoading(false);
          return;
        }
        const newTasks = data.map((r: any) => rowToTask(r));
        setTasks((prev) => {
          const prevJson = JSON.stringify(prev);
          const newJson = JSON.stringify(newTasks);
          return prevJson === newJson ? prev : newTasks;
        });
        setLoading(false);
      } catch (e) {
        console.error('Network error fetching tasks:', e);
        setLoading(false);
      }
    };
    fetchTasks();
    // Realtime cobre updates instantâneos; polling apenas como safety-net (10min)
    // e pausa quando aba está oculta — reduz egress/cloud realtime cost.
    const interval = setInterval(() => {
      if (!document.hidden) fetchTasks();
    }, 600000);
    const onVis = () => {
      if (!document.hidden) fetchTasks();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);

  // Realtime subscription
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newTask = rowToTask(payload.new as TaskRow);
          setTasks((prev) => {
            if (prev.find((t) => t.id === newTask.id)) return prev;
            return [newTask, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = rowToTask(payload.new as TaskRow);
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any).id;
          setTasks((prev) => prev.filter((t) => t.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
      const now = new Date().toISOString();
      const statusHistory: StatusHistoryEntry[] = [{ status: task.status, enteredAt: now }];

      const finalAssigneeId = task.assigneeId;

      const { error } = await supabase.from('tasks').insert({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee_id: finalAssigneeId,
        created_by: task.createdBy,
        deadline: task.deadline,
        sector: task.sector || null,
        status_history: statusHistory as any,
        image_url: task.imageUrl || null,
      });
      if (error) console.error('Error adding task:', error);
    },
    [allUsers]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
    ) => {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
      if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;

      const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
      if (error) console.error('Error updating task:', error);
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('Error deleting task:', error);
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const now = new Date().toISOString();
    // Get current task to update history
    const current = await supabase.from('tasks').select('status_history').eq('id', taskId).single();
    if (current.error) return;

    const history = [...((current.data.status_history as unknown as StatusHistoryEntry[]) || [])];
    // Close last entry
    if (history.length > 0 && !history[history.length - 1].exitedAt) {
      history[history.length - 1] = { ...history[history.length - 1], exitedAt: now };
    }
    history.push({ status, enteredAt: now });

    const { error, data: updatedRow } = await supabase
      .from('tasks')
      .update({
        status,
        updated_at: now,
        status_history: history as any,
      })
      .eq('id', taskId)
      .select('title, description, assignee_id, sector')
      .single();
    if (error) console.error('Error updating task status:', error);

    // Mirror Kanban task status onto the linked motoboy_assignment so the
    // Motoboys panel reflects the real progress (todo→pending, in_progress/paused→accepted, done→completed)
    if (!error && updatedRow?.sector === 'motoboys') {
      const statusMap: Record<TaskStatus, string> = {
        todo: 'pending',
        in_progress: 'accepted',
        paused: 'accepted',
        done: 'completed',
      };
      const rideStatus = statusMap[status];
      const rideUpdate: Record<string, any> = { status: rideStatus, updated_at: now };
      if (status === 'done') rideUpdate.completed_at = now;
      else rideUpdate.completed_at = null;
      if (status === 'in_progress' || status === 'paused' || status === 'done') {
        // Mark accepted_at the first time it leaves "todo"
        rideUpdate.accepted_at = now;
      }

      // First try direct link via task_id
      const { data: directMatch } = await supabase
        .from('motoboy_assignments')
        .select('id, accepted_at')
        .eq('task_id', taskId)
        .limit(1);
      if (directMatch && directMatch.length > 0) {
        // Preserve original accepted_at if it already exists
        if (directMatch[0].accepted_at && rideUpdate.accepted_at) {
          rideUpdate.accepted_at = directMatch[0].accepted_at;
        }
        if (status === 'todo') rideUpdate.accepted_at = null;
        await supabase.from('motoboy_assignments').update(rideUpdate).eq('id', directMatch[0].id);
      } else if (
        status === 'done' &&
        (updatedRow?.title?.includes('Corrida') || updatedRow?.title?.includes('Entrega'))
      ) {
        // Legacy fallback (only on completion) for assignments without task_id link
        const { data: assignments } = await supabase
          .from('motoboy_assignments')
          .select('id, description, client_name, assigned_to')
          .eq('assigned_to', updatedRow.assignee_id || '')
          .neq('status', 'completed');
        if (assignments) {
          const match = assignments.find(
            (a) =>
              (a.client_name && updatedRow.title.includes(a.client_name)) ||
              updatedRow.description?.includes(a.description)
          );
          if (match) {
            await supabase
              .from('motoboy_assignments')
              .update({
                status: 'completed',
                completed_at: now,
                updated_at: now,
              })
              .eq('id', match.id);
          }
        }
      }
    }
  }, []);

  const updateTaskPriority = useCallback(async (taskId: string, priority: Priority) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) console.error('Error updating task priority:', error);
  }, []);

  const claimSectorTask = useCallback(async (taskId: string, userId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        assignee_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) console.error('Error claiming task:', error);
  }, []);

  // Auto-assign removed: sector tasks must be claimed manually

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskPriority,
    claimSectorTask,
  };
};
