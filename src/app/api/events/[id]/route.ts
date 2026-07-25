import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  attendees: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateEventSchema);
  if (!body.ok) return body.response;

  const [row] = await db.update(events).set(body.data).where(eq(events.id, id)).returning();
  if (!row) return jsonError("Event not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(events).where(eq(events.id, id));
  return new NextResponse(null, { status: 204 });
}
