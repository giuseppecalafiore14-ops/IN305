import { useEffect, useState } from 'react';
import { MapPin, Globe, Instagram, ShieldCheck, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState } from '@/components/EmptyState';
import { GROUP_SELECT } from '@/lib/queries';
import type { Partner, PartnerOffer, GroupWithRelations } from '@/types';

export function BusinessProfilePage({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('partners')
        .select('*, neighborhood:neighborhoods(*)')
        .eq('slug', slug)
        .in('status', ['approved', 'active'])
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      setPartner(data as unknown as Partner);

      const [groupsRes, offersRes] = await Promise.all([
        data.owner_id
          ? supabase.from('groups').select(GROUP_SELECT).eq('host_id', data.owner_id).in('status', ['active', 'full']).order('start_time', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase.from('partner_offers').select('*').eq('partner_id', data.id).eq('status', 'active').order('created_at', { ascending: false }),
      ]);
      setGroups((groupsRes.data ?? []) as unknown as GroupWithRelations[]);
      setOffers((offersRes.data ?? []) as PartnerOffer[]);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500 text-lg mb-4">This business isn't on IN305 yet.</p>
          <Link to="/for-businesses" className="btn-primary">Partner With Us</Link>
        </div>
      </div>
    );
  }

  const isOwner = user && partner.owner_id === user.id;

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="relative h-48 sm:h-64 bg-ink-950 overflow-hidden">
        {partner.cover_image_url ? (
          <img src={partner.cover_image_url} alt="" className="w-full h-full object-cover opacity-70" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-ink-800 to-ink-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <div className="section-container -mt-14 relative pb-16 max-w-4xl">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-lifted overflow-hidden shrink-0 flex items-center justify-center">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-ink-300">{partner.business_name[0]}</span>
            )}
          </div>
          {isOwner && (
            <Link to="/business/manage" className="btn-secondary mb-1">Manage Business</Link>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 tracking-tight">{partner.business_name}</h1>
          {partner.is_demo ? (
            <span className="badge bg-ink-100 text-ink-500">Demo Preview</span>
          ) : partner.status === 'active' && (
            <span className="badge bg-success-50 text-success-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> IN305 Partner</span>
          )}
        </div>
        {partner.is_demo && (
          <p className="text-xs text-ink-400 mb-4 max-w-xl">
            This is a seed/demo listing to show what a business profile looks like — it isn't a real IN305 partnership yet.
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-ink-500 mb-5 flex-wrap">
          {partner.category && <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> {partner.category}</span>}
          {partner.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {partner.neighborhood.name}</span>}
          {partner.website && <a href={partner.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-ink-900"><Globe className="w-3.5 h-3.5" /> Website</a>}
          {partner.instagram && <a href={`https://instagram.com/${partner.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-ink-900"><Instagram className="w-3.5 h-3.5" /> {partner.instagram}</a>}
        </div>

        {partner.description && <p className="text-ink-600 leading-relaxed max-w-2xl mb-10">{partner.description}</p>}

        {offers.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">MEMBER OFFERS</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {offers.map(o => (
                <div key={o.id} className="bg-accent-50 border border-accent-100 rounded-2xl p-5">
                  <p className="font-semibold text-accent-700 mb-1">{o.title}</p>
                  {o.description && <p className="text-sm text-ink-600">{o.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">EXPERIENCES ON IN305</h2>
          {groups.length === 0 ? (
            <EmptyState title="Nothing scheduled yet." description="Check back soon for upcoming experiences from this business." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {groups.map(g => <GroupCard key={g.id} group={g} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
