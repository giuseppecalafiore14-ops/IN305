import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import type { Notification } from '@/types';

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data ?? []) as Notification[]);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new as Notification, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  if (!user) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><Link to="/login" className="btn-primary">Sign In</Link></div>;
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl text-ink-900 tracking-tight">NOTIFICATIONS</h1>
            {unreadCount > 0 && <p className="text-sm text-ink-500">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-sm">Mark all read</button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="card p-4 animate-pulse h-16" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500">Your notifications will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`card p-4 flex items-start gap-3 ${!n.read_at ? 'border-l-4 border-l-accent-500' : ''}`}>
                <div className="flex-1">
                  <p className="font-medium text-ink-900 text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-ink-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-ink-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {n.link && <Link to={n.link} className="btn-ghost text-xs">View</Link>}
                  {!n.read_at && (
                    <button onClick={() => markAsRead(n.id)} className="p-1.5 text-ink-400 hover:text-ink-900 hover:bg-ink-50 rounded-lg transition-all">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
