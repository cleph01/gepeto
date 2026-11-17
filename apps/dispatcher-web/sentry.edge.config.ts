import * as Sentry from "@sentry/nextjs";
import { privacyOptions, tracesSampleRate } from "@gepeto/monitoring";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: tracesSampleRate(),
  ...privacyOptions,
});
