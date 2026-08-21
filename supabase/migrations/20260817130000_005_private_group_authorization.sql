/*
# Private Group Authorization

1. Problem
- `public_read_groups` only ever hid `status = 'draft'` — a group with
  `visibility = 'private'` and `status = 'active'` was fully readable by
  anyone (including anonymous users) via any client query or a direct API
  call, regardless of the "Private" lock badge the UI shows.
- `public_read_group_members` was `USING (true)` — even locking down
  `groups` itself would leave a private group's member list fully public.
- `user_join_group` had no visibility check at all — a non-member could
  insert themselves into a private or members-only group directly.

2. Fix
- `can_access_private_group(group_id)`: a SECURITY DEFINER helper (same
  pattern as the existing `is_admin()`) that returns true if the current
  user is the group's host, an existing member, has a pending invite
  (`group_invites`), or an approved request (`group_requests`) — the
  authorization relationships already modeled in the existing schema.
  Being SECURITY DEFINER, its internal lookups bypass RLS, so it can be
  safely reused inside other tables' policies without recursive-RLS
  concerns.
- `public_read_groups`: unchanged for hosts/admins (see their own groups
  regardless of status) and for public/members-only groups (unchanged,
  still publicly listable — that's intentional, not the reported bug).
  Private + non-draft groups are now only visible via
  `can_access_private_group()`.
- `group_members` SELECT: simplified to "does a visible `groups` row exist
  for this group_id" — this deliberately piggybacks on `groups`' own SELECT
  policy (which Postgres RLS applies to that subquery automatically) rather
  than re-deriving the same authorization logic a second time, so the two
  policies cannot drift out of sync.
- `user_join_group`: now requires, per visibility —
  public: anyone; members_only: an active/trialing membership (this was
  previously unenforced at the DB layer too); private:
  `can_access_private_group()`.

3. Notes
- No RLS policy is removed or weakened — every change narrows access.
- `group_requests`/`group_invites` policies are unchanged; they were
  already correctly scoped to the requester/invitee/host/admin.
- Capacity/waitlist enforcement is intentionally out of scope for this
  migration (separate, already-tracked issue).
*/

CREATE OR REPLACE FUNCTION public.can_access_private_group(check_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = check_group_id
    AND (
      g.host_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.group_invites gi WHERE gi.group_id = g.id AND gi.invitee_id = auth.uid() AND gi.status = 'pending')
      OR EXISTS (SELECT 1 FROM public.group_requests gr WHERE gr.group_id = g.id AND gr.user_id = auth.uid() AND gr.status = 'approved')
    )
  );
$$;

-- groups: SELECT now respects visibility for non-host/non-admin viewers
DROP POLICY IF EXISTS "public_read_groups" ON public.groups;
CREATE POLICY "public_read_groups" ON public.groups FOR SELECT TO anon, authenticated
  USING (
    host_id = auth.uid()
    OR public.is_admin()
    OR (
      status != 'draft'
      AND (visibility != 'private' OR public.can_access_private_group(id))
    )
  );

-- group_members: visible only where the parent group is visible
DROP POLICY IF EXISTS "public_read_group_members" ON public.group_members;
CREATE POLICY "read_group_members" ON public.group_members FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id));

-- group_members: joining now enforces visibility rules at the database
DROP POLICY IF EXISTS "user_join_group" ON public.group_members;
CREATE POLICY "user_join_group" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
      AND (
        g.visibility = 'public'
        OR (
          g.visibility = 'members_only'
          AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.status IN ('active','trialing'))
        )
        OR (g.visibility = 'private' AND public.can_access_private_group(g.id))
      )
    )
  );
