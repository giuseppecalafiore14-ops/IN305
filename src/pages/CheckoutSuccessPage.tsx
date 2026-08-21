import { useEffect, useState } from 'react';
import { Check, Calendar, MapPin, Crown, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { ShareButton } from '@/components/ShareButton';
import { formatDateTime } from '@/lib/format';
import { GROUP_SELECT } from '@/lib/queries';
import type { GroupWithRelations, EventTicket, Membership, BusinessSubscription } from '@/types';

type CheckoutType = 'event' | 'membership' | 'business';

function useQueryParams() {
  return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
}

async function pollFor<T>(fetcher: () => Promise<T | null>, attempts = 5, delayMs = 1500): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const result = await fetcher();
    if (result) return result;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

export function CheckoutSuccessPage() {
  const { user } = useAuth();
  const params = useQueryParams();
  const type = (params.get('type') as CheckoutType) ?? 'event';
  const slug = params.get('slug');

  const [confirming, setConfirming] = useState(true);
  const [group, setGroup] = useState<GroupWithRelations | null>(null);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [businessSub, setBusinessSub] = useState<BusinessSubscription | null>(null);

  useEffect(() => {
    async function run() {
      if (type === 'event' && slug) {
        const { data: g } = await supabase.from('groups').select(GROUP_SELECT).eq('slug', slug).maybeSingle();
        const loadedGroup = g as unknown as GroupWithRelations | null;
        setGroup(loadedGroup);

        if (user && loadedGroup) {
          const found = await pollFor(async () => {
            const { data } = await supabase
              .from('event_tickets')
              .select('*')
              .eq('group_id', loadedGroup.id)
              .eq('buyer_id', user.id)
              .eq('status', 'paid')
              .maybeSingle();
            return data as EventTicket | null;
          });
          setTicket(found);
        }
      } else if (type === 'membership' && user) {
        const found = await pollFor(async () => {
          const { data } = await supabase.from('memberships').select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle();
          return data as Membership | null;
        });
        setMembership(found);
      } else if (type === 'business' && user) {
        const found = await pollFor(async () => {
          const { data: partner } = await supabase.from('partners').select('id').eq('owner_id', user.id).maybeSingle();
          if (!partner) return null;
          const { data: sub } = await supabase.from('business_subscriptions').select('*').eq('partner_id', partner.id).eq('status', 'active').maybeSingle();
          return sub as BusinessSubscription | null;
        });
        setBusinessSub(found);
      }
      setConfirming(false);
    }
    run();
  }, [type, slug, user]);

  const shareUrl = group ? `${window.location.origin}/groups/${group.slug}` : '';

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-success-500" />
        </div>

        {confirming ? (
          <>
            <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">CONFIRMING YOUR PAYMENT...</h1>
            <p className="text-ink-500">This usually takes just a few seconds.</p>
          </>
        ) : type === 'event' ? (
          <>
            <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">PAYMENT CONFIRMED.</h1>
            {group ? (
              <div className="card p-6 text-left mt-6 space-y-3">
                <h2 className="font-display text-2xl text-ink-900 tracking-tight">{group.title}</h2>
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <Calendar className="w-4 h-4 text-ink-400" /> {formatDateTime(group.start_time)}
                </div>
                {group.neighborhood && (
                  <div className="flex items-center gap-2 text-sm text-ink-600">
                    <MapPin className="w-4 h-4 text-ink-400" /> {group.neighborhood.name}
                  </div>
                )}
                <div className="pt-2">
                  {ticket ? (
                    <span className="badge bg-success-50 text-success-600">Ticket confirmed</span>
                  ) : (
                    <span className="badge bg-warning-50 text-warning-600">Finalizing your ticket — refresh in a moment if this doesn't update</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-3">
                  <Link to={`/groups/${group.slug}`} className="btn-primary text-sm">View Event</Link>
                  <ShareButton title={group.title} text={`I'm going to ${group.title} on IN305`} url={shareUrl} />
                </div>
              </div>
            ) : (
              <p className="text-ink-500 mt-4">Your payment was received.</p>
            )}
          </>
        ) : type === 'membership' ? (
          <>
            <Crown className="w-10 h-10 text-accent-500 mx-auto mb-3" />
            <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">WELCOME TO IN305.</h1>
            <p className="text-ink-500 mb-6">
              {membership ? "You're in — private groups, member-only events, and Miami's local social ecosystem are all open to you now." : 'Your payment was received — your membership will activate in a moment.'}
            </p>
            <Link to="/discover" className="btn-accent">Explore Miami</Link>
          </>
        ) : (
          <>
            <Building2 className="w-10 h-10 text-accent-500 mx-auto mb-3" />
            <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">YOUR BUSINESS SUBSCRIPTION IS ACTIVE.</h1>
            <p className="text-ink-500 mb-6">
              {businessSub ? 'Your business is ready to attract Miami locals.' : 'Your payment was received — your subscription will activate in a moment.'}
            </p>
            <Link to="/business/manage" className="btn-accent">Go to Business Dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}
