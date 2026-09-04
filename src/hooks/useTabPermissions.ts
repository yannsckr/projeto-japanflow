import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';

export type TabKey = 'financial' | 'corridas' | 'tracking';

export const TAB_LABELS: Record<TabKey, string> = {
  financial: 'Financeiro',
  corridas: 'Corridas',
  tracking: 'Acompanhamento',
};

export const ALL_TAB_KEYS: TabKey[] = ['financial', 'corridas', 'tracking'];

export interface TabPermission {
  user_id: string;
  tab_key: TabKey;
  enabled: boolean;
}

export const useTabPermissions = () => {
  const [permissions, setPermissions] = useState<TabPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'user_tab_permissions'),
      (snapshot) => {
        setPermissions(
          snapshot.docs.map((permissionDoc) => {
            const data = permissionDoc.data();
            return {
              user_id: data.user_id || '',
              tab_key: data.tab_key as TabKey,
              enabled: data.enabled === true,
            };
          })
        );
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar permissões de abas:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const setPermission = useCallback(async (userId: string, tabKey: TabKey, enabled: boolean) => {
    setPermissions((prev) => {
      const filtered = prev.filter((p) => !(p.user_id === userId && p.tab_key === tabKey));
      return [...filtered, { user_id: userId, tab_key: tabKey, enabled }];
    });

    const permissionId = `${userId}__${tabKey}`;

    try {
      await setDoc(
        doc(db, 'user_tab_permissions', permissionId),
        {
          user_id: userId,
          tab_key: tabKey,
          enabled,
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao salvar permissão:', error);
    }
  }, []);

  const isTabEnabled = useCallback(
    (userId: string, tabKey: TabKey, fallback: boolean): boolean => {
      const record = permissions.find((p) => p.user_id === userId && p.tab_key === tabKey);
      if (!record) return fallback;
      return record.enabled;
    },
    [permissions]
  );

  return { permissions, loading, setPermission, isTabEnabled };
};
