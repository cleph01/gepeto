// Office access codes, the sessions they unlock, and rate limiting for the
// public tracking routes. Used by dispatcher-web (shows and resets codes) and
// office-portal (checks them). Server-side only.
const crypto = require('crypto');
const db = require('./db');

const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
// No 0/O, 1/I/L: the code gets read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function deriveKey(purpose) {
  const secret = process.env.OFFICE_ACCESS_SECRET;
  if (!secret) throw new Error('OFFICE_ACCESS_SECRET is not set');
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'gepeto-office-access', purpose, 32));
}

/** A new code, e.g. "K7QM-2XPD". */
function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function encryptCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('code'), iv);
  const data = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

function decryptCode(stored) {
  const [iv, tag, data] = stored.split('.').map((s) => Buffer.from(s, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('code'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const normalize = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Constant-time check of what someone typed against the stored code. */
function codeMatches(input, stored) {
  if (!stored) return false;
  const digest = (s) => crypto.createHash('sha256').update(normalize(s)).digest();
  return crypto.timingSafeEqual(digest(input), digest(decryptCode(stored)));
}

/** One browser cookie per office. The name doesn't reveal the token. */
function sessionCookieName(token) {
  return `gepeto_office_${crypto.createHash('sha256').update(token).digest('hex').slice(0, 12)}`;
}

// A session is tied to the office, its link and its code version, so resetting
// either the link or the code signs out every device.
function sessionSignature(expires, { officeId, token, version }) {
  return crypto.createHmac('sha256', deriveKey('session'))
    .update(`${officeId}|${token}|${version}|${expires}`)
    .digest('base64url');
}

function signSession(office) {
  const expires = Date.now() + SESSION_MS;
  return `${expires}.${sessionSignature(expires, office)}`;
}

function verifySession(value, office) {
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(sessionSignature(expires, office));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Counts a hit. True when it's within `max` per `windowSeconds`. */
// The channel an unlocked page hears live changes on. Named from the secret, not
// the link, so the link alone can't tell when activity happens. A new code means
// a new channel, so someone who was locked out stops hearing it too.
function liveTopic({ token, version }) {
  const name = crypto.createHmac('sha256', deriveKey('live-topic')).update(`${token}:${version}`).digest('base64url');
  return `office:${name}`;
}

async function withinRateLimit(key, max, windowSeconds) {
  const hashed = crypto.createHash('sha256').update(key).digest('hex');
  const { rows } = await db.raw(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ?) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ?) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [hashed, windowSeconds, windowSeconds]
  );
  return rows[0].count <= max;
}

module.exports = {
  SESSION_DAYS,
  generateCode,
  encryptCode,
  decryptCode,
  codeMatches,
  sessionCookieName,
  signSession,
  verifySession,
  liveTopic,
  withinRateLimit,
};
