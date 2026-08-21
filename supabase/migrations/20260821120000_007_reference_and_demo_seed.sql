/*
# Reference Data + Demo Content Seed

1. Audit findings (read-only queries run before writing this file)
- Every content table in this project is currently empty: neighborhoods,
  activity_categories, activities, groups, group_members, partners,
  partner_offers, events, reviews, notifications, saved_items, and
  profiles. Even the currently-authenticated account has no `profiles`
  row yet — only a Supabase Auth identity.
- This means the app was never seeded with its own taxonomy data (the
  neighborhood/category/activity tables the original schema was built
  around), which is the real reason Discover/Home showed no filter chips
  at all, not just "no user content."

2. What this migration does, in order
- Populates real, permanent reference data: neighborhoods, activity
  categories, and activities. This is taxonomy, not demo content — it
  isn't marked is_demo and never will be, matching the original schema's
  own intent (these tables were always meant to be "database-driven").
- One-time backfill: creates a `profiles` row for any existing
  `auth.users` row that doesn't have one yet. This does not create any
  new identity — it only completes the profile record for accounts that
  already exist. It is not a trigger and does not change future sign-up
  behavior.
- Adds `partners.is_demo` (parallel to the `is_demo` that already exists
  on `groups` and `events` from the original schema) so demo businesses
  can be told apart from real partners the same way demo activities
  already are.
- Seeds demo content — groups, events, partners, partner_offers — all
  explicitly marked `is_demo = true`. Every demo group's `current_participants`
  is left honest: only the real backfilled host is a member (via a real
  `group_members` row and the existing count trigger), never an invented
  number. No fake reviews, no fake businesses claiming real partnership —
  demo partners are seeded with no `owner_id` (unclaimed) and are shown
  in the UI as demo, not as verified partners.
- If, somehow, no profile exists even after the backfill (no auth users
  at all yet), the demo *groups* section is skipped rather than inventing
  a host — reference data, events, and partners still seed regardless,
  since none of those require a profile.

3. Notes
- No RLS policy is touched. No migration before this one is modified.
- Every insert is idempotent (ON CONFLICT / NOT EXISTS guards) so this
  migration is safe to re-run.
*/

-- ============================================================
-- A. Reference data (real, permanent — not demo content)
-- ============================================================

INSERT INTO public.neighborhoods (name, slug, sort_order) VALUES
  ('Brickell', 'brickell', 1),
  ('Downtown', 'downtown', 2),
  ('Wynwood', 'wynwood', 3),
  ('Miami Beach', 'miami-beach', 4),
  ('South Beach', 'south-beach', 5),
  ('Design District', 'design-district', 6),
  ('Midtown', 'midtown', 7),
  ('Coconut Grove', 'coconut-grove', 8),
  ('Coral Gables', 'coral-gables', 9),
  ('Little Havana', 'little-havana', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.activity_categories (name, slug, sort_order) VALUES
  ('Sports', 'sports', 1),
  ('Fitness', 'fitness', 2),
  ('Social', 'social', 3),
  ('Nightlife', 'nightlife', 4),
  ('Creative', 'creative', 5),
  ('Business', 'business', 6),
  ('Wellness', 'wellness', 7),
  ('Outdoors', 'outdoors', 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.activities (name, slug, category_id, image_url, sort_order)
SELECT v.name, v.slug, c.id, v.image_url, v.sort_order
FROM (VALUES
  ('Padel', 'padel', 'sports', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Pickleball', 'pickleball', 'sports', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', 2),
  ('Basketball', 'basketball', 'sports', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', 3),
  ('Football', 'football', 'sports', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', 4),
  ('Beach Volleyball', 'beach-volleyball', 'sports', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', 5),
  ('Running', 'running', 'fitness', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Cycling', 'cycling', 'fitness', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', 2),
  ('Social Night', 'social-night', 'social', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Drinks & Nightlife', 'drinks-nightlife', 'nightlife', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Creative Meetup', 'creative-meetup', 'creative', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Art Walk', 'art-walk', 'creative', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', 2),
  ('Networking', 'networking', 'business', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Tech & Startups', 'tech-startups', 'business', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200', 2),
  ('Yoga', 'yoga', 'wellness', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=1200', 1)
) AS v(name, slug, category_slug, image_url, sort_order)
JOIN public.activity_categories c ON c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- B. One-time profile backfill for existing auth users
-- ============================================================

INSERT INTO public.profiles (id, username)
SELECT u.id, 'user_' || substr(u.id::text, 1, 8)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- C. partners.is_demo (parallel to the existing groups/events is_demo)
-- ============================================================

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ============================================================
-- D. Demo events (no host required — events has no creator FK)
-- ============================================================

INSERT INTO public.events (slug, title, description, activity_id, neighborhood_id, venue_name, start_time, end_time, max_participants, current_participants, price, is_official, is_featured, is_demo, status)
SELECT
  'in305-friday-padel-social', 'IN305 Friday Padel Social',
  'An official IN305 experience — come play, no partner required, we pair you up.',
  a.id, n.id, 'Padel Miami', now() + interval '5 days' + interval '18 hours', now() + interval '5 days' + interval '20 hours',
  16, 0, 0, true, true, true, 'active'
FROM public.activities a, public.neighborhoods n WHERE a.slug = 'padel' AND n.slug = 'brickell'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.events (slug, title, description, activity_id, neighborhood_id, venue_name, start_time, end_time, max_participants, current_participants, price, is_official, is_featured, is_demo, status)
SELECT
  'in305-sunset-yoga-on-the-sand', 'IN305 Sunset Yoga on the Sand',
  'Official IN305 wellness experience on South Beach. Mats provided.',
  a.id, n.id, 'South Beach Sands', now() + interval '9 days' + interval '19 hours', now() + interval '9 days' + interval '20 hours',
  30, 0, 0, true, false, true, 'active'
FROM public.activities a, public.neighborhoods n WHERE a.slug = 'yoga' AND n.slug = 'south-beach'
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- E. Demo partners + offers (unclaimed — owner_id left NULL)
-- ============================================================

INSERT INTO public.partners (business_name, slug, description, category, neighborhood_id, logo_url, cover_image_url, status, is_demo)
SELECT v.business_name, v.slug, v.description, v.category, n.id, v.logo_url, v.cover_image_url, 'active', true
FROM (VALUES
  ('Miami Padel Club', 'miami-padel-club', 'Premier padel courts in the heart of Brickell, open for IN305 socials.', 'Sports Venue', 'brickell', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Brickell Run Club', 'brickell-run-club', 'A weekly running crew based out of Brickell, all paces welcome.', 'Fitness', 'brickell', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Wynwood Creative Studio', 'wynwood-creative-studio', 'Open studio space for painting, ceramics, and creative socials in Wynwood.', 'Art Studio', 'wynwood', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('South Beach Wellness', 'south-beach-wellness', 'Yoga, breathwork, and recovery studio steps from the sand.', 'Wellness', 'south-beach', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Downtown Social House', 'downtown-social-house', 'A neighborhood bar hosting IN305 mixers and happy hours.', 'Bar', 'downtown', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200')
) AS v(business_name, slug, description, category, neighborhood_slug, logo_url, cover_image_url)
JOIN public.neighborhoods n ON n.slug = v.neighborhood_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.partner_offers (partner_id, title, description, status)
SELECT p.id, v.title, v.description, 'active'
FROM (VALUES
  ('miami-padel-club', '20% off your first session', 'Show your IN305 profile at check-in.'),
  ('brickell-run-club', 'Free first run', 'No cost to join your first Saturday run.'),
  ('wynwood-creative-studio', '10% off your first class', 'Valid for any drop-in class.'),
  ('south-beach-wellness', 'Complimentary wellness consult', 'One free 15-minute consult for new IN305 members.'),
  ('downtown-social-house', 'Free welcome drink', 'One complimentary drink for IN305 members, first visit.')
) AS v(partner_slug, title, description)
JOIN public.partners p ON p.slug = v.partner_slug
WHERE NOT EXISTS (SELECT 1 FROM public.partner_offers o WHERE o.partner_id = p.id AND o.title = v.title)
ON CONFLICT DO NOTHING;

-- ============================================================
-- F. Demo groups (require a real host — skipped if none exists)
-- ============================================================

DO $$
DECLARE
  demo_host_id uuid;
BEGIN
  SELECT id INTO demo_host_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;

  IF demo_host_id IS NULL THEN
    RAISE NOTICE 'No profile exists yet (not even after backfill) — skipping demo group seed. Reference data, events, and partners were still seeded.';
  ELSE
    INSERT INTO public.groups (slug, title, description, activity_id, host_id, neighborhood_id, venue_name, start_time, end_time, max_participants, current_participants, vibe, experience_level, cost, visibility, status, cover_image_url, is_featured, is_demo)
    SELECT v.slug, v.title, v.description, a.id, demo_host_id, n.id, v.venue_name, v.start_time, v.end_time, v.max_participants, 0, v.vibe, v.experience_level, 0, v.visibility, 'active', v.cover_image_url, v.is_featured, true
    FROM (VALUES
      ('downtown-miami-padel', 'Downtown Miami Padel', 'Casual padel at a top downtown court. All levels, we rotate partners.', 'padel', 'downtown', 'Downtown Padel Courts', now() + interval '1 day' + interval '18 hours', now() + interval '1 day' + interval '20 hours', 8, 'Active', 'Everyone', 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('brickell-run-club', 'Brickell Run Club', 'Easy 5k along the Brickell waterfront, finishing with coffee.', 'running', 'brickell', 'Brickell Ave & SE 8th St', now() + interval '2 days' + interval '7 hours', now() + interval '2 days' + interval '8 hours', 15, 'Social', 'Everyone', 'public', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('miami-beach-sunset-volleyball', 'Miami Beach Sunset Volleyball', 'Pickup beach volleyball as the sun goes down. Bring water.', 'beach-volleyball', 'miami-beach', '21st St Beach Courts', now() + interval '3 days' + interval '18 hours', now() + interval '3 days' + interval '20 hours', 12, 'Active', 'Everyone', 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('wynwood-creative-meetup', 'Wynwood Creative Meetup', 'Bring a sketchbook, a laptop, or nothing — just come make things with other creatives.', 'creative-meetup', 'wynwood', 'Wynwood Yard', now() + interval '4 days' + interval '19 hours', now() + interval '4 days' + interval '21 hours', 20, 'Creative', 'Everyone', 'public', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('little-havana-social-night', 'Little Havana Social Night', 'Dominoes, cafecito, and conversation on Calle Ocho.', 'social-night', 'little-havana', 'Domino Park', now() + interval '6 days' + interval '19 hours', now() + interval '6 days' + interval '21 hours', 14, 'Social', 'Everyone', 'public', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('downtown-pickleball', 'Downtown Pickleball', 'Beginner-friendly pickleball, paddles available to borrow.', 'pickleball', 'downtown', 'Downtown Courts', now() + interval '2 days' + interval '17 hours', now() + interval '2 days' + interval '19 hours', 8, 'Active', 'Beginner', 'members_only', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('miami-beach-morning-run', 'Miami Beach Morning Run', 'Early beachfront run before the heat kicks in.', 'running', 'miami-beach', 'Lummus Park', now() + interval '1 day' + interval '6 hours', now() + interval '1 day' + interval '7 hours', 15, 'Active', 'Everyone', 'public', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('brickell-after-work-drinks', 'Brickell After Work Drinks', 'Unwind after work with the IN305 crowd.', 'drinks-nightlife', 'brickell', 'Rooftop Brickell', now() + interval '3 days' + interval '19 hours', now() + interval '3 days' + interval '22 hours', 25, 'Party', 'Everyone', 'public', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('sunday-beach-football', 'Sunday Beach Football', 'Casual pickup football on the sand. No cleats needed.', 'football', 'miami-beach', 'South Pointe Park', now() + interval '5 days' + interval '15 hours', now() + interval '5 days' + interval '17 hours', 16, 'Active', 'Everyone', 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('coconut-grove-social-ride', 'Coconut Grove Social Ride', 'Easy-pace group bike ride through the Grove.', 'cycling', 'coconut-grove', 'Peacock Park', now() + interval '7 days' + interval '9 hours', now() + interval '7 days' + interval '11 hours', 12, 'Chill', 'Everyone', 'public', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('miami-networking-night', 'Miami Networking Night', 'Meet founders, operators, and creators building in Miami.', 'networking', 'brickell', 'The Rise Miami', now() + interval '8 days' + interval '18 hours', now() + interval '8 days' + interval '20 hours', 40, 'Professional', 'Everyone', 'public', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('wynwood-art-walk', 'Wynwood Art Walk', 'Group walk through the walls and galleries of Wynwood.', 'art-walk', 'wynwood', 'Wynwood Walls', now() + interval '10 days' + interval '18 hours', now() + interval '10 days' + interval '20 hours', 18, 'Creative', 'Everyone', 'public', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('downtown-basketball', 'Downtown Basketball', 'Run pickup games downtown, all skill levels get court time.', 'basketball', 'downtown', 'Downtown Courts', now() + interval '4 days' + interval '18 hours', now() + interval '4 days' + interval '20 hours', 10, 'Competitive', 'Intermediate', 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('south-beach-yoga-morning', 'South Beach Yoga Morning', 'Start the day with beachfront yoga. Bring your own mat.', 'yoga', 'south-beach', 'South Beach Sands', now() + interval '2 days' + interval '7 hours', now() + interval '2 days' + interval '8 hours', 20, 'Wellness', 'Everyone', 'members_only', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('miami-tech-startup-meetup', 'Miami Tech & Startup Meetup', 'Casual meetup for people building tech and startups in Miami.', 'tech-startups', 'downtown', 'The LAB Miami', now() + interval '11 days' + interval '18 hours', now() + interval '11 days' + interval '20 hours', 35, 'Professional', 'Everyone', 'public', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200', false)
    ) AS v(slug, title, description, activity_slug, neighborhood_slug, venue_name, start_time, end_time, max_participants, vibe, experience_level, visibility, cover_image_url, is_featured)
    JOIN public.activities a ON a.slug = v.activity_slug
    JOIN public.neighborhoods n ON n.slug = v.neighborhood_slug
    ON CONFLICT (slug) DO NOTHING;

    -- Host joins their own demo groups for real (drives current_participants via the existing trigger — never set directly).
    INSERT INTO public.group_members (group_id, user_id)
    SELECT g.id, demo_host_id
    FROM public.groups g
    WHERE g.is_demo = true
      AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = demo_host_id);
  END IF;
END $$;
