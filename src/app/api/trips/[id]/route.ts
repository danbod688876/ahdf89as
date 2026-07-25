import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { trips, events } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateTripSchema = z.object({
  destination: z.string().min(1).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  purpose: z.enum(["vacation", "conference_plus_vacation"]).optional(),
  status: z.enum(["requested", "approved", "booked", "confirmed"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateTripSchema);
  if (!body.ok) return body.response;

  const existing = await db.query.trips.findFirst({ where: eq(trips.id, id) });
  if (!existing) return jsonError("Trip not found", 404);

  // Reaching "approved" auto-blocks the shared calendar for those dates (spec §2.4).
  const justApproved = body.data.status === "approved" && existing.status !== "approved";
  const blocksCalendar = justApproved ? true : existing.blocksCalendar;

  const [row] = await db
    .update(trips)
    .set({ ...body.data, blocksCalendar })
    .where(eq(trips.id, id))
    .returning();

  if (justApproved) {
    const householdUsers = await db.query.users.findMany();
    await db.insert(events).values({
      source: "dashboard",
      ownerIds: householdUsers.map((u) => u.id),
      title: `Trip: ${row.destination}`,
      start: new Date(`${row.startDate}T00:00:00Z`),
      end: new Date(`${row.endDate}T23:59:59Z`),
      isHouseholdLayer: true,
    });
  }

  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(trips).where(eq(trips.id, id));
  return new NextResponse(null, { status: 204 });
}
