export type MembershipStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'inactive';
export type BusinessSubscriptionStatus = 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';
export type TicketStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type ConnectAccountStatus = 'not_connected' | 'pending' | 'active' | 'restricted';

export type GroupVisibility = 'public' | 'members_only' | 'private';
export type GroupStatus = 'draft' | 'active' | 'full' | 'completed' | 'canceled';

export type Vibe = 'Chill' | 'Social' | 'Active' | 'Competitive' | 'Creative' | 'Professional' | 'Party' | 'Wellness';
export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Everyone';

export interface ActivityCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface Activity {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  icon: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export interface PricingConfig {
  id: number;
  monthly_price: number;
  annual_price: number | null;
  founder_price: number | null;
  founder_limit: number;
  currency: string;
  is_active: boolean;
  platform_fee_percent: number;
}

export interface BusinessSubscription {
  id: string;
  partner_id: string;
  plan: 'business' | 'business_pro';
  status: BusinessSubscriptionStatus;
  current_period_end: string | null;
  canceled_at: string | null;
}

export interface EventTicket {
  id: string;
  group_id: string;
  buyer_id: string;
  host_id: string;
  amount: number;
  platform_fee: number;
  host_amount: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: TicketStatus;
  payout_status: PayoutStatus;
  stripe_transfer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HostPayoutAccount {
  id: string;
  host_id: string;
  stripe_connect_account_id: string | null;
  status: ConnectAccountStatus;
  payouts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  neighborhood_id: string | null;
  languages: string[];
  interests: string[];
  activities: string[];
  preferred_vibes: string[];
  preferred_group_size: number | null;
  preferred_times: string[];
  is_admin: boolean;
  is_host: boolean;
  is_founder: boolean;
  founder_number: number | null;
  host_verified: boolean;
  groups_joined_count: number;
  groups_hosted_count: number;
  created_at: string;
  updated_at: string;
  membership?: Membership | null;
}

export interface Membership {
  user_id: string;
  status: MembershipStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  is_founder: boolean;
  founder_number: number | null;
}

export interface Group {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  activity_id: string | null;
  host_id: string;
  neighborhood_id: string | null;
  venue_name: string | null;
  meeting_point: string | null;
  address: string | null;
  start_time: string;
  end_time: string | null;
  max_participants: number;
  current_participants: number;
  vibe: string | null;
  experience_level: string | null;
  cost: number;
  visibility: GroupVisibility;
  status: GroupStatus;
  cover_image_url: string | null;
  recurring_group_id: string | null;
  is_featured: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringGroup {
  frequency: 'weekly' | 'biweekly' | 'custom';
  interval_weeks: number;
  day_of_week: number | null;
}

export interface GroupWithRelations extends Group {
  activity?: Activity | null;
  neighborhood?: Neighborhood | null;
  host?: Profile | null;
  recurring?: RecurringGroup[] | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  attendance_status: string;
  profile?: Profile;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string | null;
  body: string;
  is_system: boolean;
  reactions: Record<string, string[]>;
  created_at: string;
  sender?: Profile | null;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  activity_id: string | null;
  neighborhood_id: string | null;
  venue_name: string | null;
  address: string | null;
  start_time: string;
  end_time: string | null;
  max_participants: number | null;
  current_participants: number;
  price: number;
  membership_required: boolean;
  external_url: string | null;
  cover_image_url: string | null;
  is_official: boolean;
  is_featured: boolean;
  is_demo: boolean;
  status: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: string;
  item_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  group_id: string;
  user_id: string;
  rating: number;
  would_do_again: boolean | null;
  would_meet_again: boolean | null;
  comment: string | null;
  created_at: string;
  profile?: Profile | null;
}

export interface Host {
  id: string;
  user_id: string;
  groups_hosted: number;
  groups_completed: number;
  total_participants: number;
  average_rating: number;
  status: 'new' | 'verified' | 'top' | 'suspended';
}

export interface Partner {
  id: string;
  owner_id: string | null;
  slug: string | null;
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  category: string | null;
  neighborhood_id: string | null;
  neighborhood?: Neighborhood | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  status: 'pending' | 'approved' | 'active' | 'declined';
  is_demo: boolean;
  created_at: string;
}

export interface PartnerOffer {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface PartnerInquiry {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  category: string | null;
  neighborhood: string | null;
  partnership_idea: string | null;
  status: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_group_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}
