import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { reminders } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createReminderSchema = z.object({
  ownerIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  category: z.enum(["bill", "renewal", "general"]).default("general"),
  dueDate: z.string().date(),
  recurrenceRule: z.string().optional(),
  amount: z.string().optional(), // numeric columns come back/in as strings
  account: z.string().optional(),
  leadTimeDays: z.number().int().min(0).default(7),
});

export async function GET() {
  const rows = await db.query.reminders.findMany();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await parseBody(request, createReminderSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(reminders).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
