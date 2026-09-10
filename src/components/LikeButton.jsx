import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getMyReaction, getReactionSummary, removeMyReaction, setMyReaction } from '../lib/api';
import { supabase } from '../lib/supabase';

const REACTIONS = [
  ['like', '👍', 'Like'],
  ['happy', '😊', 'Happy'],
  ['sad', '😢', 'Sad'],
  ['bad', '👎', 'Bad'],
  ['excited', '🤩', 'Excited'],
];

const EMPTY_COUNTS = { like: 0, happy: 0, sad: 0, bad: 0, excited: 0 };

export default function LikeButton({ postId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [myReaction, setMyReactionState] = useState(null);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [working, setWorking] = useState(false);

  async function reload() {
    const [summary, mine] = await Promise.all([
      getReactionSummary(postId),
      user ? getMyReaction(postId, user.id) : Promise.resolve(null),
    ]);
    setCounts(summary);
    setMyReactionState(mine?.reaction || null);
  }

  useEffect(() => {
    let active = true;
    reload().catch(() => {
      if (active) setCounts(EMPTY_COUNTS);
    });

    if (!supabase) return () => { active = false; };
    const channel = supabase
      .channel(`post-reactions-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions', filter: `post_id=eq.${postId}` }, () => {
        if (active) getReactionSummary(postId).then(setCounts).catch(() => {});
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // reload intentionally depends on post/user values below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  async function react(reaction) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}#reactions`)}`);
      return;
    }
    if (working) return;

    const previous = myReaction;
    setWorking(true);
    try {
      if (previous === reaction) {
        await removeMyReaction(postId, user.id);
        setMyReactionState(null);
        setCounts((current) => ({ ...current, [reaction]: Math.max(0, current[reaction] - 1) }));
        return;
      }

      await setMyReaction(postId, user.id, reaction);
      setMyReactionState(reaction);
      setCounts((current) => ({
        ...current,
        ...(previous ? { [previous]: Math.max(0, current[previous] - 1) } : {}),
        [reaction]: current[reaction] + 1,
      }));
    } catch (error) {
      toast.error(error.message || 'Could not save your reaction.');
      reload().catch(() => {});
    } finally {
      setWorking(false);
    }
  }

  return (
    <section id="reactions" className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Reader reaction</p>
          <h2 className="mt-1 text-xl font-black text-ink">How did this article make you feel?</h2>
        </div>
        {!user ? <span className="text-xs font-semibold text-gray-400">Sign in to react</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {REACTIONS.map(([value, emoji, label]) => {
          const selected = myReaction === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => react(value)}
              disabled={working}
              aria-pressed={selected}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition disabled:opacity-60 ${selected ? 'border-primary bg-blue-50 text-primary ring-2 ring-blue-100' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'}`}
            >
              <span className="text-xl" aria-hidden="true">{emoji}</span>
              <span>{label}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{counts[value] || 0}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
