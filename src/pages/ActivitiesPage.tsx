import { useEffect, useState, useMemo } from 'react';
import { Link, useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Users, MapPin, Clock, ArrowLeft, ArrowRight, Check, Calendar, Star } from 'lucide-react';
import type { ActivityCategory, Activity, GroupWithRelations, Neighborhood } from '@/types';
import { GroupCard } from '@/components/GroupCard';
import { GROUP_SELECT } from '@/lib/queries';

const CATEGORY_IMAGES: Record<string, string> = {
  sports: 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  outdoors: 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  creative: 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  'food-social': 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  nightlife: 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  wellness: 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  entertainment: 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  business: 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  other: 'https://images.pexels.com/photos/931007/pexels-photo-931007.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
};

export function ActivitiesPage({ initialCategory }: { initialCategory?: string }) {
  const { path } = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory ?? null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cats, acts, grps] = await Promise.all([
        supabase.from('activity_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('activities').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('groups')
          .select(GROUP_SELECT)
          .in('status', ['active', 'full'])
          .order('start_time', { ascending: true }),
      ]);
      setCategories(cats.data ?? []);
      setActivities(acts.data ?? []);
      setGroups((grps.data ?? []) as unknown as GroupWithRelations[]);
      setLoading(false);
    }
    load();
  }, []);

  // Activity detail view
  const activitySlug = path.includes('/activities/') ? path.split('/activities/')[1]?.split('?')[0] : null;
  const detailActivity = activitySlug ? activities.find(a => a.slug === activitySlug) : null;
  const detailGroups = detailActivity ? groups.filter(g => g.activity_id === detailActivity.id) : [];

  const filteredGroups = selectedCategory
    ? groups.filter(g => {
        const activity = activities.find(a => a.id === g.activity_id);
        return activity?.category_id === categories.find(c => c.slug === selectedCategory)?.id;
      })
    : groups;

  const categoryActivities = selectedCategory
    ? activities.filter(a => a.category_id === categories.find(c => c.slug === selectedCategory)?.id)
    : activities;

  // Activity detail page
  if (activitySlug && detailActivity) {
    return (
      <div className="min-h-screen bg-cream-50">
        {/* Hero */}
        <div className="relative h-72 bg-ink-900 overflow-hidden">
          <img src={CATEGORY_IMAGES[detailActivity.slug] ?? CATEGORY_IMAGES[categories.find(c => c.id === detailActivity.category_id)?.slug ?? 'other'] ?? CATEGORY_IMAGES.other}
            alt={detailActivity.name} className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
          <div className="absolute top-4 left-4">
            <Link to="/activities" className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> All Activities
            </Link>
          </div>
        </div>

        <div className="section-container -mt-16 relative pb-16">
          <div className="card p-6 sm:p-8">
            <span className="badge bg-accent-50 text-accent-700 mb-3">{categories.find(c => c.id === detailActivity.category_id)?.name ?? 'Activity'}</span>
            <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-3">{detailActivity.name}</h1>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-ink-100">
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Upcoming</p>
                <p className="text-xl font-bold text-ink-900">{detailGroups.length}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Neighborhoods</p>
                <p className="text-xl font-bold text-ink-900">{new Set(detailGroups.map(g => g.neighborhood?.name).filter(Boolean)).size}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Total Spots</p>
                <p className="text-xl font-bold text-ink-900">{detailGroups.reduce((sum, g) => sum + (g.max_participants - g.current_participants), 0)}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h3 className="font-semibold text-ink-900 mb-2">About {detailActivity.name}</h3>
              <p className="text-ink-600 leading-relaxed">
                Join small groups doing {detailActivity.name.toLowerCase()} across Miami. Whether you're a beginner or experienced,
                there's a group waiting for you. Meet new people while doing something you enjoy.
              </p>
            </div>
          </div>

          {/* Upcoming groups for this activity */}
          <div className="mt-6">
            <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">UPCOMING {detailActivity.name.toUpperCase()} GROUPS</h2>
            {detailGroups.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-ink-500 mb-4">No {detailActivity.name.toLowerCase()} groups scheduled right now.</p>
                <Link to="/membership" className="btn-accent">Create a Group</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {detailGroups.map(g => <GroupCard key={g.id} group={g} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8">
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-2">FIND SOMETHING TO DO</h1>
        <p className="text-ink-500 mb-6">Browse activities and find your next group.</p>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!selectedCategory ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCategory(c.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === c.slug ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Category cards (when no category selected) */}
        {!selectedCategory && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
            {categories.map(cat => {
              const catActivities = activities.filter(a => a.category_id === cat.id);
              const catGroups = groups.filter(g => {
                const act = activities.find(a => a.id === g.activity_id);
                return act?.category_id === cat.id;
              });
              return (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.slug)}
                  className="card card-hover overflow-hidden text-left group">
                  <div className="relative h-32 overflow-hidden">
                    <img src={CATEGORY_IMAGES[cat.slug] ?? CATEGORY_IMAGES.other} alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <p className="font-display text-xl text-white tracking-tight">{cat.name}</p>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-ink-400">{catActivities.length} activities</span>
                    <span className="text-xs font-medium text-accent-600">{catGroups.length} groups</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Activity pills (when category selected) */}
        {selectedCategory && (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {categoryActivities.map(a => (
                <Link key={a.id} to={`/activities/${a.slug}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-50 text-accent-600 hover:bg-accent-100 transition-all flex items-center gap-1.5">
                  {a.name} <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>

            {/* Groups in this category */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-ink-500 text-lg mb-1">Nothing here yet.</p>
                <p className="text-ink-400 text-sm mb-6">No groups in this category yet. Be the first to create one.</p>
                <Link to="/membership" className="btn-accent">Create a Group</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredGroups.map(g => <GroupCard key={g.id} group={g} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
