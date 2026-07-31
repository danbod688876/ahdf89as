import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants, gardenTasks, maintenanceItems, plantCarePlan } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { identifyPlant } from "@/lib/integrations/plantId";
import { generateSeasonalCarePlan, generatePlantIdentifier, currentSeason } from "@/lib/integrations/claude";
import { IntegrationError } from "@/lib/integrations/errors";
import { GARDEN_LOCATION, getWeatherForecast } from "@/lib/integrations/weather";
import { reconcileGardenSchedule } from "@/lib/garden";

const CONFIDENCE_THRESHOLD = 0.6;

const photoRequestSchema = z.object({
  photoUrl: z.string().url(),
  plantId: z.string().uuid().optional(), // set when re-identifying/correcting an existing plant
});

/**
 * Photo capture flow: plant ID -> low-confidence flag for manual
 * correction -> a full year-round care plan (all four seasons, not just
 * right now) -> save the real photo as reference. The current season's
 * plan is surfaced immediately via reconcileGardenSchedule (same path the
 * dashboard uses on every load), so results show up with no extra step —
 * the other three seasons' entries surface automatically as they arrive.
 * Zone, season, and the current forecast are all derived here rather than
 * trusted from the client — there's exactly one garden location for this
 * app. Falls back to a clear error (manual name entry) if the ID service
 * is down rather than blocking.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, photoRequestSchema);
  if (!body.ok) return body.response;

  let identification;
  try {
    identification = await identifyPlant(body.data.photoUrl);
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Plant ID is unavailable right now — enter the plant name manually.", 502);
    }
    throw err;
  }

  const needsConfirmation = identification.confidence < CONFIDENCE_THRESHOLD;
  const identifyingFeature = await generatePlantIdentifier(
    identification.commonName,
    identification.species
  ).catch(() => null);

  const plantValues = {
    commonName: identification.commonName,
    species: identification.species,
    referencePhotoUrl: body.data.photoUrl,
    isRealPhoto: true,
    firstIdentifiedAt: new Date(),
    identifyingFeature,
  };

  const plant = body.data.plantId
    ? (
        await db
          .update(plants)
          .set(plantValues)
          .where(eq(plants.id, body.data.plantId))
          .returning()
      )[0]
    : (await db.insert(plants).values(plantValues).returning())[0];

  if (!plant) return jsonError("Plant not found", 404);

  let seasonalPlan;
  try {
    const weather = await getWeatherForecast();
    seasonalPlan = await generateSeasonalCarePlan({
      species: identification.species,
      zone: `${GARDEN_LOCATION.name}, ${GARDEN_LOCATION.zone}`,
      currentSeason: currentSeason(),
      weather,
    });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return NextResponse.json(
        { plant, needsConfirmation, createdTasks: [], createdMaintenanceItems: [], careAdviceUnavailable: true },
        { status: 201 }
      );
    }
    throw err;
  }

  // Re-identifying an existing plant replaces its plan outright — the old
  // one may no longer describe the same species.
  await db.delete(plantCarePlan).where(eq(plantCarePlan.plantId, plant.id));
  for (const { season, actions } of seasonalPlan) {
    for (const action of actions) {
      await db.insert(plantCarePlan).values({
        plantId: plant.id,
        season,
        careKey: action.careKey,
        action: action.action,
        type: action.type,
        intervalDays: action.intervalDays ?? undefined,
        isWatering: action.isWatering,
      });
    }
  }

  await reconcileGardenSchedule({ plantId: plant.id });

  const [createdTasks, createdMaintenanceItems] = await Promise.all([
    db.query.gardenTasks.findMany({ where: and(eq(gardenTasks.plantId, plant.id), eq(gardenTasks.status, "open")) }),
    db.query.maintenanceItems.findMany({
      where: and(eq(maintenanceItems.assetRefId, plant.id), eq(maintenanceItems.assetType, "garden")),
    }),
  ]);

  return NextResponse.json({ plant, needsConfirmation, createdTasks, createdMaintenanceItems }, { status: 201 });
}
