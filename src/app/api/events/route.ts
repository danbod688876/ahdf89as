import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createEventSchema = z.object({
  ownerIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  attendees: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
  isHouseholdLayer: z.boolean().optional(),
});

export async function GET() {
  const rows = await db.query.events.findMany();
  return NextResponse.json(rows);
}

// Creates a dashboard-owned event. To also send calendar invites, use
// POST /api/calendar/push (§2.6) — this endpoint alone is silent, no writes
// to Google/Microsoft.
export async function POST(request: Request) {
  const body = await parseBody(request, createEventSchema);
  if (!body.ok) return body.response;

  const [row] = await db
    .insert(events)
    .values({ ...body.data, source: "dashboard" })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
