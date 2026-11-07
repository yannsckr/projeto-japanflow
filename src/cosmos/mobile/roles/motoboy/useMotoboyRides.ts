import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Ride = {
  id: string;
  assignedTo: string;
  clientName: string;
  location: string;
  description: string;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  scheduledFor: string | null;
  routeId: string | null;
  routeOrder: number | null;
};

const timeString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
};

// Escuta apenas as corridas do funcionario autenticado. Reutiliza a colecao do site.
export function useMotoboyRides(userId?: string) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setRides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return onSnapshot(
      query(collection(db, 'motoboy_assignments'), where('assigned_to', '==', userId)),
      (snapshot) => {
        setRides(
          snapshot.docs.map((record) => {
            const data = record.data();
            return {
              id: record.id,
              assignedTo: String(data.assigned_to || ''),
              clientName: String(data.client_name || ''),
              location: String(data.location || ''),
              description: String(data.description || ''),
              status: String(data.status || 'pending'),
              createdAt: timeString(data.created_at) || '',
              acceptedAt: timeString(data.accepted_at),
              scheduledFor: timeString(data.scheduled_for),
              routeId: typeof data.route_id === 'string' ? data.route_id : null,
              routeOrder: typeof data.route_order === 'number' ? data.route_order : null,
            };
          })
        );
        setLoading(false);
      },
      (reason) => {
        console.error('Falha ao acompanhar corridas do motoboy:', reason);
        setError(
          'Não foi possível sincronizar as corridas. Verifique a conexão e suas permissões.'
        );
        setLoading(false);
      }
    );
  }, [userId]);

  const grouped = useMemo(() => {
    const sorted = [...rides].sort(
      (a, b) =>
        (a.routeOrder ?? 9999) - (b.routeOrder ?? 9999) ||
        (a.scheduledFor || a.createdAt).localeCompare(b.scheduledFor || b.createdAt)
    );
    return {
      // Corridas designadas ainda nao iniciadas: definicao operacional da Patricia.
      pending: sorted.filter((ride) => ride.status === 'pending'),
      active: sorted.filter((ride) => ride.status === 'accepted'),
      scheduled: sorted.filter((ride) => ride.status === 'pending_approval'),
      completed: sorted.filter((ride) => ride.status === 'completed'),
      // 'Sua rota' inclui o planejamento e a corrida ativa; nao inclui pendencias de aprovacao.
      route: sorted.filter((ride) => ride.status === 'pending' || ride.status === 'accepted'),
    };
  }, [rides]);

  return { ...grouped, loading, error };
}
