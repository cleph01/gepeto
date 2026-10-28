import type { Session } from '@supabase/supabase-js';

/**
 * The drivers-table UUID for the signed-in driver.
 *
 * Read from app_metadata first: that's what the invite flow sets and what the
 * database RLS policies check, so it's the one that actually returns jobs.
 * user_metadata is only a fallback for older seeded accounts. It's also
 * user-editable, so RLS never trusts it.
 */
export function getDriverId(session: Session | null): string | undefined {
  return (session?.user.app_metadata?.driver_id ?? session?.user.user_metadata?.driver_id) as
    | string
    | undefined;
}
