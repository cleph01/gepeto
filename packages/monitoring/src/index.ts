/**
 * Shared Sentry privacy settings for every Gepeto app.
 *
 * Gepeto carries patient-adjacent data (case notes, messages, delivery photos)
 * and secret office tracking links (/t/<token>). Error reports go to a third
 * party, so they get stack traces, routes and app versions, never content.
 *
 * - No request/response bodies, cookies, query strings or DB query parameters.
 * - Tracking tokens in URLs are replaced with [token]; query strings and
 *   fragments (invite and reset tokens) are dropped.
 * - Console breadcrumbs are dropped: logs can contain message text.
 * - No Session Replay or user identity from the SDK.
 */

// Kept loose on purpose so the Next and React Native SDKs can both use it.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyEvent = any;
type AnyBreadcrumb = any;

// Office tracking secrets appear as /t/<token> (pages) and /api/track/<token> (API).
const TRACKING_PATH = /\/(t|track)\/[^/?#]+/g;

export function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.split("#")[0]!.split("?")[0]!.replace(TRACKING_PATH, "/$1/[token]");
}

export function scrubBreadcrumb(crumb: AnyBreadcrumb): AnyBreadcrumb | null {
  if (crumb.category === "console") return null;
  if (crumb.data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof crumb.data[key] === "string") crumb.data[key] = scrubUrl(crumb.data[key]);
    }
    delete crumb.data.body;
    delete crumb.data.input;
  }
  if (typeof crumb.message === "string") crumb.message = crumb.message.replace(TRACKING_PATH, "/$1/[token]");
  return crumb;
}

export function scrubEvent<E extends AnyEvent>(event: E): E {
  const e = event as AnyEvent;
  if (e.request) {
    e.request.url = scrubUrl(e.request.url);
    delete e.request.data;
    delete e.request.cookies;
    delete e.request.query_string;
    if (e.request.headers) {
      const ua = e.request.headers["user-agent"] ?? e.request.headers["User-Agent"];
      e.request.headers = ua ? { "user-agent": ua } : {};
    }
  }
  if (typeof e.transaction === "string") e.transaction = e.transaction.replace(TRACKING_PATH, "/$1/[token]");
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
  }
  if (e.user) {
    // Keep only the id we set ourselves (staff can look the person up in the console).
    e.user = e.user.id ? { id: e.user.id } : undefined;
  }
  return event;
}

/** Spread into every Sentry.init call. */
export const privacyOptions = {
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { allow: ["user-agent", "content-type"] },
    httpBodies: [] as never[],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  beforeSend: (event: AnyEvent) => scrubEvent(event),
  beforeSendTransaction: (event: AnyEvent) => scrubEvent(event),
  beforeBreadcrumb: (crumb: AnyBreadcrumb) => scrubBreadcrumb(crumb),
};

export function tracesSampleRate(): number {
  return process.env.NODE_ENV === "development" ? 1.0 : 0.1;
}

// ── PostHog (product analytics) ─────────────────────────────────────────────

/** Scrub every URL-like property on a PostHog event (current URL, pathname, referrer…). */
export function scrubAnalyticsProps(props: Record<string, unknown> | undefined) {
  if (!props) return props;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string" && (v.includes("/t/") || v.includes("/track/") || v.includes("?") || v.includes("#"))) {
      if (k.startsWith("$") || k.endsWith("url") || k.endsWith("path") || k.endsWith("pathname") || k.endsWith("referrer")) {
        props[k] = scrubUrl(v);
      }
    }
  }
  return props;
}

export const POSTHOG_HOST = "https://us.i.posthog.com";
