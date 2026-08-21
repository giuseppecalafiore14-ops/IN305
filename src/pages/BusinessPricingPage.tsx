import { Check, Sparkles, TrendingUp, Users, Calendar, BarChart3 } from 'lucide-react';
import { Link } from '@/lib/router';
import { BUSINESS_PLANS } from '@/lib/pricing';

const SELLING_POINTS = [
  { icon: Sparkles, label: 'Local Discovery' },
  { icon: Calendar, label: 'Events' },
  { icon: Users, label: 'Community' },
  { icon: TrendingUp, label: 'Recurring Customers' },
  { icon: Users, label: 'Leads' },
  { icon: BarChart3, label: 'Analytics' },
];

export function BusinessPricingPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      {/* Hero */}
      <div className="bg-ink-950 py-20">
        <div className="section-container text-center max-w-2xl">
          <p className="section-label mb-3 text-accent-400">For Businesses</p>
          <h1 className="display-heading text-5xl sm:text-6xl text-white mb-5">
            GET DISCOVERED BY MIAMI LOCALS.
          </h1>
          <p className="text-lg text-cream-200/80">
            IN305 isn't advertising — it's a way to create real experiences, build a community around your business, and turn one-time visitors into regulars.
          </p>
        </div>
      </div>

      {/* Selling points strip */}
      <div className="section-container -mt-8 relative">
        <div className="card p-5 grid grid-cols-3 sm:grid-cols-6 gap-4">
          {SELLING_POINTS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-2">
              <Icon className="w-5 h-5 text-accent-500" />
              <span className="text-2xs font-semibold text-ink-600 uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="section-container py-20">
        <div className="text-center mb-12">
          <p className="section-label mb-2">Plans</p>
          <h2 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest">TWO WAYS TO GROW WITH IN305.</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <PlanCard planKey="business" />
          <PlanCard planKey="business_pro" featured />
        </div>

        <p className="text-center text-sm text-ink-400 mt-8 max-w-lg mx-auto">
          Billing isn't live yet — choosing a plan submits your details to our team to complete setup. No charge is made today.
        </p>
      </div>

      {/* Ecosystem loop */}
      <div className="bg-ink-950 py-20">
        <div className="section-container text-center max-w-3xl">
          <p className="section-label mb-3 text-accent-400">How It Works</p>
          <h2 className="font-display text-3xl sm:text-4xl text-white tracking-tightest mb-10">FROM EXPERIENCE TO REPEAT CUSTOMER.</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm font-semibold text-cream-200 flex-wrap">
            {['You host an experience', 'IN305 promotes it', 'Locals participate', 'They become customers', 'They come back', 'Your community grows'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-3">
                <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-full">{step}</span>
                {i < arr.length - 1 && <span className="text-accent-500">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ planKey, featured = false }: { planKey: keyof typeof BUSINESS_PLANS; featured?: boolean }) {
  const plan = BUSINESS_PLANS[planKey];
  return (
    <div className={`card p-8 relative ${featured ? 'border-2 border-accent-500 shadow-lifted' : ''}`}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="badge bg-accent-500 text-white px-4 py-1.5">Most Popular</span>
        </div>
      )}
      <h3 className="font-display text-2xl text-ink-900 tracking-tight mb-1">{plan.name.toUpperCase()}</h3>
      <p className="text-3xl font-bold text-ink-900 mb-2">${plan.price}<span className="text-base font-normal text-ink-400">/month</span></p>
      <p className="text-sm text-ink-500 mb-6 leading-relaxed">{plan.positioning}</p>
      <ul className="space-y-2.5 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? 'text-accent-500' : 'text-ink-400'}`} /> {f}
          </li>
        ))}
      </ul>
      <Link to={`/for-businesses?plan=${plan.key}`} className={featured ? 'btn-accent w-full' : 'btn-primary w-full'}>
        {plan.cta}
      </Link>
    </div>
  );
}
