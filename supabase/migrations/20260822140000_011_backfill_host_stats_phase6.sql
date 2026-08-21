/*
# Reconcile Host Stats After Phase 6 Seed Expansion

Same one-time reconciliation as migration 008: `profiles.groups_hosted_count`
is only ever incremented by client-side code in CreateGroupPage, so the 8
demo groups added directly via SQL in migration 010 aren't reflected in it
(Home's "MEET THE HOSTS" section was showing "15 groups hosted" against the
real count of 23). Not a new mechanism — just re-running the same backfill.
*/

UPDATE public.profiles p
SET is_host = true,
    groups_hosted_count = (SELECT count(*) FROM public.groups g WHERE g.host_id = p.id)
WHERE EXISTS (SELECT 1 FROM public.groups g WHERE g.host_id = p.id);
