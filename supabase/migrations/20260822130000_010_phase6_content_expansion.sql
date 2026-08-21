/*
# Phase 6 — Content Expansion (Seed Data) + Recurring Visibility Fix

1. Audit findings (read before writing this file)
- Reused architecture only: no new tables. This migration only adds rows to
  existing tables (neighborhoods, activities, groups, recurring_groups,
  events, partners, partner_offers, group_members) plus one RLS policy
  change on `recurring_groups` (see #3).
- Only one real profile exists in this project (the actual signed-up
  account, backfilled by migration 007). Per "do not invent existing
  users," this migration does NOT create additional demo host profiles —
  every new demo `group` below is hosted by that same real, existing
  profile, exactly like migration 007's demo groups. The 8 new `events`
  below need no host at all (events has no creator FK). This is a known,
  deliberate limitation — see the final report for how "different hosts"
  was and wasn't satisfied.
- `groups.recurring_group_id` is a legacy, unused column — CreateGroupPage
  has never written to it; it links a group to its own recurring cadence
  the other way, via `recurring_groups.group_id -> groups.id`. The
  frontend "Recurring" badge was reading the wrong (always-null) column;
  fixed in the same commit as this migration (GROUP_SELECT now embeds
  `recurring_groups`, GroupCard checks that instead).

2. What this migration does, in order
- A. Reference data: one more neighborhood (Edgewater) and four more
     activities (Photography, Food & Drink, Outdoor Adventure, Bootcamp)
     to cover categories the seed content below needs that migration 007
     didn't add yet (all under existing categories — no new category rows).
- B. Widens `recurring_groups` SELECT to public (anon + authenticated).
     Frequency/interval/day-of-week is display info for a public listing
     (same sensitivity as `groups.start_time`, which is already public),
     not host-private data — the existing host-only policy blocked the
     public "Recurring" badge from ever reading it. Write access is
     untouched: still host/admin only via the existing `host_write_recurring`
     policy. Migrations 004 and 005 are not touched.
- C. 8 more demo `events` (official IN305, no host, is_demo = true).
- D. 8 more demo `partners` (unclaimed, owner_id NULL, is_demo = true)
     + a few `partner_offers`, rounding out to 13 total demo businesses
     across cafés, restaurants, coworking, padel/pickleball, wellness,
     hospitality, nightlife and fitness.
- E. 8 more demo `groups`, hosted by the same real profile as migration
     007's demo groups, mixing free/paid, mixing capacities, and 3 of them
     get a matching `recurring_groups` row (weekly cadence) — skipped
     entirely (same guard as 007) if no profile exists at all.

3. Notes
- No RLS policy is weakened: the recurring_groups change only adds
  visibility for non-sensitive scheduling info; writes are unaffected.
- No fake financial transactions, payments, reviews, or ratings.
- Every insert is idempotent (ON CONFLICT / NOT EXISTS guards).
- Migrations 004 and 005 are not modified.
*/

-- ============================================================
-- A. Reference data additions
-- ============================================================

INSERT INTO public.neighborhoods (name, slug, sort_order) VALUES
  ('Edgewater', 'edgewater', 11)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.activities (name, slug, category_id, image_url, sort_order)
SELECT v.name, v.slug, c.id, v.image_url, v.sort_order
FROM (VALUES
  ('Photography', 'photography', 'creative', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', 3),
  ('Food & Drink', 'food-drink', 'social', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200', 2),
  ('Outdoor Adventure', 'outdoor-adventure', 'outdoors', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', 1),
  ('Bootcamp', 'bootcamp', 'fitness', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', 3)
) AS v(name, slug, category_slug, image_url, sort_order)
JOIN public.activity_categories c ON c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- B. recurring_groups: make scheduling info publicly readable
-- ============================================================

DROP POLICY IF EXISTS "host_read_recurring" ON public.recurring_groups;
DROP POLICY IF EXISTS "public_read_recurring" ON public.recurring_groups;
CREATE POLICY "public_read_recurring" ON public.recurring_groups FOR SELECT TO anon, authenticated USING (true);
-- host_write_recurring (FOR ALL, host/admin only) already covers INSERT/UPDATE/DELETE — untouched.

-- ============================================================
-- C. Demo events (no host required)
-- ============================================================

INSERT INTO public.events (slug, title, description, activity_id, neighborhood_id, venue_name, start_time, end_time, max_participants, current_participants, price, is_official, is_featured, is_demo, status)
SELECT v.slug, v.title, v.description, a.id, n.id, v.venue_name, v.start_time, v.end_time, v.max_participants, 0, v.price, true, v.is_featured, true, 'active'
FROM (VALUES
  ('in305-rooftop-networking-mixer', 'IN305 Rooftop Networking Mixer', 'Meet founders, operators, and creators over drinks with a Brickell skyline view.', 'networking', 'brickell', 'The Rise Rooftop', now() + interval '6 days' + interval '18 hours', now() + interval '6 days' + interval '20 hours', 60, 25.00, true),
  ('in305-beach-volleyball-tournament', 'IN305 Beach Volleyball Tournament', 'Official IN305 tournament on South Beach — sign up solo or with a partner, teams are balanced on-site.', 'beach-volleyball', 'south-beach', 'South Pointe Courts', now() + interval '12 days' + interval '15 hours', now() + interval '12 days' + interval '18 hours', 32, 30.00, true),
  ('in305-wellness-morning-coconut-grove', 'IN305 Wellness Morning — Coconut Grove', 'A slow morning of breathwork and movement under the trees at Peacock Park.', 'yoga', 'coconut-grove', 'Peacock Park', now() + interval '8 days' + interval '8 hours', now() + interval '8 days' + interval '10 hours', 25, 40.00, false),
  ('in305-food-crawl-little-havana', 'IN305 Food Crawl — Little Havana', 'A guided stop-by-stop tasting through Calle Ocho''s best counters and cafés.', 'food-drink', 'little-havana', 'Calle Ocho', now() + interval '10 days' + interval '18 hours', now() + interval '10 days' + interval '21 hours', 20, 45.00, true),
  ('in305-creative-portrait-walk-wynwood', 'IN305 Creative Portrait Walk — Wynwood', 'Bring a camera or just your phone — a walking session through the murals, shooting portraits of each other.', 'photography', 'wynwood', 'Wynwood Walls', now() + interval '7 days' + interval '17 hours', now() + interval '7 days' + interval '19 hours', 15, 0, false),
  ('in305-founders-happy-hour-design-district', 'IN305 Founders Happy Hour — Design District', 'Casual, free happy hour for people building companies in Miami.', 'networking', 'design-district', 'Design District Plaza', now() + interval '13 days' + interval '18 hours', now() + interval '13 days' + interval '20 hours', 50, 0, false),
  ('in305-outdoor-adventure-day', 'IN305 Outdoor Adventure Day', 'Kayaking and trail walks at Matheson Hammock — a full morning outside.', 'outdoor-adventure', 'coral-gables', 'Matheson Hammock Park', now() + interval '14 days' + interval '9 hours', now() + interval '14 days' + interval '13 hours', 25, 20.00, false),
  ('in305-midtown-fitness-bootcamp', 'IN305 Midtown Fitness Bootcamp', 'A 45-minute outdoor bootcamp session — all levels, no equipment needed.', 'bootcamp', 'midtown', 'Midtown Miami Green', now() + interval '5 days' + interval '7 hours', now() + interval '5 days' + interval '8 hours', 20, 15.00, false)
) AS v(slug, title, description, activity_slug, neighborhood_slug, venue_name, start_time, end_time, max_participants, price, is_featured)
JOIN public.activities a ON a.slug = v.activity_slug
JOIN public.neighborhoods n ON n.slug = v.neighborhood_slug
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- D. Demo partners + offers (unclaimed — owner_id left NULL)
-- ============================================================

INSERT INTO public.partners (business_name, slug, description, category, neighborhood_id, logo_url, cover_image_url, status, is_demo)
SELECT v.business_name, v.slug, v.description, v.category, n.id, v.logo_url, v.cover_image_url, 'active', true
FROM (VALUES
  ('Brickell Coffee Roasters', 'brickell-coffee-roasters', 'Small-batch coffee and a favorite spot for IN305 meetups and casual work sessions.', 'Café', 'brickell', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Wynwood Food Hall', 'wynwood-food-hall', 'A rotating collection of Miami''s best food vendors under one roof — great for recurring IN305 socials.', 'Restaurant', 'wynwood', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Design District Coworking', 'design-district-coworking', 'Flexible workspace and event space built for Miami''s founders and freelancers.', 'Coworking', 'design-district', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Miami Pickle Social Club', 'miami-pickle-social-club', 'Courts, lessons, and a clubhouse built for Miami''s pickleball boom. Designed for Miami''s active community.', 'Padel Club', 'coconut-grove', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Edgewater Wellness Loft', 'edgewater-wellness-loft', 'A calm, light-filled studio for yoga and recovery, perfect for post-work social events.', 'Wellness', 'edgewater', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('South Beach Boutique Hotel', 'south-beach-boutique-hotel', 'Rooftop and lounge space perfect for sponsored IN305 events.', 'Hospitality', 'south-beach', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Little Havana Nightlife Lounge', 'little-havana-nightlife-lounge', 'Live music and late-night energy in the heart of Little Havana.', 'Nightlife', 'little-havana', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/36766039/pexels-photo-36766039.jpeg?auto=compress&cs=tinysrgb&w=1200'),
  ('Coral Gables Fitness Studio', 'coral-gables-fitness-studio', 'Boutique training studio designed for Miami''s active community.', 'Fitness', 'coral-gables', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=200', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200')
) AS v(business_name, slug, description, category, neighborhood_slug, logo_url, cover_image_url)
JOIN public.neighborhoods n ON n.slug = v.neighborhood_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.partner_offers (partner_id, title, description, status)
SELECT p.id, v.title, v.description, 'active'
FROM (VALUES
  ('brickell-coffee-roasters', '10% off for IN305 members', 'Show your IN305 profile at checkout.'),
  ('wynwood-food-hall', 'Free appetizer with entrée', 'Valid for any single vendor, first visit.'),
  ('miami-pickle-social-club', 'Free first lesson', 'One complimentary beginner lesson for new IN305 members.'),
  ('edgewater-wellness-loft', '15% off your first class', 'Valid for any drop-in class.'),
  ('coral-gables-fitness-studio', 'Free trial session', 'One complimentary training session for new IN305 members.')
) AS v(partner_slug, title, description)
JOIN public.partners p ON p.slug = v.partner_slug
WHERE NOT EXISTS (SELECT 1 FROM public.partner_offers o WHERE o.partner_id = p.id AND o.title = v.title)
ON CONFLICT DO NOTHING;

-- ============================================================
-- E. Demo groups (require a real host — skipped if none exists)
-- ============================================================

DO $$
DECLARE
  demo_host_id uuid;
BEGIN
  SELECT id INTO demo_host_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;

  IF demo_host_id IS NULL THEN
    RAISE NOTICE 'No profile exists yet — skipping demo group seed. Reference data, events, and partners were still seeded.';
  ELSE
    INSERT INTO public.groups (slug, title, description, activity_id, host_id, neighborhood_id, venue_name, start_time, end_time, max_participants, current_participants, vibe, experience_level, cost, visibility, status, cover_image_url, is_featured, is_demo)
    SELECT v.slug, v.title, v.description, a.id, demo_host_id, n.id, v.venue_name, v.start_time, v.end_time, v.max_participants, 0, v.vibe, v.experience_level, v.cost, v.visibility, 'active', v.cover_image_url, v.is_featured, true
    FROM (VALUES
      ('sunrise-run-brickell-to-bayfront', 'Sunrise Run — Brickell to Bayfront', 'Easy-pace run along the water, finishing at Bayfront Park before the city wakes up.', 'running', 'brickell', 'Brickell Ave & SE 8th St', now() + interval '1 day' + interval '6 hours', now() + interval '1 day' + interval '7 hours', 20, 'Active', 'Everyone', 0, 'public', 'https://images.pexels.com/photos/14018343/pexels-photo-14018343.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('wednesday-night-padel-miami-beach', 'Wednesday Night Padel — Miami Beach', 'Weekly padel under the lights. We rotate partners so everyone gets good games.', 'padel', 'miami-beach', 'Miami Beach Padel Courts', now() + interval '2 days' + interval '19 hours', now() + interval '2 days' + interval '21 hours', 8, 'Active', 'Intermediate', 22.00, 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('golden-hour-yoga-design-district', 'Golden Hour Yoga — Design District', 'Rooftop flow as the sun goes down, mats provided.', 'yoga', 'design-district', 'Design District Rooftop', now() + interval '3 days' + interval '18 hours', now() + interval '3 days' + interval '19 hours', 25, 'Wellness', 'Everyone', 18.00, 'public', 'https://images.pexels.com/photos/3772502/pexels-photo-3772502.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('miami-founders-creators-dinner', 'Miami Founders & Creators Dinner', 'A small, curated dinner for people building things in Miami — real conversation, no pitching.', 'networking', 'wynwood', 'Wynwood Yard', now() + interval '6 days' + interval '19 hours', now() + interval '6 days' + interval '21 hours', 30, 'Professional', 'Everyone', 35.00, 'public', 'https://images.pexels.com/photos/3321797/pexels-photo-3321797.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('saturday-morning-pickleball-coconut-grove', 'Saturday Morning Pickleball — Coconut Grove', 'Beginner-friendly, paddles available to borrow. New faces every week.', 'pickleball', 'coconut-grove', 'Coconut Grove Courts', now() + interval '4 days' + interval '8 hours', now() + interval '4 days' + interval '10 hours', 12, 'Active', 'Beginner', 0, 'public', 'https://images.pexels.com/photos/38155778/pexels-photo-38155778.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('sunset-social-south-beach', 'Sunset Social at South Beach', 'Casual meetup on the sand as the sun goes down — bring a friend.', 'social-night', 'south-beach', 'South Pointe Park', now() + interval '5 days' + interval '19 hours', now() + interval '5 days' + interval '21 hours', 40, 'Social', 'Everyone', 0, 'public', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200', true),
      ('little-havana-salsa-cafecito-night', 'Little Havana Salsa & Cafecito Night', 'Dance lessons, cafecito, and Calle Ocho energy — no experience necessary.', 'social-night', 'little-havana', 'Calle Ocho', now() + interval '7 days' + interval '20 hours', now() + interval '7 days' + interval '22 hours', 30, 'Party', 'Everyone', 12.00, 'public', 'https://images.pexels.com/photos/6529785/pexels-photo-6529785.jpeg?auto=compress&cs=tinysrgb&w=1200', false),
      ('coral-gables-photography-walk', 'Coral Gables Photography Walk', 'A slow walk through Coral Gables shooting architecture and each other. Members only.', 'photography', 'coral-gables', 'Coral Gables Downtown', now() + interval '9 days' + interval '17 hours', now() + interval '9 days' + interval '19 hours', 15, 'Creative', 'Everyone', 0, 'members_only', 'https://images.pexels.com/photos/28619432/pexels-photo-28619432.jpeg?auto=compress&cs=tinysrgb&w=1200', false)
    ) AS v(slug, title, description, activity_slug, neighborhood_slug, venue_name, start_time, end_time, max_participants, vibe, experience_level, cost, visibility, cover_image_url, is_featured)
    JOIN public.activities a ON a.slug = v.activity_slug
    JOIN public.neighborhoods n ON n.slug = v.neighborhood_slug
    ON CONFLICT (slug) DO NOTHING;

    -- Recurring cadence for 3 of the new groups (mirrors CreateGroupPage's own insert pattern).
    INSERT INTO public.recurring_groups (group_id, frequency, interval_weeks)
    SELECT g.id, 'weekly', 1
    FROM public.groups g
    WHERE g.slug IN ('sunrise-run-brickell-to-bayfront', 'wednesday-night-padel-miami-beach', 'saturday-morning-pickleball-coconut-grove')
      AND NOT EXISTS (SELECT 1 FROM public.recurring_groups rg WHERE rg.group_id = g.id);

    -- Host joins their own new demo groups for real (drives current_participants via the existing trigger).
    INSERT INTO public.group_members (group_id, user_id)
    SELECT g.id, demo_host_id
    FROM public.groups g
    WHERE g.is_demo = true
      AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = demo_host_id);
  END IF;
END $$;
