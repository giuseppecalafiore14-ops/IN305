// Creates a Stripe Checkout Session (one-time payment) for a paid group/event ticket.
// The price is always read server-side from the group row — never trusted from the client.
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
  if (!user) return jsonResponse({ error: 'You must be signed in to reserve a spot.' }, 401);

  let body: { group_id?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }
  if (!body.group_id) return jsonResponse({ error: 'Missing group_id.' }, 400);

  const admin = getAdminClient();

  const { data: group, error: groupError } = await admin
    .from('groups')
    .select('id, title, cost, status, host_id, slug')
    .eq('id', body.group_id)
    .maybeSingle();

  if (groupError || !group) return jsonResponse({ error: 'This event could not be found.' }, 404);
  if (!(group.cost > 0)) return jsonResponse({ error: 'This event is free — no checkout needed.' }, 400);
  if (group.status !== 'active' && group.status !== 'full') {
    return jsonResponse({ error: 'This event is no longer open for reservations.' }, 400);
  }
  if (group.host_id === user.id) return jsonResponse({ error: "You're hosting this event." }, 400);

  const { data: pricing } = await admin.from('pricing_config').select('platform_fee_percent').maybeSingle();
  const platformFeePercent = pricing?.platform_fee_percent ?? 10;

  const origin = req.headers.get('origin') ?? '';
  const successUrl = body.success_url || `${origin}/checkout/success?type=event&slug=${group.slug}`;
  const cancelUrl = body.cancel_url || `${origin}/checkout/cancel?type=event&slug=${group.slug}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: group.title },
          unit_amount: Math.round(Number(group.cost) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'event_ticket',
      group_id: group.id,
      buyer_id: user.id,
      host_id: group.host_id,
      platform_fee_percent: String(platformFeePercent),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return jsonResponse({ url: session.url }, 200);
});
