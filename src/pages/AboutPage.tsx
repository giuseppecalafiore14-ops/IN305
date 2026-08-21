import { Link } from '@/lib/router';
import { Users, Calendar, Shield, Heart, MapPin } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <div className="bg-ink-900 py-16">
        <div className="section-container text-center">
          <p className="section-label mb-2 text-accent-400">About</p>
          <h1 className="font-display text-5xl text-white tracking-tightest mb-4">BIG CITY. SMALL CIRCLES.</h1>
          <p className="text-lg text-cream-200 max-w-lg mx-auto">Miami is better when you have people to do things with.</p>
        </div>
      </div>

      <div className="section-container py-16 max-w-3xl">
        <div className="prose prose-lg max-w-none">
          <h2 className="font-display text-3xl text-ink-900 tracking-tight mb-4">What is IN305?</h2>
          <p className="text-ink-600 leading-relaxed mb-6">
            IN305 is a Miami-based social activity club. We help people discover small groups, meet people through things they actually enjoy doing, and create their own plans.
          </p>
          <p className="text-ink-600 leading-relaxed mb-6">
            The problem isn't discovering that activities exist — it's finding the right people to do them with. Someone might want to play padel, go for a run, paint, have brunch, or watch a match, but they don't have the right people available.
          </p>
          <p className="text-ink-600 leading-relaxed mb-10">
            IN305 solves this by organizing people around small groups and real-world activities. Free users join the plans. Members create the plans.
          </p>

          <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: MapPin, title: 'Pick something', desc: 'Choose something you actually want to do.' },
              { icon: Users, title: 'Join a small group', desc: 'Meet people who want to do the same thing.' },
              { icon: Calendar, title: 'Do it again', desc: 'Turn one activity into recurring plans.' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="card p-5">
                  <Icon className="w-8 h-8 text-accent-500 mb-3" />
                  <p className="font-semibold text-ink-900 mb-1">{s.title}</p>
                  <p className="text-sm text-ink-500">{s.desc}</p>
                </div>
              );
            })}
          </div>

          <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">Safety & Community</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <div className="card p-5 flex items-start gap-3">
              <Shield className="w-6 h-6 text-ocean-500 shrink-0" />
              <div>
                <p className="font-semibold text-ink-900">Verified Hosts</p>
                <p className="text-sm text-ink-500">Host information is visible. Admins verify trusted hosts.</p>
              </div>
            </div>
            <div className="card p-5 flex items-start gap-3">
              <Heart className="w-6 h-6 text-accent-500 shrink-0" />
              <div>
                <p className="font-semibold text-ink-900">Community Guidelines</p>
                <p className="text-sm text-ink-500">Report inappropriate behavior. We review every report.</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-6">
            <Link to="/signup" className="btn-accent text-base px-8 py-4">Get Started</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
