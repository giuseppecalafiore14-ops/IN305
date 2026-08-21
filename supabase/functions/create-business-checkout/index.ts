// Creates a Stripe Checkout Session (recurring subscription) for a Business plan.
// Exactly two plans exist — mirrors src/lib/pricing.ts BUSINESS_PLANS. Keep both in sync.
import { corsHeaders, corsPreflight, jsonResponse } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getAdminClient, getRequestUser } from '../_shared/supabase.ts';

const BUSINESS_PLANS: Record<string, { name: string; price: number }> = {
  business: { name: 'IN305 Business', price: 79 },
  business_pro: { name: 'IN305 Business Pro', price: 199 },
};

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const stripe = getStripe();
  if (!stripe) {
    return jsonResponse({ error: 'Payments aren\'t configured yet. Please try again later.' }, 503);
  }

  const user = await getRequestUser(req);
  if (!user) return jsonResponse({ error: 'You must be signed in to subscribe.' }, 401);

  let body: { plan?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }
  const plan = body.plan && BUSINESS_PLANS[body.plan] ? body.plan : null;
  if (!plan) return jsonResponse({ error: 'Choose either the Business or Business Pro plan.' }, 400);

  const admin = getAdminClient();

  const { data: partner, error: partnerError } = await admin
    .from('partners')
    .select('id, business_name, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (partnerError || !partner) {
    return jsonResponse({ error: "You don't manage a business on IN305 yet." }, 404);
  }

  const planInfo = BUSINESS_PLANS[plan];
  const origin = req.headers.get('origin') ?? '';
  const successUrl = body.success_url || `${origin}/checkout/success?type=business`;
  const cancelUrl = body.cancel_url || `${origin}/checkout/cancel?type=business`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: planInfo.name },
          unit_amount: Math.round(planInfo.price * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'business_subscription',
      partner_id: partner.id,
      plan,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return jsonResponse({ url: session.url }, 200);
});
