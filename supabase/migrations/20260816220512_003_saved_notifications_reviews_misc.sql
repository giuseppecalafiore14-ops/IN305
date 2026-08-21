/*
# Saved Items, Notifications, Reviews, Hosts, Partners, Reports, Places

1. New Tables
- `saved_items` — users save groups, activities, events, or places for later. Polymorphic via item_type + item_id.
- `notifications` — in-app notifications (group joined, request approved, chat message, reminders, membership events). Has unread flag and type.
- `reviews` — post-activity feedback: 1-5 stars + "would you do this again" + "would you like to meet these people again". One review per user per group (unique constraint).
- `hosts` — host profile aggregate: groups hosted, completed groups, average rating, participants, status/badges. One row per host.
- `partners` — partner businesses (padel clubs, restaurants, etc.) for potential partnerships.
- `partner_inquiries` — submissions from the /for-businesses form.
- `reports` — user reports of harassment, spam, fake groups, etc. Linked to reporter and optionally a group/user.
- `places` — venues/places of interest. Architecture for future map integration.

2. Security
- saved_items: owner read/insert/delete only.
- notifications: owner read/update/delete only.
- reviews: public read; authenticated insert (owner); owner update/delete own; host+admin delete any.
- hosts: public read; owner+admin update.
- partners: public read; admin write.
- partner_inquiries: admin read; authenticated insert (any logged-in user can submit); admin update/delete.
- reports: admin read all; authenticated insert own; admin update/delete.
- places: public read; admin write.

3. Notes
- saved_items UNIQUE(user_id, item_type, item_id) prevents duplicates.
- reviews UNIQUE(group_id, user_id) prevents duplicate reviews.
- notifications has a read_at timestamp; unread = read_at IS NULL.
*/

-- Saved items
CREATE TABLE IF NOT EXISTS public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_unique UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON public.saved_items(user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL,
  would_do_again boolean,
  would_meet_again boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT review_unique UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_group ON public.reviews(group_id);

-- Hosts (aggregate profile)
CREATE TABLE IF NOT EXISTS public.hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  groups_hosted int NOT NULL DEFAULT 0,
  groups_completed int NOT NULL DEFAULT 0,
  total_participants int NOT NULL DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT host_status_check CHECK (status IN ('new','verified','top','suspended'))
);

-- Partners
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  instagram text,
  website text,
  category text,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  partnership_idea text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_status_check CHECK (status IN ('pending','approved','active','declined'))
);

-- Partner inquiries (form submissions)
CREATE TABLE IF NOT EXISTS public.partner_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  instagram text,
  website text,
  category text,
  neighborhood text,
  partnership_idea text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inquiry_status_check CHECK (status IN ('pending','contacted','approved','declined'))
);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_status_check CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  CONSTRAINT report_reason_check CHECK (reason IN ('harassment','inappropriate_behavior','spam','fake_group','unsafe_activity','other'))
);

-- Places
CREATE TABLE IF NOT EXISTS public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  address text,
  description text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Saved items: owner only
DROP POLICY IF EXISTS "owner_read_saved" ON public.saved_items;
CREATE POLICY "owner_read_saved" ON public.saved_items FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_insert_saved" ON public.saved_items;
CREATE POLICY "owner_insert_saved" ON public.saved_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_delete_saved" ON public.saved_items;
CREATE POLICY "owner_delete_saved" ON public.saved_items FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notifications: owner only
DROP POLICY IF EXISTS "owner_read_notifications" ON public.notifications;
CREATE POLICY "owner_read_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_update_notification" ON public.notifications;
CREATE POLICY "owner_update_notification" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_delete_notification" ON public.notifications;
CREATE POLICY "owner_delete_notification" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Reviews: public read, authenticated insert own, owner update/delete own, host+admin delete any
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
CREATE POLICY "public_read_reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_review" ON public.reviews;
CREATE POLICY "owner_insert_review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_update_review" ON public.reviews;
CREATE POLICY "owner_update_review" ON public.reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "owner_host_admin_delete_review" ON public.reviews;
CREATE POLICY "owner_host_admin_delete_review" ON public.reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g, public.reviews r WHERE r.id = reviews.id AND g.id = r.group_id AND g.host_id = auth.uid()) OR public.is_admin());

-- Hosts: public read, owner+admin update
DROP POLICY IF EXISTS "public_read_hosts" ON public.hosts;
CREATE POLICY "public_read_hosts" ON public.hosts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_admin_update_hosts" ON public.hosts;
CREATE POLICY "owner_admin_update_hosts" ON public.hosts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "admin_insert_hosts" ON public.hosts;
CREATE POLICY "admin_insert_hosts" ON public.hosts FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Partners: public read, admin write
DROP POLICY IF EXISTS "public_read_partners" ON public.partners;
CREATE POLICY "public_read_partners" ON public.partners FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_partners" ON public.partners;
CREATE POLICY "admin_write_partners" ON public.partners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Partner inquiries: admin read, authenticated insert, admin update/delete
DROP POLICY IF EXISTS "admin_read_inquiries" ON public.partner_inquiries;
CREATE POLICY "admin_read_inquiries" ON public.partner_inquiries FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "anyone_insert_inquiry" ON public.partner_inquiries;
CREATE POLICY "anyone_insert_inquiry" ON public.partner_inquiries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_write_inquiries" ON public.partner_inquiries;
CREATE POLICY "admin_write_inquiries" ON public.partner_inquiries FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_inquiries" ON public.partner_inquiries;
CREATE POLICY "admin_delete_inquiries" ON public.partner_inquiries FOR DELETE TO authenticated USING (public.is_admin());

-- Reports: admin read all, authenticated insert own, admin update
DROP POLICY IF EXISTS "admin_read_reports" ON public.reports;
CREATE POLICY "admin_read_reports" ON public.reports FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "owner_insert_report" ON public.reports;
CREATE POLICY "owner_insert_report" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "admin_update_reports" ON public.reports;
CREATE POLICY "admin_update_reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Places: public read, admin write
DROP POLICY IF EXISTS "public_read_places" ON public.places;
CREATE POLICY "public_read_places" ON public.places FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_places" ON public.places;
CREATE POLICY "admin_write_places" ON public.places FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
