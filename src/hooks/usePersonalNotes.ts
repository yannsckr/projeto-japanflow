import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

function mapNote(n: any, isShared = false, sharedByUserId?: string): PersonalNote {
  return {
    id: n.id,
    userId: n.user_id,
    title: n.title,
    content: n.content,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    isShared,
    sharedByUserId,
  };
}

export function usePersonalNotes(userId: string | null) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;

    // Fetch own notes
    const { data: ownData } = await supabase
      .from('personal_notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    // Fetch notes shared with this user
    const { data: sharesData } = await supabase
      .from('personal_note_shares')
      .select('note_id, shared_by_user_id')
      .eq('shared_with_user_id', userId);

    const ownNotes = (ownData || []).map((n: any) => mapNote(n));

    if (sharesData && sharesData.length > 0) {
      const sharedNoteIds = sharesData.map((s: any) => s.note_id);
      const shareMap = new Map(sharesData.map((s: any) => [s.note_id, s.shared_by_user_id]));

      const { data: sharedNotesData } = await supabase
        .from('personal_notes')
        .select('*')
        .in('id', sharedNoteIds)
        .order('updated_at', { ascending: false });

      const sharedNotes = (sharedNotesData || [])
        .filter((n: any) => !ownNotes.some((own) => own.id === n.id))
        .map((n: any) => mapNote(n, true, shareMap.get(n.id)));

      setNotes([...ownNotes, ...sharedNotes]);
    } else {
      setNotes(ownNotes);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(
    async (title: string, content: string) => {
      if (!userId) return;
      await supabase.from('personal_notes').insert({ user_id: userId, title, content });
      fetchNotes();
    },
    [userId, fetchNotes]
  );

  const updateNote = useCallback(
    async (noteId: string, updates: { title?: string; content?: string }) => {
      await supabase
        .from('personal_notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', noteId);
      fetchNotes();
    },
    [fetchNotes]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await supabase.from('personal_notes').delete().eq('id', noteId);
      fetchNotes();
    },
    [fetchNotes]
  );

  const shareNote = useCallback(
    async (noteId: string, targetUserId: string) => {
      if (!userId) return;
      // Check if already shared
      const { data: existing } = await supabase
        .from('personal_note_shares')
        .select('id')
        .eq('note_id', noteId)
        .eq('shared_with_user_id', targetUserId);
      if (existing && existing.length > 0) return;

      await supabase.from('personal_note_shares').insert({
        note_id: noteId,
        shared_with_user_id: targetUserId,
        shared_by_user_id: userId,
      });
    },
    [userId]
  );

  const unshareNote = useCallback(async (noteId: string, targetUserId: string) => {
    await supabase
      .from('personal_note_shares')
      .delete()
      .eq('note_id', noteId)
      .eq('shared_with_user_id', targetUserId);
  }, []);

  return { notes, addNote, updateNote, deleteNote, shareNote, unshareNote, fetchNotes };
}
