import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { GroupCard } from '@/components/GroupCard';
import { GROUP_SELECT } from '@/lib/queries';
import type { GroupWithRelations, SavedItem } from '@/types';

export function SavedPage() {
  const { user } = useAuth();
  const [savedGroups, setSavedGroups] = useState<GroupWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      const { data: saved } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user!.id)
        .eq('item_type', 'group')
        .order('created_at', { ascending: false });

      const savedItems = (saved ?? []) as SavedItem[];
      if (savedItems.length === 0) { setLoading(false); return; }

      const ids = savedItems.map(s => s.item_id);
      const { data: groups } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .in('id', ids);
      setSavedGroups((groups ?? []) as unknown as GroupWithRelations[]);
      setLoading(false);
    }
    load();
  }, [user]);

  if (!user) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><Link to="/login" className="btn-primary">Sign In</Link></div>;
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8">
        <h1 className="font-display text-4xl text-ink-900 tracking-tightest mb-2">SAVED</h1>
        <p className="text-ink-500 mb-6">Groups you've saved for later.</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
          </div>
        ) : savedGroups.length === 0 ? (
          <div className="card p-12 text-center">
            <Bookmark className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500 text-lg mb-1">Save something for later.</p>
            <p className="text-ink-400 text-sm mb-6">Tap the bookmark icon on any group to save it here.</p>
            <Link to="/discover" className="btn-accent">Discover Groups</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedGroups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </div>
    </div>
  );
}
