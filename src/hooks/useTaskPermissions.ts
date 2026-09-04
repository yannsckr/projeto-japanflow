import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

export interface TaskPermission {
  id: string;
  granterId: string;
  targetType: 'employee' | 'sector';
  targetValue: string;
}

interface TaskPermissionFirestore {
  granterId: string;
  targetType: 'employee' | 'sector';
  targetValue: string;
  createdAt?: Timestamp;
}

export const useTaskPermissions = () => {
  const [permissions, setPermissions] = useState<TaskPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const permissionsQuery = query(
      collection(db, 'task_permissions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      permissionsQuery,
      (snapshot) => {
        const nextPermissions: TaskPermission[] = snapshot.docs.map(
          (permissionDoc) => {
            const data = permissionDoc.data() as TaskPermissionFirestore;

            return {
              id: permissionDoc.id,
              granterId: data.granterId,
              targetType: data.targetType,
              targetValue: data.targetValue,
            };
          }
        );

        setPermissions(nextPermissions);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Erro ao acompanhar permissões de tarefas:',
          error
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addPermission = useCallback(
    async (
      granterId: string,
      targetType: 'employee' | 'sector',
      targetValue: string
    ) => {
      try {
        await addDoc(collection(db, 'task_permissions'), {
          granterId,
          targetType,
          targetValue,
          createdAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Erro ao adicionar permissão:', error);
      }
    },
    []
  );

  const removePermission = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'task_permissions', id));
    } catch (error) {
      console.error('Erro ao remover permissão:', error);
    }
  }, []);

  const getPermissionsForUser = useCallback(
    (userId: string) => {
      return permissions.filter(
        (permission) => permission.granterId === userId
      );
    },
    [permissions]
  );

  const canAssignToEmployee = useCallback(
    (granterId: string, targetEmployeeId: string) => {
      return permissions.some(
        (permission) =>
          permission.granterId === granterId &&
          permission.targetType === 'employee' &&
          permission.targetValue === targetEmployeeId
      );
    },
    [permissions]
  );

  const canAssignToSector = useCallback(
    (granterId: string, sector: string) => {
      return permissions.some(
        (permission) =>
          permission.granterId === granterId &&
          permission.targetType === 'sector' &&
          permission.targetValue === sector
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