import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants, gardenTasks } from "@/lib/db/schema";
import type { Plant } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { parseGardenCapture, type ParsedGardenTask } from "@/lib/integrations/claude";
import { fetchStockPhoto } from "@/lib/integrations/plantData";
import { IntegrationError } from "@/lib/integrations/errors";

const captureRequestSchema = z.object({
  rawText: z.string().min(1),
  createdBy: z.string().uuid().optional(),
});

/**
 * Voice/text capture flow (spec §2.7): parse -> fuzzy-match plants table
 * (incl. nicknames) -> match pulls the saved reference photo, no match
 * queries a stock photo and creates a provisional plant row -> garden_task.
 *
 * Claude splits a note covering multiple plants into separate entries, so
 * each gets matched/created and photographed independently rather than
 * lumped into one entry with no identifiable photo.
 *
 * On a Claude parsing failure, return 502 so the client falls back to the
 * plain "add task" form (POST /api/garden/tasks) instead of blocking (§4.6).
 */
export async function POST(request: Request) {
  const body = await parseBody(request, captureRequestSchema);
  if (!body.ok) return body.response;

  let parsedTasks;
  try {
    parsedTasks = await parseGardenCapture(body.data.rawText);
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Voice/text parsing is unavailable right now — use the manual add-task form.", 502);
    }
    throw err;
  }

  const knownPlants = await db.query.plants.findMany();
  const createdTasks = [];

  for (const parsed of parsedTasks) {
    const plantId = await resolvePlantId(parsed, knownPlants);
    const [task] = await db
      .insert(gardenTasks)
      .values({
        plantId,
        rawText: body.data.rawText,
        detail: parsed.detail,
        actionType: parsed.action,
        urgency: parsed.urgency,
        createdBy: body.data.createdBy,
      })
      .returning();
    createdTasks.push(task);
  }

  return NextResponse.json(createdTasks, { status: 201 });
}

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

async function resolvePlantId(parsed: ParsedGardenTask, knownPlants: Plant[]): Promise<string> {
  const match = knownPlants.find((p) =>
    namesMatch(parsed.plantName, p.commonName, p.nicknames ?? [])
  );
  if (match) return match.id;

  const stockPhoto = await fetchStockPhoto(parsed.plantName).catch(() => null);
  const [created] = await db
    .insert(plants)
    .values({
      commonName: parsed.plantName,
      locationTag: parsed.locationHint ?? undefined,
      referencePhotoUrl: stockPhoto?.url,
      isRealPhoto: false,
    })
    .returning();

  // So a second mention of the same new plant later in this same capture
  // (or a duplicate mention) matches the row just created instead of
  // spawning another provisional plant.
  knownPlants.push(created);
  return created.id;
}
