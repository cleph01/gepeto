// Converts snake_case keys from Supabase Postgres responses to camelCase
// to match our shared @gepeto/types definitions.

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function rowToCamel<T>(obj: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v])
  ) as T;
}
