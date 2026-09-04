import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
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
  created_at: any;
  updated_at: any;
  status_history: unknown;
  image_url: string | null;
  image_urls: unknown;
  response: string | null;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

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
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  statusHistory: (row.status_history as StatusHistoryEntry[]) || [],
  imageUrl: row.image_url || undefined,
  imageUrls: (Array.isArray(row.image_urls) ? row.image_urls : []) as string[],
  response: row.response || undefined,
});

export const useTasks = (
  allUsers?: { id: string; role: string; sectors: string[] }[],
  enabled = true
) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const tasksRef = useRef<Task[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const tasksQuery = query(collection(db, 'tasks'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const newTasks = snapshot.docs.map((taskDoc) =>
          rowToTask({
            id: taskDoc.id,
            ...(taskDoc.data() as Omit<TaskRow, 'id'>),
          })
        );

        setTasks((prev) => (JSON.stringify(prev) === JSON.stringify(newTasks) ? prev : newTasks));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching tasks:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
      const nowIso = new Date().toISOString();
      const statusHistory: StatusHistoryEntry[] = [{ status: task.status, enteredAt: nowIso }];

      await addDoc(collection(db, 'tasks'), {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee_id: task.assigneeId,
        created_by: task.createdBy,
        deadline: task.deadline,
        sector: task.sector || null,
        status_history: statusHistory,
        image_url: task.imageUrl || null,
        image_urls: task.imageUrls || [],
        response: task.response || null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    [allUsers]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
    ) => {
      const dbUpdates: Record<string, any> = { updated_at: Timestamp.now() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
      if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;

      await updateDoc(doc(db, 'tasks', taskId), dbUpdates);
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    await deleteDoc(doc(db, 'tasks', taskId));
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const nowIso = new Date().toISOString();
    const taskRef = doc(db, 'tasks', taskId);
    const currentSnapshot = await getDoc(taskRef);

    if (!currentSnapshot.exists()) return;

    const currentData = currentSnapshot.data();
    const history = [...((currentData.status_history as StatusHistoryEntry[]) || [])];

    if (history.length > 0 && !history[history.length - 1].exitedAt) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        exitedAt: nowIso,
      };
    }

    history.push({ status, enteredAt: nowIso });

    await updateDoc(taskRef, {
      status,
      updated_at: Timestamp.now(),
      status_history: history,
    });

    if (currentData.sector !== 'motoboys') return;

    const statusMap: Record<TaskStatus, string> = {
      todo: 'pending',
      in_progress: 'accepted',
      paused: 'accepted',
      done: 'completed',
    };

    const rideUpdate: Record<string, any> = {
      status: statusMap[status],
      updated_at: Timestamp.now(),
      completed_at: status === 'done' ? Timestamp.now() : null,
    };

    if (status === 'in_progress' || status === 'paused' || status === 'done') {
      rideUpdate.accepted_at = Timestamp.now();
    }

    const directSnapshot = await getDocs(
      query(collection(db, 'motoboy_assignments'), where('task_id', '==', taskId), limit(1))
    );

    if (!directSnapshot.empty) {
      const directDoc = directSnapshot.docs[0];
      const directData = directDoc.data();

      if (directData.accepted_at && rideUpdate.accepted_at) {
        rideUpdate.accepted_at = directData.accepted_at;
      }
      if (status === 'todo') rideUpdate.accepted_at = null;

      await updateDoc(doc(db, 'motoboy_assignments', directDoc.id), rideUpdate);
      return;
    }

    const title = String(currentData.title || '');
    const description = String(currentData.description || '');
    const assigneeId = String(currentData.assignee_id || '');

    if (status === 'done' && (title.includes('Corrida') || title.includes('Entrega'))) {
      const legacySnapshot = await getDocs(
        query(collection(db, 'motoboy_assignments'), where('assigned_to', '==', assigneeId))
      );

      const match = legacySnapshot.docs.find((assignmentDoc) => {
        const assignment = assignmentDoc.data();
        if (assignment.status === 'completed') return false;

        return (
          (!!assignment.client_name && title.includes(String(assignment.client_name))) ||
          description.includes(String(assignment.description || ''))
        );
      });

      if (match) {
        await updateDoc(doc(db, 'motoboy_assignments', match.id), {
          status: 'completed',
          completed_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
      }
    }
  }, []);

  const updateTaskPriority = useCallback(async (taskId: string, priority: Priority) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      priority,
      updated_at: Timestamp.now(),
    });
  }, []);

  const claimSectorTask = useCallback(async (taskId: string, userId: string) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      assignee_id: userId,
      updated_at: Timestamp.now(),
    });
  }, []);

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
