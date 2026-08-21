/*
# Business Accounts

1. Problem
- `partners` is currently a pure admin-curated directory: businesses have no
  way to log in and manage their own profile, and there is no way to link a
  `partners` row to an authenticated user at all.
- There is no offers concept in the schema at all.
- A real "business dashboard" (Phase 3B) is not buildable without both.

2. Fix — minimal, additive schema only
- `partners.owner_id`: links a partner row to the profiles.id of the person
  who manages it. Nullable — existing/future admin-curated rows without an
  assigned owner keep working exactly as before (public read, admin write).
  Only admins can set this (via the existing admin_write_partners policy);
  a new owner_update_partner policy lets the linked owner edit their own
  profile fields (name, description, images, links) without needing admin
  access for every change. Ownership itself (owner_id) can only be
  (re)assigned by an admin — an owner cannot reassign their own row to
  someone else, and cannot claim an unowned row themselves.
- `partners.slug`, `logo_url`, `cover_image_url`, `description`: fields a
  real business profile page needs that didn't exist yet.
- `partner_offers`: new table for the member-offer concept described in
  Phase 3B ("20% off first session"). Owner-scoped writes, public read of
  active offers only (owner/admin can also see their own inactive ones).

3. Notes
- No existing table, column, policy, or the 004/005 security migrations are
  touched. Every change here is additive.
- A business "hosts" activities through the exact same `groups` table and
  RLS every other host already uses — host_id is still profiles.id (the
  owner's own account). No group-level "business" concept was invented;
  a business's hosted groups are simply `groups where host_id = partners.owner_id`.
- This does not implement Stripe, payments, or membership enforcement for
  businesses — only the data model needed to manage a profile and list
  offers.
*/

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS idx_partners_owner ON public.partners(owner_id);
CREATE INDEX IF NOT EXISTS idx_partners_slug ON public.partners(slug);

-- Owner can update their own partner row's profile fields (ownership assignment stays admin-only, via the existing admin_write_partners policy).
DROP POLICY IF EXISTS "owner_update_partner" ON public.partners;
CREATE POLICY "owner_update_partner" ON public.partners FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- Partner offers
CREATE TABLE IF NOT EXISTS public.partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_status_check CHECK (status IN ('active', 'inactive'))
);
CREATE INDEX IF NOT EXISTS idx_partner_offers_partner ON public.partner_offers(partner_id);

ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_offers" ON public.partner_offers;
CREATE POLICY "read_offers" ON public.partner_offers FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND (p.owner_id = auth.uid() OR public.is_admin()))
  );

DROP POLICY IF EXISTS "owner_write_offers" ON public.partner_offers;
CREATE POLICY "owner_write_offers" ON public.partner_offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND (p.owner_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND (p.owner_id = auth.uid() OR public.is_admin())));
