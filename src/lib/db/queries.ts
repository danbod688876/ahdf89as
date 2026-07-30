import { asc, eq, gte } from "drizzle-orm";
import { db } from "./index";
import { events, goals, reminders, trips, maintenanceItems, gardenTasks, householdTasks } from "./schema";

/**
 * Read-side data access for the dashboard page. Kept as small, named
 * queries (rather than one giant join) so each module card can be wired to
 * exactly the data it needs.
 */

export async function getUsers() {
  return db.query.users.findMany();
}

export async function getUpcomingEvents(fromDate: Date = new Date()) {
  return db.query.events.findMany({
    where: gte(events.end, fromDate),
    orderBy: asc(events.start),
  });
}

export async function getGoals() {
  return db.query.goals.findMany({
    orderBy: asc(goals.targetDate),
  });
}

export async function getReminders() {
  return db.query.reminders.findMany({
    orderBy: asc(reminders.dueDate),
  });
}

export async function getTrips() {
  return db.query.trips.findMany({
    with: { hotelOptions: true },
    orderBy: asc(trips.startDate),
  });
}

export async function getMaintenanceItems() {
  return db.query.maintenanceItems.findMany({
    // log: per-vehicle total cost; plant: photo/ID for garden recurring items
    // (null for home/vehicle rows, where asset_ref_id isn't set).
    with: { log: true, plant: true },
    orderBy: asc(maintenanceItems.nextDue),
  });
}

export async function getGardenTasks(status: "open" | "done" = "open") {
  return db.query.gardenTasks.findMany({
    where: eq(gardenTasks.status, status),
    with: { plant: true },
  });
}

export async function getPlants() {
  return db.query.plants.findMany();
}

export async function getHouseholdTasks(status: "open" | "done" = "open") {
  return db.query.householdTasks.findMany({
    where: eq(householdTasks.status, status),
    orderBy: asc(householdTasks.createdAt),
  });
}
