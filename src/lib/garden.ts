import { db } from "@/lib/db";
import { plants, gardenTasks } from "@/lib/db/schema";
import type { Plant } from "@/lib/db/schema";
import { parseGardenCapture, generatePlantIdentifier, type ParsedGardenTask } from "@/lib/integrations/claude";
import { fetchStockPhoto } from "@/lib/integrations/plantData";

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
