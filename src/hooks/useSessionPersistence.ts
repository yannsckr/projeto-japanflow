import { User } from '@/types';

const SESSION_KEY = 'japanflow_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

interface StoredSession {
  user: User;
  expiresAt: number;
}

export const saveSession = (user: User) => {
  const session: StoredSession = {
    user,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const loadSession = (): User | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session.user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};
