import { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, Compass, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { Carousel } from '@/components/Carousel';
import { SectionHeader } from '@/components/SectionHeader';
import { Link } from '@/lib/router';
import { GROUP_SELECT } from '@/lib/queries';
import type { GroupWithRelations, Neighborhood, ActivityCategory, Partner } from '@/types';

const TIME_FILTERS = ['Today', 'Tomorrow', 'This weekend', 'Next 7 days', 'Custom'];
const SIZE_FILTERS = ['2-4', '5-8', '9-12', '13+'];
const EXPERIENCE_FILTERS = ['Beginner', 'Intermediate', 'Advanced', 'Everyone'];
const VIBE_FILTERS = ['Chill', 'Social', 'Active', 'Competitive', 'Creative', 'Professional', 'Party', 'Wellness'];
const VISIBILITY_FILTERS = ['Public', 'Members only'];
const PRICE_FILTERS = ['Free', 'Paid'];
const RECURRING_FILTERS = ['Recurring only'];

export function DiscoverPage() {
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [businesses, setBusinesses] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    time: string | null;
    neighborhood: string | null;
    category: string | null;
    size: string | null;
    experience: string | null;
    vibe: string | null;
    visibility: string | null;
    price: string | null;
    recurring: string | null;
  }>({ time: null, neighborhood: null, category: null, size: null, experience: null, vibe: null, visibility: null, price: null, recurring: null });

  useEffect(() => {
    async function load() {
      const [groupsRes, neighborhoodsRes, categoriesRes, businessesRes] = await Promise.all([
        supabase
          .from('groups')
          .select(GROUP_SELECT)
          .in('status', ['active', 'full'])
          .order('start_time', { ascending: true }),
        supabase.from('neighborhoods').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('activity_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('partners').select('*, neighborhood:neighborhoods(*)').in('status', ['approved', 'active']).not('slug', 'is', null).limit(10),
      ]);
      setGroups((groupsRes.data ?? []) as unknown as GroupWithRelations[]);
      setNeighborhoods(neighborhoodsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setBusinesses((businessesRes.data ?? []) as unknown as Partner[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (search) {
        const q = search.toLowerCase();
        const match = g.title.toLowerCase().includes(q) ||
          g.activity?.name.toLowerCase().includes(q) ||
          g.neighborhood?.name.toLowerCase().includes(q) ||
          g.vibe?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.neighborhood && g.neighborhood?.slug !== filters.neighborhood) return false;
      if (filters.category && g.activity?.category_id !== categories.find(c => c.slug === filters.category)?.id) return false;
      if (filters.size) {
        const [min, max] = filters.size === '13+' ? [13, 999] : filters.size.split('-').map(Number);
        if (g.max_participants < min || g.max_participants > max) return false;
      }
      if (filters.experience && g.experience_level !== filters.experience) return false;
      if (filters.vibe && g.vibe !== filters.vibe) return false;
      if (filters.visibility) {
        const vis = filters.visibility === 'Members only' ? 'members_only' : 'public';
        if (g.visibility !== vis) return false;
      }
      if (filters.price === 'Free' && g.cost > 0) return false;
      if (filters.price === 'Paid' && g.cost <= 0) return false;
      if (filters.recurring && !(g.recurring && g.recurring.length > 0)) return false;
      if (filters.time) {
        const now = new Date();
        const groupDate = new Date(g.start_time);
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59);
        const tomorrowEnd = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59);
        const weekendEnd = new Date(now);
        const day = now.getDay();
        const daysToSat = (6 - day + 7) % 7;
        weekendEnd.setDate(weekendEnd.getDate() + daysToSat + 1); weekendEnd.setHours(23, 59, 59);
        const next7 = new Date(now); next7.setDate(next7.getDate() + 7);

        if (filters.time === 'Today' && groupDate > todayEnd) return false;
        if (filters.time === 'Tomorrow' && (groupDate <= todayEnd || groupDate > tomorrowEnd)) return false;
        if (filters.time === 'This weekend' && groupDate > weekendEnd) return false;
        if (filters.time === 'Next 7 days' && groupDate > next7) return false;
      }
      return true;
    });
  }, [groups, search, filters, categories]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  const recurringGroups = useMemo(
    () => groups.filter(g => g.recurring && g.recurring.length > 0).slice(0, 10),
    [groups]
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-10">
        <p className="section-label mb-2">Explore Miami</p>
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-2">WHAT DO YOU WANT TO DO?</h1>
        <p className="text-ink-500 mb-7">Find your next group and meet people through activities.</p>

        {/* Search + Filter toggle */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              placeholder="Search padel, Brickell, Sunday, painting..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-ink-200 rounded-2xl text-ink-900 placeholder-ink-400 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-medium text-sm transition-all ${showFilters ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-700 hover:border-ink-400'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-accent-500 text-white rounded-full text-2xs">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Quick category strip */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setFilters({ ...filters, category: null })}
              className={`tab-pill shrink-0 ${!filters.category ? 'tab-pill-active' : 'tab-pill-inactive'}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilters({ ...filters, category: filters.category === c.slug ? null : c.slug })}
                className={`tab-pill shrink-0 ${filters.category === c.slug ? 'tab-pill-active' : 'tab-pill-inactive'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="card p-5 sm:p-6 mb-6 animate-slide-up space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={() => { setFilters({ time: null, neighborhood: null, category: null, size: null, experience: null, vibe: null, visibility: null, price: null, recurring: null }); setSearch(''); }} className="text-sm text-ink-500 hover:text-ink-900 flex items-center gap-1">
                  <X className="w-4 h-4" /> Clear all
                </button>
              )}
            </div>

            <FilterRow label="Time" options={TIME_FILTERS} value={filters.time} onChange={(v) => setFilters({ ...filters, time: v })} />
            <FilterRow label="Neighborhood" options={neighborhoods.map(n => n.slug)} labels={neighborhoods.map(n => n.name)} value={filters.neighborhood} onChange={(v) => setFilters({ ...filters, neighborhood: v })} />
            <FilterRow label="Price" options={PRICE_FILTERS} value={filters.price} onChange={(v) => setFilters({ ...filters, price: v })} />
            <FilterRow label="Recurring" options={RECURRING_FILTERS} value={filters.recurring} onChange={(v) => setFilters({ ...filters, recurring: v })} />
            <FilterRow label="Group size" options={SIZE_FILTERS} value={filters.size} onChange={(v) => setFilters({ ...filters, size: v })} />
            <FilterRow label="Experience" options={EXPERIENCE_FILTERS} value={filters.experience} onChange={(v) => setFilters({ ...filters, experience: v })} />
            <FilterRow label="Vibe" options={VIBE_FILTERS} value={filters.vibe} onChange={(v) => setFilters({ ...filters, vibe: v })} />
            <FilterRow label="Visibility" options={VISIBILITY_FILTERS} value={filters.visibility} onChange={(v) => setFilters({ ...filters, visibility: v })} />
          </div>
        )}

        {/* Recurring Activities */}
        {recurringGroups.length > 0 && (
          <div className="mb-10">
            <SectionHeader eyebrow="Weekly & Biweekly" title="RECURRING ACTIVITIES" />
            <Carousel>
              {recurringGroups.map(group => (
                <div key={group.id} className="carousel-item w-72">
                  <GroupCard group={group} />
                </div>
              ))}
            </Carousel>
          </div>
        )}

        {/* Businesses on IN305 */}
        {businesses.length > 0 && (
          <div className="mb-10">
            <SectionHeader eyebrow="On IN305" title="BUSINESSES TO KNOW" />
            <Carousel>
              {businesses.map(b => (
                <Link key={b.id} to={`/business/${b.slug}`} className="carousel-item w-52 card card-hover p-5 text-center relative">
                  {b.is_demo && <span className="badge bg-ink-100 text-ink-500 absolute top-3 right-3">Demo</span>}
                  <div className="w-16 h-16 rounded-2xl bg-ink-50 mx-auto mb-3 overflow-hidden flex items-center justify-center">
                    {b.logo_url ? <img src={b.logo_url} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-ink-300" />}
                  </div>
                  <p className="font-semibold text-ink-900 text-sm truncate">{b.business_name}</p>
                  <p className="text-xs text-ink-400 truncate">{b.category ?? b.neighborhood?.name ?? 'Miami'}</p>
                </Link>
              ))}
            </Carousel>
          </div>
        )}

        {/* Results */}
        <div className="mb-4 text-sm text-ink-500 font-medium">
          {loading ? 'Loading...' : `${filtered.length} ${filtered.length === 1 ? 'group' : 'groups'} found`}
        </div>

        {loading ? (
          <SkeletonCardGrid count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Nothing here yet."
            description="Try adjusting your filters, or be the first to get something going."
            actionLabel="Create a Group"
            actionHref="/create"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, options, labels, value, onChange }: { label: string; options: string[]; labels?: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const optLabel = labels?.[i] ?? opt;
          const isActive = value === opt || (opt === '' && value === null);
          return (
            <button
              key={opt}
              onClick={() => onChange(isActive ? null : opt)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
            >
              {optLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
