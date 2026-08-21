import { useState } from 'react';
import { Shield, Users, Calendar, Flag, Building2, DollarSign, BarChart3, Crown, Check, X, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import { useEffect } from 'react';

export function AdminPage() {
  const { profile, loading } = useAuth();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<'overview' | 'users' | 'groups' | 'reports' | 'partners' | 'pricing'>('overview');
  const [stats, setStats] = useState({ users: 0, members: 0, founders: 0, groups: 0, events: 0, reports: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!profile?.is_admin)) { navigate('/'); return; }
    if (!profile?.is_admin) return;
    async function load() {
      const [u, m, f, g, e, r, i, p] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('memberships').select('user_id', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
        supabase.from('memberships').select('user_id', { count: 'exact', head: true }).eq('is_founder', true),
        supabase.from('groups').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('partner_inquiries').select('id', { count: 'exact', head: true }),
        supabase.from('pricing_config').select('*').maybeSingle(),
      ]);
      setStats({ users: u.count ?? 0, members: m.count ?? 0, founders: f.count ?? 0, groups: g.count ?? 0, events: e.count ?? 0, reports: r.count ?? 0 });

      if (tab === 'users') {
        const { data } = await supabase.from('profiles').select('*, membership:memberships(*)').order('created_at', { ascending: false }).limit(50);
        setUsers(data ?? []);
      }
      if (tab === 'groups') {
        const { data } = await supabase.from('groups').select('*, activity:activities(*), neighborhood:neighborhoods(*), host:profiles(*)').order('created_at', { ascending: false }).limit(50);
        setGroups(data ?? []);
      }
      if (tab === 'reports') {
        const { data } = await supabase.from('reports').select('*, reporter:profiles(*)').order('created_at', { ascending: false }).limit(50);
        setReports(data ?? []);
      }
      if (tab === 'partners') {
        const { data } = await supabase.from('partner_inquiries').select('*').order('created_at', { ascending: false }).limit(50);
        setInquiries(data ?? []);
      }
      if (tab === 'pricing') {
        setPricing(p.data);
      }
    }
    load();
  }, [profile, loading, tab, navigate]);

  if (loading) return <div className="min-h-screen bg-cream-50 flex items-center justify-center"><p className="text-ink-400">Loading...</p></div>;
  if (!profile?.is_admin) return null;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'groups', label: 'Groups', icon: Calendar },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'partners', label: 'Partners', icon: Building2 },
    { key: 'pricing', label: 'Pricing', icon: DollarSign },
  ] as const;

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="section-container py-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-6 h-6 text-ink-900" />
          <h1 className="font-display text-3xl text-ink-900 tracking-tight">ADMIN</h1>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
                <Icon className="w-4 h-4" /> {t.label}
                {t.key === 'reports' && stats.reports > 0 && <span className="px-1.5 py-0.5 bg-error-500 text-white rounded-full text-2xs">{stats.reports}</span>}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Users" value={stats.users} icon={Users} />
            <StatCard label="Active Members" value={stats.members} icon={Crown} />
            <StatCard label="Founders" value={stats.founders} icon={Star} />
            <StatCard label="Groups" value={stats.groups} icon={Calendar} />
            <StatCard label="Events" value={stats.events} icon={Calendar} />
            <StatCard label="Reports" value={stats.reports} icon={Flag} />
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Username</th><th className="text-left p-3">Membership</th><th className="text-left p-3">Founder</th><th className="text-left p-3">Host</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-ink-100">
                    <td className="p-3 font-medium text-ink-900">{u.first_name ?? '—'}</td>
                    <td className="p-3 text-ink-600">@{u.username ?? '—'}</td>
                    <td className="p-3"><span className={`badge ${u.membership?.status === 'active' ? 'bg-success-50 text-success-600' : 'bg-ink-50 text-ink-500'}`}>{u.membership?.status ?? 'inactive'}</span></td>
                    <td className="p-3">{u.membership?.is_founder ? <Check className="w-4 h-4 text-accent-500" /> : <X className="w-4 h-4 text-ink-300" />}</td>
                    <td className="p-3">{u.is_host ? <Check className="w-4 h-4 text-success-500" /> : <X className="w-4 h-4 text-ink-300" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Groups */}
        {tab === 'groups' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                <tr><th className="text-left p-3">Title</th><th className="text-left p-3">Activity</th><th className="text-left p-3">Neighborhood</th><th className="text-left p-3">Capacity</th><th className="text-left p-3">Status</th><th className="text-left p-3">Featured</th></tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-t border-ink-100">
                    <td className="p-3 font-medium text-ink-900"><Link to={`/groups/${g.slug}`} className="hover:text-accent-600">{g.title}</Link></td>
                    <td className="p-3 text-ink-600">{g.activity?.name ?? '—'}</td>
                    <td className="p-3 text-ink-600">{g.neighborhood?.name ?? '—'}</td>
                    <td className="p-3 text-ink-600">{g.current_participants}/{g.max_participants}</td>
                    <td className="p-3"><span className="badge bg-ink-50 text-ink-600">{g.status}</span></td>
                    <td className="p-3">{g.is_featured ? <Star className="w-4 h-4 text-accent-500" /> : <X className="w-4 h-4 text-ink-300" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports */}
        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 ? <div className="card p-8 text-center text-ink-500">No reports.</div> : reports.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="badge bg-error-50 text-error-600">{r.reason}</span>
                  <span className="text-xs text-ink-400">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-ink-600">{r.details ?? 'No details provided'}</p>
                <p className="text-xs text-ink-400 mt-1">Reported by: {r.reporter?.first_name ?? 'Unknown'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Partners */}
        {tab === 'partners' && (
          <div className="space-y-3">
            {inquiries.length === 0 ? <div className="card p-8 text-center text-ink-500">No partner inquiries.</div> : inquiries.map(i => (
              <div key={i.id} className="card p-4">
                <p className="font-semibold text-ink-900">{i.business_name}</p>
                <p className="text-sm text-ink-500">{i.contact_name} · {i.email}</p>
                {i.partnership_idea && <p className="text-sm text-ink-600 mt-2">{i.partnership_idea}</p>}
                <span className="badge bg-ink-50 text-ink-600 mt-2">{i.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pricing */}
        {tab === 'pricing' && pricing && (
          <div className="card p-6 max-w-md">
            <h3 className="font-semibold text-ink-900 mb-4">Pricing Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Monthly price</span><span className="font-semibold text-ink-900">${pricing.monthly_price}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Annual price</span><span className="font-semibold text-ink-900">{pricing.annual_price ? `$${pricing.annual_price}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Founder price</span><span className="font-semibold text-ink-900">{pricing.founder_price ? `$${pricing.founder_price}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Founder limit</span><span className="font-semibold text-ink-900">{pricing.founder_limit}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Currency</span><span className="font-semibold text-ink-900">{pricing.currency}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink-900">{value}</p>
    </div>
  );
}
