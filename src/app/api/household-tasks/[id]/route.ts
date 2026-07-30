import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdTasks } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateTaskSchema = z.object({
  status: z.enum(["open", "done"]).optional(),
  action: z.string().min(1).optional(),
  assetReference: z.string().nullable().optional(),
  dueHint: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateTaskSchema);
  if (!body.ok) return body.response;

  const completedAt = body.data.status === "done" ? new Date() : undefined;
  const [row] = await db
    .update(householdTasks)
    .set({ ...body.data, ...(completedAt && { completedAt }) })
    .where(eq(householdTasks.id, id))
    .returning();
  if (!row) return jsonError("Household task not found", 404);
  return NextResponse.json(row);
}
