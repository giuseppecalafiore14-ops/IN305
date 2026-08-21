import type { Profile, Membership, Group } from '@/types';

export function isActiveMember(membership: Membership | null): boolean {
  return membership?.status === 'active' || membership?.status === 'trialing';
}

export function isFounder(membership: Membership | null): boolean {
  return membership?.is_founder === true;
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.is_admin === true;
}

export function isHost(profile: Profile | null): boolean {
  return profile?.is_host === true;
}

export function canCreateGroup(membership: Membership | null): boolean {
  return isActiveMember(membership);
}

export function canCreatePrivateGroup(membership: Membership | null): boolean {
  return isActiveMember(membership);
}

export function canJoinMemberGroup(membership: Membership | null): boolean {
  return isActiveMember(membership);
}

export function canAccessMemberExperience(membership: Membership | null): boolean {
  return isActiveMember(membership);
}

export function isGroupHost(userId: string, group: Group): boolean {
  return group.host_id === userId;
}

export function canJoinGroup(group: Group, membership: Membership | null): boolean {
  if (group.status === 'full') return false;
  if (group.visibility === 'members_only' && !isActiveMember(membership)) return false;
  // Private groups are no longer blocked here: the database RLS policy
  // (user_join_group) is the real enforcement layer. If this group object
  // was loaded at all, the viewer already passed the SELECT-level
  // authorization check (host, member, or invited/approved), so an actual
  // join attempt is a database decision, not a client one.
  return true;
}
