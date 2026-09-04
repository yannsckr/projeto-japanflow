import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  collection,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { mockUsers } from '@/data/mockData';
import { User, Sector, UserRole } from '@/types';

const USERS_CACHE_KEY = 'japanflow-users-cache-v1';

interface DbUser {
  id: string;
  name: string;
  username: string;
  password: string;
  role: string;
  avatar: string | null;
  sectors: string[];
  function: string | null;
  background_color: string | null;
  created_at: any;
  updated_at: any;
}

function dbToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    username: dbUser.username,
    password: dbUser.password,
    role: dbUser.role as UserRole,
    avatar: dbUser.avatar || undefined,
    sectors: (dbUser.sectors || []) as Sector[],
    function: dbUser.function || undefined,
    backgroundColor: dbUser.background_color || undefined,
  };
}

function sanitizeUsers(value: unknown): User[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((candidate): candidate is User => {
      const user = candidate as Partial<User>;
      return Boolean(
        user &&
          typeof user.id === 'string' &&
          typeof user.name === 'string' &&
          typeof user.username === 'string' &&
          typeof user.password === 'string' &&
          typeof user.role === 'string' &&
          Array.isArray(user.sectors)
      );
    })
    .map((user) => ({
      ...user,
      username: user.username.trim(),
      password: user.password.trim(),
      sectors: Array.isArray(user.sectors) ? user.sectors : [],
    }))
    .filter((user) => user.username.length > 0 && user.password.length > 0);
}

function getFallbackUsers(): User[] {
  return mockUsers.map((user) => ({ ...user, sectors: [...user.sectors] }));
}

function readCachedUsers(): User[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return [];
    return sanitizeUsers(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeCachedUsers(users: User[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
  } catch {
    // noop
  }
}

export function useSupabaseUsers() {
  const initialUsersRef = useRef<User[]>([]);

  if (initialUsersRef.current.length === 0) {
    const cachedUsers = readCachedUsers();
    initialUsersRef.current = cachedUsers.length > 0 ? cachedUsers : getFallbackUsers();
  }

  const [users, setUsers] = useState<User[]>(initialUsersRef.current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usersRef = useRef<User[]>(initialUsersRef.current);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    setLoading(usersRef.current.length === 0);

    const usersQuery = query(
      collection(db, 'app_users'),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        if (snapshot.empty) {
          const fallbackUsers = getFallbackUsers();
          usersRef.current = fallbackUsers;
          setUsers(fallbackUsers);
          writeCachedUsers(fallbackUsers);
          setError(null);
          setLoading(false);
          return;
        }

        const mappedUsers = snapshot.docs.map((userDoc) => {
          const data = userDoc.data();

          return dbToUser({
            id: userDoc.id,
            name: data.name || '',
            username: data.username || '',
            password: data.password || '',
            role: data.role || 'employee',
            avatar: data.avatar || null,
            sectors: Array.isArray(data.sectors) ? data.sectors : [],
            function: data.function || null,
            background_color: data.background_color || null,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        });

        const sanitized = sanitizeUsers(mappedUsers);
        usersRef.current = sanitized;
        setUsers(sanitized);
        writeCachedUsers(sanitized);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Error fetching users:', snapshotError);

        if (usersRef.current.length === 0) {
          const fallbackUsers = getFallbackUsers();
          usersRef.current = fallbackUsers;
          setUsers(fallbackUsers);
          writeCachedUsers(fallbackUsers);
        }

        setError(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addUser = useCallback(async (user: Omit<User, 'id'>) => {
    const id = `emp-${Date.now()}`;

    await setDoc(doc(db, 'app_users', id), {
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role,
      sectors: user.sectors || [],
      function: user.function || null,
      avatar: user.avatar || null,
      background_color: user.backgroundColor || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  }, []);

  const updateUser = useCallback(
    async (
      userId: string,
      updates: Partial<
        Pick<User, 'name' | 'username' | 'password' | 'sectors' | 'function' | 'avatar'>
      >
    ) => {
      const dbUpdates: Record<string, any> = { updated_at: Timestamp.now() };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.password !== undefined) dbUpdates.password = updates.password;
      if (updates.sectors !== undefined) dbUpdates.sectors = updates.sectors;
      if (updates.function !== undefined) dbUpdates.function = updates.function || null;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar || null;

      await updateDoc(doc(db, 'app_users', userId), dbUpdates);
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    await deleteDoc(doc(db, 'app_users', userId));
  }, []);

  const updateProfile = useCallback(
    async (userId: string, updates: { avatar?: string; backgroundColor?: string }) => {
      const dbUpdates: Record<string, any> = { updated_at: Timestamp.now() };

      if (updates.avatar !== undefined) {
        dbUpdates.avatar = updates.avatar || null;
      }

      if (updates.backgroundColor !== undefined) {
        dbUpdates.background_color = updates.backgroundColor || null;
      }

      await updateDoc(doc(db, 'app_users', userId), dbUpdates);
    },
    []
  );

  return { users, loading, error, addUser, updateUser, deleteUser, updateProfile };
}
