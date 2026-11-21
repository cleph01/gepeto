// Helpers for updates the driver app queued while it had no signal and sends
// later (see apps/driver-app/lib/outbox.ts).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// How far back a queued update may be dated. Older than this, it's recorded
// at the time it arrives instead: a phone clock that's wrong, or an update
// stuck for days, shouldn't rewrite the record.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// A little leeway for a phone clock that runs slightly ahead.
const MAX_AHEAD_MS = 2 * 60 * 1000;

/**
 * When the driver actually tapped, from a queued update's `occurredAt`, as an
 * ISO string. Null when it's missing, unreadable or out of range, so the
 * caller uses the current time.
 */
export function occurredAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  if (t > now + MAX_AHEAD_MS || t < now - MAX_AGE_MS) return null;
  return new Date(Math.min(t, now)).toISOString();
}

/** A queued update's own id, used so sending it twice only counts once. */
export const clientId = (value: unknown): string | null =>
  typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
