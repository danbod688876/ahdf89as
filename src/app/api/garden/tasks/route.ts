import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { gardenTasks } from "@/lib/db/schema";
import { parseBody } from "@/lib/api-helpers";

const createTaskSchema = z.object({
  plantId: z.string().uuid().optional(),
  rawText: z.string().min(1),
  actionType: z.enum(["water", "prune", "fertilize", "watch", "other"]).default("other"),
  urgency: z.enum(["today", "this_week", "someday"]).default("someday"),
  createdBy: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  const rows = await db.query.gardenTasks.findMany({
    where: status === "done" ? eq(gardenTasks.status, "done") : eq(gardenTasks.status, "open"),
    with: { plant: true },
  });
  return NextResponse.json(rows);
}

// Plain manual "add task" form — the fallback path when voice/photo capture
// (POST /api/garden/capture, /api/garden/photo) isn't available or fails (spec §4.6).
export async function POST(request: Request) {
  const body = await parseBody(request, createTaskSchema);
  if (!body.ok) return body.response;

  const [row] = await db.insert(gardenTasks).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
