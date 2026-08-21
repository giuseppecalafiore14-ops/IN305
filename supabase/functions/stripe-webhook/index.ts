// The single source of truth for payment state. Stripe calls this directly
// (never the browser) — every write to memberships, business_subscriptions,
// event_tickets, and host_payout_accounts happens here, after verifying the
// event really came from Stripe. Deployed with verify_jwt = false (see
// supabase/config.toml) since Stripe cannot send a Supabase JWT; the
// Stripe signature check below is the real authentication for this endpoint.
import { getStripe, Stripe } from '../_shared/stripe.ts';
import { getAdminClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const stripe = getStripe();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripe || !webhookSecret) {
    console.error('stripe-webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook not configured', { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const admin = getAdminClient();

  // Idempotency: Stripe may deliver the same event more than once.
  const { data: alreadyProcessed } = await admin
    .from('stripe_webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    await handleEvent(event, admin, stripe);
  } catch (err) {
    console.error(`stripe-webhook: failed to process ${event.type} (${event.id})`, err);
    // Returning 500 makes Stripe retry — safe because handling is idempotent
    // (ticket/subscription writes below use upsert on a unique Stripe id).
    return new Response('Processing error', { status: 500 });
  }

  // Record success last, so a crash above never marks an unprocessed event as done.
  await admin.from('stripe_webhook_events').insert({ id: event.id, type: event.type });

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

async function handleEvent(event: Stripe.Event, admin: ReturnType<typeof getAdminClient>, stripe: Stripe) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;

      if (kind === 'event_ticket') {
        const amount = (session.amount_total ?? 0) / 100;
        const feePercent = Number(session.metadata?.platform_fee_percent ?? '10');
        const platformFee = Math.round(amount * (feePercent / 100) * 100) / 100;
        const hostAmount = Math.round((amount - platformFee) * 100) / 100;

        await admin.from('event_tickets').upsert(
          {
            group_id: session.metadata?.group_id,
            buyer_id: session.metadata?.buyer_id,
            host_id: session.metadata?.host_id,
            amount,
            platform_fee: platformFee,
            host_amount: hostAmount,
            currency: session.currency ?? 'usd',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
            status: session.payment_status === 'paid' ? 'paid' : 'pending',
          },
          { onConflict: 'stripe_checkout_session_id' }
        );

        if (session.metadata?.group_id && session.metadata?.buyer_id && session.payment_status === 'paid') {
          await admin.from('group_members').upsert(
            { group_id: session.metadata.group_id, user_id: session.metadata.buyer_id },
            { onConflict: 'group_id,user_id', ignoreDuplicates: true }
          );
        }
      } else if (kind === 'membership') {
        const userId = session.metadata?.user_id;
        if (userId) {
          await admin.from('memberships').upsert(
            {
              user_id: userId,
              status: 'active',
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
              is_founder: session.metadata?.is_founder === 'true',
            },
            { onConflict: 'user_id' }
          );
        }
      } else if (kind === 'business_subscription') {
        const partnerId = session.metadata?.partner_id;
        const plan = session.metadata?.plan;
        if (partnerId && plan) {
          await admin.from('business_subscriptions').upsert(
            {
              partner_id: partnerId,
              plan,
              status: 'active',
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
            },
            { onConflict: 'partner_id' }
          );
        }
      }
      break;
    }

    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin
        .from('event_tickets')
        .update({ status: event.type.endsWith('succeeded') ? 'paid' : 'failed' })
        .eq('stripe_checkout_session_id', session.id);
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
      const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;

      const { data: membership } = await admin
        .from('memberships')
        .select('user_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle();
      if (membership) {
        await admin.from('memberships').update({ status, current_period_end: currentPeriodEnd, canceled_at: canceledAt }).eq('user_id', membership.user_id);
        break;
      }

      const { data: bizSub } = await admin
        .from('business_subscriptions')
        .select('partner_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle();
      if (bizSub) {
        await admin.from('business_subscriptions').update({ status, current_period_end: currentPeriodEnd, canceled_at: canceledAt }).eq('partner_id', bizSub.partner_id);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (!subId) break;
      await admin.from('memberships').update({ status: 'past_due' }).eq('stripe_subscription_id', subId);
      await admin.from('business_subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        await admin.from('event_tickets').update({ status: 'refunded' }).eq('stripe_payment_intent_id', paymentIntentId);
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const status = account.charges_enabled && account.payouts_enabled ? 'active' : (account.requirements?.disabled_reason ? 'restricted' : 'pending');
      await admin
        .from('host_payout_accounts')
        .update({ status, payouts_enabled: !!account.payouts_enabled })
        .eq('stripe_connect_account_id', account.id);
      break;
    }

    default:
      // Unhandled event types are acknowledged (200) but not acted on.
      break;
  }
}
