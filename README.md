<p align="center">
  <img src="gepeto-logo.png" alt="Gepeto" width="160" />
</p>

<h1 align="center">Gepeto</h1>
<p align="center"><strong>Dental Lab Delivery & Driver Tracking Platform</strong></p>
<p align="center">An Uber-style dispatch and real-time tracking system built for the dental supply chain.</p>

---

## Overview

Gepeto connects dental labs, drivers, and dental offices into a single, purpose-built logistics platform. Dispatchers create and assign delivery jobs, drivers receive and fulfill them via mobile, and dental offices track their deliveries in real time through a token-based portal — no login required.

---

## Applications

| App | Tech | Description |
|---|---|---|
| `dispatcher-web` | Next.js 16, Tailwind CSS | Operational dashboard for lab staff — job creation, live map, driver roster, offices, settings |
| `driver-app` | Expo (React Native) | Mobile app for drivers — job queue, GPS reporting, proof of delivery |
| `office-portal` | Next.js 16, Tailwind CSS | Public tracking portal for dental offices — token URL, no account needed |

---

## Monorepo Structure

```
gepeto/
  apps/
    dispatcher-web/       ← Next.js web dashboard
    driver-app/           ← Expo React Native mobile app
    office-portal/        ← Next.js public tracking portal
  packages/
    db/                   ← Knex.js client + migrations + seed data
    types/                ← Shared TypeScript interfaces (Job, Driver, Office, Message)
    api-client/           ← Typed fetch wrappers used by all three apps
    ui/                   ← Shared design system (buttons, badges, cards)
    eslint-config/        ← Shared ESLint config
    typescript-config/    ← Shared tsconfig base
  turbo.json
  pnpm-workspace.yaml
  package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Web apps | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Mobile | Expo (React Native), TypeScript, Expo Router |
| Database | PostgreSQL on Supabase, Knex.js (migrations + query builder) |
| Auth | Supabase Auth — email/password (dispatchers), invite link (drivers), token URL (offices) |
| Real-time | Supabase Realtime (`postgres_changes` subscriptions) |
| Maps | Leaflet + OpenStreetMap (dispatcher dashboard) |
| Geocoding | Nominatim (free, no API key) |
| Email | Resend — transactional alerts |
| Cron | Vercel Cron (`*/5 * * * *`) for time-based alerts |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

```sh
npm install -g pnpm
```

### Install dependencies

```sh
pnpm install
```

### Run all apps in development

```sh
pnpm dev
```

### Run a single app

```sh
pnpm dev --filter=dispatcher-web
pnpm dev --filter=office-portal
pnpm dev --filter=driver-app
```

### Build all apps

```sh
pnpm build
```

### Type check

```sh
pnpm check-types
```

### Run database migrations

```sh
cd packages/db
npx knex migrate:latest
npx knex seed:run   # optional seed data
```

---

## Environment Variables

### `apps/dispatcher-web/.env.local`

```env
# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres.<project>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres

NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Email (Resend — resend.com)
RESEND_API_KEY=

# App URL (used in email CTAs)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Tracking portal base URL (used to build office tracking links)
NEXT_PUBLIC_TRACKING_BASE_URL=http://localhost:3001

# Cron security (set the same value in Vercel project settings)
CRON_SECRET=
```

### `apps/office-portal/.env.local`

```env
DATABASE_URL=postgresql://postgres.<project>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

---

## Deployment

| App | Platform | Domain |
|---|---|---|
| `dispatcher-web` | Vercel (Root Dir: `apps/dispatcher-web`) | `app.gepeto.com` |
| `office-portal` | Vercel (Root Dir: `apps/office-portal`) | `track.gepeto.com` |
| `driver-app` | Expo EAS Build → App Store / Play Store | — |

Vercel Cron runs automatically on the `dispatcher-web` deployment — no additional configuration needed beyond setting `CRON_SECRET` in the project environment variables.

---

## Multi-Tenant Architecture

Each lab is an independent tenant. Row-Level Security (RLS) on Supabase enforces isolation at the database layer using JWT claims (`lab_id`, `role`, `driver_id`) stored in Supabase Auth `app_metadata`.

- **Dispatchers** — full CRUD on their lab's data
- **Drivers** — read their assigned jobs, update their own driver row
- **Offices** — read-only access via opaque `tracking_token` (no auth)

---

## Features

See [FEATURES.md](FEATURES.md) for a detailed breakdown of all apps, views, and features.

---

*Gepeto — Confidential — MVP v1.0*
