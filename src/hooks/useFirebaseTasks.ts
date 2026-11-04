import { useCallback, useEffect, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  normalizeAssigneeIds,
  singleAssigneeUpdate,
  taskAssigneeCreateFields,
} from '@/lib/taskAssignments';
import { Priority, Sector, StatusHistoryEntry, Task, TaskStatus } from '@/types';

interface FirestoreTaskData {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  assignee_id?: unknown;
  assignee_ids?: unknown;
  assigneeId?: unknown;
  created_by?: unknown;
  createdBy?: unknown;
  deadline?: unknown;
  sector?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  status_history?: unknown;
  statusHistory?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  image_urls?: unknown;
  imageUrls?: unknown;
  response?: unknown;
  archived_at?: unknown;
  archivedAt?: unknown;
  archived_by?: unknown;
  archivedBy?: unknown;
}

type TaskWithArchive = Task & {
  archivedAt?: string;
  archivedBy?: string;
};

const toIso = (value: unknown): string => {
  if (!value) return '';

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate().toISOString();
    }
  }

  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;

  return '';
};

const normalizeHistory = (value: unknown, fallbackStatus: TaskStatus): StatusHistoryEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const row = entry as Record<string, unknown>;
      const enteredAt = toIso(
        row.enteredAt ?? row.entered_at ?? row.timestamp ?? row.changedAt ?? row.date
      );
      const exitedAt = toIso(row.exitedAt ?? row.exited_at);

      if (!enteredAt) return null;

      return {
        status: String(row.status || fallbackStatus) as TaskStatus,
        enteredAt,
        ...(exitedAt ? { exitedAt } : {}),
      } satisfies StatusHistoryEntry;
    })
    .filter((entry): entry is StatusHistoryEntry => entry !== null);
};

export const mapTask = (id: string, data: FirestoreTaskData): TaskWithArchive => {
  const status = String(data.status || 'todo') as TaskStatus;
  const createdAt = toIso(data.created_at ?? data.createdAt);
  const updatedAt = toIso(data.updated_at ?? data.updatedAt) || createdAt;

  return {
    id,
    title: String(data.title || ''),
    description: String(data.description || ''),
    status,
    priority: String(data.priority || 'medium') as Priority,
    assigneeId: String(data.assignee_id ?? data.assigneeId ?? ''),
    assigneeIds: Array.isArray(data.assignee_ids)
      ? normalizeAssigneeIds(data.assignee_ids)
      : undefined,
    createdBy: String(data.created_by ?? data.createdBy ?? ''),
    deadline: String(data.deadline || ''),
    sector: data.sector ? (String(data.sector) as Sector) : undefined,
    createdAt,
    updatedAt,
    statusHistory: normalizeHistory(data.status_history ?? data.statusHistory, status),
    imageUrl: data.image_url
      ? String(data.image_url)
      : data.imageUrl
        ? String(data.imageUrl)
        : undefined,
    imageUrls: Array.isArray(data.image_urls)
      ? data.image_urls.map(String)
      : Array.isArray(data.imageUrls)
        ? data.imageUrls.map(String)
        : [],
    response: data.response ? String(data.response) : undefined,
    archivedAt: toIso(data.archived_at ?? data.archivedAt) || undefined,
    archivedBy: data.archived_by
      ? String(data.archived_by)
      : data.archivedBy
        ? String(data.archivedBy)
        : undefined,
  };
};

export function useFirebaseTasks(
  _usersForAutoAssign: { id: string; role?: string; sectors?: Sector[] }[],
  enabled = true
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Modo de compatibilidade: preserva TODAS as tarefas para os consumidores
    // que ainda dependem de histórico completo (quadros, relatórios e contadores).
    // Experimento local deve usar VITE_TASKS_FILTERED_PILOT=true no .env.local;
    // NUNCA habilitar em produção sem adaptar os consumidores e os indicadores.
    const pilot = import.meta.env.VITE_TASKS_BOARD_QUERY_V2 === 'true';
    const cache = new Map<string, TaskWithArchive>();
    const sortTasks = (values: TaskWithArchive[]) =>
      values.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    if (!pilot) {
      const unsubscribe = onSnapshot(
        collection(db, 'tasks'),
        (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'removed') cache.delete(change.doc.id);
            else
              cache.set(
                change.doc.id,
                mapTask(change.doc.id, change.doc.data() as FirestoreTaskData)
              );
          }
          setTasks(sortTasks([...cache.values()]));
          setLoading(false);
        },
        (error) => {
          console.error('Erro ao buscar tarefas:', error);
          setLoading(false);
        }
      );
      return () => {
        unsubscribe();
        cache.clear();
      };
    }

    // Consulta v2: somente tarefas presentes no quadro (inclusive concluídas não arquivadas).
    // Exige backfill de board_visible ANTES da ativação.
    const unsubscribe = onSnapshot(
      query(collection(db, 'tasks'), where('board_visible', '==', true)),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') cache.delete(change.doc.id);
          else
            cache.set(
              change.doc.id,
              mapTask(change.doc.id, change.doc.data() as FirestoreTaskData)
            );
        }
        setTasks(sortTasks([...cache.values()]));
        setLoading(false);
      },
      (error) => {
        console.error('Erro no piloto de tarefas filtradas:', error);
        setLoading(false);
      }
    );
    return () => {
      unsubscribe();
      cache.clear();
    };
  }, [enabled]);

  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
      const taskRef = doc(collection(db, 'tasks'));
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();

      await writeBatch(db)
        .set(taskRef, {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          ...taskAssigneeCreateFields(task.assigneeId || '', task.assigneeIds),
          created_by: task.createdBy,
          deadline: task.deadline,
          sector: task.sector || null,
          status_history: [{ status: task.status, enteredAt: nowIso }],
          image_url: task.imageUrl || null,
          image_urls: task.imageUrls || [],
          response: task.response || null,
          created_at: now,
          updated_at: now,
          completed_at: task.status === 'done' ? now : null,
          board_visible: true,
        })
        .commit();
      return taskRef.id;
    },
    []
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
    ) => {
      const dbUpdates: Record<string, unknown> = {
        updated_at: Timestamp.now(),
      };

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
      if (updates.assigneeId !== undefined) {
        Object.assign(dbUpdates, singleAssigneeUpdate(updates.assigneeId));
      }

      await updateDoc(doc(db, 'tasks', taskId), dbUpdates);
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    await deleteDoc(doc(db, 'tasks', taskId));
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const taskRef = doc(db, 'tasks', taskId);
    const snapshot = await getDoc(taskRef);

    if (!snapshot.exists()) return;

    const current = snapshot.data() as FirestoreTaskData;
    const currentStatus = String(current.status || 'todo') as TaskStatus;
    const history = normalizeHistory(
      current.status_history ?? current.statusHistory,
      currentStatus
    );
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();

    if (history.length > 0 && !history[history.length - 1].exitedAt) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        exitedAt: nowIso,
      };
    }

    history.push({ status, enteredAt: nowIso });

    await updateDoc(taskRef, {
      status,
      status_history: history,
      completed_at: status === 'done' ? now : null,
      board_visible: true,
      updated_at: now,
    });

    const sector = String(current.sector || '');
    if (sector !== 'motoboys') return;

    const statusMap: Record<TaskStatus, string> = {
      todo: 'pending',
      in_progress: 'accepted',
      paused: 'accepted',
      done: 'completed',
    };

    const assignmentUpdate: Record<string, unknown> = {
      status: statusMap[status],
      updated_at: now,
      completed_at: status === 'done' ? now : null,
    };

    if (status === 'in_progress' || status === 'paused' || status === 'done') {
      assignmentUpdate.accepted_at = now;
    }

    // Concluir a tarefa nao conclui a corrida: exigimos foto assinada no fluxo Motoboy.
    if (status === 'done') return;

    const directSnapshot = await getDocs(
      query(collection(db, 'motoboy_assignments'), where('task_id', '==', taskId), limit(1))
    );

    if (!directSnapshot.empty) {
      const assignmentDoc = directSnapshot.docs[0];
      const assignment = assignmentDoc.data();

      if (assignment.accepted_at && assignmentUpdate.accepted_at) {
        assignmentUpdate.accepted_at = assignment.accepted_at;
      }

      if (status === 'todo') assignmentUpdate.accepted_at = null;

      await updateDoc(doc(db, 'motoboy_assignments', assignmentDoc.id), assignmentUpdate);
      return;
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
      ...singleAssigneeUpdate(userId),
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
}
