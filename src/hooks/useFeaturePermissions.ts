import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

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
  motoboy_management:
    'Aprovar, criar, editar e excluir corridas (além da Patrícia/admins)',
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

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'user_feature_permissions'),
      (snapshot) => {
        const nextPermissions = snapshot.docs
          .map((permissionDoc) => {
            const data = permissionDoc.data();
            return {
              user_id: data.user_id || '',
              feature_key: data.feature_key as FeatureKey,
              enabled: data.enabled === true,
            };
          })
          .filter(
            (permission) =>
              permission.user_id &&
              ALL_FEATURE_KEYS.includes(permission.feature_key)
          );

        setPermissions(nextPermissions);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar permissões:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const setPermission = useCallback(
    async (userId: string, featureKey: FeatureKey, enabled: boolean) => {
      const previous = permissions;

      setPermissions((prev) => {
        const filtered = prev.filter(
          (permission) =>
            !(permission.user_id === userId && permission.feature_key === featureKey)
        );

        return [...filtered, { user_id: userId, feature_key: featureKey, enabled }];
      });

      try {
        const permissionId = `${featureKey}__${userId}`;

        await setDoc(
          doc(db, 'user_feature_permissions', permissionId),
          {
            user_id: userId,
            feature_key: featureKey,
            enabled,
            updated_at: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Erro ao salvar permissão:', error);
        setPermissions(previous);
      }
    },
    [permissions]
  );

  const hasFeature = useCallback(
    (userId: string | undefined, featureKey: FeatureKey): boolean => {
      if (!userId) return false;

      const record = permissions.find(
        (permission) =>
          permission.user_id === userId &&
          permission.feature_key === featureKey
      );

      return record?.enabled === true;
    },
    [permissions]
  );

  return { permissions, loading, setPermission, hasFeature };
};
