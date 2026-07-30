import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants, gardenTasks, maintenanceItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { identifyPlant } from "@/lib/integrations/plantId";
import { generateCareAdvice, generatePlantIdentifier } from "@/lib/integrations/claude";
import { IntegrationError } from "@/lib/integrations/errors";
import { computeNextDue } from "@/app/api/maintenance/route";

const CONFIDENCE_THRESHOLD = 0.6;

const photoRequestSchema = z.object({
  photoUrl: z.string().url(),
  zone: z.string().min(1),
  season: z.string().min(1),
  plantId: z.string().uuid().optional(), // set when re-identifying/correcting an existing plant
});

/**
 * Photo capture flow (spec §2.7): plant ID -> low-confidence flag for manual
 * correction -> zone/season-specific care advice -> save the real photo as
 * reference -> recurring actions become MaintenanceItem rows, one-offs
 * become GardenTasks. Falls back to a clear error (manual name entry) if the
 * ID service is down rather than blocking (§4.6).
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

  let careActions;
  try {
    careActions = await generateCareAdvice({
      species: identification.species,
      zone: body.data.zone,
      season: body.data.season,
    });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return NextResponse.json(
        { plant, needsConfirmation, careActions: [], careAdviceUnavailable: true },
        { status: 201 }
      );
    }
    throw err;
  }

  const createdTasks = [];
  const createdMaintenanceItems = [];
  for (const action of careActions) {
    if (action.type === "recurring") {
      const today = new Date().toISOString().slice(0, 10);
      const [item] = await db
        .insert(maintenanceItems)
        .values({
          assetType: "garden",
          assetName: plant.commonName,
          assetRefId: plant.id,
          task: action.text,
          intervalDays: action.intervalDays ?? undefined,
          lastDone: today,
          nextDue: computeNextDue(today, action.intervalDays ?? undefined),
        })
        .returning();
      createdMaintenanceItems.push(item);
    } else {
      const [task] = await db
        .insert(gardenTasks)
        .values({
          plantId: plant.id,
          rawText: action.text,
          actionType: "other",
          urgency: "this_week",
        })
        .returning();
      createdTasks.push(task);
    }
  }

  return NextResponse.json(
    { plant, needsConfirmation, createdTasks, createdMaintenanceItems },
    { status: 201 }
  );
}
