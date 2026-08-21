const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

export function MissingEnvScreen() {
  const missing = REQUIRED_VARS.filter((key) => !import.meta.env[key]);

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="font-display text-4xl tracking-tightest text-ink-900 mb-2">IN305</div>
          <h1 className="font-display text-2xl text-ink-900 tracking-tight">CONFIGURATION MISSING</h1>
        </div>

        <div className="card p-6">
          <p className="text-ink-600 mb-4">
            The app can't start because {missing.length === 1 ? 'this environment variable is' : 'these environment variables are'} missing:
          </p>

          <ul className="space-y-1.5 mb-5">
            {missing.map((key) => (
              <li key={key} className="font-mono text-sm bg-ink-50 text-ink-900 rounded-lg px-3 py-2">
                {key}
              </li>
            ))}
          </ul>

          <p className="text-sm text-ink-600 mb-2">
            Create a <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">.env</code> file in the project root with:
          </p>
          <pre className="text-xs bg-ink-900 text-cream-100 rounded-lg px-4 py-3 overflow-x-auto mb-4">
            {missing.map((key) => `${key}=...`).join('\n')}
          </pre>

          <p className="text-sm text-ink-500">
            Get these values from your Supabase project's dashboard under Settings → API, then restart{' '}
            <code className="font-mono bg-ink-50 px-1.5 py-0.5 rounded">npm run dev</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
