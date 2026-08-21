import { useEffect, useState } from 'react';
import { Check, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter, Link } from '@/lib/router';
import { startMembershipCheckout, openBillingPortal } from '@/lib/stripe';
import { ErrorBanner } from '@/components/ErrorBanner';
import type { PricingConfig } from '@/types';

export function MembershipPage() {
  const { user, membership } = useAuth();
  const { navigate } = useRouter();
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [founderCount, setFounderCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [p, f] = await Promise.all([
        supabase.from('pricing_config').select('*').maybeSingle(),
        supabase.from('memberships').select('user_id', { count: 'exact', head: true }).eq('is_founder', true),
      ]);
      setPricing(p.data as PricingConfig | null);
      setFounderCount(f.count ?? 0);
    }
    load();
  }, []);

  async function handleJoin() {
    if (!user) { navigate('/signup'); return; }
    setLoading(true);
    setError(null);
    // Membership state is server-authoritative — this only requests a Stripe
    // Checkout session; the webhook is the only thing that ever activates it.
    const { error: checkoutError } = await startMembershipCheckout();
    if (checkoutError) {
      setError(checkoutError);
      setLoading(false);
    }
    // On success, startMembershipCheckout redirects the browser to Stripe.
  }

  async function handleManageBilling() {
    setLoading(true);
    setError(null);
    const { error: portalError } = await openBillingPortal('membership');
    if (portalError) {
      setError(portalError);
      setLoading(false);
    }
    // On success, openBillingPortal redirects the browser to Stripe.
  }

  const freeFeatures = [
    'Explore groups and activities',
    'Join public groups',
    'Create your profile',
    'Save activities for later',
    'Participate in group chat',
  ];

  const memberFeatures = [
    'Everything in Free, plus:',
    'Member-only events',
    'Private groups',
    'Early access to popular activities',
    'Member community',
    'Special partner benefits',
    'Priority access',
    'Create and host groups',
  ];

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-ink-900 py-16">
        <div className="section-container text-center">
          <p className="section-label mb-2 text-accent-400">Membership</p>
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-tightest mb-4">MORE THAN AN EVENT.<br />IT'S YOUR COMMUNITY.</h1>
          <p className="text-lg text-cream-200 max-w-lg mx-auto">Member-only events, private groups, early access, and the people who make Miami feel like home.</p>
        </div>
      </div>

      <div className="section-container py-16">
        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* Free */}
          <div className="card p-8">
            <h3 className="font-display text-2xl text-ink-900 tracking-tight mb-1">FREE</h3>
            <p className="text-3xl font-bold text-ink-900 mb-6">$0<span className="text-base font-normal text-ink-400">/month</span></p>
            <ul className="space-y-3 mb-8">
              {freeFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
                  <Check className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {user ? (
              <div className="btn-secondary w-full opacity-60 cursor-default">Current Plan</div>
            ) : (
              <Link to="/signup" className="btn-secondary w-full">Get Started Free</Link>
            )}
          </div>

          {/* Member */}
          <div className="card p-8 relative border-2 border-accent-500 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="badge bg-accent-500 text-white px-4 py-1.5">Recommended</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-accent-500" />
              <h3 className="font-display text-2xl text-ink-900 tracking-tight">MEMBER</h3>
            </div>
            <p className="text-3xl font-bold text-ink-900 mb-6">
              ${pricing?.monthly_price ?? '24.99'}<span className="text-base font-normal text-ink-400">/month</span>
            </p>
            <ul className="space-y-3 mb-8">
              {memberFeatures.map((f, i) => (
                <li key={f} className={`flex items-start gap-2 text-sm ${i === 0 ? 'font-semibold text-ink-900' : 'text-ink-600'}`}>
                  {i === 0 ? <Sparkles className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" />}
                  {f}
                </li>
              ))}
            </ul>
            {membership?.status === 'active' ? (
              <button onClick={handleManageBilling} disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> {loading ? 'Redirecting...' : 'Active Member · Manage Billing'}
              </button>
            ) : (
              <button onClick={handleJoin} disabled={loading} className="btn-accent w-full">
                {loading ? 'Redirecting to secure checkout...' : 'Join IN305'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            )}
            {error && <ErrorBanner message={error} className="mt-3" />}
            <p className="text-xs text-ink-400 text-center mt-3">Cancel anytime · You're joining Miami's local social ecosystem, not a SaaS plan.</p>
          </div>
        </div>

        {/* Founder Section */}
        {pricing && (
          <div className="bg-gradient-to-br from-ink-800 to-ink-900 rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden max-w-4xl mx-auto">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Crown className="w-6 h-6 text-accent-400" />
                <span className="badge bg-accent-500/20 text-accent-300 border border-accent-500/30">Founding 100</span>
              </div>
              <h2 className="font-display text-5xl sm:text-6xl text-white tracking-tightest mb-4">
                {founderCount} / {pricing.founder_limit}
              </h2>
              <p className="text-lg text-cream-200 max-w-md mx-auto mb-2">
                Be one of the first {pricing.founder_limit} people helping build IN305.
              </p>
              <p className="text-sm text-cream-300 max-w-md mx-auto mb-8">
                Founder Members get a special badge, early access, and exclusive experiences.
              </p>
              {membership?.status !== 'active' && (
                <button onClick={handleJoin} disabled={loading} className="btn-accent text-base px-8 py-4">
                  Become a Founder
                </button>
              )}
            </div>
          </div>
        )}

        {/* Value prop */}
        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h3 className="font-display text-3xl text-ink-900 tracking-tight mb-3">FREE USERS JOIN THE PLANS. MEMBERS CREATE THE PLANS.</h3>
          <p className="text-ink-500">Members don't just join IN305. They create what happens next.</p>
        </div>
      </div>
    </div>
  );
}
