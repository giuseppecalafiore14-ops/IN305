import { useEffect, useMemo, useState } from 'react';
import { Calendar, Users, Sparkles, Rocket, DollarSign, Wallet, Percent, Ticket, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { Tabs } from '@/components/Tabs';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { GROUP_SELECT } from '@/lib/queries';
import { calculateEventEconomics, formatCurrency, DEFAULT_PLATFORM_FEE_PERCENT } from '@/lib/pricing';
import { startConnectOnboarding } from '@/lib/stripe';
import { formatDateShort } from '@/lib/format';
import type { GroupWithRelations, PricingConfig, EventTicket, HostPayoutAccount } from '@/types';

type TabKey = 'upcoming' | 'past' | 'drafts' | 'cancelled' | 'earnings';

export function HostDashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<HostPayoutAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [groupsRes, pricingRes, ticketsRes, payoutRes] = await Promise.all([
        supabase.from('groups').select(GROUP_SELECT).eq('host_id', user!.id).order('start_time', { ascending: false }),
        supabase.from('pricing_config').select('platform_fee_percent').maybeSingle(),
        supabase.from('event_tickets').select('*').eq('host_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('host_payout_accounts').select('*').eq('host_id', user!.id).maybeSingle(),
      ]);
      setGroups((groupsRes.data ?? []) as unknown as GroupWithRelations[]);
      const pricing = pricingRes.data as Pick<PricingConfig, 'platform_fee_percent'> | null;
      if (pricing?.platform_fee_percent != null) setPlatformFeePercent(pricing.platform_fee_percent);
      setTickets((ticketsRes.data ?? []) as EventTicket[]);
      setPayoutAccount(payoutRes.data as HostPayoutAccount | null);
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleConnectPayouts() {
    setConnectLoading(true);
    setConnectError(null);
    const { error } = await startConnectOnboarding();
    if (error) {
      setConnectError(error);
      setConnectLoading(false);
    }
    // On success, startConnectOnboarding redirects the browser to Stripe.
  }

  const now = useMemo(() => new Date(), []);

  const buckets = useMemo(() => {
    const upcoming = groups.filter(g => new Date(g.start_time) >= now && (g.status === 'active' || g.status === 'full'));
    const past = groups.filter(g => g.status === 'completed' || (new Date(g.start_time) < now && (g.status === 'active' || g.status === 'full')));
    const drafts = groups.filter(g => g.status === 'draft');
    const cancelled = groups.filter(g => g.status === 'canceled');
    return { upcoming, past, drafts, cancelled };
  }, [groups, now]);

  const paidGroups = useMemo(() => groups.filter(g => g.cost > 0 && g.status !== 'canceled' && g.status !== 'draft'), [groups]);

  const estimatedEarnings = useMemo(() => {
    return paidGroups.reduce(
      (acc, g) => {
        const e = calculateEventEconomics(g.cost, g.current_participants, platformFeePercent);
        return {
          grossRevenue: acc.grossRevenue + e.grossRevenue,
          platformFee: acc.platformFee + e.platformFee,
          netEarnings: acc.netEarnings + e.netEarnings,
        };
      },
      { grossRevenue: 0, platformFee: 0, netEarnings: 0 }
    );
  }, [paidGroups, platformFeePercent]);

  const paidTickets = useMemo(() => tickets.filter(t => t.status === 'paid'), [tickets]);

  const realFinancials = useMemo(() => {
    return paidTickets.reduce(
      (acc, t) => {
        acc.grossSales += t.amount;
        acc.platformFees += t.platform_fee;
        acc.netEarnings += t.host_amount;
        if (t.payout_status === 'pending') acc.availableBalance += t.host_amount;
        if (t.payout_status === 'processing') acc.pendingPayout += t.host_amount;
        if (t.payout_status === 'paid') acc.paidOut += t.host_amount;
        return acc;
      },
      { grossSales: 0, platformFees: 0, netEarnings: 0, availableBalance: 0, pendingPayout: 0, paidOut: 0 }
    );
  }, [paidTickets]);

  const stats = useMemo(() => {
    const totalParticipants = groups.reduce((sum, g) => sum + g.current_participants, 0);
    const upcomingParticipants = buckets.upcoming.reduce((sum, g) => sum + g.current_participants, 0);
    return {
      groupsHosted: groups.length,
      upcomingCount: buckets.upcoming.length,
      totalParticipants,
      upcomingParticipants,
    };
  }, [groups, buckets]);

  const activeList = tab === 'earnings' ? [] : buckets[tab];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-10">
        <p className="section-label mb-2">Host Dashboard</p>
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-2">YOUR EVENTS.</h1>
        <p className="text-ink-500 mb-8">Everything you're hosting on IN305, in one place.</p>

        {/* Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatTile icon={Calendar} label="Events Hosted" value={stats.groupsHosted} loading={loading} />
          <StatTile icon={Rocket} label="Upcoming Events" value={stats.upcomingCount} loading={loading} />
          <StatTile icon={Ticket} label="Tickets Sold" value={paidTickets.length} loading={loading} />
          <StatTile icon={DollarSign} label="Gross Sales" value={realFinancials.grossSales} loading={loading} isCurrency />
          <StatTile icon={Percent} label="IN305 Fees" value={realFinancials.platformFees} loading={loading} isCurrency />
          <StatTile icon={Wallet} label="Net Earnings" value={realFinancials.netEarnings} loading={loading} isCurrency />
        </div>

        {/* Payout account status */}
        {!loading && (
          <div className="card p-5 mb-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ink-50 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-ink-500" />
              </div>
              <div>
                <p className="font-semibold text-ink-900">
                  {payoutAccount?.status === 'active' ? 'Payout account connected' : 'Get paid for your events'}
                </p>
                <p className="text-sm text-ink-500">
                  {payoutAccount?.status === 'active'
                    ? 'Earnings from paid events are sent to your connected account.'
                    : 'To receive earnings from paid events, connect your payout account.'}
                </p>
              </div>
            </div>
            {payoutAccount?.status === 'active' ? (
              <span className="badge bg-success-50 text-success-600 flex items-center gap-1 shrink-0"><ShieldCheck className="w-3.5 h-3.5" /> Connected</span>
            ) : (
              <button onClick={handleConnectPayouts} disabled={connectLoading} className="btn-primary text-sm shrink-0">
                {connectLoading ? 'Redirecting...' : payoutAccount?.status === 'pending' ? 'Finish Setup' : 'Connect Payout Account'}
                {!connectLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
        {connectError && <ErrorBanner message={connectError} className="mb-6" />}

        <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'upcoming', label: 'Upcoming', count: buckets.upcoming.length },
              { key: 'past', label: 'Past', count: buckets.past.length },
              { key: 'drafts', label: 'Drafts', count: buckets.drafts.length },
              { key: 'cancelled', label: 'Cancelled', count: buckets.cancelled.length },
              { key: 'earnings', label: 'Earnings' },
            ] as const}
          />
          <Link to="/create" className="btn-accent text-sm px-4 py-2.5 shrink-0">
            <Sparkles className="w-4 h-4" /> New Group
          </Link>
        </div>

        {tab === 'earnings' ? (
          <div className="space-y-6 max-w-2xl">
            <div className="card p-6">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-4">Balance</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="font-display text-2xl text-ink-900">{formatCurrency(realFinancials.availableBalance)}</p>
                  <p className="text-xs text-ink-400 mt-1">Available</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900">{formatCurrency(realFinancials.pendingPayout)}</p>
                  <p className="text-xs text-ink-400 mt-1">Pending Payout</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900">{formatCurrency(realFinancials.paidOut)}</p>
                  <p className="text-xs text-ink-400 mt-1">Paid Out</p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3">Recent Transactions</p>
              {tickets.length === 0 ? (
                <p className="text-sm text-ink-400">No transactions yet.</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {tickets.slice(0, 10).map(t => (
                    <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="text-ink-900 font-medium">{formatCurrency(t.amount)} ticket</p>
                        <p className="text-ink-400 text-xs">{formatDateShort(t.created_at)}</p>
                      </div>
                      <span className={`badge ${t.status === 'paid' ? 'bg-success-50 text-success-600' : t.status === 'refunded' ? 'bg-error-50 text-error-600' : 'bg-ink-100 text-ink-500'}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {paidGroups.length > 0 && (
              <div className="card p-6">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-4">Estimated Earnings (based on current signups)</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-600">Gross revenue ({paidGroups.length} paid {paidGroups.length === 1 ? 'event' : 'events'})</span>
                    <span className="font-semibold text-ink-900">{formatCurrency(estimatedEarnings.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-ink-500">
                    <span>IN305 platform fee ({platformFeePercent}%)</span>
                    <span>-{formatCurrency(estimatedEarnings.platformFee)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-ink-100 font-display text-2xl text-ink-900">
                    <span className="text-base font-sans font-semibold self-center">Estimated net earnings</span>
                    <span className="text-accent-600">{formatCurrency(estimatedEarnings.netEarnings)}</span>
                  </div>
                </div>
                <p className="text-xs text-ink-400 leading-relaxed mt-4">
                  This is a projection based on current signups at full ticket price — not settled money. The Balance and Transactions above reflect real, confirmed payments only.
                </p>
              </div>
            )}

            {paidGroups.length === 0 && tickets.length === 0 && (
              <EmptyState
                icon={Wallet}
                title="No earnings yet."
                description="Create your first paid experience and start earning through IN305 — you keep most of every ticket, we handle discovery, booking and community."
                actionLabel="Create a Paid Event"
                actionHref="/create"
              />
            )}
          </div>
        ) : loading ? (
          <SkeletonCardGrid count={3} />
        ) : activeList.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={tab === 'upcoming' ? "Nothing planned yet." : `No ${tab} groups.`}
            description={tab === 'upcoming' ? 'Be the first person to organize something.' : "Groups you've hosted will show up here."}
            actionLabel={tab === 'upcoming' ? 'Create an Activity' : undefined}
            actionHref={tab === 'upcoming' ? '/create' : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeList.map(g => (
              <GroupCard key={g.id} group={g} linkTo={`/manage/${g.slug}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, loading, isCurrency }: { icon: any; label: string; value: number; loading: boolean; isCurrency?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {loading ? <div className="skeleton h-8 w-12 rounded-lg" /> : <p className="font-display text-3xl text-ink-900">{isCurrency ? formatCurrency(value) : value}</p>}
    </div>
  );
}
