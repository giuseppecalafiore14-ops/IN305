import { useEffect, useState } from 'react';
import { Compass, Users, Calendar, ArrowRight, Sparkles, Crown, Flame, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Link } from '@/lib/router';
import { GroupCard } from '@/components/GroupCard';
import { Avatar } from '@/components/Avatar';
import { Carousel } from '@/components/Carousel';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonCarousel } from '@/components/Skeleton';
import { useAuth } from '@/lib/auth';
import { GROUP_SELECT } from '@/lib/queries';
import { formatCurrency } from '@/lib/pricing';
import { formatDateShort } from '@/lib/format';
import type { GroupWithRelations, ActivityCategory, PricingConfig, Profile } from '@/types';

function FeaturedExperience({ group }: { group: GroupWithRelations }) {
  const spotsLeft = group.max_participants - group.current_participants;
  return (
    <Link to={`/groups/${group.slug}`} className="group block relative rounded-4xl overflow-hidden h-[420px] sm:h-[480px] bg-ink-950">
      {group.cover_image_url ? (
        <img src={group.cover_image_url} alt={group.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-ink-800 to-ink-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <span className="badge bg-accent-500 text-white">This Week's Pick</span>
        {group.activity && <span className="badge bg-white/15 backdrop-blur-sm text-white border border-white/20">{group.activity.name}</span>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <div className="max-w-xl">
          {group.host && (
            <div className="flex items-center gap-2 mb-3">
              <Avatar src={group.host.avatar_url} name={group.host.first_name} size="xs" ring />
              <span className="text-sm text-white/80">Hosted by {group.host.first_name ?? 'a member'}</span>
            </div>
          )}
          <h3 className="display-heading text-3xl sm:text-5xl text-white mb-3 leading-[0.95]">{group.title}</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/85 mb-5">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatDateShort(group.start_time)}</span>
            {group.neighborhood && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {group.neighborhood.name}</span>}
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="btn-accent">
              {group.cost > 0 ? `Reserve — ${formatCurrency(group.cost)}` : 'Join Group'} <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [trending, setTrending] = useState<GroupWithRelations[]>([]);
  const [thisWeek, setThisWeek] = useState<GroupWithRelations[]>([]);
  const [featured, setFeatured] = useState<GroupWithRelations[]>([]);
  const [hosts, setHosts] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [founderCount, setFounderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const in7Days = new Date(now);
      in7Days.setDate(in7Days.getDate() + 7);

      const [trendingRes, weekRes, featuredRes, categoriesRes, pricingRes, founderRes, hostsRes] = await Promise.all([
        supabase.from('groups').select(GROUP_SELECT).eq('status', 'active').order('current_participants', { ascending: false }).limit(10),
        supabase.from('groups').select(GROUP_SELECT).eq('status', 'active').gte('start_time', now.toISOString()).lte('start_time', in7Days.toISOString()).order('start_time', { ascending: true }).limit(10),
        supabase.from('groups').select(GROUP_SELECT).eq('status', 'active').eq('is_featured', true).order('start_time', { ascending: true }).limit(10),
        supabase.from('activity_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('pricing_config').select('*').maybeSingle(),
        supabase.from('memberships').select('user_id', { count: 'exact', head: true }).eq('is_founder', true),
        supabase.from('profiles').select('*').eq('is_host', true).order('groups_hosted_count', { ascending: false }).limit(8),
      ]);

      setTrending((trendingRes.data ?? []) as unknown as GroupWithRelations[]);
      setThisWeek((weekRes.data ?? []) as unknown as GroupWithRelations[]);
      setFeatured((featuredRes.data ?? []) as unknown as GroupWithRelations[]);
      setCategories(categoriesRes.data ?? []);
      setPricing(pricingRes.data as PricingConfig | null);
      setFounderCount(founderRes.count ?? 0);
      setHosts((hostsRes.data ?? []) as Profile[]);
      setLoading(false);
    }
    load();
  }, []);

  const hasAnyGroups = trending.length > 0 || thisWeek.length > 0 || featured.length > 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[640px] flex items-center overflow-hidden bg-ink-950">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/931007/pexels-photo-931007.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Miami skyline at golden hour"
            className="w-full h-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/20 to-transparent" />
        </div>

        <div className="relative section-container py-24">
          <div className="max-w-2xl animate-slide-up">
            <div className="flex items-center gap-2 mb-6">
              <span className="badge bg-accent-500/15 text-accent-300 border border-accent-500/30">Miami's Social Club</span>
            </div>
            <h1 className="display-heading text-6xl sm:text-7xl md:text-8xl text-white mb-6">
              MIAMI IS BETTER<br />WITH PEOPLE.
            </h1>
            <p className="font-serif italic text-xl sm:text-2xl text-cream-100/90 max-w-lg mb-9 leading-snug">
              Real plans, real people — padel on Sunday, dinner on Wednesday, whatever's next.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/discover" className="btn-accent text-base px-8 py-4">
                Explore Miami
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to={user ? '/create' : '/signup'} className="btn-secondary text-base px-8 py-4 bg-white/5 text-white border-white/20 hover:bg-white/10 hover:border-white/40">
                Create a Group
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cream-50 to-transparent" />
      </section>

      {/* Featured pick — large immersive card, distinct from the carousels below */}
      {!loading && trending.length > 0 && (
        <section className="section-container pt-16 pb-4">
          <FeaturedExperience group={trending[0]} />
        </section>
      )}

      {/* Trending in Miami */}
      {(loading || trending.length > 0) && (
        <section className="section-container pt-16 pb-4">
          <SectionHeader eyebrow="Live Right Now" title="TRENDING IN MIAMI" seeAllHref="/discover" />
          {loading ? (
            <SkeletonCarousel />
          ) : (
            <Carousel>
              {trending.map((group) => (
                <div key={group.id} className="carousel-item w-72">
                  <GroupCard group={group} />
                </div>
              ))}
            </Carousel>
          )}
        </section>
      )}

      {/* Happening This Week */}
      {(loading || thisWeek.length > 0) && (
        <section className="section-container pt-12 pb-4">
          <SectionHeader eyebrow="Don't Miss Out" title="HAPPENING THIS WEEK" seeAllHref="/discover" />
          {loading ? (
            <SkeletonCarousel />
          ) : (
            <Carousel>
              {thisWeek.map((group) => (
                <div key={group.id} className="carousel-item w-72">
                  <GroupCard group={group} />
                </div>
              ))}
            </Carousel>
          )}
        </section>
      )}

      {!loading && !hasAnyGroups && (
        <section className="section-container py-16">
          <div className="card p-12 text-center">
            <Flame className="w-10 h-10 text-accent-400 mx-auto mb-4" />
            <p className="text-ink-900 font-semibold text-lg mb-1">Nothing live yet — be the first.</p>
            <p className="text-ink-500 mb-6 max-w-sm mx-auto">The circle starts with one plan. Get something going and watch it fill up.</p>
            <Link to={user ? '/create' : '/signup'} className="btn-accent">Create a Group</Link>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="bg-ink-950 py-24">
        <div className="section-container">
          <div className="text-center mb-16">
            <p className="section-label mb-2 text-accent-400">How It Works</p>
            <h2 className="font-display text-4xl sm:text-5xl text-white tracking-tightest">FIND YOUR PEOPLE THROUGH ACTIVITIES.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'PICK SOMETHING', desc: 'Choose something you actually want to do.', icon: Compass },
              { num: '02', title: 'JOIN A SMALL GROUP', desc: 'Meet a handful of people who want to do the same thing.', icon: Users },
              { num: '03', title: 'DO IT AGAIN', desc: 'Turn one activity into recurring plans and real relationships.', icon: Calendar },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent-500/15 flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-accent-400" />
                  </div>
                  <p className="font-display text-2xl text-accent-400 mb-2">{step.num}</p>
                  <h3 className="font-display text-2xl text-white tracking-tight mb-3">{step.title}</h3>
                  <p className="text-cream-200/80 text-base leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Activities */}
      {categories.length > 0 && (
        <section className="section-container py-20">
          <SectionHeader eyebrow="Explore" title="POPULAR ACTIVITIES" seeAllHref="/activities" />
          <Carousel>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/activities?category=${cat.slug}`}
                className="carousel-item w-40 h-40 rounded-2xl bg-gradient-to-br from-ink-800 to-ink-950 flex flex-col items-center justify-center gap-3 group hover:from-accent-600 hover:to-accent-800 transition-colors duration-300"
              >
                <span className="font-display text-4xl text-white/90">{cat.name[0]}</span>
                <span className="text-sm font-semibold text-white text-center px-2">{cat.name}</span>
              </Link>
            ))}
          </Carousel>
        </section>
      )}

      {/* Groups Worth Joining */}
      {(loading || featured.length > 0) && (
        <section className="bg-cream-100 py-20">
          <div className="section-container">
            <SectionHeader eyebrow="Curated" title="GROUPS WORTH JOINING" seeAllHref="/groups" />
            {loading ? (
              <SkeletonCarousel />
            ) : (
              <Carousel>
                {featured.map((group) => (
                  <div key={group.id} className="carousel-item w-72">
                    <GroupCard group={group} />
                  </div>
                ))}
              </Carousel>
            )}
          </div>
        </section>
      )}

      {/* Hosts Worth Discovering */}
      {hosts.length > 0 && (
        <section className="section-container py-20">
          <SectionHeader eyebrow="Meet The Hosts" title="PEOPLE WORTH DISCOVERING" />
          <Carousel>
            {hosts.map((host) => {
              const content = (
                <>
                  <Avatar src={host.avatar_url} name={host.first_name} size="lg" className="mx-auto mb-3" />
                  <p className="font-semibold text-ink-900 text-sm mb-0.5 truncate">{host.first_name ?? 'Host'}</p>
                  <p className="text-xs text-ink-400">{host.groups_hosted_count} groups hosted</p>
                  {host.host_verified && (
                    <span className="badge bg-success-50 text-success-600 mt-2">Verified</span>
                  )}
                </>
              );
              return host.username ? (
                <Link key={host.id} to={`/profile/${host.username}`} className="carousel-item w-44 card card-hover p-5 text-center">
                  {content}
                </Link>
              ) : (
                <div key={host.id} className="carousel-item w-44 card p-5 text-center">
                  {content}
                </div>
              );
            })}
          </Carousel>
        </section>
      )}

      {/* Member Value */}
      <section className="bg-ink-950 py-24">
        <div className="section-container">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="section-label mb-2 text-accent-400">Membership</p>
            <h2 className="font-display text-4xl sm:text-5xl text-white tracking-tightest mb-4">MEMBERS CREATE THE PLANS.</h2>
            <p className="text-lg text-cream-200/80">See something you want to do? Start a group and bring people together.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {['Friday Padel', 'Sunday Beach', 'Painting & Drinks', 'Watch Party'].map((example) => (
              <div key={example} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="w-10 h-10 rounded-lg bg-ocean-500/20 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-ocean-400" />
                </div>
                <p className="font-semibold text-white">{example}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/membership" className="btn-accent text-base px-8 py-4">
              Join IN305
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      {pricing && (
        <section className="section-container py-20">
          <div className="bg-gradient-to-br from-accent-700 via-ink-900 to-ink-950 rounded-4xl p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-accent-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-ocean-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Crown className="w-6 h-6 text-accent-400" />
                <span className="badge bg-accent-500/20 text-accent-300 border border-accent-500/30">Founding 100</span>
              </div>
              <h2 className="font-display text-5xl sm:text-6xl text-white tracking-tightest mb-4">
                {founderCount} / {pricing.founder_limit}
              </h2>
              <p className="text-lg text-cream-200/90 max-w-md mx-auto mb-8">
                Be one of the first {pricing.founder_limit} people helping build IN305.
              </p>
              <Link to="/membership" className="btn-accent text-base px-8 py-4">
                Become a Founder
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Brand Closing */}
      <section className="bg-ink-950 py-24">
        <div className="section-container text-center">
          <h2 className="font-display text-5xl sm:text-6xl text-white tracking-tightest mb-4">BIG CITY. SMALL CIRCLES.</h2>
          <p className="font-serif italic text-lg text-cream-200/80 mb-8 max-w-xl mx-auto">
            The 305 is bigger with the right people in it.
          </p>
          <Link to="/signup" className="btn-accent text-base px-8 py-4">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
