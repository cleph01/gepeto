require('dotenv').config();
const knex = require('knex');

// ─── camelCase ↔ snake_case conversion ──────────────────────────────────────

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnake(str) {
  return str.replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`);
}

function rowToCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v])
  );
}

// ─── Knex instance ───────────────────────────────────────────────────────────

// Connection budget — see docs/database-connections.md before changing.
//
// Supabase's pooler caps how many clients can connect at once. Two things
// used to blow through that cap and 500 every API route:
//   1. Next.js dev hot-reload re-runs this module on edits, and each run made
//      a new knex pool without closing the old one. Caching the instance on
//      globalThis means one pool per server process, however many reloads.
//   2. The default pool (min 2, max 10) holds connections open while idle.
//      min 0 lets idle connections close; max stays small because each app
//      process (and, on Vercel, each serverless instance) gets its own pool.
const POOL_MAX = Number(process.env.DB_POOL_MAX) || 3;

const db = globalThis.__gepetoDb ?? knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 0,
    max: POOL_MAX,
    idleTimeoutMillis: 10_000,
  },

  // Convert snake_case column names → camelCase on every query result
  postProcessResponse(result) {
    if (Array.isArray(result)) return result.map(rowToCamel);
    if (result && typeof result === 'object') return rowToCamel(result);
    return result;
  },

  // Convert camelCase identifiers → snake_case when building SQL
  wrapIdentifier(value, origImpl) {
    return origImpl(toSnake(value));
  },
});

globalThis.__gepetoDb = db;

module.exports = db;
