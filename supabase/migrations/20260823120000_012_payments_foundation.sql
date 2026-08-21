/*
# Phase 8 — Payments Foundation (Stripe-Ready Schema)

1. Audit findings (read before writing this file)
- `memberships` and `business_subscriptions` already carry
  `stripe_customer_id`/`stripe_subscription_id` columns and are already
  admin-write-only under RLS (migration 001's own comment: "Stripe webhook
  writes via service role, bypasses RLS") — that pattern is reused as-is,
  not redesigned.
- Their `status` CHECK constraints only cover a subset of real Stripe
  subscription statuses. Widened here to the full Stripe enum so the
  webhook handler can write real Stripe states without a constraint
  violation. `inactive` is kept on both for backward compatibility with
  existing rows/app code that already reads it as "no active subscription."
- No transaction, payout, or webhook-idempotency table existed anywhere —
  `groups.cost` was only ever a listing price with no purchase record
  model. This migration adds exactly three new tables to close that gap,
  reusing `groups`/`profiles`/`pricing_config` rather than duplicating
  anything.

2. What this migration does
- Widens `memberships.status` and `business_subscriptions.status` CHECKs
  to the real Stripe subscription status enum.
- `event_tickets` — one row per successful/attempted event ticket
  purchase. Written exclusively by the Stripe webhook (service role) —
  no INSERT/UPDATE policy exists for anon/authenticated, matching the
  requirement that payment/payout state is server-authoritative and never
  client-writable. Buyers read their own tickets; hosts read tickets for
  groups they host; admins read everything.
- `host_payout_accounts` — one row per host who has started Stripe
  Connect onboarding. Same server-write-only pattern; hosts read their own.
- `stripe_webhook_events` — idempotency ledger keyed by Stripe's own event
  id. RLS is enabled with zero policies, so no anon/authenticated request
  can read or write it under any circumstance; only the service role
  (used exclusively by the webhook Edge Function) bypasses RLS.

3. Notes
- No existing RLS policy is weakened — only widened CHECK constraints and
  brand-new tables with a read-only-your-own-data / write-nothing policy
  set for regular clients.
- Migrations 004 and 005 are not touched.
- Every statement is additive and safe to re-run (DROP CONSTRAINT IF
  EXISTS + re-add, CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS +
  re-create).
*/

-- ============================================================
-- A. Widen subscription status CHECKs to the real Stripe enum
-- ============================================================

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS membership_status_check;
ALTER TABLE public.memberships ADD CONSTRAINT membership_status_check CHECK (
  status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'inactive')
);

ALTER TABLE public.business_subscriptions DROP CONSTRAINT IF EXISTS business_subscriptions_status_check;
ALTER TABLE public.business_subscriptions ADD CONSTRAINT business_subscriptions_status_check CHECK (
  status IN ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')
);

-- ============================================================
-- B. event_tickets — the event-purchase transaction record
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) NOT NULL,
  host_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  stripe_transfer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_tickets_group ON public.event_tickets(group_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_buyer ON public.event_tickets(buyer_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_host ON public.event_tickets(host_id);

DROP TRIGGER IF EXISTS event_tickets_touch_updated_at ON public.event_tickets;
CREATE TRIGGER event_tickets_touch_updated_at BEFORE UPDATE ON public.event_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_event_tickets" ON public.event_tickets;
CREATE POLICY "read_own_event_tickets" ON public.event_tickets FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR host_id = auth.uid() OR public.is_admin());
-- No INSERT/UPDATE/DELETE policy for anon/authenticated: only the
-- Stripe webhook (service role) ever writes a ticket. Admin can still
-- manage rows directly in the dashboard via service role if ever needed.

-- ============================================================
-- C. host_payout_accounts — Stripe Connect onboarding state
-- ============================================================

CREATE TABLE IF NOT EXISTS public.host_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_connect_account_id text UNIQUE,
  status text NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected', 'pending', 'active', 'restricted')),
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS host_payout_accounts_touch_updated_at ON public.host_payout_accounts;
CREATE TRIGGER host_payout_accounts_touch_updated_at BEFORE UPDATE ON public.host_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.host_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_payout_account" ON public.host_payout_accounts;
CREATE POLICY "read_own_payout_account" ON public.host_payout_accounts FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR public.is_admin());
-- No client write policy — only the Connect-account-link and webhook
-- Edge Functions (service role) create/update these rows.

-- ============================================================
-- D. stripe_webhook_events — idempotency ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies: RLS enabled with no matching policy means
-- anon/authenticated requests are denied outright for every operation.
-- Only the webhook Edge Function's service-role key can touch this table.
