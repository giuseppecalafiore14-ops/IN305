// Creates a Stripe Checkout Session (recurring subscription) for an IN305 membership.
// Price is always read server-side from pricing_config — never trusted from the client.
import { corsHeaders, corsPreflight, jsonResponse } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getAdminClient, getRequestUser } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const stripe = getStripe();
  if (!stripe) {
    return jsonResponse({ error: 'Payments aren\'t configured yet. Please try again later.' }, 503);
  }

  const user = await getRequestUser(req);
  if (!user) return jsonResponse({ error: 'You must be signed in to join IN305.' }, 401);

  const admin = getAdminClient();

  const { data: pricing } = await admin.from('pricing_config').select('*').maybeSingle();
  if (!pricing) return jsonResponse({ error: 'Membership pricing is not configured.' }, 500);

  const { count: founderCount } = await admin
    .from('memberships')
    .select('user_id', { count: 'exact', head: true })
    .eq('is_founder', true);

  const isFounderEligible = pricing.founder_price != null && (founderCount ?? 0) < pricing.founder_limit;
  const price = isFounderEligible ? pricing.founder_price : pricing.monthly_price;

  let body: { success_url?: string; cancel_url?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body is optional for this endpoint */
  }

  const origin = req.headers.get('origin') ?? '';
  const successUrl = body.success_url || `${origin}/checkout/success?type=membership`;
  const cancelUrl = body.cancel_url || `${origin}/checkout/cancel?type=membership`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: pricing.currency?.toLowerCase() ?? 'usd',
          product_data: { name: isFounderEligible ? 'IN305 Founding Membership' : 'IN305 Membership' },
          unit_amount: Math.round(Number(price) * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'membership',
      user_id: user.id,
      is_founder: String(isFounderEligible),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return jsonResponse({ url: session.url }, 200);
});
