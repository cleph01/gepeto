import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Expo's static web render runs this module in Node, where AsyncStorage's web
// backend touches `window` and crashes the dev server. Skip storage there;
// phones and real browsers are unaffected.
const isServerRender = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServerRender ? undefined : AsyncStorage,
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});

let channelSeq = 0;

/**
 * A realtime channel name that's unique per subscription. supabase.channel()
 * returns the existing channel when the name is already in use, and adding
 * callbacks to one that's subscribed throws, which happens when the same
 * screen is open twice (e.g. a job opened from the new-job alert while its
 * detail screen is already on the stack).
 */
export function channelName(base: string): string {
  channelSeq += 1;
  return `${base}:${channelSeq}`;
}
