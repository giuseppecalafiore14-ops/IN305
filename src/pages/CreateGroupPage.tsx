import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Crown, Rocket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter } from '@/lib/router';
import type { Activity, Neighborhood, ActivityCategory } from '@/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { calculateEventEconomics, formatCurrency, DEFAULT_PLATFORM_FEE_PERCENT } from '@/lib/pricing';
import type { PricingConfig } from '@/types';

const VIBE_OPTIONS = ['Chill', 'Social', 'Active', 'Competitive', 'Creative', 'Professional', 'Party', 'Wellness'];
const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Everyone'];
const SIZE_OPTIONS = [4, 6, 8, 10, 12];
const RECURRENCE_OPTIONS = [
  { value: 'one_time', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'custom', label: 'Custom' },
];

export function CreateGroupPage({ editSlug, duplicateSlug }: { editSlug?: string; duplicateSlug?: string }) {
  const { user, membership, profile, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const [step, setStep] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [loadingSource, setLoadingSource] = useState(Boolean(editSlug || duplicateSlug));
  const [sourceUnauthorized, setSourceUnauthorized] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);

  const [form, setForm] = useState({
    activity_id: '',
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    recurrence: 'one_time',
    neighborhood_id: '',
    venue_name: '',
    meeting_point: '',
    address: '',
    max_participants: 8,
    experience_level: 'Everyone',
    vibe: 'Social',
    visibility: 'public' as 'public' | 'members_only' | 'private',
    description: '',
    cover_image_url: '',
    cost: 0,
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    // Editing your own existing group doesn't require an active membership —
    // only creating a new one does.
    if (!editSlug && (!membership || (membership.status !== 'active' && membership.status !== 'trialing'))) {
      navigate('/membership'); return;
    }
    Promise.all([
      supabase.from('activities').select('*, category:activity_categories(*)').eq('is_active', true).order('sort_order'),
      supabase.from('activity_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('neighborhoods').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('pricing_config').select('platform_fee_percent').maybeSingle(),
    ]).then(([a, c, n, p]) => {
      setActivities((a.data ?? []) as unknown as Activity[]);
      setCategories(c.data ?? []);
      setNeighborhoods(n.data ?? []);
      const pricing = p.data as Pick<PricingConfig, 'platform_fee_percent'> | null;
      if (pricing?.platform_fee_percent != null) setPlatformFeePercent(pricing.platform_fee_percent);
    });
  }, [user, membership, editSlug]);

  useEffect(() => {
    const sourceSlug = editSlug ?? duplicateSlug;
    if (!sourceSlug || !user) { setLoadingSource(false); return; }

    async function loadSource() {
      const { data } = await supabase.from('groups').select('*').eq('slug', sourceSlug).maybeSingle();
      if (!data) { setLoadingSource(false); return; }
      if (editSlug && data.host_id !== user!.id) { setSourceUnauthorized(true); setLoadingSource(false); return; }

      if (editSlug) setEditGroupId(data.id);

      const start = new Date(data.start_time);
      const end = data.end_time ? new Date(data.end_time) : null;
      const pad = (n: number) => String(n).padStart(2, '0');

      setForm({
        activity_id: data.activity_id ?? '',
        title: editSlug ? data.title : `${data.title} (Copy)`,
        date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
        start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        end_time: end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : '',
        recurrence: 'one_time',
        neighborhood_id: data.neighborhood_id ?? '',
        venue_name: data.venue_name ?? '',
        meeting_point: data.meeting_point ?? '',
        address: data.address ?? '',
        max_participants: data.max_participants,
        experience_level: data.experience_level ?? 'Everyone',
        vibe: data.vibe ?? 'Social',
        visibility: data.visibility,
        description: data.description ?? '',
        cover_image_url: data.cover_image_url ?? '',
        cost: Number(data.cost ?? 0),
      });
      setLoadingSource(false);
    }
    loadSource();
  }, [editSlug, duplicateSlug, user]);

  const steps = [
    'WHAT ARE YOU DOING?',
    'GIVE IT A NAME',
    'WHEN?',
    'WHERE?',
    'HOW MANY PEOPLE?',
    'HOW DO YOU WANT TO CHARGE?',
    "WHO'S IT FOR?",
    'WHO CAN JOIN?',
    'SELL IT',
    'COVER IMAGE',
    "YOU'RE READY",
  ];

  async function handlePublish() {
    if (!user) return;
    setPublishing(true);
    setPublishError(null);

    const startDateTime = new Date(`${form.date}T${form.start_time}`);
    const endDateTime = form.end_time ? new Date(`${form.date}T${form.end_time}`) : null;

    if (editGroupId) {
      const { error } = await supabase.from('groups').update({
        title: form.title,
        description: form.description,
        activity_id: form.activity_id || null,
        neighborhood_id: form.neighborhood_id || null,
        venue_name: form.venue_name || null,
        meeting_point: form.meeting_point || null,
        address: form.address || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString() ?? null,
        max_participants: form.max_participants,
        vibe: form.vibe,
        experience_level: form.experience_level,
        visibility: form.visibility,
        cover_image_url: form.cover_image_url || null,
        cost: form.cost,
      }).eq('id', editGroupId);

      if (error) {
        logError('CreateGroupPage:handlePublish(edit)', error);
        setPublishError(getErrorMessage(error, "We couldn't save your changes. Please try again."));
        setPublishing(false);
        return;
      }

      setPublishing(false);
      navigate(`/manage/${editSlug}`);
      return;
    }

    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);

    const { data, error } = await supabase.from('groups').insert({
      slug,
      title: form.title,
      description: form.description,
      activity_id: form.activity_id || null,
      host_id: user.id,
      neighborhood_id: form.neighborhood_id || null,
      venue_name: form.venue_name || null,
      meeting_point: form.meeting_point || null,
      address: form.address || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime?.toISOString() ?? null,
      max_participants: form.max_participants,
      current_participants: 1,
      vibe: form.vibe,
      experience_level: form.experience_level,
      cost: form.cost,
      visibility: form.visibility,
      status: 'active',
      cover_image_url: form.cover_image_url || null,
      is_featured: false,
      is_demo: false,
    }).select().single();

    if (error) {
      logError('CreateGroupPage:handlePublish', error);
      setPublishError(getErrorMessage(error, "We couldn't publish your group. Please try again."));
      setPublishing(false);
      return;
    }

    await supabase.from('group_members').insert({
      group_id: data.id,
      user_id: user.id,
    });

    await supabase.from('group_messages').insert({
      group_id: data.id,
      sender_id: user.id,
      body: `${profile?.first_name ?? 'Host'} created this group.`,
      is_system: true,
    });

    if (!profile?.is_host) {
      await supabase.from('profiles').update({ is_host: true, groups_hosted_count: (profile?.groups_hosted_count ?? 0) + 1 }).eq('id', user.id);
      await refreshProfile();
    }

    if (form.recurrence !== 'one_time') {
      await supabase.from('recurring_groups').insert({
        group_id: data.id,
        frequency: form.recurrence === 'biweekly' ? 'biweekly' : 'weekly',
        interval_weeks: form.recurrence === 'biweekly' ? 2 : 1,
      });
    }

    setPublishing(false);
    setPublishedSlug(slug);
  }

  if (loadingSource) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  }

  if (sourceUnauthorized) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-ink-500 text-lg mb-4">You don't manage this group.</p>
          <button onClick={() => navigate('/host')} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (publishedSlug) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-10 h-10 text-success-500" />
          </div>
          <h1 className="font-display text-4xl text-ink-900 tracking-tight mb-3">YOUR GROUP IS LIVE.</h1>
          <p className="text-ink-500 mb-8">People can now discover and join your group.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => navigate(`/groups/${publishedSlug}`)} className="btn-accent w-full">View Group</button>
            <button onClick={() => navigate('/discover')} className="btn-secondary w-full">Go to Discover</button>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = steps[step];
  const selectedActivity = activities.find(a => a.id === form.activity_id);

  return (
    <div className="min-h-screen bg-cream-50 py-8 sm:py-12">
      <div className="section-container max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Step {step + 1} of {steps.length}</p>
            <p className="text-xs font-semibold text-ink-400">{editGroupId ? 'Edit Group' : 'Create a Group'}</p>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-accent-500 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <h1 className="display-heading text-4xl sm:text-5xl">{currentStep}</h1>
        </div>

        <div className="card p-6 sm:p-8 space-y-5">
          {/* Step 0: Activity */}
          {step === 0 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {categories.map(cat => {
                  const catActivities = activities.filter(a => a.category_id === cat.id);
                  return catActivities.map(a => (
                    <button key={a.id} onClick={() => setForm({ ...form, activity_id: a.id })}
                      className={`p-3 rounded-xl text-sm font-medium transition-all text-left ${form.activity_id === a.id ? 'bg-accent-500 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}>
                      {a.name}
                    </button>
                  ));
                })}
              </div>
            </div>
          )}

          {/* Step 1: Title */}
          {step === 1 && (
            <div>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="input-field" placeholder="Saturday Padel Crew" />
              <p className="text-sm text-ink-400 mt-2">Example: Saturday Padel Crew, Sunset Beach Run, Wynwood Painting Night</p>
            </div>
          )}

          {/* Step 2: When */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Start time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">End time (optional)</label>
                  <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Recurrence</label>
                <div className="flex flex-wrap gap-2">
                  {RECURRENCE_OPTIONS.map(r => (
                    <button key={r.value} onClick={() => setForm({ ...form, recurrence: r.value })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.recurrence === r.value ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Where */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Neighborhood</label>
                <div className="flex flex-wrap gap-2">
                  {neighborhoods.map(n => (
                    <button key={n.id} onClick={() => setForm({ ...form, neighborhood_id: n.id })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.neighborhood_id === n.id ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {n.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Venue name</label>
                <input value={form.venue_name} onChange={e => setForm({ ...form, venue_name: e.target.value })} className="input-field" placeholder="Padel Miami" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Meeting point</label>
                <input value={form.meeting_point} onChange={e => setForm({ ...form, meeting_point: e.target.value })} className="input-field" placeholder="Front desk" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" placeholder="1451 Brickell Ave, Miami, FL" />
              </div>
            </div>
          )}

          {/* Step 4: Size */}
          {step === 4 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {SIZE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setForm({ ...form, max_participants: s })}
                    className={`px-6 py-3 rounded-xl text-lg font-bold transition-all ${form.max_participants === s ? 'bg-accent-500 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="bg-ocean-50 rounded-xl p-4 text-ocean-700 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> Small groups make it easier to actually meet people. We recommend 8.
              </div>
            </div>
          )}

          {/* Step 5: Pricing */}
          {step === 5 && (() => {
            const isPaid = form.cost > 0;
            const { grossRevenue, platformFee, netEarnings } = calculateEventEconomics(form.cost, form.max_participants, platformFeePercent);
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setForm({ ...form, cost: 0 })}
                    className={`p-4 rounded-xl text-left transition-all border-2 ${!isPaid ? 'border-accent-500 bg-accent-50' : 'border-ink-100 hover:border-ink-200'}`}
                  >
                    <p className="font-semibold text-ink-900">Free</p>
                    <p className="text-sm text-ink-500">No ticket price.</p>
                  </button>
                  <button
                    onClick={() => setForm({ ...form, cost: form.cost > 0 ? form.cost : 20 })}
                    className={`p-4 rounded-xl text-left transition-all border-2 ${isPaid ? 'border-accent-500 bg-accent-50' : 'border-ink-100 hover:border-ink-200'}`}
                  >
                    <p className="font-semibold text-ink-900">Paid</p>
                    <p className="text-sm text-ink-500">Set your ticket price.</p>
                  </button>
                </div>

                {isPaid && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1.5">Ticket price (per person)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-semibold">$</span>
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={form.cost}
                          onChange={e => setForm({ ...form, cost: Math.max(0, Number(e.target.value)) })}
                          className="input-field pl-8"
                        />
                      </div>
                    </div>

                    <div className="bg-ink-900 rounded-2xl p-5 text-white">
                      <p className="text-xs uppercase tracking-wide text-cream-300 mb-3">Per Participant</p>
                      <div className="flex items-center justify-between text-sm mb-4 pb-4 border-b border-white/15">
                        <span className="text-cream-200">{formatCurrency(form.cost)} ticket → IN305 fee {platformFeePercent}%</span>
                        <span className="font-semibold text-accent-400">You receive {formatCurrency(form.cost * (1 - platformFeePercent / 100))}</span>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-cream-300 mb-3">Estimated Revenue at Full Capacity</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-cream-200">{formatCurrency(form.cost)} × {form.max_participants} spots</span>
                          <span className="font-semibold">{formatCurrency(grossRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-cream-300">
                          <span>IN305 platform fee ({platformFeePercent}%)</span>
                          <span>-{formatCurrency(platformFee)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-white/15 font-display text-xl">
                          <span>Your estimated earnings</span>
                          <span className="text-accent-400">{formatCurrency(netEarnings)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-ink-400 leading-relaxed">
                      You keep {100 - platformFeePercent}% of your event revenue. IN305 keeps {platformFeePercent}% for providing discovery, booking, community and event infrastructure.
                      Payment processing fees and event expenses may also apply. Figures above are an estimate based on full capacity — online payments aren't live yet, so this preview doesn't create a real charge.
                    </p>
                  </>
                )}
              </div>
            );
          })()}

          {/* Step 6: Who */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Experience level</label>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_OPTIONS.map(e => (
                    <button key={e} onClick={() => setForm({ ...form, experience_level: e })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.experience_level === e ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Vibe</label>
                <div className="flex flex-wrap gap-2">
                  {VIBE_OPTIONS.map(v => (
                    <button key={v} onClick={() => setForm({ ...form, vibe: v })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.vibe === v ? 'bg-ocean-500 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Visibility */}
          {step === 7 && (
            <div className="space-y-3">
              {([
                { value: 'public', title: 'Public', desc: 'Anyone can discover and join.' },
                { value: 'members_only', title: 'Members Only', desc: 'Only IN305 members can access.' },
                { value: 'private', title: 'Private', desc: 'Only invited or approved users can join.' },
              ] as const).map(v => (
                <button key={v.value} onClick={() => setForm({ ...form, visibility: v.value })}
                  className={`w-full p-4 rounded-xl text-left transition-all border-2 ${form.visibility === v.value ? 'border-accent-500 bg-accent-50' : 'border-ink-100 hover:border-ink-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-900">{v.title}</p>
                      <p className="text-sm text-ink-500">{v.desc}</p>
                    </div>
                    {form.visibility === v.value && <Check className="w-5 h-5 text-accent-500" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 8: Description */}
          {step === 8 && (
            <div>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="input-field min-h-[150px]" placeholder="Tell people why they should join. What will you do? What's the vibe? What should they bring?" />
            </div>
          )}

          {/* Step 9: Cover */}
          {step === 9 && (
            <div>
              <input value={form.cover_image_url} onChange={e => setForm({ ...form, cover_image_url: e.target.value })}
                className="input-field" placeholder="Image URL (optional)" />
              <p className="text-sm text-ink-400 mt-2">Leave blank to use a category image automatically.</p>
            </div>
          )}

          {/* Step 10: Preview */}
          {step === 10 && (
            <div className="space-y-4">
              <div className="bg-ink-900 rounded-2xl p-6 text-center">
                <span className="badge bg-accent-500/20 text-accent-300 mb-2">{selectedActivity?.name ?? 'Activity'}</span>
                <h3 className="font-display text-2xl text-white tracking-tight mb-2">{form.title || 'Your Group'}</h3>
                <p className="text-cream-200 text-sm">{form.date || 'Date TBD'} · {form.start_time || 'Time TBD'}</p>
                <p className="text-cream-300 text-sm">{neighborhoods.find(n => n.id === form.neighborhood_id)?.name ?? 'Location TBD'}</p>
                <p className="text-cream-300 text-sm mt-2">{form.max_participants} spots · {form.vibe} · {form.experience_level}</p>
                <p className="font-display text-lg text-accent-400 mt-3">{form.cost > 0 ? `${formatCurrency(form.cost)} / person` : 'Free'}</p>
              </div>
              {form.description && (
                <div className="bg-cream-100 rounded-xl p-4">
                  <p className="text-sm text-ink-600 whitespace-pre-line">{form.description}</p>
                </div>
              )}
            </div>
          )}

          {publishError && <ErrorBanner message={publishError} />}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button onClick={() => { setStep(step - 1); setPublishError(null); }} className="btn-secondary flex-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex-1"
                disabled={step === 0 && !form.activity_id || step === 1 && !form.title || step === 2 && !form.date}>
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handlePublish} disabled={publishing} className="btn-accent flex-1">
                {publishing ? 'Saving...' : editGroupId ? 'Save Changes' : 'Publish Group'} <Rocket className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
