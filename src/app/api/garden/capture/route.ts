import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants, gardenTasks } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { parseGardenCapture } from "@/lib/integrations/claude";
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
 * On a Claude parsing failure, return 502 so the client falls back to the
 * plain "add task" form (POST /api/garden/tasks) instead of blocking (§4.6).
 */
export async function POST(request: Request) {
  const body = await parseBody(request, captureRequestSchema);
  if (!body.ok) return body.response;

  let parsed;
  try {
    parsed = await parseGardenCapture(body.data.rawText);
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Voice/text parsing is unavailable right now — use the manual add-task form.", 502);
    }
    throw err;
  }

  const allPlants = await db.query.plants.findMany();
  const needle = parsed.plantName.toLowerCase();
  const match = allPlants.find(
    (p) =>
      p.commonName.toLowerCase().includes(needle) ||
      needle.includes(p.commonName.toLowerCase()) ||
      (p.nicknames ?? []).some((n) => n.toLowerCase() === needle)
  );

  let plantId: string;
  if (match) {
    plantId = match.id;
  } else {
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
    plantId = created.id;
  }

  const [task] = await db
    .insert(gardenTasks)
    .values({
      plantId,
      rawText: body.data.rawText,
      actionType: parsed.action,
      urgency: parsed.urgency,
      createdBy: body.data.createdBy,
    })
    .returning();

  return NextResponse.json(task, { status: 201 });
}
