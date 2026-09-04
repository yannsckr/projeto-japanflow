import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  sharedByUserId?: string;
}

interface PersonalNoteFirestore {
  userId: string;
  title: string;
  content: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapNote(
  id: string,
  data: PersonalNoteFirestore,
  isShared = false,
  sharedByUserId?: string
): PersonalNote {
  return {
    id,
    userId: data.userId,
    title: data.title || '',
    content: data.content || '',
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : new Date().toISOString(),
    isShared,
    sharedByUserId,
  };
}

export function usePersonalNotes(userId: string | null) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);

  const fetchNotes = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      return;
    }

    try {
      const ownQuery = query(collection(db, 'personal_notes'), where('userId', '==', userId));

      const sharesQuery = query(
        collection(db, 'personal_note_shares'),
        where('sharedWithUserId', '==', userId)
      );

      const [ownSnapshot, sharesSnapshot] = await Promise.all([
        getDocs(ownQuery),
        getDocs(sharesQuery),
      ]);

      const ownNotes = ownSnapshot.docs.map((noteDoc) =>
        mapNote(noteDoc.id, noteDoc.data() as PersonalNoteFirestore)
      );

      const ownIds = new Set(ownNotes.map((note) => note.id));

      const sharedNotes: PersonalNote[] = [];

      for (const shareDoc of sharesSnapshot.docs) {
        const shareData = shareDoc.data();

        const noteId = shareData.noteId as string;
        const sharedByUserId = shareData.sharedByUserId as string;

        if (!noteId || ownIds.has(noteId)) continue;

        const noteSnapshot = await getDoc(doc(db, 'personal_notes', noteId));

        if (!noteSnapshot.exists()) continue;

        sharedNotes.push(
          mapNote(
            noteSnapshot.id,
            noteSnapshot.data() as PersonalNoteFirestore,
            true,
            sharedByUserId
          )
        );
      }

      const allNotes = [...ownNotes, ...sharedNotes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setNotes(allNotes);
    } catch (error) {
      console.error('Erro ao carregar notas pessoais:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(
    async (title: string, content: string) => {
      if (!userId) return;

      try {
        const now = Timestamp.now();

        await addDoc(collection(db, 'personal_notes'), {
          userId,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        });

        await fetchNotes();
      } catch (error) {
        console.error('Erro ao criar nota:', error);
      }
    },
    [userId, fetchNotes]
  );

  const updateNote = useCallback(
    async (
      noteId: string,
      updates: {
        title?: string;
        content?: string;
      }
    ) => {
      try {
        await updateDoc(doc(db, 'personal_notes', noteId), {
          ...updates,
          updatedAt: Timestamp.now(),
        });

        await fetchNotes();
      } catch (error) {
        console.error('Erro ao atualizar nota:', error);
      }
    },
    [fetchNotes]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      try {
        await deleteDoc(doc(db, 'personal_notes', noteId));

        const sharesQuery = query(
          collection(db, 'personal_note_shares'),
          where('noteId', '==', noteId)
        );

        const sharesSnapshot = await getDocs(sharesQuery);

        await Promise.all(
          sharesSnapshot.docs.map((shareDoc) =>
            deleteDoc(doc(db, 'personal_note_shares', shareDoc.id))
          )
        );

        await fetchNotes();
      } catch (error) {
        console.error('Erro ao excluir nota:', error);
      }
    },
    [fetchNotes]
  );

  const shareNote = useCallback(
    async (noteId: string, targetUserId: string) => {
      if (!userId) return;

      try {
        const existingQuery = query(
          collection(db, 'personal_note_shares'),
          where('noteId', '==', noteId),
          where('sharedWithUserId', '==', targetUserId)
        );

        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) return;

        await addDoc(collection(db, 'personal_note_shares'), {
          noteId,
          sharedWithUserId: targetUserId,
          sharedByUserId: userId,
          createdAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Erro ao compartilhar nota:', error);
      }
    },
    [userId]
  );

  const unshareNote = useCallback(async (noteId: string, targetUserId: string) => {
    try {
      const sharesQuery = query(
        collection(db, 'personal_note_shares'),
        where('noteId', '==', noteId),
        where('sharedWithUserId', '==', targetUserId)
      );

      const snapshot = await getDocs(sharesQuery);

      await Promise.all(
        snapshot.docs.map((shareDoc) => deleteDoc(doc(db, 'personal_note_shares', shareDoc.id)))
      );
    } catch (error) {
      console.error('Erro ao remover compartilhamento:', error);
    }
  }, []);

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    shareNote,
    unshareNote,
    fetchNotes,
  };
}
