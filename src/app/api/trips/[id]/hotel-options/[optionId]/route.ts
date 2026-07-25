import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { hotelOptions } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-helpers";

// Marks this hotel option "selected" and unselects any other option on the same trip.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  const { id, optionId } = await params;

  await db
    .update(hotelOptions)
    .set({ selected: false })
    .where(eq(hotelOptions.tripId, id));

  const [row] = await db
    .update(hotelOptions)
    .set({ selected: true })
    .where(and(eq(hotelOptions.id, optionId), eq(hotelOptions.tripId, id)))
    .returning();

  if (!row) return jsonError("Hotel option not found", 404);
  return NextResponse.json(row);
}
