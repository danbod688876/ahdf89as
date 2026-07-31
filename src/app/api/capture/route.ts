import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdTasks, maintenanceItems } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { classifyCapture } from "@/lib/integrations/claude";
import { IntegrationError } from "@/lib/integrations/errors";
import { createGardenTasksFromCapture, resolvePlantIdForName } from "@/lib/garden";
import { computeNextDue } from "@/app/api/maintenance/route";

export const maxDuration = 30;

const recurringSchema = z.object({
  interval: z.number().int().positive(),
  unit: z.enum(["days", "weeks", "months"]),
});

const captureRequestSchema = z.object({
  rawText: z.string().min(1),
  // Set when captured from inside a specific module's own card — the card
  // the user is looking at is the explicit signal, so classification is
  // skipped for that module.
  moduleHint: z.enum(["garden", "home", "vehicle"]).optional(),
  recurring: recurringSchema.nullable().optional(),
  createdBy: z.string().uuid().optional(),
});

function toIntervalDays(interval: number, unit: "days" | "weeks" | "months") {
  if (unit === "days") return interval;
  if (unit === "weeks") return interval * 7;
  return interval * 30;
}

async function gardenTasksResponse(rawText: string, createdBy?: string) {
  try {
    const createdTasks = await createGardenTasksFromCapture(rawText, createdBy);
    return NextResponse.json(createdTasks, { status: 201 });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Capture parsing is unavailable right now — try the manual add-task form.", 502);
    }
    throw err;
  }
}

/**
 * Universal capture bar's commit endpoint (spec: single-field capture, no
 * confirmation step). Used by the global bar (no moduleHint -> classify
 * for auto-routing) and every per-card bar (moduleHint fixes the module).
 *
 * Recurring toggle bypasses one-off tasks entirely and writes a
 * MaintenanceItem instead, for any module — mirrors how converting a
 * garden task to recurring already works.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, captureRequestSchema);
  if (!body.ok) return body.response;
  const { rawText, moduleHint, createdBy } = body.data;
  const recurring = body.data.recurring ?? null;

  // Garden, one-off, from the Garden card itself: reuse the full
  // parse+split+detail flow directly — classification would be redundant
  // when the module is already fixed.
  if (moduleHint === "garden" && !recurring) {
    return gardenTasksResponse(rawText, createdBy);
  }

  let classification;
  try {
    classification = await classifyCapture(rawText, moduleHint);
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Capture parsing is unavailable right now — try the manual add-task form.", 502);
    }
    throw err;
  }

  // Low-confidence auto-routing defaults to garden (today's primary use
  // case) rather than blocking on asking the user to pick a module.
  const resolvedModule =
    moduleHint ?? (classification.module === "uncertain" ? "garden" : classification.module);

  if (recurring) {
    const intervalDays = toIntervalDays(recurring.interval, recurring.unit);
    const lastDone = new Date().toISOString().slice(0, 10);
    const nextDue = computeNextDue(lastDone, intervalDays);
    let assetRefId: string | undefined;
    let assetName = classification.assetReference ?? classification.action;

    if (resolvedModule === "garden") {
      const knownPlants = await db.query.plants.findMany();
      assetRefId = await resolvePlantIdForName(assetName, knownPlants);
      const plant = knownPlants.find((p) => p.id === assetRefId);
      if (plant) assetName = plant.commonName;
    }

    const [item] = await db
      .insert(maintenanceItems)
      .values({
        assetType: resolvedModule,
        assetName,
        assetRefId,
        task: classification.action,
        intervalDays,
        lastDone,
        nextDue,
      })
      .returning();
    return NextResponse.json(item, { status: 201 });
  }

  if (resolvedModule === "garden") {
    return gardenTasksResponse(rawText, createdBy);
  }

  const [task] = await db
    .insert(householdTasks)
    .values({
      assetType: resolvedModule,
      assetReference: classification.assetReference,
      action: classification.action,
      dueHint: classification.dueHint,
      rawText,
      createdBy,
    })
    .returning();
  return NextResponse.json(task, { status: 201 });
}
