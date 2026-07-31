import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { createGardenTasksFromCapture } from "@/lib/garden";
import { IntegrationError } from "@/lib/integrations/errors";

export const maxDuration = 30;

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

  try {
    const createdTasks = await createGardenTasksFromCapture(body.data.rawText, body.data.createdBy);
    return NextResponse.json(createdTasks, { status: 201 });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError("Voice/text parsing is unavailable right now — use the manual add-task form.", 502);
    }
    throw err;
  }
}
