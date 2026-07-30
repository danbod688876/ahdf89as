import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdTasks } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createTaskSchema = z.object({
  assetType: z.enum(["home", "vehicle"]),
  assetReference: z.string().nullable().optional(),
  action: z.string().min(1),
  dueHint: z.string().nullable().optional(),
  rawText: z.string().min(1),
  createdBy: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  const rows = await db.query.householdTasks.findMany({
    where: status === "done" ? eq(householdTasks.status, "done") : eq(householdTasks.status, "open"),
  });
  return NextResponse.json(rows);
}

// Plain manual "add task" endpoint — used both as the direct target for
// already-classified captures from the universal capture bar, and as the
// fallback when AI classification is unavailable (mirrors /api/garden/tasks).
export async function POST(request: Request) {
  const body = await parseBody(request, createTaskSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(householdTasks).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
