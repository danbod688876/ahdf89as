import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, calendarAccounts } from "@/lib/db/schema";
import { parseBody, jsonError } from "@/lib/api-helpers";
import { pushCalendarInvite } from "@/lib/integrations/calendar";
import { IntegrationError } from "@/lib/integrations/errors";

const pushRequestSchema = z.object({
  accountId: z.string().uuid(), // which connected calendar account creates + sends the invite
  ownerIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  attendees: z.array(z.object({ email: z.string().email(), name: z.string().optional() })),
  isHouseholdLayer: z.boolean().optional(),
});

/**
 * The one explicit "create event & send invites" action (spec §2.6) — the
 * only place write scopes get used. One-way push: the dashboard creates the
 * event on the acting account's calendar and the provider's own invite
 * delivery (standard iCalendar under the hood) reaches every attendee,
 * cross-platform, without a two-way sync.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, pushRequestSchema);
  if (!body.ok) return body.response;

  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.id, body.data.accountId),
  });
  if (!account) return jsonError("Calendar account not found", 404);

  let externalId: string;
  try {
    const result = await pushCalendarInvite(account, {
      title: body.data.title,
      start: body.data.start,
      end: body.data.end,
      attendees: body.data.attendees,
    });
    externalId = result.externalId;
  } catch (err) {
    if (err instanceof IntegrationError) {
      return jsonError(`Could not send calendar invite (${err.message}).`, 502);
    }
    throw err;
  }

  const [row] = await db
    .insert(events)
    .values({
      source: account.provider === "google" ? "gmail" : "outlook",
      externalId,
      ownerIds: body.data.ownerIds,
      title: body.data.title,
      start: body.data.start,
      end: body.data.end,
      attendees: body.data.attendees,
      isHouseholdLayer: body.data.isHouseholdLayer,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
