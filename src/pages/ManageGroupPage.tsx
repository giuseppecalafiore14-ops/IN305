import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Users, Calendar, MapPin, Copy, Pencil, Ban, Inbox, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { formatCurrency } from '@/lib/pricing';
import { GROUP_SELECT } from '@/lib/queries';
import type { GroupWithRelations, GroupMember, EventTicket } from '@/types';

export function ManageGroupPage({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [group, setGroup] = useState<GroupWithRelations | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .eq('slug', slug)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      setGroup(data as unknown as GroupWithRelations);

      const [memberRes, requestRes, ticketsRes] = await Promise.all([
        supabase.from('group_members').select('*, profile:profiles(*)').eq('group_id', (data as any).id).order('joined_at', { ascending: true }),
        supabase.from('group_requests').select('id', { count: 'exact', head: true }).eq('group_id', (data as any).id).eq('status', 'pending'),
        (data as any).cost > 0
          ? supabase.from('event_tickets').select('*').eq('group_id', (data as any).id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      setMembers((memberRes.data ?? []) as unknown as GroupMember[]);
      setRequestCount(requestRes.count ?? 0);
      setTickets((ticketsRes.data ?? []) as EventTicket[]);
      setLoading(false);
    }
    load();
  }, [slug]);

  const paidTickets = useMemo(() => tickets.filter(t => t.status === 'paid'), [tickets]);
  const ticketTotals = useMemo(
    () => paidTickets.reduce((acc, t) => ({ gross: acc.gross + t.amount, fee: acc.fee + t.platform_fee, net: acc.net + t.host_amount }), { gross: 0, fee: 0, net: 0 }),
    [paidTickets]
  );

  async function handleCancel() {
    if (!group) return;
    setCancelling(true);
    setError(null);
    const { error: cancelError } = await supabase.from('groups').update({ status: 'canceled' }).eq('id', group.id);
    if (cancelError) {
      logError('ManageGroupPage:handleCancel', cancelError);
      setError(getErrorMessage(cancelError, "We couldn't cancel this group. Please try again."));
      setCancelling(false);
      return;
    }
    setGroup({ ...group, status: 'canceled' });
    setCancelling(false);
    setConfirmingCancel(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500 text-lg mb-4">This group doesn't exist.</p>
          <Link to="/host" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!user || group.host_id !== user.id) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500 text-lg mb-4">You don't manage this group.</p>
          <Link to={`/groups/${group.slug}`} className="btn-primary">View Group</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8 max-w-3xl">
        <button onClick={() => navigate('/host')} className="flex items-center gap-1.5 text-ink-500 hover:text-ink-900 text-sm font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {group.activity && <span className="badge bg-accent-50 text-accent-700">{group.activity.name}</span>}
              <StatusBadge status={group.status} />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight">{group.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-ink-500 mt-3 mb-6">
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDateTime(group.start_time)}</span>
          {group.neighborhood && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {group.neighborhood.name}</span>}
        </div>

        {error && <ErrorBanner message={error} className="mb-6" />}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link to={`/create?edit=${group.slug}`} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Edit Details
          </Link>
          <Link to={`/create?duplicate=${group.slug}`} className="btn-secondary">
            <Copy className="w-4 h-4" /> Duplicate
          </Link>
          {group.status !== 'canceled' && group.status !== 'completed' && (
            confirmingCancel ? (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} disabled={cancelling} className="btn-accent bg-error-500 hover:bg-error-600">
                  {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
                <button onClick={() => setConfirmingCancel(false)} className="btn-ghost">Never mind</button>
              </div>
            ) : (
              <button onClick={() => setConfirmingCancel(true)} className="btn-ghost text-error-600 hover:bg-error-50">
                <Ban className="w-4 h-4" /> Cancel Event
              </button>
            )
          )}
        </div>

        {/* Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-6 border-b border-ink-100 mb-6">
          <Overview label="Participants" value={`${group.current_participants} / ${group.max_participants}`} />
          <Overview label="Visibility" value={group.visibility.replace('_', ' ')} />
          <Overview label="Pending Requests" value={String(requestCount)} />
        </div>

        {/* Ticket sales (paid events only) */}
        {group.cost > 0 && (
          <div className="card p-6 mb-8">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Ticket className="w-3.5 h-3.5" /> Ticket Sales
            </p>
            {paidTickets.length === 0 ? (
              <p className="text-sm text-ink-400">No tickets sold yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center mb-2">
                <div>
                  <p className="font-display text-2xl text-ink-900">{paidTickets.length}</p>
                  <p className="text-xs text-ink-400 mt-1">Sold</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900">{formatCurrency(ticketTotals.gross)}</p>
                  <p className="text-xs text-ink-400 mt-1">Gross</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-accent-600">{formatCurrency(ticketTotals.net)}</p>
                  <p className="text-xs text-ink-400 mt-1">You Receive</p>
                </div>
              </div>
            )}
          </div>
        )}

        {requestCount === 0 && (
          <div className="flex items-start gap-3 text-sm text-ink-400 bg-ink-50 rounded-xl p-4 mb-8">
            <Inbox className="w-4 h-4 shrink-0 mt-0.5" />
            <p>No pending join requests right now. This group is {group.visibility === 'private' ? 'private, so requests will appear here once someone asks to join.' : 'open — people join directly without needing your approval.'}</p>
          </div>
        )}

        {/* Participants */}
        <div>
          <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Participants ({members.length})</h3>
          {members.length === 0 ? (
            <p className="text-ink-400 text-sm">No one has joined yet.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.first_name} size="sm" />
                  <p className="text-sm font-medium text-ink-900">{m.profile?.first_name ?? 'Member'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-success-50 text-success-600',
    full: 'bg-warning-50 text-warning-600',
    draft: 'bg-ink-100 text-ink-600',
    completed: 'bg-ink-100 text-ink-600',
    canceled: 'bg-error-50 text-error-600',
  };
  return <span className={`badge ${map[status] ?? 'bg-ink-100 text-ink-600'}`}>{status}</span>;
}

function Overview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-semibold text-ink-900 capitalize">{value}</p>
    </div>
  );
}
