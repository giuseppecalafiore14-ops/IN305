// Opens the Stripe-hosted Billing Portal so a member or business can manage
// or cancel their own subscription — no custom cancellation UI to build or
// trust client-side; Stripe handles the change and the webhook (source of
// truth) reflects it back into memberships/business_subscriptions.
import { corsHeaders, corsPreflight, jsonResponse } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getAdminClient, getRequestUser } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const stripe = getStripe();
  if (!stripe) {
    return jsonResponse({ error: 'Billing management isn\'t configured yet. Please try again later.' }, 503);
  }

  const user = await getRequestUser(req);
  if (!user) return jsonResponse({ error: 'You must be signed in.' }, 401);

  let body: { kind?: string; return_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }
  if (body.kind !== 'membership' && body.kind !== 'business') {
    return jsonResponse({ error: 'kind must be "membership" or "business".' }, 400);
  }

  const admin = getAdminClient();
  let customerId: string | null = null;

  if (body.kind === 'membership') {
    const { data } = await admin.from('memberships').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    customerId = data?.stripe_customer_id ?? null;
  } else {
    const { data: partner } = await admin.from('partners').select('id').eq('owner_id', user.id).maybeSingle();
    if (partner) {
      const { data: sub } = await admin.from('business_subscriptions').select('stripe_customer_id').eq('partner_id', partner.id).maybeSingle();
      customerId = sub?.stripe_customer_id ?? null;
    }
  }

  if (!customerId) {
    return jsonResponse({ error: 'No billing account found yet — subscribe first.' }, 404);
  }

  const origin = req.headers.get('origin') ?? '';
  const returnUrl = body.return_url || (body.kind === 'membership' ? `${origin}/membership` : `${origin}/business/manage`);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return jsonResponse({ url: session.url }, 200);
});
