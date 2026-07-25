import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hotelOptions } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createHotelOptionSchema = z.object({
  name: z.string().min(1),
  price: z.string().optional(),
  link: z.string().url().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, createHotelOptionSchema);
  if (!body.ok) return body.response;

  const [row] = await db
    .insert(hotelOptions)
    .values({ ...body.data, tripId: id })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
