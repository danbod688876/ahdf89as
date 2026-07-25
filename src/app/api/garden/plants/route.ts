import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { plants } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createPlantSchema = z.object({
  commonName: z.string().min(1),
  species: z.string().optional(),
  nicknames: z.array(z.string()).optional(),
  locationTag: z.string().optional(),
  referencePhotoUrl: z.string().url().optional(),
  isRealPhoto: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const rows = await db.query.plants.findMany();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await parseBody(request, createPlantSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(plants).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
