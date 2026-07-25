# Household Dashboard — Product Spec (v2, merged with Garden Assistant)

## 1. Purpose

A shared dashboard for two people running two calendar systems (Outlook + Gmail) to see one merged view of their life together: what's on the calendar, what they're working toward, what needs remembering, upcoming trips, the ongoing upkeep of the house and vehicles, and now the garden. Chores (non-garden household chores) are explicitly out of scope.

Garden was originally scoped as a standalone app but folds in cleanly: it's the same shape as Home & Vehicle Maintenance (recurring, asset-tied upkeep) plus one genuinely new capability the rest of the dashboard doesn't have — an AI layer for photo ID and natural-language capture. That AI layer is worth keeping visually distinct as its own module even though its recurring tasks plug into the existing maintenance engine underneath. More on that in §2.7 and the merge notes at the end.

## 2. Core Modules

### 2.1 Unified Calendar
- Merged read view of Outlook and Gmail events, color-coded by owner (you / her / shared)
- Conflict flagging — surfaces when both of you are double-booked or both away at once
- Shared "household" layer for anything neither calendar owns natively (trips, joint appointments)
- Quick-add from the dashboard that writes back out to the real calendars (see §2.6)

### 2.2 Goals
- Shared and individual goals, each with a target date or "ongoing" status
- Simple stages: not started → in progress → done (avoid over-building this — a goal tracker with too much scaffolding stops getting used)
- Optional link from a goal to relevant calendar events (e.g., a goal "run a half marathon" linked to training days)
- A single "this month" view that surfaces goals nearing their date, so they don't quietly go stale

### 2.3 Reminders
- One-off and recurring reminders, each assigned to a person or both
- Categories: bills/renewals (insurance, subscriptions, licenses, passports), general
- Bill reminders carry amount + account/payee as optional fields, kept visually distinct from general reminders
- Notification lead time configurable per reminder (e.g., renewal reminders 30 days out, bills 3 days out)
- This module's notification/lead-time engine is the one shared delivery mechanism for every "something is due" case in the app — Maintenance and Garden hook into it rather than each building their own (see §4)

### 2.4 Vacation Planning
- Add a trip: destination, date range, purpose (vacation vs. conference-plus-vacation)
- Status checkboxes as a linear progression: dates requested → approved → booked → confirmed
- Hotel options: save multiple candidates per trip (name, price, link, notes), mark one "selected"
- Once a trip reaches "approved," it auto-blocks the shared calendar for those dates so nothing else gets scheduled against it
- Explicitly excluded per your scope: packing checklist, trip budget

### 2.5 Home & Vehicle Maintenance
- Ongoing/recurring maintenance items, separate from the Reminders module since these are asset-tied rather than person-tied
- Home: HVAC filters, gutters, seasonal system checks, appliance servicing
- Vehicle: oil changes, tire rotation, registration renewal, inspection
- Each item has an interval (time-based or mileage-based for vehicles) and a "last done" date, so the dashboard can calculate "next due" rather than requiring manual rescheduling
- Simple log of past completions per item, so you have service history in one place
- **Now a third asset type: garden.** Recurring plant care (e.g., "prune roses late Feb," "fertilize in spring") uses this exact same interval/last-done/next-due/log mechanism, just with `asset_type = garden` and the asset linked to a row in the new `plants` table. No separate recurrence engine needed for garden.

### 2.6 Calendar Write-Access (shared events & invites)
This is the piece worth being deliberate about, since it requires broader OAuth scopes than a typical read-only calendar app.

- **Google Calendar API**: creating an event with an `attendees` field sends a real calendar invite by email; edits push update notifications the same way.
- **Microsoft Graph API** (Outlook): identical pattern — `POST /events` with `attendees` triggers a meeting invite; `PATCH` sends change notifications.
- Invites work cross-platform (standard iCalendar format under the hood), so a Gmail-side invite lands correctly in an Outlook inbox and vice versa.
- **Recommended model: one-way push, not two-way sync.** The dashboard is the place a plan gets finalized; once agreed, it creates the event and pushes invites out to both calendars (and outside addresses if needed). Two-way sync is meaningfully more complex (webhook subscriptions, conflict resolution, rate limits) and isn't necessary here. Build one-way first; two-way can be a v2 if needed.
- Required scopes: `Calendar.ReadWrite` (Graph) and the write-scope equivalent for Google Calendar — heavier permission asks than read-only, so the consent screen should be clear about why.

### 2.7 Garden (new)

Two capture flows feeding one shared plant inventory and task list.

**Voice/text capture (mainly her):**
1. She speaks or types: *"hydrangeas by the fence need watering."*
2. Claude API parses the sentence → `{plant_name, location_hint, action, urgency}`.
3. Fuzzy-match against the `plants` table (including nicknames). Match → pull the saved reference photo (real garden photo if one exists, otherwise stock). No match → query Perenual/Trefle for a stock photo by best-guess species and create a provisional plant row.
4. Create a `garden_task` row linked to the plant.
5. Your view: a task list — photo, plant name, action, urgency. No ID work required from you.

**Photo capture (mainly you):**
1. Upload a photo.
2. Send to a plant ID API — plant.id performs strongest on cultivated/ornamental garden plants specifically; PlantNet is a solid free fallback.
3. If confidence is low, or either of you flags it wrong, allow a manual correction — she confirms once. Without this step, a wrong ID can turn into bad advice nobody catches.
4. Claude API call: species + your zone (Campbell River, coastal BC, ~8a/8b) + current season + anything visible in the photo → specific, non-generic care actions.
5. Save the actual photo as the plant's reference photo, replacing any stock placeholder.
6. Recurring actions suggested here (e.g., "prune again in 6 weeks") get written as `MaintenanceItem` rows under `asset_type = garden`, not a separate garden-only recurrence system — one-off actions ("water today") stay as `garden_tasks`.

The inventory builds itself as a byproduct of normal use — nobody catalogs the garden upfront. Stock photos get replaced by real ones organically over time.

## 3. Data Model (high level)

```
User
 - id, name, email(s), calendar_provider_tokens

Event
 - id, source (outlook/gmail/dashboard-created), owner(s), title, start, end, attendees[]

Goal
 - id, owner(s), title, target_date (nullable), status, linked_event_ids[]

Reminder
 - id, owner(s), title, category (bill/renewal/general), due_date, recurrence, amount (nullable), account (nullable), lead_time_days

Trip
 - id, destination, start_date, end_date, purpose, status (requested/approved/booked/confirmed), hotel_options[]

HotelOption
 - id, trip_id, name, price, link, notes, selected (bool)

MaintenanceItem
 - id, asset_type (home/vehicle/garden), asset_name, asset_ref_id (nullable — links to plants.id when asset_type=garden), task, interval, last_done, next_due, log[]

Plant
 - id, common_name, species, nicknames[], location_tag (optional), reference_photo_url, is_real_photo (bool), first_identified_at, notes

GardenTask
 - id, plant_id (nullable), raw_text, action_type (water/prune/fertilize/watch/other), urgency (today/this_week/someday), status (open/done), created_by, created_at, completed_at
```

## 4. Integration & Auth Flow

1. Each person authenticates their own Outlook and/or Gmail account via OAuth (separate token sets — don't share credentials between you). This is the app's one and only auth system — Garden doesn't get its own login; garden tasks and plants just reference the same `User` rows.
2. Tokens stored server-side, never in the client. This needs a lightweight backend — a pure front-end app can't hold OAuth secrets safely.
3. Read scopes pull events into the merged calendar view on a polling or webhook basis.
4. Write scopes are only invoked when a plan is explicitly finalized on the dashboard (the "create event & send invites" action) — not for every dashboard interaction, to keep the permission footprint narrow.
5. **Unified due-date/notification engine**, originally built for Reminders, now also serves Maintenance (home/vehicle/garden) and goals-nearing-date. One delivery mechanism, one place to configure lead times, instead of three modules each reinventing "tell me before this is due."
6. **Garden's AI layer is the app's one dependency with an external failure mode the rest doesn't have** — plant ID and Claude parsing are live third-party calls, not just CRUD against your own DB or a calendar provider. Worth designing for graceful degradation specifically here: if the plant ID API is slow or down, let either of you type the plant name manually rather than blocking on it; if Claude parsing misses on a voice note, fall back to a plain "add task" form instead of failing silently.

## 5. Tech Notes for Replit / Lovable

- Backend: needed for OAuth token storage, calendar API calls, and now the plant ID / Claude / weather API calls — a serverless function set (or small Node/Python backend) is enough; this isn't a heavy compute app.
- Frontend: single dashboard view with modules as cards/sections (calendar, goals, reminders, trips, maintenance, garden) — avoid a "dashboard of widgets" feel by giving each module a distinct but coherent visual treatment (see design direction below). Garden's voice-capture entry point should be a persistent, low-friction button (she's often outside, hands full) rather than buried a level deep.
- Auth libraries: Google's own OAuth client library and Microsoft's MSAL both handle the token refresh flow so you're not maintaining that logic by hand.
- New integrations beyond the original spec: Claude API (voice/photo parsing + zone-specific care generation), a plant ID API (plant.id primary, PlantNet fallback), a plant data API (Perenual or Trefle, for stock reference photos), and optionally OpenWeatherMap (skip/flag watering tasks after recent rain — cheap addition, high value since watering is the easiest task to over- or under-do).

## 6. Design Direction

Brief: calming, modern, lovely — should not read as AI-generated. That rules out cream-background-with-serif, near-black-with-neon, and hairline-rule-broadsheet defaults.

**Palette:**
- `#EEF1EC` — mist, base background
- `#3F5B4E` — deep pine, primary accent
- `#C9A87C` — warm sand, secondary accent (highlights, badges, trip/vacation module)
- `#2B2E2C` — ink, primary text
- `#7C8880` — sage grey, secondary text and dividers

**Type**: humanist sans for interface/body (Inter or General Sans), a warm serif for module headers only (Fraunces or Lora), utility text (dates, timestamps) in a smaller sans weight.

**Layout concept**: not a grid of identical widget cards. Each module gets visual weight based on how it's actually used — calendar largest and most persistent; goals/reminders a slimmer side column; trips, maintenance, and garden as expandable sections that stay collapsed until relevant. Garden follows the same pattern as trips: a plant with an open "today" task takes more visual space than one that's dormant for the season.

**Signature element**: a soft, hand-drawn-feeling divider/icon set (rounded, organic shapes) used consistently across all modules, including garden's plant photo cards — this is what ties a six-module app together as one considered product instead of six bolted-together tools.

**Motion**: minimal and functional — a gentle fade/slide on module expansion, nothing decorative.

## 7. Explicitly Out of Scope (per current decisions)
- Chores list
- Trip packing checklist
- Trip budget tracking
- Two-way calendar sync (v1 is one-way push from dashboard to calendars)
- Full garden GPS/bed mapping (location tags are optional, lightweight)
- Disease/pest diagnosis from garden photos (separate, harder problem — bolt on later if useful)

## Merge notes — decisions worth flagging

1. **Garden's recurring care rides on the existing Maintenance engine** rather than getting its own interval/notification system. Keeps "when is X due" logic in one place across home, vehicle, and garden.
2. **No separate garden auth.** It uses the same two-user OAuth system already required for calendar access — one less thing to build or maintain.
3. **Garden introduces the app's first live third-party AI dependency.** Every other module is CRUD-plus-calendar-webhooks; garden's capture flows call out to Claude and a plant ID service in real time. Not a reason to hold it back, just a reason to build its failure paths (manual fallback entry) deliberately rather than as an afterthought.
4. **Garden keeps its own UI module** rather than being flattened entirely into §2.5, because it has flows (voice capture, photo ID, a browsable plant inventory with photos) that home/vehicle maintenance doesn't need. Underneath, though, its recurring items are just another `MaintenanceItem` row.
