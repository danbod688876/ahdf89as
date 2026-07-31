import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { plants, gardenTasks, plantCarePlan, maintenanceItems } from "@/lib/db/schema";
import type { Plant } from "@/lib/db/schema";
import { parseGardenCapture, generatePlantIdentifier, currentSeason, type ParsedGardenTask } from "@/lib/integrations/claude";
import { fetchStockPhoto } from "@/lib/integrations/plantData";
import { getWeatherForecast } from "@/lib/integrations/weather";
import { computeNextDue } from "@/app/api/maintenance/route";

/**
 * Shared plant-matching + garden-capture logic, used by both the
 * garden-specific capture endpoint and the universal capture bar's
 * garden branch — kept in one place so routing to garden never
 * reimplements this matching/creation behavior.
 */

function namesMatch(needle: string, commonName: string, nicknames: string[]): boolean {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/s$/, "");
  const n = normalize(needle);
  const c = normalize(commonName);
  if (n === c) return true;
  if (nicknames.some((nick) => normalize(nick) === n)) return true;
  // Loose substring matching only against single-plant names — skip it for
  // compound entries (e.g. a stale "Lavender and Portuguese laurel" row
  // from before captures were split per-plant) so "lavender" can't falsely
  // match into a name that merely happens to contain it as a substring.
  if (/\band\b|,|\+/.test(c)) return false;
  return c.includes(n) || n.includes(c);
}

export async function resolvePlantId(parsed: ParsedGardenTask, knownPlants: Plant[]): Promise<string> {
  const match = knownPlants.find((p) => namesMatch(parsed.plantName, p.commonName, p.nicknames ?? []));
  if (match) return match.id;

  const [stockPhoto, identifyingFeature] = await Promise.all([
    fetchStockPhoto(parsed.plantName).catch(() => null),
    generatePlantIdentifier(parsed.plantName, parsed.locationHint).catch(() => null),
  ]);
  const [created] = await db
    .insert(plants)
    .values({
      commonName: parsed.plantName,
      locationTag: parsed.locationHint ?? undefined,
      referencePhotoUrl: stockPhoto?.url,
      isRealPhoto: false,
      identifyingFeature,
    })
    .returning();

  // So a second mention of the same new plant later in this same capture
  // (or a duplicate mention) matches the row just created instead of
  // spawning another provisional plant.
  knownPlants.push(created);
  return created.id;
}

/**
 * Same matching/creation as resolvePlantId, but for callers that only have
 * a bare plant name (e.g. the universal bar's recurring-capture path,
 * which has an assetReference string rather than a full parsed task).
 */
export async function resolvePlantIdForName(name: string, knownPlants: Plant[]): Promise<string> {
  return resolvePlantId({ plantName: name, locationHint: null } as ParsedGardenTask, knownPlants);
}

/**
 * Full garden capture flow (spec §2.7): parse -> split per-plant -> match
 * or create each plant -> one garden_task per plant. Shared by
 * /api/garden/capture and the universal capture bar's garden branch so
 * both get the same multi-plant splitting and expanded, actionable detail.
 */
export async function createGardenTasksFromCapture(rawText: string, createdBy?: string) {
  const parsedTasks = await parseGardenCapture(rawText);
  const knownPlants = await db.query.plants.findMany();
  const createdTasks = [];

  for (const parsed of parsedTasks) {
    const plantId = await resolvePlantId(parsed, knownPlants);
    const [task] = await db
      .insert(gardenTasks)
      .values({
        plantId,
        rawText,
        detail: parsed.detail,
        actionType: parsed.action,
        urgency: parsed.urgency,
        createdBy,
      })
      .returning();
    createdTasks.push(task);
  }

  return createdTasks;
}

/**
 * Surfaces whatever the current season's care plan calls for, then
 * weather-adjusts any due watering items. Idempotent (safe to call on
 * every dashboard load) via each plan row's lastSurfacedYear:
 *  - one_off: creates the season's GardenTask once per year.
 *  - recurring: finds the ongoing MaintenanceItem by (plant, careKey) and
 *    resyncs its task text/cadence to this season's values, creating it
 *    the first time — so a single "watering" reminder persists across
 *    season changes rather than spawning a new item every time.
 *
 * Pass plantId to scope this to one plant (used right after a photo ID so
 * results appear immediately) or omit it to reconcile every plant (used
 * on dashboard load).
 */
export async function reconcileGardenSchedule(options?: { plantId?: string }): Promise<void> {
  const season = currentSeason();
  const year = new Date().getFullYear();

  const duePlans = await db.query.plantCarePlan.findMany({
    where: options?.plantId
      ? and(eq(plantCarePlan.season, season), eq(plantCarePlan.plantId, options.plantId))
      : eq(plantCarePlan.season, season),
    with: { plant: true },
  });

  for (const plan of duePlans) {
    if (plan.type === "one_off") {
      if (plan.lastSurfacedYear === year) continue;
      await db.insert(gardenTasks).values({
        plantId: plan.plantId,
        rawText: plan.action,
        detail: plan.action,
        actionType: "other",
        urgency: "this_week",
      });
      await db.update(plantCarePlan).set({ lastSurfacedYear: year }).where(eq(plantCarePlan.id, plan.id));
      continue;
    }

    const existing = await db.query.maintenanceItems.findFirst({
      where: and(eq(maintenanceItems.assetRefId, plan.plantId), eq(maintenanceItems.careKey, plan.careKey)),
    });

    if (existing) {
      if (existing.task !== plan.action || existing.intervalDays !== plan.intervalDays) {
        await db
          .update(maintenanceItems)
          .set({ task: plan.action, intervalDays: plan.intervalDays ?? undefined, isWatering: plan.isWatering })
          .where(eq(maintenanceItems.id, existing.id));
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      await db.insert(maintenanceItems).values({
        assetType: "garden",
        assetName: plan.plant.commonName,
        assetRefId: plan.plantId,
        task: plan.action,
        intervalDays: plan.intervalDays ?? undefined,
        lastDone: today,
        nextDue: computeNextDue(today, plan.intervalDays ?? undefined),
        careKey: plan.careKey,
        isWatering: plan.isWatering,
      });
    }
    await db.update(plantCarePlan).set({ lastSurfacedYear: year }).where(eq(plantCarePlan.id, plan.id));
  }

  await applyWeatherAdjustments(options?.plantId);
}

/**
 * Pushes out any due watering item's next-due date when rain is expected
 * in the next couple of days, with a note explaining why. Only ever sets
 * the note when pushing — it's cleared on the item's next completion
 * (POST /api/maintenance/[id]/complete), not proactively here, so it
 * doesn't get wiped the moment the pushed date is no longer "due".
 */
async function applyWeatherAdjustments(plantId?: string): Promise<void> {
  const weather = await getWeatherForecast();
  if (!weather) return;

  const rainSoon = weather.days.slice(0, 2).some((d) => d.precipitationMm > 0 || d.precipitationChance >= 0.5);
  if (!rainSoon) return;

  const today = new Date().toISOString().slice(0, 10);
  const wateringItems = await db.query.maintenanceItems.findMany({
    where: plantId
      ? and(eq(maintenanceItems.assetType, "garden"), eq(maintenanceItems.isWatering, true), eq(maintenanceItems.assetRefId, plantId))
      : and(eq(maintenanceItems.assetType, "garden"), eq(maintenanceItems.isWatering, true)),
  });

  for (const item of wateringItems) {
    if (!item.nextDue || item.nextDue > today) continue;
    const pushedDue = computeNextDue(today, 2);
    if (!pushedDue || item.nextDue === pushedDue) continue;
    await db
      .update(maintenanceItems)
      .set({ nextDue: pushedDue, weatherNote: `Pushed to ${format(new Date(`${pushedDue}T00:00:00Z`), "MMM d")} — rain expected` })
      .where(eq(maintenanceItems.id, item.id));
  }
}
