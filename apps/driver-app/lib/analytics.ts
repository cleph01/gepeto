import PostHog from 'posthog-react-native';
import { POSTHOG_HOST, scrubAnalyticsProps } from '@gepeto/monitoring';

/**
 * Product analytics for the driver app. Screen names only: no session replay,
 * no touch autocapture (button labels can carry case details).
 */
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const analytics = key
  ? new PostHog(key, {
      host: POSTHOG_HOST,
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
      personProfiles: 'identified_only',
      before_send: (event) => {
        if (event) scrubAnalyticsProps(event.properties as Record<string, unknown>);
        return event;
      },
    })
  : null;
