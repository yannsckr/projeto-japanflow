import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FeatureKey =
  | 'motoboy_management'
  | 'request_reverse'
  | 'tracking_warranties'
  | 'corporate_tools'
  | 'sales_calculator'
  | 'transfer_tasks';

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  motoboy_management: 'Gestão de Motoboys',
  request_reverse: 'Solicitar Envio Reverso',
  tracking_warranties: 'Rastreamentos & Garantias',
  corporate_tools: 'Ferramentas Corporativas',
  sales_calculator: 'Calculadora de Vendas',
  transfer_tasks: 'Transferir Tarefas',
};

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  motoboy_management: 'Aprovar, criar, editar e excluir corridas (além da Patrícia/admins)',
  request_reverse: 'Criar solicitações de envio reverso',
  tracking_warranties:
    'Adicionar/excluir rastreamentos e gerenciar garantias (além do William/admins)',
  corporate_tools: 'Publicar avisos, mural, enquetes e responder sugestões',
  sales_calculator: 'Acessar calculadora de vendas (SJC, ML, DIFAL)',
  transfer_tasks: 'Transferir tarefas para outros usuários (além dos admins)',
};

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  'motoboy_management',
  'request_reverse',
  'tracking_warranties',
  'corporate_tools',
  'sales_calculator',
  'transfer_tasks',
];

export interface FeaturePermission {
  user_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
}

export const useFeaturePermissions = () => {
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_feature_permissions')
      .select('user_id, feature_key, enabled');
    if (!error && data) setPermissions(data as FeaturePermission[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPermissions();
    const channel = supabase
      .channel('user_feature_permissions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_feature_permissions' },
        () => fetchPermissions()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPermissions]);

  const setPermission = useCallback(
    async (userId: string, featureKey: FeatureKey, enabled: boolean) => {
      setPermissions((prev) => {
        const filtered = prev.filter(
          (p) => !(p.user_id === userId && p.feature_key === featureKey)
        );
        return [...filtered, { user_id: userId, feature_key: featureKey, enabled }];
      });
      const { error } = await supabase.from('user_feature_permissions').upsert(
        {
          user_id: userId,
          feature_key: featureKey,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,feature_key' }
      );
      if (error) {
        console.error('Erro ao salvar permissão:', error);
        fetchPermissions();
      }
    },
    [fetchPermissions]
  );

  const hasFeature = useCallback(
    (userId: string | undefined, featureKey: FeatureKey): boolean => {
      if (!userId) return false;
      const record = permissions.find((p) => p.user_id === userId && p.feature_key === featureKey);
      return record?.enabled === true;
    },
    [permissions]
  );

  return { permissions, loading, setPermission, hasFeature };
};
