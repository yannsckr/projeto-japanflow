import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BulletinPost {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  pinned: boolean;
  createdAt: string;
  reactions: BulletinReaction[];
}

export interface BulletinReaction {
  id: string;
  postId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Suggestion {
  id: string;
  content: string;
  createdBy: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
}

export interface Poll {
  id: string;
  question: string;
  createdBy: string;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
  options: PollOption[];
  votes: PollVote[];
}

export interface PollOption {
  id: string;
  pollId: string;
  label: string;
}

export interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  voterId: string;
}

export const useSupabaseCorporate = () => {
  const [bulletinPosts, setBulletinPosts] = useState<BulletinPost[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);

  const fetchAll = useCallback(async () => {
    const [bp, sg, pl, po, pv, br] = await Promise.all([
      supabase
        .from('bulletin_posts')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('suggestions').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_options').select('*'),
      supabase.from('poll_votes').select('*'),
      supabase.from('bulletin_reactions').select('*'),
    ]);

    const reactions: BulletinReaction[] = (br.data || []).map((r: any) => ({
      id: r.id,
      postId: r.post_id,
      userId: r.user_id,
      emoji: r.emoji,
      createdAt: r.created_at,
    }));
    if (bp.data)
      setBulletinPosts(
        bp.data.map((r: any) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          createdBy: r.created_by,
          pinned: r.pinned,
          createdAt: r.created_at,
          reactions: reactions.filter((rx) => rx.postId === r.id),
        }))
      );
    if (sg.data)
      setSuggestions(
        sg.data.map((r: any) => ({
          id: r.id,
          content: r.content,
          createdBy: r.created_by,
          status: r.status,
          adminResponse: r.admin_response,
          createdAt: r.created_at,
        }))
      );

    if (pl.data && po.data && pv.data) {
      const options = po.data.map((r: any) => ({ id: r.id, pollId: r.poll_id, label: r.label }));
      const votes = pv.data.map((r: any) => ({
        id: r.id,
        pollId: r.poll_id,
        optionId: r.option_id,
        voterId: r.voter_id,
      }));
      const now = new Date();
      setPolls(
        pl.data.map((r: any) => {
          const expiresAt = r.expires_at;
          const isExpired = expiresAt && new Date(expiresAt) <= now;
          return {
            id: r.id,
            question: r.question,
            createdBy: r.created_by,
            active: isExpired ? false : r.active,
            createdAt: r.created_at,
            expiresAt,
            options: options.filter((o: PollOption) => o.pollId === r.id),
            votes: votes.filter((v: PollVote) => v.pollId === r.id),
          };
        })
      );
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const channels = [
      'bulletin_posts',
      'suggestions',
      'polls',
      'poll_options',
      'poll_votes',
      'bulletin_reactions',
    ].map((table) =>
      supabase
        .channel(`${table}-rt`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchAll())
        .subscribe()
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [fetchAll]);

  // Bulletin
  const addBulletinPost = useCallback(async (title: string, content: string, createdBy: string) => {
    await supabase.from('bulletin_posts').insert({ title, content, created_by: createdBy });
  }, []);
  const deleteBulletinPost = useCallback(async (id: string) => {
    await supabase.from('bulletin_posts').delete().eq('id', id);
  }, []);
  const togglePinPost = useCallback(async (id: string, pinned: boolean) => {
    await supabase.from('bulletin_posts').update({ pinned: !pinned }).eq('id', id);
  }, []);

  // Reactions
  const toggleReaction = useCallback(async (postId: string, userId: string, emoji: string) => {
    const { data: existing } = await supabase
      .from('bulletin_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from('bulletin_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('bulletin_reactions').insert({ post_id: postId, user_id: userId, emoji });
    }
  }, []);

  const addSuggestion = useCallback(async (content: string, createdBy: string) => {
    await supabase.from('suggestions').insert({ content, created_by: createdBy });
  }, []);
  const respondSuggestion = useCallback(async (id: string, response: string) => {
    await supabase
      .from('suggestions')
      .update({ admin_response: response, status: 'responded' })
      .eq('id', id);
  }, []);
  const deleteSuggestion = useCallback(async (id: string) => {
    await supabase.from('suggestions').delete().eq('id', id);
  }, []);

  const createPoll = useCallback(
    async (question: string, options: string[], createdBy: string, expiresAt?: string) => {
      const insert: any = { question, created_by: createdBy };
      if (expiresAt) insert.expires_at = expiresAt;
      const { data } = await supabase.from('polls').insert(insert).select().single();
      if (data) {
        await supabase
          .from('poll_options')
          .insert(options.map((label) => ({ poll_id: data.id, label })));
      }
    },
    []
  );
  const votePoll = useCallback(async (pollId: string, optionId: string, voterId: string) => {
    await supabase
      .from('poll_votes')
      .insert({ poll_id: pollId, option_id: optionId, voter_id: voterId });
  }, []);
  const closePoll = useCallback(async (pollId: string) => {
    await supabase.from('polls').update({ active: false }).eq('id', pollId);
  }, []);

  return {
    bulletinPosts,
    suggestions,
    polls,
    addBulletinPost,
    deleteBulletinPost,
    togglePinPost,
    toggleReaction,
    addSuggestion,
    respondSuggestion,
    deleteSuggestion,
    createPoll,
    votePoll,
    closePoll,
  };
};
