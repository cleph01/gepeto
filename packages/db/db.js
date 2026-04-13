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

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,

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

module.exports = db;
