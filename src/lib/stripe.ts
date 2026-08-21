import { supabase } from '@/lib/supabase';

interface CheckoutResult {
  error: string | null;
}

async function invokeCheckout(fn: string, body: Record<string, unknown> = {}): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke(fn, { body });

  if (error) {
    let message = "We couldn't start checkout. Please try again.";
    try {
      const context = (error as { context?: Response }).context;
      const parsed = await context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      /* fall back to the generic message below */
    }
    return { error: message };
  }

  if (data?.url) {
    window.location.href = data.url;
    return { error: null };
  }

  return { error: "We couldn't start checkout. Please try again." };
}

export function startEventCheckout(groupId: string): Promise<CheckoutResult> {
  return invokeCheckout('create-event-checkout', { group_id: groupId });
}

export function startMembershipCheckout(): Promise<CheckoutResult> {
  return invokeCheckout('create-membership-checkout');
}

export function startBusinessCheckout(plan: 'business' | 'business_pro'): Promise<CheckoutResult> {
  return invokeCheckout('create-business-checkout', { plan });
}

export function startConnectOnboarding(): Promise<CheckoutResult> {
  return invokeCheckout('create-connect-account-link');
}

export function openBillingPortal(kind: 'membership' | 'business'): Promise<CheckoutResult> {
  return invokeCheckout('create-billing-portal-session', { kind });
}
