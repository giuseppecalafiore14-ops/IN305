import { useState } from 'react';
import { Building2, Send, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from '@/lib/router';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getErrorMessage, logError } from '@/lib/errors';
import { BUSINESS_PLANS } from '@/lib/pricing';

const CATEGORIES = ['Padel Club', 'Pickleball Club', 'Gym', 'Restaurant', 'Bar', 'Art Studio', 'Boat Company', 'Wellness', 'Sports Venue', 'Nightlife', 'Experiences', 'Other'];
const NEIGHBORHOODS = ['Brickell', 'Downtown', 'Wynwood', 'Miami Beach', 'South Beach', 'Design District', 'Midtown', 'Coconut Grove', 'Coral Gables', 'Little Havana', 'Other'];

export function ForBusinessesPage() {
  const { user } = useAuth();
  const selectedPlanKey = new URLSearchParams(window.location.search).get('plan');
  const selectedPlan = selectedPlanKey === 'business' || selectedPlanKey === 'business_pro' ? BUSINESS_PLANS[selectedPlanKey] : null;
  const [form, setForm] = useState({
    business_name: '', contact_name: '', email: '', phone: '', instagram: '', website: '',
    category: '', neighborhood: '',
    partnership_idea: selectedPlan ? `Interested in: ${selectedPlan.name} ($${selectedPlan.price}/mo)` : '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from('partner_inquiries').insert({
      ...form,
      status: 'pending',
    });

    setLoading(false);

    if (insertError) {
      logError('ForBusinessesPage:handleSubmit', insertError);
      setError(getErrorMessage(insertError, "We couldn't send your inquiry. Please try again."));
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Hero */}
      <div className="bg-ink-900 py-16">
        <div className="section-container text-center">
          <Building2 className="w-12 h-12 text-accent-400 mx-auto mb-4" />
          <p className="section-label mb-2 text-accent-400">For Businesses</p>
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-tightest mb-4">BRING YOUR BUSINESS INTO THE CIRCLE.</h1>
          <p className="text-lg text-cream-200 max-w-md mx-auto">Reach young, social people through real-world experiences.</p>
        </div>
      </div>

      <div className="section-container py-16 max-w-2xl">
        {/* Partner types */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
          {['Padel clubs', 'Pickleball clubs', 'Gyms', 'Restaurants', 'Bars', 'Art studios', 'Boat companies', 'Wellness', 'Sports venues', 'Nightlife', 'Experiences', 'Venues'].map(t => (
            <div key={t} className="card p-3 text-center text-sm font-medium text-ink-600">{t}</div>
          ))}
        </div>

        {submitted ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success-500" />
            </div>
            <h2 className="font-display text-2xl text-ink-900 tracking-tight mb-2">THANK YOU!</h2>
            <p className="text-ink-500 mb-6">We've received your inquiry. Our team will reach out soon.</p>
            <Link to="/" className="btn-primary">Back to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <h2 className="font-display text-2xl text-ink-900 tracking-tight">Partner with IN305</h2>
            {selectedPlan && (
              <div className="bg-accent-50 border border-accent-100 rounded-xl px-4 py-3 text-sm text-accent-700">
                You selected the <strong>{selectedPlan.name}</strong> plan (${selectedPlan.price}/mo). Submit your details below and our team will follow up to complete setup and billing.
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Business name *</label>
                <input required value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Contact name</label>
                <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Instagram</label>
                <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} className="input-field" placeholder="@yourbusiness" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Website</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="input-field" placeholder="yourbusiness.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Neighborhood</label>
                <select value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} className="input-field">
                  <option value="">Select neighborhood</option>
                  {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Partnership idea</label>
              <textarea value={form.partnership_idea} onChange={e => setForm({ ...form, partnership_idea: e.target.value })} className="input-field min-h-[100px]" placeholder="Tell us how you'd like to partner with IN305..." />
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading || !user} className="btn-accent w-full">
              {loading ? 'Sending...' : 'Submit Inquiry'} <Send className="w-4 h-4" />
            </button>
            {!user && <p className="text-sm text-ink-400 text-center">Please <Link to="/login" className="text-accent-600 font-semibold">sign in</Link> to submit.</p>}
          </form>
        )}
      </div>
    </div>
  );
}
