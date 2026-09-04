import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  query,
} from 'firebase/firestore';

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

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export const useCorporate = () => {
  const [bulletinPosts, setBulletinPosts] = useState<BulletinPost[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    let posts: any[] = [];
    let reactions: any[] = [];
    let suggestionsRows: any[] = [];
    let pollsRows: any[] = [];
    let optionsRows: any[] = [];
    let votesRows: any[] = [];

    const rebuild = () => {
      const mappedReactions: BulletinReaction[] = reactions.map((r) => ({
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        emoji: r.emoji,
        createdAt: toIso(r.created_at),
      }));

      setBulletinPosts(
        posts
          .map((r) => ({
            id: r.id,
            title: r.title || '',
            content: r.content || '',
            createdBy: r.created_by || '',
            pinned: r.pinned === true,
            createdAt: toIso(r.created_at),
            reactions: mappedReactions.filter((rx) => rx.postId === r.id),
          }))
          .sort(
            (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)
          )
      );

      setSuggestions(
        suggestionsRows
          .map((r) => ({
            id: r.id,
            content: r.content || '',
            createdBy: r.created_by || '',
            status: r.status || 'pending',
            adminResponse: r.admin_response || null,
            createdAt: toIso(r.created_at),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );

      const now = new Date();
      setPolls(
        pollsRows
          .map((r) => {
            const expiresAt = toIso(r.expires_at) || r.expires_at || null;
            const isExpired = expiresAt ? new Date(expiresAt) <= now : false;
            return {
              id: r.id,
              question: r.question || '',
              createdBy: r.created_by || '',
              active: isExpired ? false : r.active !== false,
              createdAt: toIso(r.created_at),
              expiresAt,
              options: optionsRows
                .filter((o) => o.poll_id === r.id)
                .map((o) => ({
                  id: o.id,
                  pollId: o.poll_id,
                  label: o.label || '',
                })),
              votes: votesRows
                .filter((v) => v.poll_id === r.id)
                .map((v) => ({
                  id: v.id,
                  pollId: v.poll_id,
                  optionId: v.option_id,
                  voterId: v.voter_id,
                })),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    };

    const unsubs = [
      onSnapshot(collection(db, 'bulletin_posts'), (snap) => {
        posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
      onSnapshot(collection(db, 'bulletin_reactions'), (snap) => {
        reactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
      onSnapshot(collection(db, 'suggestions'), (snap) => {
        suggestionsRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
      onSnapshot(collection(db, 'polls'), (snap) => {
        pollsRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
      onSnapshot(collection(db, 'poll_options'), (snap) => {
        optionsRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
      onSnapshot(collection(db, 'poll_votes'), (snap) => {
        votesRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rebuild();
      }),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  const addBulletinPost = useCallback(async (title: string, content: string, createdBy: string) => {
    await addDoc(collection(db, 'bulletin_posts'), {
      title,
      content,
      created_by: createdBy,
      pinned: false,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  }, []);

  const deleteBulletinPost = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'bulletin_posts', id));
  }, []);

  const togglePinPost = useCallback(async (id: string, pinned: boolean) => {
    await updateDoc(doc(db, 'bulletin_posts', id), {
      pinned: !pinned,
      updated_at: Timestamp.now(),
    });
  }, []);

  const toggleReaction = useCallback(async (postId: string, userId: string, emoji: string) => {
    const snap = await getDocs(
      query(
        collection(db, 'bulletin_reactions'),
        where('post_id', '==', postId),
        where('user_id', '==', userId),
        where('emoji', '==', emoji)
      )
    );

    if (!snap.empty) {
      await Promise.all(
        snap.docs.map((reactionDoc) => deleteDoc(doc(db, 'bulletin_reactions', reactionDoc.id)))
      );
    } else {
      await addDoc(collection(db, 'bulletin_reactions'), {
        post_id: postId,
        user_id: userId,
        emoji,
        created_at: Timestamp.now(),
      });
    }
  }, []);

  const addSuggestion = useCallback(async (content: string, createdBy: string) => {
    await addDoc(collection(db, 'suggestions'), {
      content,
      created_by: createdBy,
      status: 'pending',
      admin_response: null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  }, []);

  const respondSuggestion = useCallback(async (id: string, response: string) => {
    await updateDoc(doc(db, 'suggestions', id), {
      admin_response: response,
      status: 'responded',
      updated_at: Timestamp.now(),
    });
  }, []);

  const deleteSuggestion = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'suggestions', id));
  }, []);

  const createPoll = useCallback(
    async (question: string, options: string[], createdBy: string, expiresAt?: string) => {
      const pollRef = await addDoc(collection(db, 'polls'), {
        question,
        created_by: createdBy,
        active: true,
        expires_at: expiresAt || null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await Promise.all(
        options.map((label) =>
          addDoc(collection(db, 'poll_options'), {
            poll_id: pollRef.id,
            label,
            created_at: Timestamp.now(),
          })
        )
      );
    },
    []
  );

  const votePoll = useCallback(async (pollId: string, optionId: string, voterId: string) => {
    const voteId = `${pollId}__${voterId}`;
    await setDoc(doc(db, 'poll_votes', voteId), {
      poll_id: pollId,
      option_id: optionId,
      voter_id: voterId,
      created_at: Timestamp.now(),
    });
  }, []);

  const closePoll = useCallback(async (pollId: string) => {
    await updateDoc(doc(db, 'polls', pollId), {
      active: false,
      updated_at: Timestamp.now(),
    });
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
