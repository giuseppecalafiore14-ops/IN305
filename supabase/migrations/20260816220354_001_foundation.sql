/*
# Foundation Tables — Reference Data, Profiles, Memberships

1. New Tables (in dependency order)
- `neighborhoods` — Miami neighborhoods (Brickell, Wynwood, …), database-driven.
- `activity_categories` — top-level groupings (Sports, Outdoors, Creative, …).
- `activities` — specific things to do (Padel, Brunch…), linked to a category.
- `pricing_config` — singleton row with membership pricing + founder limits (never hard-coded in app).
- `profiles` — one row per auth user; public profile info + admin/founder/host flags. Private contact (email) stays in auth.users.
- `memberships` — membership state (active/trialing/past_due/canceled/incomplete/inactive), Stripe ids, founder info. App reads status from here.

2. Security
- Helper `is_admin()` (SECURITY DEFINER) checks profiles.is_admin for the current user. Defined AFTER profiles exists.
- Reference tables (neighborhoods, categories, activities, pricing): public read for anon+authenticated; admin-only writes via is_admin().
- profiles: public read; owner insert+update; admin update.
- memberships: public read (so group cards can show "Members only"); admin write. Stripe webhook writes via service role (bypasses RLS).

3. Notes
- profiles.id → auth.users(id) ON DELETE CASCADE.
- memberships.user_id → profiles(id) ON DELETE CASCADE.
- pricing_config singleton via CHECK(id=1) + default row inserted.
- updated_at triggers on profiles and memberships.
*/

-- neighborhoods (no dependencies)
CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- activity categories (no dependencies)
CREATE TABLE IF NOT EXISTS public.activity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- activities (depends on categories)
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES public.activity_categories(id) ON DELETE CASCADE,
  icon text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category_id);
CREATE INDEX IF NOT EXISTS idx_activities_slug ON public.activities(slug);

-- pricing config (singleton, no dependencies)
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id int PRIMARY KEY DEFAULT 1,
  monthly_price numeric(10,2) NOT NULL DEFAULT 24.99,
  annual_price numeric(10,2),
  founder_price numeric(10,2),
  founder_limit int NOT NULL DEFAULT 100,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_pricing CHECK (id = 1)
);
INSERT INTO public.pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- profiles (depends on neighborhoods)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  username text UNIQUE,
  avatar_url text,
  bio text,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  languages text[] DEFAULT '{}',
  interests text[] DEFAULT '{}',
  activities text[] DEFAULT '{}',
  preferred_vibes text[] DEFAULT '{}',
  preferred_group_size int,
  preferred_times text[] DEFAULT '{}',
  is_admin boolean NOT NULL DEFAULT false,
  is_host boolean NOT NULL DEFAULT false,
  is_founder boolean NOT NULL DEFAULT false,
  founder_number int,
  host_verified boolean NOT NULL DEFAULT false,
  groups_joined_count int NOT NULL DEFAULT 0,
  groups_hosted_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- memberships (depends on profiles)
CREATE TABLE IF NOT EXISTS public.memberships (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  is_founder boolean NOT NULL DEFAULT false,
  founder_number int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_status_check CHECK (
    status IN ('active','trialing','past_due','canceled','incomplete','inactive')
  )
);

-- is_admin helper (defined after profiles exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS memberships_touch_updated_at ON public.memberships;
CREATE TRIGGER memberships_touch_updated_at BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS everywhere
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Reference tables: public read, admin write
DROP POLICY IF EXISTS "public_read_neighborhoods" ON public.neighborhoods;
CREATE POLICY "public_read_neighborhoods" ON public.neighborhoods FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_neighborhoods" ON public.neighborhoods;
CREATE POLICY "admin_write_neighborhoods" ON public.neighborhoods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_read_activity_categories" ON public.activity_categories;
CREATE POLICY "public_read_activity_categories" ON public.activity_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_activity_categories" ON public.activity_categories;
CREATE POLICY "admin_write_activity_categories" ON public.activity_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_read_activities" ON public.activities;
CREATE POLICY "public_read_activities" ON public.activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_activities" ON public.activities;
CREATE POLICY "admin_write_activities" ON public.activities FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_read_pricing" ON public.pricing_config;
CREATE POLICY "public_read_pricing" ON public.pricing_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_pricing" ON public.pricing_config;
CREATE POLICY "admin_write_pricing" ON public.pricing_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- profiles: public read, owner insert+update, admin update
DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
CREATE POLICY "public_read_profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_profile" ON public.profiles;
CREATE POLICY "owner_insert_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owner_update_profile" ON public.profiles;
CREATE POLICY "owner_update_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "admin_update_profile" ON public.profiles;
CREATE POLICY "admin_update_profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- memberships: public read, admin write (Stripe webhook uses service role, bypasses RLS)
DROP POLICY IF EXISTS "public_read_memberships" ON public.memberships;
CREATE POLICY "public_read_memberships" ON public.memberships FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_memberships" ON public.memberships;
CREATE POLICY "admin_write_memberships" ON public.memberships FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
