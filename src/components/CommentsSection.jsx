import { Flag, MessageCircle, Pencil, Reply, Send, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { addPostComment, deletePostComment, editPostComment, getPostComments, reportPostComment } from '../lib/api';
import { supabase } from '../lib/supabase';

function CommentAvatar({ comment }) {
  if (comment.author_avatar_url) {
    return <img src={comment.author_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary"><UserRound className="h-4 w-4" /></span>;
}

function CommentItem({ comment, replies, user, onReply, onDelete, onEdit, onReport }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <CommentAvatar comment={comment} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-black text-ink">{comment.author_name || 'Reader'}</p>
            <time className="text-xs text-gray-400" dateTime={comment.created_at}>
              {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.created_at))}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{comment.body}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
            <button type="button" onClick={() => onReply(comment)} className="inline-flex items-center gap-1 text-primary hover:underline"><Reply className="h-3.5 w-3.5" /> Reply</button>
            {user?.id === comment.user_id ? (
              <>
                <button type="button" onClick={() => onEdit(comment)} className="inline-flex items-center gap-1 text-gray-500 hover:text-primary"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button type="button" onClick={() => onDelete(comment)} className="inline-flex items-center gap-1 text-red-500 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </>
            ) : user ? (
              <button type="button" onClick={() => onReport(comment)} className="inline-flex items-center gap-1 text-gray-500 hover:text-red-500"><Flag className="h-3.5 w-3.5" /> Report</button>
            ) : null}
          </div>
        </div>
      </div>
      {replies.length ? (
        <div className="mt-4 space-y-3 border-s-2 border-blue-100 ps-4">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-3 rounded-xl bg-white p-3">
              <CommentAvatar comment={reply} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-ink">{reply.author_name || 'Reader'}</p>
                  <time className="text-[11px] text-gray-400" dateTime={reply.created_at}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(reply.created_at))}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{reply.body}</p>
                <div className="mt-2 flex gap-3 text-xs font-bold">
                  <button type="button" onClick={() => onReply(comment)} className="text-primary hover:underline">Reply</button>
                  {user?.id === reply.user_id ? <>
                    <button type="button" onClick={() => onEdit(reply)} className="text-gray-500 hover:text-primary">Edit</button>
                    <button type="button" onClick={() => onDelete(reply)} className="text-red-500 hover:underline">Delete</button>
                  </> : user ? <button type="button" onClick={() => onReport(reply)} className="text-gray-500 hover:text-red-500">Report</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CommentsSection({ postId }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [working, setWorking] = useState(false);

  async function load() {
    setComments(await getPostComments(postId));
  }

  useEffect(() => {
    let active = true;
    getPostComments(postId).then((rows) => { if (active) setComments(rows); }).catch(() => {});
    if (!supabase) return () => { active = false; };

    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, () => {
        if (active) load().catch(() => {});
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const roots = useMemo(() => comments.filter((item) => !item.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map();
    for (const item of comments) {
      if (!item.parent_id) continue;
      const current = map.get(item.parent_id) || [];
      current.push(item);
      map.set(item.parent_id, current);
    }
    return map;
  }, [comments]);

  function requireLogin() {
    if (user) return true;
    navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}#comments`)}`);
    return false;
  }

  async function submit(event) {
    event.preventDefault();
    if (!requireLogin()) return;
    const text = body.trim();
    if (!text) return;
    setWorking(true);
    try {
      const created = await addPostComment(postId, user.id, text, replyTo?.id || null);
      setComments((current) => [...current, created]);
      setBody('');
      setReplyTo(null);
      toast.success(replyTo ? 'Reply posted.' : 'Comment posted.');
    } catch (error) {
      toast.error(error.message || 'Could not post comment.');
    } finally {
      setWorking(false);
    }
  }

  async function edit(comment) {
    if (!user || user.id !== comment.user_id) return;
    const nextBody = window.prompt('Edit your comment:', comment.body);
    if (nextBody == null || !nextBody.trim() || nextBody.trim() === comment.body) return;
    try {
      const updated = await editPostComment(comment.id, nextBody.trim());
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, ...updated } : item));
      toast.success('Comment updated.');
    } catch (error) {
      toast.error(error.message || 'Could not edit comment.');
    }
  }

  async function remove(comment) {
    if (!user || user.id !== comment.user_id) return;
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deletePostComment(comment.id, user.id);
      setComments((current) => current.filter((item) => item.id !== comment.id && item.parent_id !== comment.id));
    } catch (error) {
      toast.error(error.message || 'Could not delete comment.');
    }
  }

  async function report(comment) {
    if (!requireLogin()) return;
    const reason = window.prompt('Why are you reporting this comment?');
    if (!reason?.trim()) return;
    try {
      await reportPostComment(comment.id, user.id, reason.trim());
      toast.success('Report sent for review.');
    } catch (error) {
      if (error.code === '23505') toast('You already reported this comment.');
      else toast.error(error.message || 'Could not report comment.');
    }
  }

  return (
    <section id="comments" className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-primary"><MessageCircle className="h-5 w-5" /></span>
        <div>
          <h2 className="text-2xl font-black text-ink">Comments</h2>
          <p className="text-sm text-gray-500">{comments.length} discussion item{comments.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5">
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span>Replying to <strong>{replyTo.author_name}</strong></span>
            <button type="button" onClick={() => setReplyTo(null)} className="font-black">Cancel</button>
          </div>
        ) : null}
        <textarea
          rows={4}
          maxLength={2000}
          value={body}
          onFocus={() => requireLogin()}
          onChange={(e) => setBody(e.target.value)}
          placeholder={user ? 'Add to the discussion…' : 'Sign in to comment…'}
          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-400">{body.length}/2000</span>
          <button disabled={working || !body.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" /> {working ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</button>
        </div>
      </form>

      <div className="mt-7 space-y-4">
        {roots.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={repliesByParent.get(comment.id) || []}
            user={user}
            onReply={(item) => { if (requireLogin()) { setReplyTo(item); document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
            onDelete={remove}
            onEdit={edit}
            onReport={report}
          />
        ))}
        {!roots.length ? <div className="rounded-2xl border border-dashed border-gray-300 p-7 text-center text-sm text-gray-500">No comments yet. Start the discussion.</div> : null}
      </div>
    </section>
  );
}
