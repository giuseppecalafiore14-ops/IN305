import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import { ErrorBanner } from '@/components/ErrorBanner';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const isLogin = mode === 'login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isLogin) {
      const result = await signIn(email, password);
      setLoading(false);
      if (result.error) setError(result.error);
      else navigate('/discover');
      return;
    }

    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
    } else {
      navigate('/onboarding');
    }
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
        <div className="w-full max-w-md text-center">
          <Link to="/" className="font-display text-4xl tracking-tightest text-ink-900">IN305</Link>
          <div className="card p-8 mt-8">
            <div className="w-14 h-14 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-accent-600" />
            </div>
            <h1 className="font-display text-2xl text-ink-900 tracking-tight mb-2">CHECK YOUR EMAIL</h1>
            <p className="text-ink-500 mb-6">
              We sent a confirmation link to <strong className="text-ink-700">{email}</strong>. Click it to activate your account, then sign in below.
            </p>
            <Link to="/login" className="btn-primary w-full">Go to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-4xl tracking-tightest text-ink-900">IN305</Link>
          <h1 className="font-display text-3xl text-ink-900 tracking-tight mt-4">
            {isLogin ? 'WELCOME BACK' : 'JOIN IN305'}
          </h1>
          <p className="text-ink-500 mt-2">
            {isLogin ? 'Sign in to your account' : 'Create your account and start meeting people'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-500 mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <Link to={isLogin ? '/signup' : '/login'} className="text-accent-600 font-semibold hover:underline">
            {isLogin ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
