import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mapTask } from '@/hooks/useFirebaseTasks';
import type { Task } from '@/types';

/** Consulta as tarefas de um único criador; não faz leitura da coleção inteira. */
export function useCreatedTasks(creatorId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTasks([]);
    setError(null);
    if (!creatorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const snapshots = new Map<string, Map<string, Task>>();
    let active = true;
    const sources = ['created_by', 'createdBy'] as const;
    const unsubscribers = sources.map((field) =>
      onSnapshot(
        query(collection(db, 'tasks'), where(field, '==', creatorId)),
        (snapshot) => {
          if (!active) return;
          snapshots.set(field, new Map(snapshot.docs.map((d) => [d.id, mapTask(d.id, d.data())])));
          const merged = new Map<string, Task>();
          snapshots.forEach((items) => items.forEach((task, id) => merged.set(id, task)));
          setTasks([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
          setError(null);
          setLoading(false);
        },
        (cause) => {
          if (!active) return;
          setError(`Não foi possível consultar ${field}: ${cause.message}`);
          setLoading(false);
        }
      )
    );
    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [creatorId]);
  return { tasks, loading, error };
}
