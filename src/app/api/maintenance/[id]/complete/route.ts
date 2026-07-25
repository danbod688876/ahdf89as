import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { maintenanceItems, maintenanceLog } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { computeNextDue } from "@/app/api/maintenance/route";

const completeSchema = z.object({
  completedAt: z.string().date(),
  mileageAt: z.number().int().optional(),
  note: z.string().optional(),
});

// Logs a completion and recalculates next-due from the item's interval,
// so "next due" is always derived rather than manually rescheduled (spec §2.5).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, completeSchema);
  if (!body.ok) return body.response;

  const item = await db.query.maintenanceItems.findFirst({ where: eq(maintenanceItems.id, id) });
  if (!item) return jsonError("Maintenance item not found", 404);

  await db.insert(maintenanceLog).values({ maintenanceItemId: id, ...body.data });

  const [updated] = await db
    .update(maintenanceItems)
    .set({
      lastDone: body.data.completedAt,
      lastDoneMileage: body.data.mileageAt,
      nextDue: computeNextDue(body.data.completedAt, item.intervalDays ?? undefined),
    })
    .where(eq(maintenanceItems.id, id))
    .returning();

  return NextResponse.json(updated);
}
