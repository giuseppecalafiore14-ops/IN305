import { useEffect, useState, useRef } from 'react';
import { Send, MessageCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import type { GroupWithRelations, GroupMessage } from '@/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';

export function MessagesPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithRelations | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      const { data } = await supabase
        .from('group_members')
        .select('group:groups(*, activity:activities(*), neighborhood:neighborhoods(*), host:profiles(*))')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: false });
      const userGroups = ((data ?? []).map((m: any) => m.group) as GroupWithRelations[]);
      setGroups(userGroups);
      if (userGroups.length > 0) setSelectedGroup(userGroups[0]);
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedGroup || !user) return;
    async function loadMessages() {
      const { data } = await supabase
        .from('group_messages')
        .select('*, sender:profiles(*)')
        .eq('group_id', selectedGroup!.id)
        .order('created_at', { ascending: true })
        .limit(50);
      setMessages((data ?? []) as unknown as GroupMessage[]);
    }
    loadMessages();

    const channel = supabase
      .channel(`messages-${selectedGroup.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${selectedGroup.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as GroupMessage]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedGroup) return;
    const msg = newMessage.trim();
    setChatError(null);
    const { error: sendError } = await supabase.from('group_messages').insert({
      group_id: selectedGroup.id,
      sender_id: user.id,
      body: msg,
      is_system: false,
    });

    if (sendError) {
      logError('MessagesPage:handleSend', sendError);
      setChatError(getErrorMessage(sendError, "Your message didn't send. Please try again."));
      return;
    }

    setNewMessage('');
  }

  if (!user) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><Link to="/login" className="btn-primary">Sign In</Link></div>;
  }

  if (loading) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  }

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <MessageCircle className="w-12 h-12 text-ink-300 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-ink-900 tracking-tight mb-2">YOUR GROUP CONVERSATIONS WILL APPEAR HERE.</h1>
          <p className="text-ink-500 mb-6">Join a group to start chatting with other members.</p>
          <Link to="/discover" className="btn-accent">Discover Groups</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8">
        <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-4">MESSAGES</h1>
        <div className="flex gap-4 h-[600px]">
          {/* Group list */}
          <div className={`w-full sm:w-72 shrink-0 card overflow-hidden ${selectedGroup ? 'hidden sm:block' : ''}`}>
            <div className="p-3 border-b border-ink-100">
              <p className="text-sm font-semibold text-ink-500 px-2">Your groups</p>
            </div>
            <div className="overflow-y-auto h-[calc(600px-49px)]">
              {groups.map(g => (
                <button key={g.id} onClick={() => { setSelectedGroup(g); setChatError(null); }}
                  className={`w-full p-3 text-left flex items-center gap-3 transition-all ${selectedGroup?.id === g.id ? 'bg-accent-50' : 'hover:bg-ink-50'}`}>
                  <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center text-xs font-bold text-ink-600 shrink-0">
                    {g.activity?.name?.[0] ?? 'G'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900 text-sm truncate">{g.title}</p>
                    <p className="text-xs text-ink-400">{g.activity?.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          {selectedGroup && (
            <div className="flex-1 card overflow-hidden flex flex-col">
              <div className="p-4 border-b border-ink-100 flex items-center gap-2">
                <button onClick={() => setSelectedGroup(null)} className="sm:hidden btn-ghost p-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <p className="font-semibold text-ink-900">{selectedGroup.title}</p>
                  <p className="text-xs text-ink-400">{selectedGroup.activity?.name} · {selectedGroup.neighborhood?.name}</p>
                </div>
                <Link to={`/groups/${selectedGroup.slug}`} className="btn-ghost text-xs">View group</Link>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream-50">
                {messages.length === 0 ? (
                  <p className="text-center text-ink-400 text-sm py-8">Say hello to the group!</p>
                ) : messages.map(msg => (
                  <div key={msg.id} className={msg.is_system ? 'text-center' : ''}>
                    {msg.is_system ? (
                      <p className="text-xs text-ink-400 italic">{msg.body}</p>
                    ) : (
                      <div className={`flex gap-2 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}>
                        <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center text-accent-700 font-semibold text-xs shrink-0 overflow-hidden">
                          {msg.sender?.avatar_url ? <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" /> : (msg.sender?.first_name?.[0] ?? 'U')}
                        </div>
                        <div className={`max-w-[70%] ${msg.sender_id === user?.id ? 'items-end' : ''}`}>
                          <p className="text-xs text-ink-400 mb-0.5">{msg.sender?.first_name ?? 'Member'}</p>
                          <div className={`px-3 py-2 rounded-2xl text-sm ${msg.sender_id === user?.id ? 'bg-accent-500 text-white rounded-br-sm' : 'bg-white text-ink-900 rounded-bl-sm border border-ink-100'}`}>
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {chatError && <ErrorBanner message={chatError} className="mx-3 mb-2" />}
              <form onSubmit={handleSend} className="p-3 border-t border-ink-100 flex gap-2">
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-cream-50 border border-ink-100 rounded-full text-sm focus:outline-none focus:border-ink-300 transition-all" />
                <button type="submit" className="w-10 h-10 rounded-full bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 transition-all shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
