/**
 * Shared select strings for Supabase queries used across multiple pages.
 *
 * GROUP_SELECT nests the host's membership under the host profile
 * (`host:profiles(*, membership:memberships(*))`) rather than as a sibling
 * `memberships!host_id(*)` embed on `groups` directly — there is no foreign
 * key between `groups` and `memberships` for PostgREST to resolve that way
 * (only `groups.host_id -> profiles.id` and `memberships.user_id ->
 * profiles.id` exist independently), so the sibling form always failed with
 * PGRST200 and silently returned zero rows to every caller.
 */
export const GROUP_SELECT =
  '*, activity:activities(*), neighborhood:neighborhoods(*), host:profiles(*, membership:memberships(*)), recurring:recurring_groups(frequency, interval_weeks, day_of_week)';
