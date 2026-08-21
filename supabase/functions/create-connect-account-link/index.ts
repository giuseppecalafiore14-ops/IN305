// Starts (or resumes) Stripe Connect Express onboarding for a host who wants
// to receive payouts from paid events. Creates the Connect account on first
// call, then always returns a fresh onboarding link.
import { corsHeaders, corsPreflight, jsonResponse } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getAdminClient, getRequestUser } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const stripe = getStripe();
  if (!stripe) {
    return jsonResponse({ error: 'Payouts aren\'t configured yet. Please try again later.' }, 503);
  }

  const user = await getRequestUser(req);
  if (!user) return jsonResponse({ error: 'You must be signed in to connect a payout account.' }, 401);

  const admin = getAdminClient();

  const { data: existing } = await admin
    .from('host_payout_accounts')
    .select('*')
    .eq('host_id', user.id)
    .maybeSingle();

  let connectAccountId = existing?.stripe_connect_account_id ?? null;

  if (!connectAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });
    connectAccountId = account.id;

    await admin.from('host_payout_accounts').upsert(
      { host_id: user.id, stripe_connect_account_id: connectAccountId, status: 'pending' },
      { onConflict: 'host_id' }
    );
  }

  const origin = req.headers.get('origin') ?? '';
  const accountLink = await stripe.accountLinks.create({
    account: connectAccountId,
    refresh_url: `${origin}/host?payout=refresh`,
    return_url: `${origin}/host?payout=connected`,
    type: 'account_onboarding',
  });

  return jsonResponse({ url: accountLink.url }, 200);
});
