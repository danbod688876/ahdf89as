import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createTripSchema = z.object({
  destination: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date(),
  purpose: z.enum(["vacation", "conference_plus_vacation"]).default("vacation"),
});

export async function GET() {
  const rows = await db.query.trips.findMany({ with: { hotelOptions: true } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await parseBody(request, createTripSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(trips).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
