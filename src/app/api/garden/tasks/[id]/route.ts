import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { gardenTasks } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateTaskSchema = z.object({
  status: z.enum(["open", "done"]).optional(),
  urgency: z.enum(["today", "this_week", "someday"]).optional(),
  plantId: z.string().uuid().nullable().optional(),
  rawText: z.string().min(1).optional(),
  detail: z.string().nullable().optional(),
  actionType: z.enum(["water", "prune", "fertilize", "watch", "other"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateTaskSchema);
  if (!body.ok) return body.response;

  const completedAt = body.data.status === "done" ? new Date() : undefined;
  const [row] = await db
    .update(gardenTasks)
    .set({ ...body.data, ...(completedAt && { completedAt }) })
    .where(eq(gardenTasks.id, id))
    .returning();
  if (!row) return jsonError("Garden task not found", 404);
  return NextResponse.json(row);
}
