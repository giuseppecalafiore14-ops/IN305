/*
# Groups, Group Members, Events, and Related Tables

1. New Tables
- `groups` — the core product unit. A small social group doing an activity at a date/time/place. Has host, activity, neighborhood, capacity, vibe, experience, visibility (public/members_only/private), cost, recurrence info, cover image, and status.
- `group_members` — join table linking users to groups they've joined. Tracks attendance status and join time.
- `group_requests` — for private groups: users request to join, host/admin approves.
- `group_invites` — host invites specific users to a private group.
- `group_waitlist` — when a group is full, users can waitlist; notified when a spot opens.
- `group_messages` — chat messages within a group. Supports text, system messages, and reactions.
- `events` — larger/official IN305 experiences (tournaments, boat days, parties). Separate from groups. Has capacity, price, membership requirement, external URL.
- `event_participants` — join table for event RSVPs.
- `recurring_groups` — template for weekly/biweekly/custom recurrence. Groups reference this for recurring series.

2. Security
- groups: public read (visitors browse); owner (host) insert/update/delete; admin write.
- group_members: members read (anyone can see who joined); authenticated insert own row (join); owner/admin update/delete own row (leave) or admin delete any.
- group_requests: owner insert (request); group host + admin read/update (approve/deny).
- group_invites: host + admin read/write.
- group_waitlist: owner insert (waitlist); host + admin read; owner delete (leave waitlist).
- group_messages: group members read; members insert; owner update/delete own message; host + admin delete any.
- events: public read; admin write.
- event_participants: public read; authenticated insert own; owner/admin delete own.

3. Notes
- Groups have a CHECK on visibility ('public','members_only','private') and status ('draft','active','full','completed','canceled').
- group_members has a UNIQUE(user_id, group_id) to prevent double joins.
- A trigger maintains current_participants counter on group_members insert/delete.
*/

-- Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  activity_id uuid REFERENCES public.activities(id),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  venue_name text,
  meeting_point text,
  address text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  max_participants int NOT NULL DEFAULT 8,
  current_participants int NOT NULL DEFAULT 0,
  vibe text,
  experience_level text,
  cost numeric(10,2) DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'active',
  cover_image_url text,
  recurring_group_id uuid,
  is_featured boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_visibility_check CHECK (visibility IN ('public','members_only','private')),
  CONSTRAINT group_status_check CHECK (status IN ('draft','active','full','completed','canceled'))
);
CREATE INDEX IF NOT EXISTS idx_groups_activity ON public.groups(activity_id);
CREATE INDEX IF NOT EXISTS idx_groups_neighborhood ON public.groups(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_groups_host ON public.groups(host_id);
CREATE INDEX IF NOT EXISTS idx_groups_start_time ON public.groups(start_time);
CREATE INDEX IF NOT EXISTS idx_groups_visibility ON public.groups(visibility);
CREATE INDEX IF NOT EXISTS idx_groups_status ON public.groups(status);

-- Recurring groups (templates)
CREATE TABLE IF NOT EXISTS public.recurring_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  interval_weeks int NOT NULL DEFAULT 1,
  day_of_week int,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_freq_check CHECK (frequency IN ('weekly','biweekly','custom'))
);

-- Group members
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  attendance_status text NOT NULL DEFAULT 'going',
  CONSTRAINT group_member_unique UNIQUE (group_id, user_id),
  CONSTRAINT attendance_check CHECK (attendance_status IN ('going','waitlist','attended','no_show','left'))
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);

-- Group requests (for private groups)
CREATE TABLE IF NOT EXISTS public.group_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_status_check CHECK (status IN ('pending','approved','denied')),
  CONSTRAINT request_unique UNIQUE (group_id, user_id)
);

-- Group invites
CREATE TABLE IF NOT EXISTS public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_status_check CHECK (status IN ('pending','accepted','declined')),
  CONSTRAINT invite_unique UNIQUE (group_id, invitee_id)
);

-- Group waitlist
CREATE TABLE IF NOT EXISTS public.group_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position int NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_unique UNIQUE (group_id, user_id)
);

-- Group messages (chat)
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  reactions jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  activity_id uuid REFERENCES public.activities(id),
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  venue_name text,
  address text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  max_participants int,
  current_participants int NOT NULL DEFAULT 0,
  price numeric(10,2) DEFAULT 0,
  membership_required boolean NOT NULL DEFAULT false,
  external_url text,
  cover_image_url text,
  is_official boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_status_check CHECK (status IN ('draft','active','full','completed','canceled'))
);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_neighborhood ON public.events(neighborhood_id);

-- Event participants
CREATE TABLE IF NOT EXISTS public.event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_participant_unique UNIQUE (event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Groups: public read (active + non-draft), host insert/update/delete, admin write
DROP POLICY IF EXISTS "public_read_groups" ON public.groups;
CREATE POLICY "public_read_groups" ON public.groups FOR SELECT TO anon, authenticated
  USING (status != 'draft' OR host_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "host_insert_group" ON public.groups;
CREATE POLICY "host_insert_group" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
DROP POLICY IF EXISTS "host_update_group" ON public.groups;
CREATE POLICY "host_update_group" ON public.groups FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin()) WITH CHECK (host_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "host_delete_group" ON public.groups;
CREATE POLICY "host_delete_group" ON public.groups FOR DELETE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin());

-- Recurring groups: visible to group host + admin
DROP POLICY IF EXISTS "host_read_recurring" ON public.recurring_groups;
CREATE POLICY "host_read_recurring" ON public.recurring_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "host_write_recurring" ON public.recurring_groups;
CREATE POLICY "host_write_recurring" ON public.recurring_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));

-- Group members: public read, authenticated insert own, owner/admin delete own
DROP POLICY IF EXISTS "public_read_group_members" ON public.group_members;
CREATE POLICY "public_read_group_members" ON public.group_members FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "user_join_group" ON public.group_members;
CREATE POLICY "user_join_group" ON public.group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_leave_group" ON public.group_members;
CREATE POLICY "user_leave_group" ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "admin_delete_group_member" ON public.group_members;
CREATE POLICY "admin_delete_group_member" ON public.group_members FOR DELETE TO authenticated USING (public.is_admin());

-- Group requests: owner insert, host+admin read/update
DROP POLICY IF EXISTS "owner_insert_request" ON public.group_requests;
CREATE POLICY "owner_insert_request" ON public.group_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "read_group_requests" ON public.group_requests;
CREATE POLICY "read_group_requests" ON public.group_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "host_update_request" ON public.group_requests;
CREATE POLICY "host_update_request" ON public.group_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));

-- Group invites: host+admin read/write
DROP POLICY IF EXISTS "read_group_invites" ON public.group_invites;
CREATE POLICY "read_group_invites" ON public.group_invites FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "host_write_invites" ON public.group_invites;
CREATE POLICY "host_write_invites" ON public.group_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));

-- Group waitlist: owner insert, host+admin read, owner delete
DROP POLICY IF EXISTS "owner_waitlist_insert" ON public.group_waitlist;
CREATE POLICY "owner_waitlist_insert" ON public.group_waitlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "read_waitlist" ON public.group_waitlist;
CREATE POLICY "read_waitlist" ON public.group_waitlist FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.host_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "owner_leave_waitlist" ON public.group_waitlist;
CREATE POLICY "owner_leave_waitlist" ON public.group_waitlist FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Group messages: group members read, members insert, owner update/delete own, host+admin delete any
DROP POLICY IF EXISTS "members_read_messages" ON public.group_messages;
CREATE POLICY "members_read_messages" ON public.group_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_messages.group_id AND g.host_id = auth.uid())
     OR public.is_admin());
DROP POLICY IF EXISTS "members_insert_message" ON public.group_messages;
CREATE POLICY "members_insert_message" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()));
DROP POLICY IF EXISTS "owner_update_message" ON public.group_messages;
CREATE POLICY "owner_update_message" ON public.group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS "host_admin_delete_message" ON public.group_messages;
CREATE POLICY "host_admin_delete_message" ON public.group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_messages.group_id AND g.host_id = auth.uid()) OR public.is_admin());

-- Events: public read, admin write
DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events" ON public.events FOR SELECT TO anon, authenticated
  USING (status != 'draft' OR public.is_admin());
DROP POLICY IF EXISTS "admin_write_events" ON public.events;
CREATE POLICY "admin_write_events" ON public.events FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Event participants: public read, authenticated insert own, owner/admin delete own
DROP POLICY IF EXISTS "public_read_event_participants" ON public.event_participants;
CREATE POLICY "public_read_event_participants" ON public.event_participants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "user_join_event" ON public.event_participants;
CREATE POLICY "user_join_event" ON public.event_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_leave_event" ON public.event_participants;
CREATE POLICY "user_leave_event" ON public.event_participants FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Triggers: maintain current_participants counter on group_members
CREATE OR REPLACE FUNCTION public.update_group_participant_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.groups SET current_participants = current_participants + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.groups SET current_participants = GREATEST(current_participants - 1, 0) WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS group_members_count_trigger ON public.group_members;
CREATE TRIGGER group_members_count_trigger
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_group_participant_count();
