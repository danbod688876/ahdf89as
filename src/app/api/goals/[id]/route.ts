import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  targetDate: z.string().date().nullable().optional(),
  status: z.enum(["not_started", "in_progress", "done"]).optional(),
  linkedEventIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateGoalSchema);
  if (!body.ok) return body.response;

  const [row] = await db.update(goals).set(body.data).where(eq(goals.id, id)).returning();
  if (!row) return jsonError("Goal not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(goals).where(eq(goals.id, id));
  return new NextResponse(null, { status: 204 });
}
