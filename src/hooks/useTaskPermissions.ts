import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskPermission {
  id: string;
  granterId: string;
  targetType: 'employee' | 'sector';
  targetValue: string;
}

export const useTaskPermissions = () => {
  const [permissions, setPermissions] = useState<TaskPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('task_permissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setPermissions(
          data.map((r: any) => ({
            id: r.id,
            granterId: r.granter_id,
            targetType: r.target_type as 'employee' | 'sector',
            targetValue: r.target_value,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('task-permissions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_permissions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as any;
            setPermissions((prev) => {
              if (prev.find((p) => p.id === r.id)) return prev;
              return [
                {
                  id: r.id,
                  granterId: r.granter_id,
                  targetType: r.target_type,
                  targetValue: r.target_value,
                },
                ...prev,
              ];
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as any).id;
            setPermissions((prev) => prev.filter((p) => p.id !== id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addPermission = useCallback(
    async (granterId: string, targetType: 'employee' | 'sector', targetValue: string) => {
      const { error } = await supabase.from('task_permissions').insert({
        granter_id: granterId,
        target_type: targetType,
        target_value: targetValue,
      });
      if (error) console.error('Error adding permission:', error);
    },
    []
  );

  const removePermission = useCallback(async (id: string) => {
    const { error } = await supabase.from('task_permissions').delete().eq('id', id);
    if (error) console.error('Error removing permission:', error);
  }, []);

  const getPermissionsForUser = useCallback(
    (userId: string) => {
      return permissions.filter((p) => p.granterId === userId);
    },
    [permissions]
  );

  const canAssignToEmployee = useCallback(
    (granterId: string, targetEmployeeId: string) => {
      return permissions.some(
        (p) =>
          p.granterId === granterId &&
          p.targetType === 'employee' &&
          p.targetValue === targetEmployeeId
      );
    },
    [permissions]
  );

  const canAssignToSector = useCallback(
    (granterId: string, sector: string) => {
      return permissions.some(
        (p) => p.granterId === granterId && p.targetType === 'sector' && p.targetValue === sector
      );
    },
    [permissions]
  );

  return {
    permissions,
    loading,
    addPermission,
    removePermission,
    getPermissionsForUser,
    canAssignToEmployee,
    canAssignToSector,
  };
};
