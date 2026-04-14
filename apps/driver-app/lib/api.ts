import { supabase } from './supabase';
import type { ApiResponse } from '@gepeto/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: await getHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}
