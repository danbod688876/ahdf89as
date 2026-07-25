import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updatePlantSchema = z.object({
  commonName: z.string().min(1).optional(),
  species: z.string().nullable().optional(),
  nicknames: z.array(z.string()).optional(),
  locationTag: z.string().nullable().optional(),
  referencePhotoUrl: z.string().url().optional(), // e.g. correcting a wrong plant ID (spec §2.7)
  isRealPhoto: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updatePlantSchema);
  if (!body.ok) return body.response;

  const [row] = await db.update(plants).set(body.data).where(eq(plants.id, id)).returning();
  if (!row) return jsonError("Plant not found", 404);
  return NextResponse.json(row);
}
