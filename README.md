<p align="center">
  <img src="gepeto-logo.png" alt="Gepeto" width="160" />
</p>

<h1 align="center">Gepeto</h1>
<p align="center"><strong>Dental Lab Delivery & Driver Tracking Platform</strong></p>
<p align="center">An Uber-style dispatch and real-time tracking system built for the dental supply chain.</p>

---

## Overview

Gepeto connects dental labs, drivers, and dental offices into a single, purpose-built logistics platform. Dispatchers create and assign delivery jobs, drivers receive and fulfill them via mobile, and dental offices track their deliveries in real time through a magic-link portal — no login required.

---

## Applications

| App | Tech | Description |
|---|---|---|
| `dispatcher-web` | Next.js 16, Tailwind CSS | Operational dashboard for lab staff — job creation, live map, driver roster |
| `driver-app` | Expo (React Native) | Mobile app for drivers — job queue, GPS reporting, proof of delivery |
| `office-portal` | Next.js 16, Tailwind CSS | Public tracking portal for dental offices — magic-link, no account needed |

---

## Monorepo Structure

```
gepeto/
  apps/
    dispatcher-web/       ← Next.js web dashboard
    driver-app/           ← Expo React Native mobile app
    office-portal/        ← Next.js public tracking portal
  packages/
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

- **Monorepo:** Turborepo + pnpm workspaces
- **Web apps:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Mobile:** Expo (React Native), TypeScript, Expo Router
- **Database:** PostgreSQL via Prisma ORM
- **Real-time:** Pusher or Ably (WebSocket-as-a-service)
- **Auth:** NextAuth.js (dispatcher) + magic-link tokens (office portal)
- **Maps:** Google Maps SDK
- **File storage:** AWS S3 (proof-of-delivery photos)

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

---

## Environment Variables

Each app uses a `.env.local` file. See the Environment Variables section in each app's README for the full variable reference.

---

## Deployment

| App | Platform | Domain |
|---|---|---|
| `dispatcher-web` | Vercel (Root Dir: `apps/dispatcher-web`) | `app.gepeto.com` |
| `office-portal` | Vercel (Root Dir: `apps/office-portal`) | `track.gepeto.com` |
| `driver-app` | Expo EAS Build → App Store / Play Store | — |

---

## Build Phases

1. **Phase 1** — Data foundation: types, Prisma schema, seed data, API routes
2. **Phase 2** — Dispatcher web: auth, dashboard, job creation, map panel
3. **Phase 3** — Driver mobile app: job queue, status updates, GPS, proof of delivery
4. **Phase 4** — Real-time layer: Pusher/Ably wiring across all apps
5. **Phase 5** — Office portal: magic-link tracking, ETA countdown, driver map

---

*Gepeto — Confidential — MVP v1.0*
