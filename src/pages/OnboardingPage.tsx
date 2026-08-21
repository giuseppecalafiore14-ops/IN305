import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, Link } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ArrowLeft, Check, Sparkles, Compass, Rocket, Building2 } from 'lucide-react';
import type { Neighborhood, GroupWithRelations } from '@/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { GROUP_SELECT } from '@/lib/queries';

const MOTIVATION_OPTIONS = ['Meet people', 'Find activities', 'Discover Miami', 'Host events', 'Grow my business'];
const VIBE_OPTIONS = ['Chill', 'Social', 'Active', 'Competitive', 'Creative', 'Professional', 'Party', 'Wellness'];
const ACTIVITY_OPTIONS = ['Running', 'Basketball', 'Volleyball', 'Tennis', 'Padel', 'Pickleball', 'Fitness', 'Surfing', 'Cycling', 'Hiking', 'Social Events', 'Adventure', 'Photography', 'Painting', 'Brunch', 'Dinner', 'Coffee', 'Yoga', 'Boat', 'Watch Parties', 'Networking', 'Beach', 'Nightlife', 'Wellness'];

const ROLES = [
  { icon: Compass, title: 'Member', description: 'Discover experiences and meet people.' },
  { icon: Rocket, title: 'Host', description: 'Create experiences and get paid.' },
  { icon: Building2, title: 'Business', description: 'Attract Miami locals and build recurring customers.' },
];

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<GroupWithRelations[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    username: '',
    neighborhood_id: '',
    motivations: [] as string[],
    activities: [] as string[],
    preferred_vibes: [] as string[],
  });

  useEffect(() => {
    supabase.from('neighborhoods').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, []);

  // Load recommendations when reaching the final step
  useEffect(() => {
    if (step === 5 && !saved) {
      handleSave();
    }
  }, [step]);

  async function handleSave() {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.from('profiles').update({
      first_name: form.first_name || null,
      username: form.username || null,
      neighborhood_id: form.neighborhood_id || null,
      interests: form.motivations,
      activities: form.activities,
      preferred_vibes: form.preferred_vibes,
    }).eq('id', user.id);

    if (updateError) {
      logError('OnboardingPage:handleSave', updateError);
      setError(getErrorMessage(updateError, "We couldn't save your profile. Please try again."));
      setLoading(false);
      return;
    }

    await refreshProfile();

    // Load recommendations based on selected activities
    const { data: groups } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .in('status', ['active', 'full'])
      .order('start_time', { ascending: true })
      .limit(6);

    // Score and sort by activity match
    const scored = ((groups ?? []) as unknown as GroupWithRelations[]).map(g => {
      let score = 0;
      if (form.activities.some(a => g.activity?.name.toLowerCase().includes(a.toLowerCase()))) score += 30;
      if (form.preferred_vibes.some(v => g.vibe === v)) score += 15;
      if (form.neighborhood_id && g.neighborhood_id === form.neighborhood_id) score += 20;
      return { group: g, score };
    }).sort((a, b) => b.score - a.score);

    setRecommendations(scored.map(s => s.group).slice(0, 3));
    setSaved(true);
    setLoading(false);
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  const steps = [
    { title: "What's your name?", subtitle: "Let's start with the basics." },
    { title: 'What brings you to IN305?', subtitle: 'Pick everything that applies — you can change this later.' },
    { title: 'What are you into?', subtitle: 'Pick a few activities and vibes that match your energy.' },
    { title: 'Where do you spend time?', subtitle: 'Helps us recommend things nearby.' },
    { title: 'Meet IN305', subtitle: 'Three ways to use the platform.' },
    { title: "Here's what we found for you", subtitle: 'Recommended groups based on your interests.' },
  ];

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="section-label mb-2">Profile Setup</p>
          <h1 className="font-display text-3xl text-ink-900 tracking-tight">{steps[step].title}</h1>
          <p className="text-ink-500 text-sm mt-1">{steps[step].subtitle}</p>
          <div className="flex justify-center gap-1.5 mt-4">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-accent-500' : i < step ? 'w-8 bg-ink-300' : 'w-8 bg-ink-100'}`} />
            ))}
          </div>
        </div>

        <div className="card p-6 space-y-5">
          {/* Step 1: Name */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">First name</label>
                <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input-field" placeholder="Your name" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Username</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="input-field" placeholder="username" />
              </div>
            </>
          )}

          {/* Step 2: What brings you to IN305 */}
          {step === 1 && (
            <div>
              <div className="flex flex-wrap gap-2">
                {MOTIVATION_OPTIONS.map(m => (
                  <button key={m} onClick={() => setForm({ ...form, motivations: toggleArray(form.motivations, m) })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.motivations.includes(m) ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                    {form.motivations.includes(m) && <Check className="w-3.5 h-3.5 inline mr-1" />}
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-400 mt-3">{form.motivations.length} selected</p>
            </div>
          )}

          {/* Step 3: Activities + Vibes */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Activities</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map(a => (
                    <button key={a} onClick={() => setForm({ ...form, activities: toggleArray(form.activities, a) })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${form.activities.includes(a) ? 'bg-accent-500 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {form.activities.includes(a) && <Check className="w-3.5 h-3.5 inline mr-1" />}
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Vibe</p>
                <div className="flex flex-wrap gap-2">
                  {VIBE_OPTIONS.map(v => (
                    <button key={v} onClick={() => setForm({ ...form, preferred_vibes: toggleArray(form.preferred_vibes, v) })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.preferred_vibes.includes(v) ? 'bg-ocean-500 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {form.preferred_vibes.includes(v) && <Check className="w-3.5 h-3.5 inline mr-1" />}
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Neighborhood */}
          {step === 3 && (
            <div>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map(n => (
                  <button key={n.id} onClick={() => setForm({ ...form, neighborhood_id: n.id })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.neighborhood_id === n.id ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Role explainer */}
          {step === 4 && (
            <div className="space-y-3">
              {ROLES.map(r => (
                <div key={r.title} className="flex items-start gap-3 p-4 rounded-xl bg-ink-50">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <r.icon className="w-5 h-5 text-accent-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900">{r.title}</p>
                    <p className="text-sm text-ink-500">{r.description}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-400 pt-1">
                You're starting as a Member — hosting and business tools are available any time from your profile, at no extra step required now.
              </p>
            </div>
          )}

          {/* Step 6: Recommendations */}
          {step === 5 && (
            <div>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-ink-400">Finding groups for you...</div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <ErrorBanner message={error} className="mb-4 text-left" />
                  <button onClick={handleSave} className="btn-secondary">Try Again</button>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="w-10 h-10 text-ink-300 mx-auto mb-3" />
                  <p className="text-ink-500 mb-4">No groups match your interests yet. Explore all groups to find something for you!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map(g => (
                    <Link key={g.id} to={`/groups/${g.slug}`} className="card card-hover p-4 flex items-center gap-3 block">
                      <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {g.cover_image_url ? (
                          <img src={g.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-lg text-ink-500">{g.activity?.name?.[0] ?? 'G'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink-900 text-sm truncate">{g.title}</p>
                        <p className="text-xs text-ink-500">{g.activity?.name} · {g.neighborhood?.name}</p>
                        <p className="text-xs text-ink-400">{g.current_participants}/{g.max_participants} spots</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 0 && step < 5 && (
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 4 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex-1"
                disabled={step === 0 && !form.first_name}>
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : step === 4 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">
                See Recommendations <Sparkles className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => navigate('/discover')} className="btn-accent flex-1">
                Start Exploring <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
