import { useEffect, useState, useMemo } from 'react';
import { Calendar, MapPin, Users, Crown, ArrowRight, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import type { EventItem, Neighborhood, Activity, ActivityCategory } from '@/types';

const TIME_FILTERS = ['Today', 'This Week', 'Weekend'];
const CATEGORY_FILTERS = ['Sports', 'Outdoor', 'Social'];

export function EventsPage() {
  const { user, membership } = useAuth();
  const [events, setEvents] = useState<(EventItem & { neighborhood?: Neighborhood; activity?: Activity })[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [eventsRes, catsRes, actsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, neighborhood:neighborhoods(*), activity:activities(*)')
          .in('status', ['active', 'full'])
          .order('start_time', { ascending: true }),
        supabase.from('activity_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('activities').select('*').eq('is_active', true).order('sort_order'),
      ]);
      setEvents((eventsRes.data ?? []) as any);
      setCategories(catsRes.data ?? []);
      setActivities(actsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (timeFilter) {
        const now = new Date();
        const eventDate = new Date(e.start_time);
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59);
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
        const day = now.getDay();
        const daysToSat = (6 - day + 7) % 7;
        const weekendStart = new Date(now); weekendStart.setDate(weekendStart.getDate() + daysToSat); weekendStart.setHours(0, 0, 0);
        const weekendEnd = new Date(weekendStart); weekendEnd.setDate(weekendEnd.getDate() + 2);

        if (timeFilter === 'Today' && eventDate > todayEnd) return false;
        if (timeFilter === 'This Week' && eventDate > weekEnd) return false;
        if (timeFilter === 'Weekend' && (eventDate < weekendStart || eventDate > weekendEnd)) return false;
      }
      if (categoryFilter && e.activity) {
        const activity = activities.find(a => a.id === e.activity!.id);
        const category = categories.find(c => c.id === activity?.category_id);
        if (!category) return false;
        const filterMap: Record<string, string> = { Sports: 'sports', Outdoor: 'outdoors', Social: 'food-social' };
        if (category.slug !== filterMap[categoryFilter]) return false;
      }
      return true;
    });
  }, [events, timeFilter, categoryFilter, activities, categories]);

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8">
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-2">EVENTS</h1>
        <p className="text-ink-500 mb-6">Official IN305 experiences and partner events.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Time</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill label="All" active={!timeFilter} onClick={() => setTimeFilter(null)} />
              {TIME_FILTERS.map(t => (
                <FilterPill key={t} label={t} active={timeFilter === t} onClick={() => setTimeFilter(t)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill label="All" active={!categoryFilter} onClick={() => setCategoryFilter(null)} />
              {CATEGORY_FILTERS.map(c => (
                <FilterPill key={c} label={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} />
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-64 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500">No events match your filters right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filtered.map(e => {
              const spotsLeft = e.max_participants ? e.max_participants - e.current_participants : null;
              const gated = e.membership_required && !(membership?.status === 'active' || membership?.status === 'trialing');
              return (
                <div key={e.id} className="card card-hover overflow-hidden">
                  <div className="relative h-44 bg-gradient-to-br from-ocean-600 to-ocean-800 overflow-hidden">
                    {e.cover_image_url ? (
                      <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover opacity-70" />
                    ) : (
                      <span className="font-display text-3xl text-white/30 tracking-tightest uppercase">{e.activity?.name ?? 'IN305'}</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {e.is_official && <span className="badge bg-accent-500 text-white">IN305 Official</span>}
                      {e.membership_required && <span className="badge bg-ink-900/80 text-cream-50 flex items-center gap-1"><Crown className="w-3 h-3" /> Members</span>}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-display text-xl text-white tracking-tight">{e.title}</h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-ink-500 mb-3 line-clamp-2">{e.description}</p>
                    <div className="flex items-center gap-3 text-xs text-ink-500 mb-4">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(e.start_time)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(e.start_time)}</span>
                      {e.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {e.neighborhood.name}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        {e.price > 0 ? <p className="font-bold text-ink-900">${e.price}</p> : <p className="font-bold text-success-600">Free</p>}
                        {e.max_participants && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Users className="w-3.5 h-3.5 text-ink-400" />
                            <span className="text-xs text-ink-400">{e.current_participants}/{e.max_participants} going</span>
                          </div>
                        )}
                      </div>
                      {gated ? (
                        <Link to="/membership" className="btn-accent text-sm px-4 py-2">Join to attend</Link>
                      ) : e.external_url ? (
                        <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm px-4 py-2">Get Tickets <ArrowRight className="w-4 h-4" /></a>
                      ) : (
                        <Link to={user ? `/events/${e.slug}` : '/signup'} className="btn-primary text-sm px-4 py-2">RSVP</Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
      {label}
    </button>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} · ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`;
}
