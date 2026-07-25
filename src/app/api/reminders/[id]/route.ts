import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reminders } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";

const updateReminderSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(["bill", "renewal", "general"]).optional(),
  dueDate: z.string().date().optional(),
  recurrenceRule: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  account: z.string().nullable().optional(),
  leadTimeDays: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, updateReminderSchema);
  if (!body.ok) return body.response;

  const [row] = await db.update(reminders).set(body.data).where(eq(reminders.id, id)).returning();
  if (!row) return jsonError("Reminder not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(reminders).where(eq(reminders.id, id));
  return new NextResponse(null, { status: 204 });
}
