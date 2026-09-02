import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomGroup {
  id: string;
  name: string;
  createdBy: string;
  participants: string[]; // array of user IDs
  createdAt: string;
}

export function useCustomGroups() {
  const [groups, setGroups] = useState<CustomGroup[]>([]);

  const fetchGroups = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGroups(
        data.map((g: any) => ({
          id: g.id,
          name: g.name,
          createdBy: g.created_by,
          participants: (g.participants as string[]) || [],
          createdAt: g.created_at,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    const channel = supabase
      .channel('custom-groups-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_groups' }, () =>
        fetchGroups()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGroups]);

  const createGroup = useCallback(
    async (name: string, participants: string[], createdBy: string) => {
      await supabase.from('custom_groups').insert({
        name,
        participants: participants as any,
        created_by: createdBy,
      });
    },
    []
  );

  const deleteGroup = useCallback(async (id: string) => {
    await supabase.from('custom_groups').delete().eq('id', id);
  }, []);

  return { groups, createGroup, deleteGroup };
}
