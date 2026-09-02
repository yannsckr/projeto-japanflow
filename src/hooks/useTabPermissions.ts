import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchPermissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_tab_permissions')
      .select('user_id, tab_key, enabled');
    if (!error && data) {
      setPermissions(data as TabPermission[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPermissions();
    const channel = supabase
      .channel('user_tab_permissions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_tab_permissions' },
        () => {
          fetchPermissions();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPermissions]);

  const setPermission = useCallback(
    async (userId: string, tabKey: TabKey, enabled: boolean) => {
      // Optimistic update
      setPermissions((prev) => {
        const filtered = prev.filter((p) => !(p.user_id === userId && p.tab_key === tabKey));
        return [...filtered, { user_id: userId, tab_key: tabKey, enabled }];
      });
      const { error } = await supabase
        .from('user_tab_permissions')
        .upsert(
          { user_id: userId, tab_key: tabKey, enabled, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,tab_key' }
        );
      if (error) {
        console.error('Erro ao salvar permissão:', error);
        fetchPermissions();
      }
    },
    [fetchPermissions]
  );

  /**
   * Returns whether a tab is enabled for a user.
   * If no record exists, falls back to the provided default (default-allow rules).
   */
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
