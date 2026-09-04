import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

export interface CustomGroup {
  id: string;
  name: string;
  createdBy: string;
  participants: string[];
  createdAt: string;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useCustomGroups() {
  const [groups, setGroups] = useState<CustomGroup[]>([]);

  useEffect(() => {
    const groupsQuery = query(collection(db, 'custom_groups'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      groupsQuery,
      (snapshot) => {
        setGroups(
          snapshot.docs.map((groupDoc) => {
            const data = groupDoc.data();

            return {
              id: groupDoc.id,
              name: data.name || '',
              createdBy: data.created_by || '',
              participants: Array.isArray(data.participants) ? data.participants : [],
              createdAt: toIso(data.created_at),
            };
          })
        );
      },
      (error) => {
        console.error('Erro ao carregar grupos:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const createGroup = useCallback(
    async (name: string, participants: string[], createdBy: string) => {
      await addDoc(collection(db, 'custom_groups'), {
        name,
        participants,
        created_by: createdBy,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const deleteGroup = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'custom_groups', id));
  }, []);

  return {
    groups,
    createGroup,
    deleteGroup,
  };
}
