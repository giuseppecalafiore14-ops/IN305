/*
# Monetization Data Model (event pricing, host earnings, business subscriptions)

1. Inspection findings (before writing this file)
- `groups.cost` already exists and is exactly "ticket price per person" —
  no new column needed for event pricing. Gross revenue for an event is
  simply `cost * current_participants`, both already real, already-tracked
  columns. There is no separate "transactions" ledger because there are no
  real transactions yet (no live Stripe) — host/business earnings shown in
  the UI are an *estimate* computed live from this, never stored as if
  they were settled money.
- `recurring_groups` + `groups.recurring_group_id` already model recurring
  events end to end (frequency, interval, end date) and are already wired
  into CreateGroupPage. Nothing new needed for recurring events.
- `partners` is public-read (`USING (true)`), so subscription/billing
  state must NOT live on that table — it would leak every business's
  billing status to anyone. It needs its own table with owner-only read.

2. What this migration adds
- `pricing_config.platform_fee_percent`: the platform-wide fee rate (10%
  at launch), stored once, read by both the create-event revenue
  calculator and the host earnings dashboard so neither hardcodes it.
- `business_subscriptions`: one row per partner, mirroring the same shape
  and trust model `memberships` already uses for consumer billing
  (status, stripe ids, period end — write access is admin-only, exactly
  like `admin_write_memberships`). A business owner can only ever *read*
  their own row. There is no owner-insert/self-activate policy, on
  purpose — the lesson from the earlier profile/membership privilege
  work applies here too: billing status must never be client-writable.
  Until Stripe is live, this table is expected to be empty for everyone,
  and the UI shows an honest "no active subscription" state rather than
  writing a fake pending/active row to make the screen look populated.

3. Notes
- No existing table, column, policy, or the 004/005 security migrations
  are touched. Every change here is additive.
- Stripe Connect fields (host payout accounts) are deliberately NOT
  added yet — there is no UI need for them until real payments exist,
  and committing to a schema shape now risks it being wrong once the
  actual Stripe Connect integration happens. That integration should
  design its own migration alongside the real API calls.
*/

ALTER TABLE public.pricing_config ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) NOT NULL DEFAULT 10.00;

CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL UNIQUE REFERENCES public.partners(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('business', 'business_pro')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  canceled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_partner ON public.business_subscriptions(partner_id);

DROP TRIGGER IF EXISTS business_subscriptions_touch_updated_at ON public.business_subscriptions;
CREATE TRIGGER business_subscriptions_touch_updated_at BEFORE UPDATE ON public.business_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_subscription" ON public.business_subscriptions;
CREATE POLICY "owner_read_subscription" ON public.business_subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND p.owner_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "admin_write_subscription" ON public.business_subscriptions;
CREATE POLICY "admin_write_subscription" ON public.business_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
