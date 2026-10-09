# Database connections

How the apps connect to Supabase Postgres, why it's set up this way, and what
to do if every API route suddenly starts failing.

## What happened (2026-10-08)

Every dispatcher-web API route started returning 500 — even `/api/jobs`, which
hadn't changed. The app looked broken, but the code was fine. It had run out of
database connections.

The analogy: the database has a front desk with **15 phone lines** (Supabase's
connection limit on the plan's session pooler). Each running app holds some
lines open so it can talk to the database quickly. When all 15 are taken, the
next caller gets a busy signal — that's the 500 error.

Two things were tying up lines:

1. **Each app held up to 10 lines, even when idle.** Knex (the library that
   talks to Postgres) defaults to a pool of 2–10 connections and keeps them
   open.
2. **Dev mode leaked lines on every code edit.** `next dev` hot-reloads code
   when files change. Each reload created a brand-new pool of connections
   without hanging up the old one. After a morning of edits, dispatcher-web
   was holding 11 lines and office-portal 4 — all 15 gone.

Restarting the dev server hung up all its lines, which is why that fixed it
immediately. It would have come back after enough edits.

## Why this matters more in production

On Vercel, the apps don't run as one long-lived server. Each burst of traffic
can spin up several separate copies ("serverless instances"), and **each copy
gets its own pool**. Ten instances × 10 connections = 100 lines needed, with
only 15 available. Without the fix, a busy morning in production would take the
app down the same way.

## The fix (commit "Cap DB connection pool, use transaction pooler")

| Change | Where | Why |
|---|---|---|
| One pool per process | `packages/db/db.js` caches the knex instance on `globalThis` | Hot reloads reuse the existing pool instead of leaking a new one |
| Small pool, closes when idle | `db.js`: `min: 0`, `max: 3` (override with `DB_POOL_MAX`), idle timeout 10s | Each app/instance holds few lines and gives them back when quiet |
| Transaction pooler for the apps | `DATABASE_URL` uses port **6543** in app env files | See below |
| Session pooler for migrations | `packages/db/.env` keeps port **5432** | Migrations need a dedicated connection for their whole run |

### Session pooler (5432) vs transaction pooler (6543)

Supabase offers two front desks on the same host:

- **Session pooler, port 5432** — you get a line for as long as you stay
  connected. Hard cap on simultaneous clients. Right for migrations and
  long-running scripts.
- **Transaction pooler, port 6543** — you only hold a line for the length of a
  single query or transaction, then it goes back to the shared pool. Many more
  app connections can share the same database. Right for web apps and
  serverless — this is what Supabase recommends for Vercel.

The transaction pooler doesn't support session features (`SET` for a session,
`LISTEN/NOTIFY`, named prepared statements, advisory locks). The app code uses
none of these — checked 2026-10-09. If something new needs them, it has to use
the 5432 URL.

## Production checklist (Vercel)

For **dispatcher-web** and **office-portal** project settings → Environment
Variables:

- [ ] `DATABASE_URL` uses `...pooler.supabase.com:6543/postgres` (not 5432)
- [ ] `DB_POOL_MAX=1` — on serverless, one connection per instance is enough;
      the transaction pooler does the sharing
- [ ] Run migrations from a machine with `packages/db/.env` on port 5432, never
      from a Vercel build step

## If it happens again

**Symptom:** many or all API routes return 500 at once, including ones that
haven't changed. Server logs show `EMAXCONNSESSION`, `max clients reached`,
`too many clients`, or `remaining connection slots are reserved`.

**Check which port is in use:** look at `DATABASE_URL` in the failing app's env.
If it's 5432, that's the likely cause — switch to 6543.

**Count open connections** (from the Supabase SQL editor):

```sql
select application_name, client_addr, state, count(*)
from pg_stat_activity
group by 1, 2, 3
order by 4 desc;
```

**Local dev quick fix:** restart the dev server. On the Mac Mini, count
connections held by each server:

```bash
for port in 3000 3001; do
  p=$(lsof -tiTCP:$port -sTCP:LISTEN)
  echo "$port: $(lsof -nP -p $p | grep -c ':5432\|:6543') connections"
done
```

**Production quick fix:** redeploy (forces fresh instances), then confirm the
checklist above. If traffic has genuinely outgrown the plan, Supabase's
Database → Settings page shows the pooler's pool size, which can be raised.
