/*
# Backfill Host Stats for Seeded Demo Groups

`profiles.groups_hosted_count` is only ever incremented by client-side code
in CreateGroupPage when a group is published through the app — it isn't
maintained by a trigger. The demo groups seeded in 007 were inserted
directly in SQL, bypassing that client-side counter, so the host's own
profile was showing "0 groups hosted" despite genuinely hosting 15 demo
groups. This is a one-time reconciliation, not a new mechanism.
*/

UPDATE public.profiles p
SET is_host = true,
    groups_hosted_count = (SELECT count(*) FROM public.groups g WHERE g.host_id = p.id)
WHERE EXISTS (SELECT 1 FROM public.groups g WHERE g.host_id = p.id);
