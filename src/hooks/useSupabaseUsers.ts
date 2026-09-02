import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  created_at: string;
  updated_at: string;
}

function dbToUser(db: DbUser): User {
  return {
    id: db.id,
    name: db.name,
    username: db.username,
    password: db.password,
    role: db.role as UserRole,
    avatar: db.avatar || undefined,
    sectors: (db.sectors || []) as Sector[],
    function: db.function || undefined,
    backgroundColor: db.background_color || undefined,
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

    const parsed = JSON.parse(raw);
    return sanitizeUsers(parsed);
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
  const isFetchingRef = useRef(false);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const fetchUsers = useCallback(async () => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (usersRef.current.length === 0) {
      setLoading(true);
    }

    const retryDelays = [0, 1200, 3000];

    try {
      for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
        if (retryDelays[attempt] > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        }

        const { data, error } = await supabase
          .from('app_users')
          .select(
            'id, name, username, password, role, avatar, sectors, function, background_color, created_at, updated_at'
          )
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mappedUsers = data.map((d: any) => dbToUser(d as DbUser));
          usersRef.current = mappedUsers;
          setUsers(mappedUsers);
          writeCachedUsers(mappedUsers);
          setError(null);
          return;
        }

        if (!error && Array.isArray(data) && data.length === 0) {
          const fallbackUsers = getFallbackUsers();
          usersRef.current = fallbackUsers;
          setUsers(fallbackUsers);
          writeCachedUsers(fallbackUsers);
          setError(null);
          return;
        }

        const isLastAttempt = attempt === retryDelays.length - 1;
        if (isLastAttempt) {
          console.error('Error fetching users:', error);

          if (usersRef.current.length === 0) {
            const fallbackUsers = getFallbackUsers();
            usersRef.current = fallbackUsers;
            setUsers(fallbackUsers);
            writeCachedUsers(fallbackUsers);
            setError(null);
          } else {
            setError(null);
          }
        }
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    // Realtime cobre mudanças; polling fica como safety-net a cada 15min
    // e somente quando aba está visível.
    const refreshInterval = setInterval(() => {
      if (!document.hidden) fetchUsers();
    }, 900000);

    const channel = supabase
      .channel('app-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  const addUser = useCallback(async (user: Omit<User, 'id'>) => {
    const id = `emp-${Date.now()}`;
    await supabase.from('app_users').insert({
      id,
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role,
      sectors: user.sectors as any,
      function: user.function || null,
    });
  }, []);

  const updateUser = useCallback(
    async (
      userId: string,
      updates: Partial<
        Pick<User, 'name' | 'username' | 'password' | 'sectors' | 'function' | 'avatar'>
      >
    ) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.password !== undefined) dbUpdates.password = updates.password;
      if (updates.sectors !== undefined) dbUpdates.sectors = updates.sectors;
      if (updates.function !== undefined) dbUpdates.function = updates.function;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('app_users').update(dbUpdates).eq('id', userId);
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    await supabase.from('app_users').delete().eq('id', userId);
  }, []);

  const updateProfile = useCallback(
    async (userId: string, updates: { avatar?: string; backgroundColor?: string }) => {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.backgroundColor !== undefined)
        dbUpdates.background_color = updates.backgroundColor;
      await supabase.from('app_users').update(dbUpdates).eq('id', userId);
    },
    []
  );

  return { users, loading, error, addUser, updateUser, deleteUser, updateProfile };
}
