import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { maintenanceItems } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateMaintenanceItemSchema = z.object({
  assetName: z.string().min(1).optional(),
  task: z.string().min(1).optional(),
  intervalDays: z.number().int().positive().nullable().optional(),
  intervalMiles: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateMaintenanceItemSchema);
  if (!body.ok) return body.response;

  const [row] = await db
    .update(maintenanceItems)
    .set(body.data)
    .where(eq(maintenanceItems.id, id))
    .returning();
  if (!row) return jsonError("Maintenance item not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(maintenanceItems).where(eq(maintenanceItems.id, id));
  return new NextResponse(null, { status: 204 });
}
