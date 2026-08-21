interface SupabaseLikeError {
  message?: string;
  code?: string;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  '23505': 'That already exists.',
  '42501': "You don't have permission to do that.",
  '23503': "That record no longer exists.",
  '23514': "That value isn't allowed.",
};

/**
 * Turns a raw Supabase/Postgrest error into a safe, user-facing message.
 * Never returns the raw error text (which can contain column/constraint
 * names) — only a curated message for known cases, or the caller-supplied
 * fallback for anything else.
 */
export function getErrorMessage(error: SupabaseLikeError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code && FRIENDLY_MESSAGES[error.code]) {
    return FRIENDLY_MESSAGES[error.code];
  }
  return fallback;
}

/** Logs the real error for debugging. Never called with secrets — client-side Supabase errors don't carry them. */
export function logError(context: string, error: SupabaseLikeError | null | undefined): void {
  if (!error) return;
  console.error(`[${context}]`, error.message, error.code ? `(code: ${error.code})` : '');
}
