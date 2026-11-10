import { supabase } from './supabase';
import type { ApiResponse } from '@gepeto/types';
import { timeLimit, withTimeout } from './fetch-timeout';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// With weak or no signal a request can hang instead of failing. The whole
// request, including getting the login token (which may need renewing over
// the network), gives up after this long, so callers show their "check your
// signal" message instead of spinning.
const TIMEOUT_MS = 15_000;
const timedFetch = withTimeout(TIMEOUT_MS);

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await timeLimit(supabase.auth.getSession(), TIMEOUT_MS);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await timedFetch(`${BASE_URL}${path}`, { headers: await getHeaders() });
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await timedFetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: await getHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await timedFetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}
