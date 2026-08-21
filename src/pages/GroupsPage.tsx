import { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { GroupCard } from '@/components/GroupCard';
import { Tabs } from '@/components/Tabs';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { GROUP_SELECT } from '@/lib/queries';
import type { GroupWithRelations } from '@/types';

type TabKey = 'all' | 'upcoming' | 'mine';
type PreviewMember = { src?: string | null; name?: string | null };

async function loadMemberPreviews(groupIds: string[]): Promise<Record<string, PreviewMember[]>> {
  if (groupIds.length === 0) return {};
  const { data } = await supabase
    .from('group_members')
    .select('group_id, joined_at, profile:profiles(avatar_url, first_name)')
    .in('group_id', groupIds)
    .order('joined_at', { ascending: true });

  const byGroup: Record<string, PreviewMember[]> = {};
  for (const row of (data ?? []) as any[]) {
    const list = byGroup[row.group_id] ?? (byGroup[row.group_id] = []);
    if (list.length < 5) list.push({ src: row.profile?.avatar_url, name: row.profile?.first_name });
  }
  return byGroup;
}

export function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [memberPreviews, setMemberPreviews] = useState<Record<string, PreviewMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (tab === 'mine') {
        if (!user) { setGroups([]); setLoading(false); return; }
        const [joinedRes, hostedRes] = await Promise.all([
          supabase.from('group_members').select(`group:groups(${GROUP_SELECT})`).eq('user_id', user.id),
          supabase.from('groups').select(GROUP_SELECT).eq('host_id', user.id),
        ]);
        const joined = (joinedRes.data ?? []).map((m: any) => m.group).filter(Boolean);
        const hosted = hostedRes.data ?? [];
        const deduped = Array.from(new Map([...hosted, ...joined].map((g: any) => [g.id, g])).values());
        deduped.sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        setGroups(deduped as unknown as GroupWithRelations[]);
        setMemberPreviews(await loadMemberPreviews(deduped.map((g: any) => g.id)));
        setLoading(false);
        return;
      }

      let query = supabase.from('groups').select(GROUP_SELECT).in('status', ['active', 'full']).order('start_time', { ascending: true });

      if (tab === 'upcoming') {
        const now = new Date();
        const in14Days = new Date(now);
        in14Days.setDate(in14Days.getDate() + 14);
        query = query.gte('start_time', now.toISOString()).lte('start_time', in14Days.toISOString());
      }

      const { data } = await query;
      const list = (data ?? []) as unknown as GroupWithRelations[];
      setGroups(list);
      setMemberPreviews(await loadMemberPreviews(list.map(g => g.id)));
      setLoading(false);
    }
    load();
  }, [tab, user]);

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-10">
        <p className="section-label mb-2">The Circle</p>
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 tracking-tightest mb-2">GROUPS</h1>
        <p className="text-ink-500 mb-7">These are the people you could actually meet.</p>

        <Tabs
          className="mb-7"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'mine', label: 'My Groups' },
          ] as const}
        />

        {tab === 'mine' && !user ? (
          <EmptyState
            icon={Users2}
            title="Sign in to see your groups."
            description="Track everything you're hosting or have joined in one place."
            actionLabel="Sign In"
            actionHref="/login"
          />
        ) : loading ? (
          <SkeletonCardGrid count={6} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="Nothing here yet."
            description={tab === 'mine' ? "You haven't joined or hosted any groups yet." : 'Be the first to get something going.'}
            actionLabel={tab === 'mine' ? 'Discover Groups' : 'Create a Group'}
            actionHref={tab === 'mine' ? '/discover' : '/create'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map(g => <GroupCard key={g.id} group={g} previewMembers={memberPreviews[g.id]} />)}
          </div>
        )}
      </div>
    </div>
  );
}
