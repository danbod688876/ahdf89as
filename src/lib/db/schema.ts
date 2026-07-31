import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Schema mirrors the data model in the Household Dashboard spec (§3).
 * Two-person app: `owner_ids` columns are small uuid[] arrays referencing `users.id`
 * rather than a join table, since cardinality never exceeds two.
 */

// ---------- Enums ----------

export const calendarProviderEnum = pgEnum("calendar_provider", ["google", "microsoft"]);
export const eventSourceEnum = pgEnum("event_source", ["outlook", "gmail", "dashboard"]);
export const goalStatusEnum = pgEnum("goal_status", ["not_started", "in_progress", "done"]);
export const reminderCategoryEnum = pgEnum("reminder_category", ["bill", "renewal", "general"]);
export const tripPurposeEnum = pgEnum("trip_purpose", ["vacation", "conference_plus_vacation"]);
export const tripStatusEnum = pgEnum("trip_status", [
  "requested",
  "approved",
  "booked",
  "confirmed",
]);
export const assetTypeEnum = pgEnum("asset_type", ["home", "vehicle", "garden"]);
export const gardenActionTypeEnum = pgEnum("garden_action_type", [
  "water",
  "prune",
  "fertilize",
  "watch",
  "other",
]);
export const gardenUrgencyEnum = pgEnum("garden_urgency", ["today", "this_week", "someday"]);
export const gardenTaskStatusEnum = pgEnum("garden_task_status", ["open", "done"]);
export const householdTaskAssetTypeEnum = pgEnum("household_task_asset_type", ["home", "vehicle"]);
export const householdTaskStatusEnum = pgEnum("household_task_status", ["open", "done"]);
export const seasonEnum = pgEnum("season", ["winter", "spring", "summer", "fall"]);
export const carePlanActionTypeEnum = pgEnum("care_plan_action_type", ["recurring", "one_off"]);

// ---------- User ----------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per connected calendar account (a user may connect Google and/or Microsoft).
export const calendarAccounts = pgTable("calendar_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: calendarProviderEnum("provider").notNull(),
  email: text("email").notNull(),
  // Tokens live server-side only — never sent to the client. See §4.2 of the spec.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Calendar ----------

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: eventSourceEnum("source").notNull(),
  externalId: text("external_id"), // id on the provider side, null for dashboard-only events
  ownerIds: uuid("owner_ids").array().notNull(),
  title: text("title").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  attendees: jsonb("attendees").$type<{ email: string; name?: string }[]>().default([]),
  isHouseholdLayer: boolean("is_household_layer").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Goals ----------

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerIds: uuid("owner_ids").array().notNull(),
  title: text("title").notNull(),
  targetDate: date("target_date"),
  status: goalStatusEnum("status").notNull().default("not_started"),
  linkedEventIds: uuid("linked_event_ids").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Reminders ----------

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerIds: uuid("owner_ids").array().notNull(),
  title: text("title").notNull(),
  category: reminderCategoryEnum("category").notNull().default("general"),
  dueDate: date("due_date").notNull(),
  recurrenceRule: text("recurrence_rule"), // e.g. "yearly", "monthly"; null = one-off
  amount: numeric("amount", { precision: 10, scale: 2 }),
  account: text("account"),
  leadTimeDays: integer("lead_time_days").notNull().default(7),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Vacation Planning ----------

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  destination: text("destination").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  purpose: tripPurposeEnum("purpose").notNull().default("vacation"),
  status: tripStatusEnum("status").notNull().default("requested"),
  blocksCalendar: boolean("blocks_calendar").notNull().default(false), // set true once status hits "approved"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hotelOptions = pgTable("hotel_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }),
  link: text("link"),
  notes: text("notes"),
  selected: boolean("selected").notNull().default(false),
});

// ---------- Home / Vehicle / Garden Maintenance ----------

export const maintenanceItems = pgTable("maintenance_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetType: assetTypeEnum("asset_type").notNull(),
  assetName: text("asset_name").notNull(), // e.g. "Furnace", "Honda CR-V", "Roses (fence bed)"
  assetRefId: uuid("asset_ref_id"), // references plants.id when assetType = "garden"
  task: text("task").notNull(), // e.g. "Replace filter", "Oil change", "Prune"
  intervalDays: integer("interval_days"), // time-based recurrence
  intervalMiles: integer("interval_miles"), // mileage-based recurrence (vehicles)
  lastDone: date("last_done"),
  lastDoneMileage: integer("last_done_mileage"),
  nextDue: date("next_due"), // computed on write from lastDone + intervalDays
  // Stable key (e.g. "watering") linking an ongoing recurring item back to
  // its plant_care_plan row across season changes — lets reconcile find
  // and update the same item's cadence rather than spawning a new one
  // each time the season rolls over.
  careKey: text("care_key"),
  isWatering: boolean("is_watering").notNull().default(false),
  // Set by the weather-aware reconcile step when a watering item's due
  // date gets auto-pushed out; cleared once it no longer applies.
  weatherNote: text("weather_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceLog = pgTable("maintenance_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  maintenanceItemId: uuid("maintenance_item_id")
    .notNull()
    .references(() => maintenanceItems.id, { onDelete: "cascade" }),
  completedAt: date("completed_at").notNull(),
  mileageAt: integer("mileage_at"),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Garden ----------

export const plants = pgTable("plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  commonName: text("common_name").notNull(),
  species: text("species"),
  nicknames: text("nicknames").array().default([]),
  locationTag: text("location_tag"),
  referencePhotoUrl: text("reference_photo_url"),
  isRealPhoto: boolean("is_real_photo").notNull().default(false),
  // One plain-language sentence of what to visually look for (leaf shape,
  // color, flowers) — generated alongside the photo so a non-gardener can
  // match the row to the actual plant, not just recognize a thumbnail.
  identifyingFeature: text("identifying_feature"),
  firstIdentifiedAt: timestamp("first_identified_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gardenTasks = pgTable("garden_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
  rawText: text("raw_text").notNull(), // the original voice/text capture
  detail: text("detail"), // Claude-expanded, actionable explanation for whoever executes it
  actionType: gardenActionTypeEnum("action_type").notNull().default("other"),
  urgency: gardenUrgencyEnum("urgency").notNull().default("someday"),
  status: gardenTaskStatusEnum("status").notNull().default("open"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// A plant's year-round care profile, generated once from its photo ID
// (all four seasons at once) rather than only "right now" — reconcile
// surfaces each season's entries as they arrive so the task list builds
// itself over time instead of requiring a fresh photo each visit.
export const plantCarePlan = pgTable("plant_care_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  season: seasonEnum("season").notNull(),
  // Groups the same conceptual action (e.g. "watering") across all four
  // season rows so a recurring item's cadence can be resynced instead of
  // duplicated when the season changes.
  careKey: text("care_key").notNull(),
  action: text("action").notNull(),
  type: carePlanActionTypeEnum("type").notNull(),
  intervalDays: integer("interval_days"), // set when type = recurring
  isWatering: boolean("is_watering").notNull().default(false),
  // one_off: calendar year this season's task was last created.
  // recurring: calendar year the linked item's cadence was last synced.
  lastSurfacedYear: integer("last_surfaced_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One-off home/vehicle tasks captured via the universal capture bar — the
// same shape as garden_tasks, minus the plant relation (home/vehicle assets
// aren't tracked as their own rows the way plants are).
export const householdTasks = pgTable("household_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetType: householdTaskAssetTypeEnum("asset_type").notNull(),
  assetReference: text("asset_reference"), // the appliance/vehicle as said in plain text, e.g. "the Forester"
  action: text("action").notNull(),
  dueHint: text("due_hint"), // free-text timing only when actually implied, e.g. "before winter"
  rawText: text("raw_text").notNull(),
  status: householdTaskStatusEnum("status").notNull().default("open"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  calendarAccounts: many(calendarAccounts),
}));

export const calendarAccountsRelations = relations(calendarAccounts, ({ one }) => ({
  user: one(users, { fields: [calendarAccounts.userId], references: [users.id] }),
}));

export const tripsRelations = relations(trips, ({ many }) => ({
  hotelOptions: many(hotelOptions),
}));

export const hotelOptionsRelations = relations(hotelOptions, ({ one }) => ({
  trip: one(trips, { fields: [hotelOptions.tripId], references: [trips.id] }),
}));

export const maintenanceItemsRelations = relations(maintenanceItems, ({ many, one }) => ({
  log: many(maintenanceLog),
  // Only populated when asset_type = garden; assetRefId points at plants.id.
  // Not a DB-level FK (garden is one of three asset types sharing this
  // table), just a query-time relation so garden items can show a photo.
  plant: one(plants, { fields: [maintenanceItems.assetRefId], references: [plants.id] }),
}));

export const maintenanceLogRelations = relations(maintenanceLog, ({ one }) => ({
  item: one(maintenanceItems, {
    fields: [maintenanceLog.maintenanceItemId],
    references: [maintenanceItems.id],
  }),
}));

export const plantsRelations = relations(plants, ({ many }) => ({
  tasks: many(gardenTasks),
  carePlan: many(plantCarePlan),
}));

export const gardenTasksRelations = relations(gardenTasks, ({ one }) => ({
  plant: one(plants, { fields: [gardenTasks.plantId], references: [plants.id] }),
  creator: one(users, { fields: [gardenTasks.createdBy], references: [users.id] }),
}));

export const plantCarePlanRelations = relations(plantCarePlan, ({ one }) => ({
  plant: one(plants, { fields: [plantCarePlan.plantId], references: [plants.id] }),
}));

export const householdTasksRelations = relations(householdTasks, ({ one }) => ({
  creator: one(users, { fields: [householdTasks.createdBy], references: [users.id] }),
}));

// ---------- Row types ----------

export type User = typeof users.$inferSelect;
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type HotelOption = typeof hotelOptions.$inferSelect;
export type MaintenanceItem = typeof maintenanceItems.$inferSelect;
export type MaintenanceLogEntry = typeof maintenanceLog.$inferSelect;
export type Plant = typeof plants.$inferSelect;
export type GardenTask = typeof gardenTasks.$inferSelect;
export type HouseholdTask = typeof householdTasks.$inferSelect;
export type PlantCarePlanEntry = typeof plantCarePlan.$inferSelect;
