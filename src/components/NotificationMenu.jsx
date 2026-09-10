import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function NotificationMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  useEffect(() => {
    if (!user || !supabase) {
      setNotifications([]);
      return undefined;
    }

    let active = true;

    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,type,message,link,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        toast.error('Could not load notifications.');
        return;
      }

      if (active) setNotifications(data ?? []);
    };

    loadNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        ({ new: nextNotification }) => {
          setNotifications((current) => [nextNotification, ...current].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  async function openNotification(notification) {
    if (!supabase || !user) return;

    if (!notification.is_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id)
        .eq('user_id', user.id);

      if (!error) {
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
        );
      }
    }

    setOpen(false);
    if (notification.link?.startsWith('/')) navigate(notification.link);
  }

  async function markAllRead() {
    if (!supabase || !user || unreadCount === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast.error('Could not mark notifications as read.');
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => (user ? setOpen((value) => !value) : navigate('/login'))}
        className="relative rounded-xl p-2 text-gray-600 transition hover:bg-gray-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={user ? `Notifications, ${unreadCount} unread` : 'Sign in to view notifications'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {user && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && user && (
        <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="font-semibold text-ink">Notifications</p>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`block w-full border-b border-gray-100 px-4 py-4 text-left transition hover:bg-gray-50 ${
                    notification.is_read ? 'bg-white' : 'bg-blue-50/60'
                  }`}
                >
                  <p className="text-sm font-medium leading-5 text-ink">{notification.message}</p>
                  <time className="mt-1 block text-xs text-gray-500" dateTime={notification.created_at}>
                    {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
                      new Date(notification.created_at),
                    )}
                  </time>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
