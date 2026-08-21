import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';

/**
 * Returns null (never throws) when STRIPE_SECRET_KEY isn't configured, so
 * every function can return a clean "payments aren't configured yet" error
 * instead of crashing when Stripe hasn't been set up.
 */
export function getStripe(): Stripe | null {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export { Stripe };
