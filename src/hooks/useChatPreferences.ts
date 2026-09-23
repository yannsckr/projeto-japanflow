import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export interface ChatPreference {
  partnerId: string;
  pinned: boolean;
  archived: boolean;
  favorite: boolean;
  muted: boolean;
}

const emptyPreference = (partnerId: string): ChatPreference => ({
  partnerId,
  pinned: false,
  archived: false,
  favorite: false,
  muted: false,
});

export function useChatPreferences(userId: string | null | undefined) {
  const [preferences, setPreferences] = useState<Record<string, ChatPreference>>({});

  useEffect(() => {
    if (!userId) {
      setPreferences({});
      return;
    }

    const prefsQuery = query(collection(db, 'chat_preferences'), where('user_id', '==', userId));

    return onSnapshot(
      prefsQuery,
      (snapshot) => {
        const next: Record<string, ChatPreference> = {};

        snapshot.docs.forEach((prefDoc) => {
          const data = prefDoc.data();
          const partnerId = String(data.partner_id || '');
          if (!partnerId) return;

          next[partnerId] = {
            partnerId,
            pinned: data.pinned === true,
            archived: data.archived === true,
            favorite: data.favorite === true,
            muted: data.muted === true,
          };
        });

        setPreferences(next);
      },
      (error) => console.error('Erro ao carregar preferências do chat:', error)
    );
  }, [userId]);

  const getPreference = useCallback(
    (partnerId: string) => preferences[partnerId] || emptyPreference(partnerId),
    [preferences]
  );

  const updatePreference = useCallback(
    async (partnerId: string, patch: Partial<Omit<ChatPreference, 'partnerId'>>) => {
      if (!userId || !partnerId) return;

      const previous = preferences[partnerId] || emptyPreference(partnerId);

      setPreferences((current) => ({
        ...current,
        [partnerId]: {
          ...(current[partnerId] || emptyPreference(partnerId)),
          ...patch,
          partnerId,
        },
      }));

      const preferenceId = `${userId}__${partnerId}`;

      try {
        await setDoc(
          doc(db, 'chat_preferences', preferenceId),
          {
            user_id: userId,
            partner_id: partnerId,
            ...patch,
            updated_at: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (error) {
        setPreferences((current) => ({ ...current, [partnerId]: previous }));
        throw error;
      }
    },
    [preferences, userId]
  );

  const mutedPartnerIds = useMemo(
    () =>
      new Set(
        Object.values(preferences)
          .filter((item) => item.muted)
          .map((item) => item.partnerId)
      ),
    [preferences]
  );

  return { preferences, getPreference, updatePreference, mutedPartnerIds };
}
