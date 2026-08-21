/*
# Protect Privileged Profile Fields

1. Problem
- The `owner_insert_profile` and `owner_update_profile` RLS policies on
  `public.profiles` are row-scoped (`auth.uid() = id`), not column-scoped.
  Postgres RLS has no native column-level restriction, so any authenticated
  user could insert or update their own row and set `is_admin`, `is_founder`,
  `founder_number`, or `host_verified` directly via the client SDK — a
  privilege-escalation vulnerability.

2. Fix
- A BEFORE INSERT OR UPDATE trigger on `public.profiles` forces those four
  columns back to a safe value whenever the caller is not trusted:
  - INSERT: forced to their column defaults (false/false/null/false),
    regardless of what the client submitted.
  - UPDATE: forced back to the row's current (OLD) value, so any other
    fields in the same request still save normally.
- "Trusted" means: an existing admin (via the pre-existing is_admin()
  helper), a service_role caller (Edge Functions / webhooks), or a request
  with no PostgREST JWT context at all (direct SQL — the SQL editor or a
  migration). The last case exists so the first admin can ever be bootstrapped;
  every request that goes through the public anon/authenticated API always
  carries a JWT role claim, so this bypass is not reachable from the app.

3. Notes
- No existing RLS policy is removed or weakened.
- No app code path currently writes these columns (verified against
  src/lib/auth.tsx, src/pages/ProfilePage.tsx, src/pages/OnboardingPage.tsx,
  src/pages/CreateGroupPage.tsx), so this has no effect on existing
  functionality.
*/

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Trusted callers: existing admins, service_role, or direct DB sessions
  -- (no JWT context at all — SQL editor / migrations). Every request through
  -- the public anon/authenticated API always carries a JWT role claim, so
  -- this branch is unreachable from the app itself.
  IF public.is_admin() OR auth.role() = 'service_role' OR auth.role() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_founder := OLD.is_founder;
    NEW.founder_number := OLD.founder_number;
    NEW.host_verified := OLD.host_verified;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.is_founder := false;
    NEW.founder_number := NULL;
    NEW.host_verified := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged_fields ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_profile_fields();
