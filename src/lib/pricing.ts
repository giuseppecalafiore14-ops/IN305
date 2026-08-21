export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

export interface EventEconomics {
  grossRevenue: number;
  platformFee: number;
  netEarnings: number;
}

/** Live estimate only — there are no real transactions until Stripe is connected. */
export function calculateEventEconomics(
  ticketPrice: number,
  participants: number,
  feePercent: number = DEFAULT_PLATFORM_FEE_PERCENT
): EventEconomics {
  const grossRevenue = Math.max(0, ticketPrice) * Math.max(0, participants);
  const platformFee = grossRevenue * (feePercent / 100);
  const netEarnings = grossRevenue - platformFee;
  return { grossRevenue, platformFee, netEarnings };
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export const BUSINESS_PLANS = {
  business: {
    key: 'business' as const,
    name: 'Business',
    price: 79,
    positioning: 'Get discovered by Miami locals and turn events into recurring customers.',
    cta: 'Choose Business',
    features: [
      'Business profile',
      'Discover placement',
      'Create events',
      'Create offers',
      'Recurring events',
      'Community management',
      'Basic analytics',
      'Basic lead generation',
      'Host collaboration',
    ],
  },
  business_pro: {
    key: 'business_pro' as const,
    name: 'Business Pro',
    price: 199,
    positioning: 'Turn IN305 into your local growth engine.',
    cta: 'Go Pro',
    features: [
      'Everything in Business',
      'Featured placement',
      'Event promotion',
      'Advanced analytics',
      'Advanced lead generation',
      'Priority partnership opportunities',
      'Sponsored IN305 events',
      'Premium visibility',
      'Advanced community insights',
    ],
  },
} as const;
