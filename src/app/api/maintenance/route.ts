import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { maintenanceItems } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createMaintenanceItemSchema = z.object({
  assetType: z.enum(["home", "vehicle", "garden"]),
  assetName: z.string().min(1),
  assetRefId: z.string().uuid().optional(), // plants.id, when assetType = "garden"
  task: z.string().min(1),
  intervalDays: z.number().int().positive().optional(),
  intervalMiles: z.number().int().positive().optional(),
  lastDone: z.string().date().optional(),
  lastDoneMileage: z.number().int().optional(),
});

export async function GET() {
  const rows = await db.query.maintenanceItems.findMany({ with: { log: true } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await parseBody(request, createMaintenanceItemSchema);
  if (!body.ok) return body.response;

  const nextDue = computeNextDue(body.data.lastDone, body.data.intervalDays);
  const [row] = await db
    .insert(maintenanceItems)
    .values({ ...body.data, nextDue })
    .returning();
  return NextResponse.json(row, { status: 201 });
}

export function computeNextDue(lastDone: string | undefined, intervalDays: number | undefined) {
  if (!lastDone || !intervalDays) return undefined;
  const d = new Date(`${lastDone}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}
