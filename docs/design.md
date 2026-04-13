# Gepeto — Design System & Visual Language

Last updated: 2026-04-12

---

## Philosophy

Clean SaaS — think Stripe, Linear, Loom. Not a flashy consumer app, not a cluttered healthcare portal. Confident, direct, and fast-feeling. Dense and professional for internal ops UIs (dispatcher dashboard); open and inviting for public-facing surfaces (landing page, office portal).

---

## Color Palette

### Brand colors (all apps)

| Token | Hex | Use |
|---|---|---|
| Primary blue | `#185FA5` | CTAs, links, active states, accents |
| Success green | `#3B6D11` | Delivered badges, checkmarks, positive states |
| Warning amber | `#854F0B` | Priority flags, caution callouts |
| Error red | `#A32D2D` | Failed states, destructive actions |
| Neutral gray | `#5F5E5A` | Secondary text, borders, muted UI |

### Landing page extended palette

| Role | Color | Use |
|---|---|---|
| Hero background | `#0F1B2D` | Hero + CTA footer dark wash — gives gravity |
| Surface light | `#F8F9FB` | Alternating section backgrounds |
| White | `#FFFFFF` | Cards, forms, open sections |
| Text primary | `#111827` | Headings, body on light bg |
| Text secondary | `#6B7280` | Captions, supporting copy, metadata |

**Rule:** Keep it blue + neutrals as the dominant palette. Green and amber are accent-only — never decorative.

---

## Typography

- **Font family:** Inter (web), system font stack (mobile/driver app)
- **Weights:**
  - 400 — body copy, captions
  - 500 — UI labels, nav items, table cells
  - 600 — headings in app UIs (dispatcher, office portal)
  - 700 — headings on landing page (marketing needs more punch)
- **Hero headline:** `clamp(2.5rem, 5vw, 3.5rem)` — scales gracefully from mobile to desktop
- **No decorative or display fonts** — Inter carries the brand consistently

---

## Spacing & Shape

- **Base unit:** 4px
- **Component spacing:** multiples of 4 (8, 12, 16, 24, 32, 48, 64)
- **Badge radius:** 8px
- **Card radius:** 12px
- **Button radius:** 8px
- **Input radius:** 8px
- **Min tap target:** 44px (mobile)

---

## Layout

### App UIs (dispatcher-web, office-portal)
- Dense, professional ops UI — information density over whitespace
- Dispatcher: persistent split-panel (job list left, map right) — never tabbed
- Max content width: 1280px

### Landing page
- **Mobile-first:** single column, generous vertical rhythm
- **Desktop breakpoint:** 1100px max-width, centered
- Sections break into 2-col layouts where it adds clarity (features grid, how-it-works steps)
- Sticky nav on scroll with blur backdrop (`backdrop-blur`)
- Smooth scroll anchors to each section

---

## Landing Page — Section Design

### Hero
- Full-bleed dark background (`#0F1B2D`)
- Logo top-left (white version), nav links right
- Bold white headline + 1-line sub-copy
- Inline email sign-up field + "Get Started" primary CTA button
- Subtle background gradient or abstract illustration — no stock photography

### Problem
- White background
- 3 pain-point cards with icons
- Conversational, relatable copy — speaks to the dispatcher's daily frustration

### How It Works
- Light gray background (`#F8F9FB`)
- Numbered steps (1–3) with role labels: **Lab · Driver · Office**
- Simple connecting line between steps on desktop
- Each step has an icon + short description

### Features
- White background
- 2×3 icon grid
- Short feature blurbs — no marketing fluff, describe what it actually does

### CTA Footer
- Dark background (matches hero — `#0F1B2D`)
- Large email sign-up form as the primary action
- "Or schedule a demo" as a secondary text link below the form

---

## CTA Hierarchy (Landing Page)

1. **Primary:** Inline sign-up (get them in immediately)
2. **Secondary:** "Request a demo" — available but not pushed; for leads who need more convincing

---

## What to Avoid

- Stock dental photography — generic and trust-killing
- More than 2 brand accent colors in any single view
- Heavy gradients or glassmorphism — too trendy, ages fast
- Tabbed layouts in the dispatcher dashboard — always use split-panel
- PHI or case-specific data in logs, error messages, or URLs
