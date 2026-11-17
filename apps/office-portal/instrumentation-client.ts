import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { POSTHOG_HOST, privacyOptions, scrubAnalyticsProps, tracesSampleRate } from "@gepeto/monitoring";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: tracesSampleRate(),
  // No Session Replay: screens show patient-adjacent case info.
  ...privacyOptions,
});

// Product analytics. No recordings, no element text, tracking links scrubbed.
if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_HOST,
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    disable_surveys: true,
    before_send: (event) => {
      if (event) scrubAnalyticsProps(event.properties);
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
