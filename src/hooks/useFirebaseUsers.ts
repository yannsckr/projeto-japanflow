import { useCallback, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { adminCreateUserApi } from '@/lib/api';
import { CreateUserInput, Sector, User, UserRole } from '@/types';

function mapUser(id: string, data: Record<string, any>): User {
  return {
    id,
    name: String(data.name || ''),
    username: String(data.username || ''),
    role: (data.role === 'admin' ? 'admin' : 'employee') as UserRole,
    sectors: (Array.isArray(data.sectors) ? data.sectors : []) as Sector[],
    function: data.function || undefined,
    avatar: data.avatar || undefined,
    backgroundColor: data.backgroundColor || data.background_color || undefined,
    authUid: data.auth_uid || data.authUid || undefined,
    authEmail: data.auth_email || data.authEmail || undefined,
    active: data.active !== false,
  };
}

export function useFirebaseUsers(enabled = true) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const userList = snapshot.docs
          .map((docSnap) => mapUser(docSnap.id, docSnap.data()))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        setUsers(userList);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar usuários do Firebase:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const addUser = useCallback(async (newUser: CreateUserInput) => {
    await adminCreateUserApi(newUser);
  }, []);

  const updateUser = useCallback(
    async (
      userId: string,
      updates: Partial<Pick<User, 'name' | 'role' | 'sectors' | 'function' | 'active' | 'avatar'>>
    ) => {
      const current = users.find((user) => user.id === userId);
      const userRef = doc(db, 'users', userId);
      const dbUpdates: Record<string, unknown> = { updated_at: Timestamp.now() };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.sectors !== undefined) dbUpdates.sectors = updates.sectors;
      if (updates.function !== undefined) dbUpdates.function = updates.function || null;
      if (updates.active !== undefined) dbUpdates.active = updates.active;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar || null;

      if (current?.authUid && (updates.role !== undefined || updates.active !== undefined)) {
        const batch = writeBatch(db);
        batch.update(userRef, dbUpdates);
        batch.update(doc(db, 'auth_links', current.authUid), {
          ...(updates.role !== undefined ? { role: updates.role } : {}),
          ...(updates.active !== undefined ? { active: updates.active } : {}),
          updated_at: Timestamp.now(),
        });
        await batch.commit();
        return;
      }

      await updateDoc(userRef, dbUpdates);
    },
    [users]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      await updateUser(userId, { active: false });
    },
    [updateUser]
  );

  const updateProfile = useCallback(
    async (userId: string, updates: { avatar?: string; backgroundColor?: string }) => {
      const dbUpdates: Record<string, unknown> = { updated_at: Timestamp.now() };

      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar || null;
      if (updates.backgroundColor !== undefined) {
        dbUpdates.backgroundColor = updates.backgroundColor || null;
      }

      await updateDoc(doc(db, 'users', userId), dbUpdates);
    },
    []
  );

  return { users, loading, error, addUser, updateUser, deleteUser, updateProfile };
}
