import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { classifyCapture } from "@/lib/integrations/claude";
import { IntegrationError } from "@/lib/integrations/errors";

const previewRequestSchema = z.object({
  rawText: z.string().min(1),
  moduleHint: z.enum(["garden", "home", "vehicle"]).optional(),
});

/**
 * Dry-run only — no DB writes. Used by CaptureBar to pre-fill and
 * pre-toggle the Recurring control while the user is still typing, so
 * they only ever confirm/nudge a guess instead of building one from
 * scratch. The actual submit goes to POST /api/capture instead.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, previewRequestSchema);
  if (!body.ok) return body.response;

  try {
    const classification = await classifyCapture(body.data.rawText, body.data.moduleHint);
    return NextResponse.json(classification);
  } catch (err) {
    if (err instanceof IntegrationError) return jsonError("Preview unavailable", 502);
    throw err;
  }
}
