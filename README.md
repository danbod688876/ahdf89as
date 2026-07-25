# Household Dashboard

A shared dashboard for two people running Outlook + Gmail: merged calendar, goals, reminders,
vacation planning, home/vehicle/garden maintenance, and an AI-assisted garden module. See
`docs/spec.md` for the full product spec this scaffold implements.

## Stack

- **Next.js 16** (App Router, TypeScript) — one deployable app, API routes as serverless functions
- **Drizzle ORM** + **Postgres** (Neon `neon-http` driver — fits Vercel's serverless model, no connection pool to manage)
- **Auth.js (NextAuth v5 beta)** — Google + Microsoft Entra ID, with calendar write scopes for §2.6
- **Tailwind v4** — palette/type tokens from spec §6 live in `src/app/globals.css`
- **Claude API** (`@anthropic-ai/sdk`) — garden voice/photo capture and care advice (spec §2.7)

## Project layout

```
src/
  app/
    page.tsx                 dashboard shell
    api/                     route handlers (one folder per module)
  components/
    modules/                 Calendar, Goals, Reminders, Trips, Maintenance, Garden
    ui/                      ModuleCard, ExpandableSection, Badge, OrganicDivider
  lib/
    db/                      Drizzle schema, client, read queries
    integrations/            Claude, plant ID, plant data, weather, calendar-push
    notifications/           unified due-date engine (spec §4.5)
    auth.ts                  NextAuth config
```

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum to run the dashboard
npm run db:generate          # generate SQL migrations from src/lib/db/schema.ts
npm run db:migrate           # apply them
npm run dev
```

The dashboard page (`src/app/page.tsx`) reads live from Postgres, so `DATABASE_URL` is required
even for local development. Everything else in `.env.example` degrades gracefully when unset:
OAuth sign-in just won't work, and the garden AI routes return a `502` telling the client to fall
back to manual entry (per spec §4.6) rather than crashing.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a Postgres database (Vercel Postgres, or bring your own Neon instance) and copy its
   connection string into `DATABASE_URL`.
3. Set the remaining env vars from `.env.example` in the Vercel project settings — at minimum
   `AUTH_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, and
   `AUTH_MICROSOFT_ENTRA_ID_ID`/`AUTH_MICROSOFT_ENTRA_ID_SECRET` to enable sign-in.
4. Run `npm run db:migrate` once against the production database (locally, with `DATABASE_URL`
   pointed at prod, or via a Vercel deploy hook) before first use.
5. In the Google Cloud Console and Microsoft Entra admin center, add
   `https://<your-domain>/api/auth/callback/google` and
   `https://<your-domain>/api/auth/callback/microsoft-entra-id` as redirect URIs.

## What's stubbed vs. real

- **Data model, CRUD routes, dashboard UI**: fully wired against Postgres.
- **OAuth**: fully configured (Google Calendar `calendar` scope, Microsoft Graph
  `Calendars.ReadWrite`) — tokens are written to `calendar_accounts` server-side per spec §4.2.
  Linking a second provider (e.g. Outlook after Gmail) to the same household member is currently
  a manual step; the scaffold doesn't infer that two different emails belong to one person.
  Reading events from Google Calendar / Microsoft Graph into the merged calendar view
  (§2.1's read side) isn't wired yet — `POST /api/calendar/push` (the write side, §2.6) is.
- **Garden AI layer**: real API calls (Claude, plant.id/PlantNet, Perenual/Trefle,
  OpenWeatherMap) behind `src/lib/integrations/`, gated on the corresponding env var being set.
- **Notifications**: `getPendingNotifications()` computes what's due across Reminders/
  Maintenance/Goals; there's no delivery mechanism (email/push) wired up yet, per spec §4.5's
  "one delivery mechanism" being the next thing to build on top of this.
