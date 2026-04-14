# Gepeto — Feature Reference

This document details every app, view, and feature in the Gepeto platform as of MVP v1.0.

---

## Table of Contents

1. [dispatcher-web](#1-dispatcher-web)
2. [driver-app](#2-driver-app)
3. [office-portal](#3-office-portal)
4. [Shared Infrastructure](#4-shared-infrastructure)

---

## 1. dispatcher-web

Web dashboard for lab staff (owners and dispatchers). Deployed at `app.gepeto.com`.

### Authentication

| Feature | Detail |
|---|---|
| Email/password login | Supabase Auth; JWT stored in cookie via `@supabase/ssr` |
| Role enforcement | `requireAuth()` server-side helper; checks `app_metadata.role === "dispatcher"` |
| Protected routes | Middleware redirects unauthenticated users to `/login` |
| Session persistence | Auto-refreshed by Supabase SSR client |

---

### Views

#### `/dashboard`

The real-time operational overview.

| Feature | Detail |
|---|---|
| Live job list | All active jobs for the lab; auto-updates via Supabase Realtime |
| Live driver roster | All drivers with current status (available, on_route, off_duty); updates in real time |
| Interactive map | Leaflet + OpenStreetMap; driver pins (colored by status) + job destination dots |
| Job status badges | Color-coded: pending, assigned, picked_up, in_transit, arrived, delivered, cancelled |
| Real-time sync | `useRealtimeDashboard` hook — single Supabase channel per lab; INSERT/UPDATE/DELETE on `jobs` and `drivers` |
| Responsive layout | Two-column (map + list) on desktop; stacked on mobile |

#### `/jobs`

Full job management.

| Feature | Detail |
|---|---|
| Job list | All lab jobs, sorted newest first; columns: Case ID, Office, Driver, Status, Priority, Created |
| Status badges | Inline color-coded badges |
| Priority badges | STAT (red) vs Standard |
| Create job modal | Fields: Case ID, Office, Driver (optional), Priority, Items, Pickup Address, Delivery Address |
| Geocoding | Delivery address geocoded via Nominatim on creation; coordinates stored for map display |
| STAT alert | Email sent to all dispatcher/owner addresses the moment a STAT job is created |
| Assign driver | Driver dropdown in create modal; status auto-set to `assigned` if driver selected, `pending` otherwise |
| Responsive | Table on desktop; card list on mobile |

#### `/drivers`

Driver roster and provisioning.

| Feature | Detail |
|---|---|
| Driver list | All drivers for the lab; columns: Name, Phone, Email, Status, Joined |
| Status badges | Color-coded: available (green), on_route (blue), off_duty (gray) |
| Add driver modal | Fields: Name, Phone, Email |
| Driver provisioning | On add: (1) inserts DB row, (2) sends Supabase invite email, (3) sets `app_metadata` with role/lab_id/driver_id, (4) rollback on failure |
| Edit driver | Inline PATCH — update name, phone, or status |
| Off-duty alert | Email to dispatchers when a driver is marked off_duty |
| Responsive | Table on desktop; card list on mobile |

#### `/offices`

Office management and tracking link distribution.

| Feature | Detail |
|---|---|
| Office cards | Grid of office cards; each shows name, address, phone, contact |
| Tracking link | Each office has a unique `tracking_token`; displayed as a copyable URL (`track.gepeto.com/t/<token>`) |
| Copy link button | One-click copy to clipboard with visual feedback |
| Add office modal | Fields: Name, Address, Phone, Contact Name |
| Edit office modal | Same fields; PATCH endpoint scoped to `lab_id` |
| Token generation | `randomUUID()` on insert; immutable after creation |
| Responsive | 2-column grid on desktop; 1-column on mobile |

#### `/settings`

Lab configuration and notification preferences.

| Feature | Detail |
|---|---|
| Lab profile | Edit lab name, address, phone, city, state, zip, timezone, business hours |
| Notification preferences | Toggle unassigned job alerts and late delivery alerts; configure threshold minutes |
| Profile display | Shows logged-in user's name and role; avatar initials computed from real name |
| Persistence | Lab settings saved to `labs.settings` JSONB; notifications merged into `labs.settings.notifications` |
| Real data | All fields loaded from `/api/settings` on mount; no hardcoded seed values |

---

### API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/jobs` | List jobs (all for dispatcher, own for driver) |
| POST | `/api/jobs` | Create job; geocodes delivery address; fires STAT alert |
| GET | `/api/jobs/[id]` | Single job with office_name and driver_name |
| PATCH | `/api/jobs/[id]` | Update job status or driver assignment |
| GET | `/api/drivers` | List drivers for lab |
| POST | `/api/drivers` | Provision driver (DB + Supabase Auth invite + app_metadata) |
| PATCH | `/api/drivers/[id]` | Update driver name, phone, or status; fires off-duty alert |
| GET | `/api/offices` | List offices for lab |
| POST | `/api/offices` | Create office with auto-generated tracking_token |
| PATCH | `/api/offices/[id]` | Update office fields |
| GET | `/api/settings` | Return lab info + notification prefs + user profile |
| PATCH | `/api/settings/lab` | Update lab profile fields |
| PATCH | `/api/settings/notifications` | Merge notification preferences into settings JSONB |
| GET | `/api/cron/alerts` | Cron endpoint — sends unassigned and late delivery alerts |

---

### Email Alerts

All email is sent via **Resend**. Alerts are only sent when `RESEND_API_KEY` is set.

| Alert | Trigger | Recipients |
|---|---|---|
| STAT job created | Immediately on POST `/api/jobs` when priority = stat | All dispatcher/owner emails for the lab |
| Driver off-duty | Immediately on PATCH `/api/drivers/[id]` when status = off_duty | All dispatcher/owner emails for the lab |
| Unassigned job | Cron: pending job with no driver older than threshold (default 15 min) | All dispatcher/owner emails for the lab |
| Late delivery | Cron: in-transit job past scheduled_at by threshold (default 30 min) | All dispatcher/owner emails for the lab |

**Duplicate prevention:** `unassigned_alerted_at` and `late_alerted_at` timestamp columns on `jobs` ensure each alert fires at most once per job.

---

### Cron Job

- **Schedule:** Every 5 minutes (`*/5 * * * *`) via Vercel Cron
- **Endpoint:** `GET /api/cron/alerts`
- **Security:** `Authorization: Bearer <CRON_SECRET>` header; Vercel sends this automatically
- **Config:** `vercel.json` at project root

---

## 2. driver-app

React Native mobile app for drivers. Built with Expo + Expo Router.

> The driver-app foundation is scaffolded. Full feature implementation is in progress.

### Planned Views

| View | Description |
|---|---|
| Login | Drivers log in with the email/password set when accepting their invite |
| Job Queue | List of assigned jobs sorted by priority and scheduled time |
| Job Detail | Full job info — pickup address, delivery address, items, office contact |
| Status Updates | One-tap status progression: accepted → picked_up → in_transit → arrived → delivered |
| GPS Reporting | Background location sent to server; powers live map in dispatcher-web |
| Proof of Delivery | Camera capture; photo upload on delivery confirmation |

### Auth

Drivers receive a Supabase invite email. On first login they set a password. Subsequent logins use email/password. JWT `app_metadata` contains `role: "driver"`, `lab_id`, and `driver_id`.

---

## 3. office-portal

Public tracking portal for dental offices. Deployed at `track.gepeto.com`.

### Views

#### `/t/[token]`

The only view — a public, no-login tracking page for a specific office.

| Feature | Detail |
|---|---|
| Token-based access | Each office has a unique `tracking_token`; the URL is the auth — no login required |
| Active deliveries | Lists all non-delivered, non-cancelled jobs for the office |
| Recent deliveries | Last 3 delivered jobs for context |
| Job cards | Shows Case ID, status, driver name, pickup address, delivery address |
| 5-step progress bar | Visual progress indicator: Pending → Assigned → Picked Up → In Transit → Delivered |
| Auto-refresh | Polls `/api/track/:token` every 30 seconds |
| SSR initial load | Server component fetches initial data; no loading flash |
| Mobile optimized | Responsive card layout; driver info row wraps on narrow screens |
| Invalid token | 404 page if token is not found in the database |

### API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/track/[token]` | Public — returns active + recent delivered jobs for the office |

---

## 4. Shared Infrastructure

### Database (`packages/db`)

- **PostgreSQL** on Supabase
- **Knex.js** for migrations and query building
- **Automatic camelCase conversion** via `postProcessResponse` / `wrapIdentifier`

#### Tables

| Table | Key Columns |
|---|---|
| `labs` | id, name, address, phone, settings (JSONB) |
| `lab_users` | id, lab_id, user_id, role (owner/dispatcher) |
| `drivers` | id, lab_id, user_id, name, phone, email, status, current_location |
| `offices` | id, lab_id, name, address, phone, contact_name, tracking_token |
| `jobs` | id, lab_id, office_id, driver_id, case_id, status, priority, items, pickup_address, delivery_address, delivery_lat, delivery_lng, scheduled_at, unassigned_alerted_at, late_alerted_at |
| `messages` | id, job_id, sender_role, body, created_at |

#### Row-Level Security (RLS)

RLS is enabled on all tables. Policies use JWT claims from `auth.jwt() -> 'app_metadata'`:

- **Dispatchers:** full CRUD on rows where `lab_id` matches their JWT `lab_id`
- **Drivers:** SELECT their assigned jobs; UPDATE their own driver row
- **Public (office portal):** no RLS bypass — API routes use the Knex service-role connection

### Shared Packages

| Package | Purpose |
|---|---|
| `@gepeto/db` | Knex client instance; imported by all server-side code |
| `@gepeto/types` | TypeScript interfaces: `Job`, `Driver`, `Office`, `Message`, `Lab`, `LabUser` |
| `@gepeto/api-client` | Typed `apiFetch` wrapper used by web app pages |
| `@gepeto/ui` | Shared React components (design system) |

### Design System

See `docs/design.md` for full color palette, typography, spacing, and component specifications.

---

*Gepeto — Confidential — MVP v1.0*
