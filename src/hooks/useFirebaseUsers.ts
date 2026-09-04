import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';

export function useFirebaseUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersCol,
      (snapshot) => {
        const userList: User[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || '',
            username: data.username || '',
            password: data.password || '',
            role: data.role || 'user',
            sectors: data.sectors || [],
            function: data.function || '',
            avatar: data.avatar || '',
            backgroundColor: data.backgroundColor || '',
          } as User;
        });
        setUsers(userList);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar usuários do Firebase:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addUser = useCallback(async (newUser: Omit<User, 'id'>) => {
    try {
      const docRef = doc(collection(db, 'users'));
      await setDoc(docRef, { ...newUser, createdAt: new Date().toISOString() });
    } catch (err: any) {
      console.error('Erro ao adicionar usuário:', err);
    }
  }, []);

  const updateUser = useCallback(
    async (
      userId: string,
      updates: Partial<Pick<User, 'name' | 'username' | 'password' | 'sectors' | 'function'>>
    ) => {
      try {
        const docRef = doc(db, 'users', userId);
        await updateDoc(docRef, updates);
      } catch (err: any) {
        console.error('Erro ao atualizar usuário:', err);
      }
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err: any) {
      console.error('Erro ao deletar usuário:', err);
    }
  }, []);

  const updateProfile = useCallback(
    async (userId: string, updates: { avatar?: string; backgroundColor?: string }) => {
      try {
        const docRef = doc(db, 'users', userId);
        await updateDoc(docRef, updates);
      } catch (err: any) {
        console.error('Erro ao atualizar perfil:', err);
      }
    },
    []
  );

  return { users, loading, error, addUser, updateUser, deleteUser, updateProfile };
}
