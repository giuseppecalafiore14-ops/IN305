import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Trash2, Eye, EyeOff, Sparkles, ExternalLink, Crown, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { Tabs } from '@/components/Tabs';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Avatar } from '@/components/Avatar';
import { getErrorMessage, logError } from '@/lib/errors';
import { GROUP_SELECT } from '@/lib/queries';
import { BUSINESS_PLANS } from '@/lib/pricing';
import { startBusinessCheckout, openBillingPortal } from '@/lib/stripe';
import type { Partner, PartnerOffer, GroupWithRelations, BusinessSubscription, Profile } from '@/types';

type TabKey = 'overview' | 'activities' | 'offers' | 'community' | 'subscription' | 'partnership';

export function BusinessDashboardPage() {
  const { user } = useAuth();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [communityMembers, setCommunityMembers] = useState<{ profile: Profile; groupsAttended: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');

  const [profileForm, setProfileForm] = useState({
    business_name: '', slug: '', category: '', description: '',
    logo_url: '', cover_image_url: '', website: '', instagram: '', phone: '', email: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newOffer, setNewOffer] = useState({ title: '', description: '' });
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('partners').select('*, neighborhood:neighborhoods(*)').eq('owner_id', user!.id).maybeSingle();
      if (data) {
        setPartner(data as unknown as Partner);
        setProfileForm({
          business_name: data.business_name ?? '',
          slug: data.slug ?? '',
          category: data.category ?? '',
          description: data.description ?? '',
          logo_url: data.logo_url ?? '',
          cover_image_url: data.cover_image_url ?? '',
          website: data.website ?? '',
          instagram: data.instagram ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
        });

        const [groupsRes, offersRes, subRes] = await Promise.all([
          supabase.from('groups').select(GROUP_SELECT).eq('host_id', user!.id).order('start_time', { ascending: false }),
          supabase.from('partner_offers').select('*').eq('partner_id', data.id).order('created_at', { ascending: false }),
          supabase.from('business_subscriptions').select('*').eq('partner_id', data.id).maybeSingle(),
        ]);
        const loadedGroups = (groupsRes.data ?? []) as unknown as GroupWithRelations[];
        setGroups(loadedGroups);
        setOffers((offersRes.data ?? []) as PartnerOffer[]);
        setSubscription(subRes.data as BusinessSubscription | null);

        const groupIds = loadedGroups.map(g => g.id);
        if (groupIds.length > 0) {
          const membersRes = await supabase
            .from('group_members')
            .select('user_id, group_id, profile:profiles(*)')
            .in('group_id', groupIds);
          const byUser = new Map<string, { profile: Profile; groupsAttended: number }>();
          for (const row of (membersRes.data ?? []) as unknown as { user_id: string; profile: Profile | null }[]) {
            if (!row.profile) continue;
            const existing = byUser.get(row.user_id);
            if (existing) existing.groupsAttended += 1;
            else byUser.set(row.user_id, { profile: row.profile, groupsAttended: 1 });
          }
          setCommunityMembers(Array.from(byUser.values()).sort((a, b) => b.groupsAttended - a.groupsAttended));
        }
      }
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleSaveProfile() {
    if (!partner) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    const cleanSlug = profileForm.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { error } = await supabase.from('partners').update({
      business_name: profileForm.business_name,
      slug: cleanSlug || null,
      category: profileForm.category || null,
      description: profileForm.description || null,
      logo_url: profileForm.logo_url || null,
      cover_image_url: profileForm.cover_image_url || null,
      website: profileForm.website || null,
      instagram: profileForm.instagram || null,
      phone: profileForm.phone || null,
      email: profileForm.email || null,
    }).eq('id', partner.id);

    if (error) {
      logError('BusinessDashboardPage:handleSaveProfile', error);
      setProfileError(getErrorMessage(error, "We couldn't save your business profile. Please try again."));
      setSavingProfile(false);
      return;
    }

    setPartner({ ...partner, ...profileForm, slug: cleanSlug || null } as Partner);
    setSavingProfile(false);
    setProfileSaved(true);
  }

  async function handleAddOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!partner || !newOffer.title.trim()) return;
    setSavingOffer(true);
    setOfferError(null);

    const { data, error } = await supabase.from('partner_offers').insert({
      partner_id: partner.id,
      title: newOffer.title.trim(),
      description: newOffer.description.trim() || null,
      status: 'active',
    }).select().single();

    if (error) {
      logError('BusinessDashboardPage:handleAddOffer', error);
      setOfferError(getErrorMessage(error, "We couldn't create that offer. Please try again."));
      setSavingOffer(false);
      return;
    }

    setOffers([data as PartnerOffer, ...offers]);
    setNewOffer({ title: '', description: '' });
    setSavingOffer(false);
  }

  async function toggleOffer(offer: PartnerOffer) {
    const nextStatus = offer.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('partner_offers').update({ status: nextStatus }).eq('id', offer.id);
    if (error) { logError('BusinessDashboardPage:toggleOffer', error); return; }
    setOffers(offers.map(o => o.id === offer.id ? { ...o, status: nextStatus } : o));
  }

  async function deleteOffer(offer: PartnerOffer) {
    const { error } = await supabase.from('partner_offers').delete().eq('id', offer.id);
    if (error) { logError('BusinessDashboardPage:deleteOffer', error); return; }
    setOffers(offers.filter(o => o.id !== offer.id));
  }

  if (loading) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <EmptyState
          icon={Building2}
          title="You don't manage a business on IN305 yet."
          description="Apply to partner with us, and once approved you'll get a dashboard to manage your profile, activities, and member offers."
          actionLabel="Partner With Us"
          actionHref="/for-businesses"
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-10 max-w-4xl">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <div>
            <p className="section-label mb-2">Business Dashboard</p>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight">{partner.business_name}</h1>
          </div>
          {partner.slug && (
            <Link to={`/business/${partner.slug}`} className="btn-secondary text-sm">
              View Public Profile <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
        <PartnerStatusBadge status={partner.status} />

        <Tabs
          className="my-7"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'activities', label: 'Activities', count: groups.length },
            { key: 'offers', label: 'Offers', count: offers.length },
            { key: 'community', label: 'Community', count: communityMembers.length },
            { key: 'subscription', label: 'Subscription' },
            { key: 'partnership', label: 'Partnership' },
          ] as const}
        />

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-1">Profile views, activity views, participation</h3>
              <p className="text-sm text-ink-500">Not tracked yet — IN305 doesn't currently record page views or leads. This section will show real numbers once that tracking exists; nothing here is estimated or invented.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card p-6">
                <p className="font-display text-3xl text-ink-900">{groups.length}</p>
                <p className="text-xs text-ink-400 uppercase tracking-wide">Activities Hosted</p>
              </div>
              <div className="card p-6">
                <p className="font-display text-3xl text-ink-900">{groups.reduce((sum, g) => sum + g.current_participants, 0)}</p>
                <p className="text-xs text-ink-400 uppercase tracking-wide">Total Participants</p>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h3 className="font-semibold text-ink-900">Business Profile</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Business name"><input value={profileForm.business_name} onChange={e => setProfileForm({ ...profileForm, business_name: e.target.value })} className="input-field" /></Field>
                <Field label="Public URL slug"><input value={profileForm.slug} onChange={e => setProfileForm({ ...profileForm, slug: e.target.value })} className="input-field" placeholder="your-business-name" /></Field>
                <Field label="Category"><input value={profileForm.category} onChange={e => setProfileForm({ ...profileForm, category: e.target.value })} className="input-field" /></Field>
                <Field label="Phone"><input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="input-field" /></Field>
                <Field label="Website"><input value={profileForm.website} onChange={e => setProfileForm({ ...profileForm, website: e.target.value })} className="input-field" /></Field>
                <Field label="Instagram"><input value={profileForm.instagram} onChange={e => setProfileForm({ ...profileForm, instagram: e.target.value })} className="input-field" placeholder="@yourbusiness" /></Field>
                <Field label="Logo URL"><input value={profileForm.logo_url} onChange={e => setProfileForm({ ...profileForm, logo_url: e.target.value })} className="input-field" /></Field>
                <Field label="Cover image URL"><input value={profileForm.cover_image_url} onChange={e => setProfileForm({ ...profileForm, cover_image_url: e.target.value })} className="input-field" /></Field>
              </div>
              <Field label="Description">
                <textarea value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} className="input-field min-h-[100px]" />
              </Field>
              {profileError && <ErrorBanner message={profileError} />}
              {profileSaved && !profileError && <p className="text-sm text-success-600">Saved.</p>}
              <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-accent">
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {tab === 'activities' && (
          <div>
            <div className="flex justify-end mb-4">
              <Link to="/create" className="btn-accent text-sm px-4 py-2.5"><Sparkles className="w-4 h-4" /> Create Activity</Link>
            </div>
            {groups.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No activities yet."
                description="Host your first IN305 experience — Friday Padel, a dinner social, whatever fits your business."
                actionLabel="Create Activity"
                actionHref="/create"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {groups.map(g => <GroupCard key={g.id} group={g} linkTo={`/manage/${g.slug}`} />)}
              </div>
            )}
          </div>
        )}

        {tab === 'offers' && (
          <div className="space-y-6">
            <form onSubmit={handleAddOffer} className="card p-6 space-y-4">
              <h3 className="font-semibold text-ink-900">New Member Offer</h3>
              <Field label="Title"><input value={newOffer.title} onChange={e => setNewOffer({ ...newOffer, title: e.target.value })} className="input-field" placeholder="20% off first padel session" required /></Field>
              <Field label="Description (optional)"><input value={newOffer.description} onChange={e => setNewOffer({ ...newOffer, description: e.target.value })} className="input-field" placeholder="Redeemable in-person, mention IN305" /></Field>
              {offerError && <ErrorBanner message={offerError} />}
              <button type="submit" disabled={savingOffer || !newOffer.title.trim()} className="btn-accent"><Plus className="w-4 h-4" /> Add Offer</button>
            </form>

            {offers.length === 0 ? (
              <p className="text-ink-400 text-sm">No offers yet.</p>
            ) : (
              <div className="space-y-3">
                {offers.map(o => (
                  <div key={o.id} className="card p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ink-900">{o.title}</p>
                        <span className={`badge ${o.status === 'active' ? 'bg-success-50 text-success-600' : 'bg-ink-100 text-ink-500'}`}>{o.status}</span>
                      </div>
                      {o.description && <p className="text-sm text-ink-500 mt-1">{o.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleOffer(o)} className="p-2 text-ink-400 hover:text-ink-900 hover:bg-ink-50 rounded-lg" aria-label={o.status === 'active' ? 'Deactivate offer' : 'Activate offer'}>
                        {o.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteOffer(o)} className="p-2 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg" aria-label="Delete offer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'community' && (
          <div className="space-y-4">
            {communityMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No community activity yet."
                description="Once locals join the activities you host, they'll show up here so you can see who's engaging with your business."
              />
            ) : (
              <div className="card divide-y divide-ink-100">
                {communityMembers.map(({ profile, groupsAttended }) => (
                  <div key={profile.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={profile.avatar_url} name={profile.first_name ?? profile.username} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900 truncate">
                          {profile.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : profile.username ?? 'Member'}
                        </p>
                        {profile.username && <p className="text-xs text-ink-400 truncate">@{profile.username}</p>}
                      </div>
                    </div>
                    <span className="badge bg-ink-100 text-ink-600 shrink-0">
                      {groupsAttended} {groupsAttended === 1 ? 'activity' : 'activities'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'subscription' && (
          <SubscriptionTab subscription={subscription} />
        )}

        {tab === 'partnership' && (
          <div className="card p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">Current Status</p>
              <PartnerStatusBadge status={partner.status} />
            </div>
            <p className="text-sm text-ink-600 leading-relaxed">
              Featured placement, promoted activities, and sponsored events aren't available yet — this is the foundation for them.
              When they launch, they'll build on the profile and activities you manage here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionTab({ subscription }: { subscription: BusinessSubscription | null }) {
  const [loadingPlan, setLoadingPlan] = useState<'business' | 'business_pro' | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isLive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const plan = subscription ? BUSINESS_PLANS[subscription.plan] : null;

  async function handleSubscribe(planKey: 'business' | 'business_pro') {
    setLoadingPlan(planKey);
    setCheckoutError(null);
    const { error } = await startBusinessCheckout(planKey);
    if (error) {
      setCheckoutError(error);
      setLoadingPlan(null);
    }
    // On success, startBusinessCheckout redirects the browser to Stripe.
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    setCheckoutError(null);
    const { error } = await openBillingPortal('business');
    if (error) {
      setCheckoutError(error);
      setPortalLoading(false);
    }
    // On success, openBillingPortal redirects the browser to Stripe.
  }

  if (isLive && plan) {
    return (
      <div className="card p-6 space-y-4 max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">Current Plan</p>
            <p className="font-display text-2xl text-ink-900 tracking-tight">{plan.name.toUpperCase()}</p>
          </div>
          <span className="badge bg-success-50 text-success-600">{subscription!.status === 'trialing' ? 'Trial' : 'Active'}</span>
        </div>
        <p className="text-sm text-ink-500">${plan.price}/month &middot; {plan.positioning}</p>
        {subscription!.current_period_end && (
          <p className="text-sm text-ink-400">Renews {new Date(subscription!.current_period_end).toLocaleDateString()}</p>
        )}
        {checkoutError && <ErrorBanner message={checkoutError} />}
        <div className="flex gap-2">
          <button onClick={handleManageBilling} disabled={portalLoading} className="btn-primary text-sm">
            {portalLoading ? 'Redirecting...' : 'Manage Billing'}
          </button>
          <Link to="/business/pricing" className="btn-secondary text-sm">Compare Plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <EmptyState
        icon={Crown}
        title="No active Business subscription."
        description="Subscribe to a Business plan to unlock event promotion, offers, and analytics built for growing your business on IN305."
      />
      {subscription && !isLive && (
        <p className="text-sm text-ink-500">
          Your last subscription is <strong className="text-ink-700">{subscription.status.replace('_', ' ')}</strong>. Subscribe again below to reactivate.
        </p>
      )}
      {checkoutError && <ErrorBanner message={checkoutError} />}
      <div className="grid sm:grid-cols-2 gap-4">
        {(['business', 'business_pro'] as const).map(key => {
          const p = BUSINESS_PLANS[key];
          return (
            <div key={key} className={`card p-6 ${key === 'business_pro' ? 'border-2 border-accent-500' : ''}`}>
              <h3 className="font-display text-xl text-ink-900 tracking-tight mb-1">{p.name.toUpperCase()}</h3>
              <p className="text-2xl font-bold text-ink-900 mb-3">${p.price}<span className="text-sm font-normal text-ink-400">/month</span></p>
              <p className="text-sm text-ink-500 mb-4">{p.positioning}</p>
              <button
                onClick={() => handleSubscribe(key)}
                disabled={loadingPlan !== null}
                className={key === 'business_pro' ? 'btn-accent w-full' : 'btn-primary w-full'}
              >
                {loadingPlan === key ? 'Redirecting...' : p.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PartnerStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-warning-50 text-warning-600',
    approved: 'bg-ocean-50 text-ocean-600',
    active: 'bg-success-50 text-success-600',
    declined: 'bg-error-50 text-error-600',
  };
  return <span className={`badge ${map[status] ?? 'bg-ink-100 text-ink-600'}`}>{status}</span>;
}
