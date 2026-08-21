import { useEffect, useState } from 'react';
import { Crown, MapPin, Edit3, Check, X, Award, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter } from '@/lib/router';
import { Link } from '@/lib/router';
import type { GroupWithRelations, Neighborhood, Review } from '@/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState } from '@/components/EmptyState';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ProfilePage({ username }: { username?: string }) {
  const { user, profile, membership, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const [viewProfile, setViewProfile] = useState(profile);
  const [viewMembership, setViewMembership] = useState(membership);
  const [groups, setGroups] = useState<GroupWithRelations[]>([]);
  const [hostedGroups, setHostedGroups] = useState<GroupWithRelations[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: profile?.first_name ?? '',
    bio: profile?.bio ?? '',
    neighborhood_id: profile?.neighborhood_id ?? '',
  });

  const isOwnProfile = !username || username === profile?.username;

  useEffect(() => {
    async function load() {
      let targetProfile = profile;
      let targetMembership = membership;

      if (username && username !== profile?.username) {
        const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
        targetProfile = p as any;
        const { data: m } = await supabase.from('memberships').select('*').eq('user_id', p?.id).maybeSingle();
        targetMembership = m as any;
      }

      setViewProfile(targetProfile);
      setViewMembership(targetMembership);

      if (targetProfile) {
        const [joined, hosted] = await Promise.all([
          supabase
            .from('group_members')
            .select('group:groups(*, activity:activities(*), neighborhood:neighborhoods(*), host:profiles(*))')
            .eq('user_id', targetProfile.id)
            .order('joined_at', { ascending: false }),
          supabase
            .from('groups')
            .select('*, activity:activities(*), neighborhood:neighborhoods(*), host:profiles(*)')
            .eq('host_id', targetProfile.id)
            .order('created_at', { ascending: false }),
        ]);
        setGroups((joined.data ?? []).map((m: any) => m.group) as GroupWithRelations[]);
        const hostedList = (hosted.data ?? []) as unknown as GroupWithRelations[];
        setHostedGroups(hostedList);

        if (hostedList.length > 0) {
          const { data: reviewData } = await supabase
            .from('reviews')
            .select('*, profile:profiles(*)')
            .in('group_id', hostedList.map(g => g.id))
            .order('created_at', { ascending: false })
            .limit(10);
          setReviews((reviewData ?? []) as unknown as Review[]);
        }
      }

      const { data: n } = await supabase.from('neighborhoods').select('*').eq('is_active', true).order('sort_order');
      setNeighborhoods(n ?? []);
      setLoading(false);
    }
    load();
  }, [username, profile, membership]);

  async function handleSaveEdit() {
    if (!user) return;
    setSaving(true);
    setEditError(null);

    const { error } = await supabase.from('profiles').update({
      first_name: editForm.first_name || null,
      bio: editForm.bio || null,
      neighborhood_id: editForm.neighborhood_id || null,
    }).eq('id', user.id);

    if (error) {
      logError('ProfilePage:handleSaveEdit', error);
      setEditError(getErrorMessage(error, "We couldn't save your changes. Please try again."));
      setSaving(false);
      return;
    }

    await refreshProfile();
    setViewProfile({ ...profile!, first_name: editForm.first_name, bio: editForm.bio, neighborhood_id: editForm.neighborhood_id });
    setSaving(false);
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50">
        <div className="skeleton h-40" />
        <div className="section-container -mt-12 relative">
          <div className="skeleton w-24 h-24 rounded-full mb-4" />
        </div>
      </div>
    );
  }

  if (!viewProfile) {
    return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-500">Profile not found.</p></div>;
  }

  const neighborhood = neighborhoods.find(n => n.id === viewProfile.neighborhood_id);

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Cover band */}
      <div className="h-40 sm:h-48 bg-gradient-to-br from-ink-800 to-ink-950" />

      <div className="section-container -mt-16 relative pb-16 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          <Avatar src={viewProfile.avatar_url} name={viewProfile.first_name} size="xl" ring className="shadow-lifted" />

          <div className="flex-1 pt-2 sm:pt-14">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-3xl text-ink-900 tracking-tight">{viewProfile.first_name ?? 'Member'}</h1>
                  {viewMembership?.is_founder && (
                    <span className="badge bg-accent-50 text-accent-600 flex items-center gap-1"><Crown className="w-3 h-3" /> Founder #{viewMembership.founder_number}</span>
                  )}
                  {viewProfile.host_verified && <span className="badge bg-success-50 text-success-600 flex items-center gap-1"><Award className="w-3 h-3" /> Trusted Host</span>}
                  {viewProfile.is_admin && <span className="badge bg-ink-100 text-ink-600">Admin</span>}
                </div>
                {viewProfile.username && <p className="text-ink-400 text-sm">@{viewProfile.username}</p>}
                <div className="flex items-center gap-3 text-ink-500 text-sm mt-1 flex-wrap">
                  {neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {neighborhood.name}</span>}
                  {viewProfile.created_at && (
                    <span>Member since {MONTHS[new Date(viewProfile.created_at).getMonth()]} {new Date(viewProfile.created_at).getFullYear()}</span>
                  )}
                </div>
              </div>

              {isOwnProfile && !editing && (
                <button onClick={() => setEditing(true)} className="btn-secondary shrink-0">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}
            </div>

            {viewProfile.bio && <p className="text-ink-600 mt-3 leading-relaxed max-w-xl">{viewProfile.bio}</p>}

            {/* Stats */}
            <div className="flex gap-8 mt-5">
              <div>
                <p className="font-display text-2xl text-ink-900">{groups.length}</p>
                <p className="text-xs text-ink-400 uppercase tracking-wide">Groups Joined</p>
              </div>
              <div>
                <p className="font-display text-2xl text-ink-900">{hostedGroups.length}</p>
                <p className="text-xs text-ink-400 uppercase tracking-wide">Groups Hosted</p>
              </div>
              {hostedGroups.length > 0 && (
                <div>
                  <p className="font-display text-2xl text-ink-900">{hostedGroups.reduce((sum, g) => sum + g.current_participants, 0)}</p>
                  <p className="text-xs text-ink-400 uppercase tracking-wide">People Hosted</p>
                </div>
              )}
            </div>

            {/* Activities & vibes */}
            {((viewProfile.activities?.length ?? 0) > 0 || (viewProfile.preferred_vibes?.length ?? 0) > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {viewProfile.activities?.map(a => (
                  <span key={a} className="badge bg-ink-50 text-ink-600">{a}</span>
                ))}
                {viewProfile.preferred_vibes?.map(v => (
                  <span key={v} className="badge bg-ocean-50 text-ocean-600">{v}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="card p-6 mb-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">First name</label>
              <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Bio</label>
              <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} className="input-field min-h-[80px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">Neighborhood</label>
              <select value={editForm.neighborhood_id} onChange={e => setEditForm({ ...editForm, neighborhood_id: e.target.value })} className="input-field">
                <option value="">Select neighborhood</option>
                {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            {editError && <ErrorBanner message={editError} />}
            <div className="flex gap-3">
              <button onClick={handleSaveEdit} disabled={saving} className="btn-accent flex-1"><Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setEditError(null); }} disabled={saving} className="btn-secondary"><X className="w-4 h-4" /> Cancel</button>
            </div>
          </div>
        )}

        {/* Hosted groups */}
        {hostedGroups.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">HOSTING</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {hostedGroups.map(g => <GroupCard key={g.id} group={g} />)}
            </div>
          </div>
        )}

        {/* Reviews */}
        {hostedGroups.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">REVIEWS</h2>
            {reviews.length === 0 ? (
              <p className="text-ink-400 text-sm">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="flex items-start gap-3">
                    <Avatar src={r.profile?.avatar_url} name={r.profile?.first_name} size="sm" />
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-warning-400 text-warning-400' : 'text-ink-200'}`} />
                        ))}
                        <span className="text-sm font-medium text-ink-900 ml-1">{r.profile?.first_name ?? 'Member'}</span>
                      </div>
                      {r.comment && <p className="text-sm text-ink-600">{r.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Joined groups */}
        <div>
          <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-4">JOINED GROUPS</h2>
          {groups.length === 0 ? (
            <EmptyState
              title="No groups joined yet."
              description="Find something you'd actually want to do."
              actionLabel="Discover Groups"
              actionHref="/discover"
            />
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
