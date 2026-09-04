import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, TaskStatus, Priority, Sector } from '@/types';

export function useFirebaseTasks(
  usersForAutoAssign: { id: string; role?: string; sectors?: Sector[] }[],
  enabled: boolean = true
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const tasksCol = collection(db, 'tasks');
    const q = query(tasksCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Task[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Task[];
        setTasks(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar tarefas:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addTask = useCallback(
    async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
      try {
        const docRef = doc(collection(db, 'tasks'));
        const now = new Date().toISOString();

        // Estrutura flexível para o histórico inicial sem quebrar o contrato de tipo
        const initialHistoryEntry: any = {
          status: newTask.status,
          timestamp: now,
          changedAt: now,
          date: now,
        };

        const taskData = {
          ...newTask,
          id: docRef.id,
          createdAt: now,
          updatedAt: now,
          statusHistory: [initialHistoryEntry],
        } as unknown as Task;

        await setDoc(docRef, taskData);
      } catch (err) {
        console.error('Erro ao criar tarefa:', err);
      }
    },
    []
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline' | 'assigneeId'>>
    ) => {
      try {
        const docRef = doc(db, 'tasks', taskId);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Erro ao atualizar tarefa:', err);
      }
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      console.error('Erro ao deletar tarefa:', err);
    }
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    try {
      const docRef = doc(db, 'tasks', taskId);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        status,
        updatedAt: now,
      });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  }, []);

  const updateTaskPriority = useCallback(async (taskId: string, priority: Priority) => {
    try {
      const docRef = doc(db, 'tasks', taskId);
      await updateDoc(docRef, {
        priority,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erro ao alterar prioridade:', err);
    }
  }, []);

  const claimSectorTask = useCallback(async (taskId: string, userId: string) => {
    try {
      const docRef = doc(db, 'tasks', taskId);
      await updateDoc(docRef, {
        assigneeId: userId,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erro ao assumir tarefa do setor:', err);
    }
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
