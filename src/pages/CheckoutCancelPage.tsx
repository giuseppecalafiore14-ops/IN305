import { X } from 'lucide-react';
import { Link } from '@/lib/router';

function useQueryParams() {
  return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
}

export function CheckoutCancelPage() {
  const params = useQueryParams();
  const type = params.get('type');
  const slug = params.get('slug');

  const backHref = type === 'event' && slug ? `/groups/${slug}` : type === 'business' ? '/business/pricing' : '/membership';
  const backLabel = type === 'event' ? 'Back to Event' : type === 'business' ? 'Back to Pricing' : 'Back to Membership';

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-6">
          <X className="w-8 h-8 text-ink-400" />
        </div>
        <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">PAYMENT CANCELED.</h1>
        <p className="text-ink-500 mb-8">Nothing was charged. You can try again whenever you're ready.</p>
        <Link to={backHref} className="btn-accent">{backLabel}</Link>
      </div>
    </div>
  );
}
