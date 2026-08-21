import { useEffect, useState, useRef } from 'react';
import { MapPin, Clock, Users, Calendar, ArrowLeft, Crown, Lock, Send, Check, Bookmark, BookmarkCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import { canJoinGroup, isActiveMember, isGroupHost } from '@/lib/permissions';
import type { GroupWithRelations, GroupMember, GroupMessage } from '@/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { AvatarStack } from '@/components/AvatarStack';
import { ShareButton } from '@/components/ShareButton';
import { formatDateTime } from '@/lib/format';
import { formatCurrency, calculateEventEconomics, DEFAULT_PLATFORM_FEE_PERCENT } from '@/lib/pricing';
import { startEventCheckout } from '@/lib/stripe';
import { GROUP_SELECT } from '@/lib/queries';
import type { PricingConfig } from '@/types';

export function GroupDetailPage({ slug }: { slug: string }) {
  const { user, profile, membership } = useAuth();
  const { navigate } = useRouter();
  const [group, setGroup] = useState<GroupWithRelations | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .eq('slug', slug)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      setGroup(data as unknown as GroupWithRelations);

      if ((data as any).cost > 0) {
        const { data: pricing } = await supabase.from('pricing_config').select('platform_fee_percent').maybeSingle();
        const p = pricing as Pick<PricingConfig, 'platform_fee_percent'> | null;
        if (p?.platform_fee_percent != null) setPlatformFeePercent(p.platform_fee_percent);
      }

      const { data: memberData } = await supabase
        .from('group_members')
        .select('*, profile:profiles(*)')
        .eq('group_id', (data as any).id)
        .order('joined_at', { ascending: true });
      setMembers((memberData ?? []) as unknown as GroupMember[]);

      if (user) {
        const isMember = (memberData ?? []).some((m: any) => m.user_id === user.id);
        setIsMember(isMember);

        const { data: saved } = await supabase
          .from('saved_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_type', 'group')
          .eq('item_id', (data as any).id)
          .maybeSingle();
        setIsSaved(!!saved);
      }

      setLoading(false);
    }
    load();
  }, [slug, user]);

  useEffect(() => {
    if (!group || !isMember) return;
    async function loadMessages() {
      const { data } = await supabase
        .from('group_messages')
        .select('*, sender:profiles(*)')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: true })
        .limit(50);
      setMessages((data ?? []) as unknown as GroupMessage[]);
    }
    loadMessages();

    const channel = supabase
      .channel(`group-${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as GroupMessage]);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group, isMember]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleJoin() {
    if (!user) { navigate('/signup'); return; }
    if (!group) return;
    if (!canJoinGroup(group, membership)) {
      if (group.visibility === 'members_only') { navigate('/membership'); return; }
      setError('This group is full.');
      return;
    }
    setJoining(true);
    setError(null);
    const { error: joinError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });

    if (joinError) {
      logError('GroupDetailPage:handleJoin', joinError);
      if (joinError.code === '23505') {
        setError("You're already in this group.");
      } else {
        setError(getErrorMessage(joinError, "We couldn't add you to this group. Please try again."));
      }
      setJoining(false);
      return;
    }

    await supabase.from('group_messages').insert({
      group_id: group.id,
      sender_id: user.id,
      body: `${profile?.first_name ?? 'Someone'} joined the group.`,
      is_system: true,
    });

    setIsMember(true);
    setJoining(false);
    setChatOpen(true);

    const { data: updatedMembers } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', group.id)
      .order('joined_at', { ascending: true });
    setMembers((updatedMembers ?? []) as unknown as GroupMember[]);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user || !group) return;
    const msg = newMessage.trim();
    setChatError(null);
    const { error: sendError } = await supabase.from('group_messages').insert({
      group_id: group.id,
      sender_id: user.id,
      body: msg,
      is_system: false,
    });

    if (sendError) {
      logError('GroupDetailPage:handleSendMessage', sendError);
      setChatError(getErrorMessage(sendError, "Your message didn't send. Please try again."));
      return;
    }

    setNewMessage('');
  }

  async function handleSave() {
    if (!user || !group) return;
    if (isSaved) {
      await supabase.from('saved_items').delete().eq('user_id', user.id).eq('item_type', 'group').eq('item_id', group.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_items').insert({ user_id: user.id, item_type: 'group', item_id: group.id });
      setIsSaved(true);
    }
  }

  async function handlePayNow() {
    if (!group) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    const { error: checkoutErr } = await startEventCheckout(group.id);
    if (checkoutErr) {
      setCheckoutError(checkoutErr);
      setCheckoutLoading(false);
    }
    // On success, startEventCheckout redirects the browser to Stripe — no further state update needed.
  }

  function handleCalendar() {
    if (!group) return;
    const startDate = new Date(group.start_time);
    const endDate = group.end_time ? new Date(group.end_time) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IN305//EN',
      'BEGIN:VEVENT', `UID:${group.id}@in305`,
      `DTSTAMP:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${group.title}`, `DESCRIPTION:${group.description ?? ''}`,
      `LOCATION:${group.venue_name ?? ''} ${group.address ?? ''}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${group.slug}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50">
        <div className="skeleton h-[45vh] min-h-[320px]" />
        <div className="section-container py-6 space-y-4">
          <div className="skeleton h-8 w-2/3 rounded-lg" />
          <div className="skeleton h-4 w-1/3 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500 text-lg mb-4">This group doesn't exist or has been removed.</p>
          <Link to="/groups" className="btn-primary">Browse Groups</Link>
        </div>
      </div>
    );
  }

  const spotsLeft = group.max_participants - group.current_participants;
  const isFull = spotsLeft <= 0;
  const isHostUser = user ? isGroupHost(user.id, group) : false;
  const showMembershipGate = group.visibility === 'members_only' && !isActiveMember(membership);
  const isPaid = group.cost > 0;

  const primaryAction = isHostUser ? null : !isMember ? (
    showMembershipGate ? (
      <button onClick={() => navigate('/membership')} className="btn-accent flex-1">
        <Crown className="w-5 h-5" /> Become a Member to Join
      </button>
    ) : isFull ? (
      <button onClick={handleJoin} disabled={joining} className="btn-secondary flex-1">
        Join Waitlist
      </button>
    ) : isPaid ? (
      <button onClick={() => { if (!user) { navigate('/signup'); return; } setShowCheckout(true); }} className="btn-accent flex-1">
        Reserve Your Spot — {formatCurrency(group.cost)}
      </button>
    ) : (
      <button onClick={handleJoin} disabled={joining} className="btn-accent flex-1">
        {joining ? 'Joining...' : 'Join Group'}
      </button>
    )
  ) : null;

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Hero */}
      <div className="relative h-[45vh] min-h-[340px] sm:h-[52vh] bg-ink-950 overflow-hidden">
        {group.cover_image_url ? (
          <img src={group.cover_image_url} alt={group.title} className="w-full h-full object-cover" loading="eager" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
            <span className="font-display text-6xl text-white/15 tracking-tightest uppercase">{group.activity?.name}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/10" />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button onClick={() => navigate('/groups')} className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium bg-black/20 backdrop-blur-sm rounded-full px-3 py-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <ShareButton variant="overlay" title={group.title} text={`Join me at ${group.title} on IN305`} url={typeof window !== 'undefined' ? window.location.href : ''} />
            {user && (
              <button onClick={handleSave} className="p-2.5 bg-black/20 backdrop-blur-sm rounded-full text-white/90 hover:text-white transition-colors" aria-label={isSaved ? 'Remove from saved' : 'Save group'}>
                {isSaved ? <BookmarkCheck className="w-5 h-5 text-accent-400" /> : <Bookmark className="w-5 h-5" />}
              </button>
            )}
          </div>
          {user && (
            <button onClick={handleSave} className="hidden md:block p-2.5 bg-black/20 backdrop-blur-sm rounded-full text-white/90 hover:text-white transition-colors" aria-label={isSaved ? 'Remove from saved' : 'Save group'}>
              {isSaved ? <BookmarkCheck className="w-5 h-5 text-accent-400" /> : <Bookmark className="w-5 h-5" />}
            </button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 section-container pb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {group.activity && <span className="badge bg-white/95 text-ink-900">{group.activity.name}</span>}
            {group.visibility === 'members_only' && (
              <span className="badge bg-white/15 backdrop-blur-sm text-white border border-white/20 flex items-center gap-1"><Crown className="w-3 h-3" /> Members Only</span>
            )}
            {group.visibility === 'private' && (
              <span className="badge bg-white/15 backdrop-blur-sm text-white border border-white/20 flex items-center gap-1"><Lock className="w-3 h-3" /> Private</span>
            )}
            {group.vibe && <span className="badge bg-white/15 backdrop-blur-sm text-white border border-white/20">{group.vibe}</span>}
          </div>
          <h1 className="display-heading text-4xl sm:text-5xl md:text-6xl text-white max-w-2xl">{group.title}</h1>
          {isPaid && (
            <p className="font-display text-2xl text-accent-400 mt-2">{formatCurrency(group.cost)} <span className="text-base text-white/70 font-sans font-normal">/ person</span></p>
          )}
        </div>
      </div>

      <div className="section-container py-6 pb-40 md:pb-12">
        {/* Key info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-ink-100">
          <InfoItem icon={Clock} label="When" value={formatDateTime(group.start_time)} />
          <InfoItem icon={MapPin} label="Where" value={group.neighborhood?.name ?? 'TBA'} />
          <InfoItem icon={Users} label="Spots" value={`${group.current_participants} / ${group.max_participants}`} highlight={isFull ? 'error' : 'success'} />
          <InfoItem icon={Calendar} label="Cost" value={group.cost > 0 ? `$${group.cost}` : 'Free'} />
        </div>

        {/* Availability bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-ink-700">
              {isFull ? 'GROUP FULL' : `${spotsLeft} ${spotsLeft === 1 ? 'SPOT' : 'SPOTS'} LEFT`}
            </span>
            <span className="text-xs text-ink-400">{Math.round((group.current_participants / group.max_participants) * 100)}% full</span>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-error-500' : 'bg-success-500'}`}
              style={{ width: `${Math.min((group.current_participants / group.max_participants) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Who's going */}
        {members.length > 0 && (
          <div className="mt-6 flex items-center gap-3">
            <AvatarStack people={members.map(m => ({ src: m.profile?.avatar_url, name: m.profile?.first_name }))} max={6} size="sm" />
            <span className="text-sm text-ink-600">
              <strong className="text-ink-900">{members.length}</strong> {members.length === 1 ? 'person' : 'people'} going
            </span>
          </div>
        )}

        {/* Host */}
        {group.host && (
          <div className="mt-6 flex items-center gap-4">
            <Avatar src={group.host.avatar_url} name={group.host.first_name} size="lg" />
            <div className="flex-1">
              <p className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-0.5">Hosted by</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink-900">{group.host.first_name}</p>
                {group.host.host_verified && <span className="badge bg-success-50 text-success-600 flex items-center gap-1"><Check className="w-3 h-3" /> Verified</span>}
                {group.host?.membership?.is_founder && (
                  <span className="badge bg-accent-50 text-accent-600 flex items-center gap-1"><Crown className="w-3 h-3" /> Founder</span>
                )}
              </div>
              <p className="text-sm text-ink-500">{group.host.groups_hosted_count} groups hosted</p>
            </div>
          </div>
        )}

        {/* Description */}
        {group.description && (
          <div className="mt-6">
            <h3 className="font-semibold text-ink-900 mb-2">About this group</h3>
            <p className="text-ink-600 leading-relaxed whitespace-pre-line">{group.description}</p>
          </div>
        )}

        {/* Venue details */}
        {(group.venue_name || group.address || group.meeting_point) && (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {group.venue_name && (
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Venue</p>
                <p className="text-ink-900">{group.venue_name}</p>
                {group.address && <p className="text-sm text-ink-500">{group.address}</p>}
              </div>
            )}
            {group.meeting_point && (
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Meeting point</p>
                <p className="text-ink-900">{group.meeting_point}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <ErrorBanner message={error} className="mt-6" />}

        {/* Checkout preview (paid events — no real payment yet) */}
        {showCheckout && isPaid && (() => {
          const economics = calculateEventEconomics(group.cost, 1, platformFeePercent);
          return (
            <div className="mt-6 card p-6">
              <h3 className="font-semibold text-ink-900 mb-4">Reserve Your Spot</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-ink-600">
                  <span>{group.title}</span>
                  <span>{formatCurrency(group.cost)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-ink-100 font-semibold text-ink-900">
                  <span>You pay</span>
                  <span>{formatCurrency(group.cost)}</span>
                </div>
              </div>
              <div className="bg-ink-50 rounded-xl p-4 text-xs text-ink-500 mb-4 space-y-1">
                <p className="font-semibold text-ink-600 uppercase tracking-wide text-2xs">Where your money goes</p>
                <div className="flex justify-between"><span>Host receives</span><span>{formatCurrency(economics.netEarnings)}</span></div>
                <div className="flex justify-between"><span>IN305 platform fee ({platformFeePercent}%)</span><span>{formatCurrency(economics.platformFee)}</span></div>
              </div>
              {checkoutError && <ErrorBanner message={checkoutError} className="mb-4" />}
              <button onClick={handlePayNow} disabled={checkoutLoading} className="btn-accent w-full">
                {checkoutLoading ? 'Redirecting to secure checkout...' : `Pay ${formatCurrency(group.cost)}`}
              </button>
              <p className="text-xs text-ink-400 text-center mt-3">You'll be redirected to Stripe for secure payment. You won't be added to this event until payment is confirmed.</p>
            </div>
          );
        })()}

        {/* Desktop actions */}
        <div className="mt-6 hidden md:flex items-center gap-3">
          {primaryAction}
          {isMember && (
            <button onClick={() => setChatOpen(!chatOpen)} className="btn-accent">
              {chatOpen ? 'Hide Chat' : 'Open Chat'}
            </button>
          )}
          <button onClick={handleCalendar} className="btn-secondary">
            <Calendar className="w-5 h-5" /> Add to Calendar
          </button>
          <ShareButton title={group.title} text={`Join me at ${group.title} on IN305`} url={typeof window !== 'undefined' ? window.location.href : ''} />
          {isHostUser && (
            <div className="flex-1 p-4 bg-ocean-50 rounded-xl text-ocean-700 text-sm font-medium flex items-center gap-2">
              <Check className="w-5 h-5" /> You're hosting this group
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mt-10">
          <h3 className="font-semibold text-ink-900 mb-4">Participants ({members.length})</h3>
          {members.length === 0 ? (
            <p className="text-ink-400 text-sm">No one has joined yet. Be the first!</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.first_name} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-ink-900">{m.profile?.first_name ?? 'Member'}</p>
                    {m.profile?.preferred_vibes?.[0] && <p className="text-xs text-ink-400">{m.profile.preferred_vibes[0]}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat */}
        {isMember && (
          <div className={`mt-8 card p-0 overflow-hidden ${chatOpen ? 'block' : 'hidden md:block'}`}>
            <div className="p-4 border-b border-ink-100 flex items-center gap-2">
              <h3 className="font-semibold text-ink-900">Group Chat</h3>
              <span className="text-xs text-ink-400">{members.length} members</span>
            </div>
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-cream-50">
              {messages.length === 0 ? (
                <p className="text-center text-ink-400 text-sm py-8">Say hello to the group!</p>
              ) : messages.map(msg => (
                <div key={msg.id} className={msg.is_system ? 'text-center' : ''}>
                  {msg.is_system ? (
                    <p className="text-xs text-ink-400 italic">{msg.body}</p>
                  ) : (
                    <div className={`flex gap-2 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}>
                      <Avatar src={msg.sender?.avatar_url} name={msg.sender?.first_name} size="xs" />
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
            <form onSubmit={handleSendMessage} className="p-3 border-t border-ink-100 flex gap-2">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 bg-cream-50 border border-ink-100 rounded-full text-sm focus:outline-none focus:border-ink-300 transition-all"
              />
              <button type="submit" className="w-10 h-10 rounded-full bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 transition-all shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sticky mobile CTA */}
      {(primaryAction || isMember || isHostUser) && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-cream-50/95 backdrop-blur-lg border-t border-ink-100 px-4 py-3 flex items-center gap-2">
          {isHostUser ? (
            <div className="flex-1 py-3 text-center text-ocean-700 text-sm font-semibold flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> You're hosting this group
            </div>
          ) : isMember ? (
            <>
              <button onClick={() => setChatOpen(!chatOpen)} className="btn-accent flex-1">
                {chatOpen ? 'Hide Chat' : 'Open Chat'}
              </button>
              <button onClick={handleCalendar} className="btn-secondary px-4">
                <Calendar className="w-5 h-5" />
              </button>
            </>
          ) : (
            primaryAction
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: 'success' | 'error' }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-ink-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`font-semibold ${highlight === 'error' ? 'text-error-500' : highlight === 'success' ? 'text-success-600' : 'text-ink-900'}`}>{value}</p>
    </div>
  );
}
