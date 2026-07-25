import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createGoalSchema = z.object({
  ownerIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  targetDate: z.string().date().optional(),
  linkedEventIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const rows = await db.query.goals.findMany();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await parseBody(request, createGoalSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(goals).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
