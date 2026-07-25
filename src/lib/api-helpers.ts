import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>) {
  const raw = await request.json().catch(() => null);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false as const, response: jsonError(result.error.issues[0]?.message ?? "Invalid request body") };
  }
  return { ok: true as const, data: result.data };
}
