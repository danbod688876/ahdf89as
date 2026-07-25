import { IntegrationError } from "./errors";
import type { CalendarAccount } from "@/lib/db/schema";

type PushableEvent = {
  title: string;
  start: Date;
  end: Date;
  attendees: { email: string; name?: string }[];
};

/**
 * One-way push, not two-way sync (spec §2.6): once a plan is finalized on
 * the dashboard, create the event and send invites out to both calendars.
 * Never invoked on every dashboard interaction — only from the explicit
 * "create event & send invites" action.
 */
export async function pushCalendarInvite(
  account: Pick<CalendarAccount, "provider" | "accessToken">,
  event: PushableEvent
): Promise<{ externalId: string }> {
  if (account.provider === "google") return pushToGoogle(account.accessToken, event);
  return pushToMicrosoft(account.accessToken, event);
}

async function pushToGoogle(
  accessToken: string,
  event: PushableEvent
): Promise<{ externalId: string }> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
        attendees: event.attendees.map((a) => ({ email: a.email, displayName: a.name })),
      }),
    }
  );
  if (!res.ok) throw new IntegrationError("google-calendar", `HTTP ${res.status}`);
  const data = await res.json();
  return { externalId: data.id };
}

async function pushToMicrosoft(
  accessToken: string,
  event: PushableEvent
): Promise<{ externalId: string }> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.title,
      start: { dateTime: event.start.toISOString(), timeZone: "UTC" },
      end: { dateTime: event.end.toISOString(), timeZone: "UTC" },
      attendees: event.attendees.map((a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      })),
    }),
  });
  if (!res.ok) throw new IntegrationError("microsoft-graph", `HTTP ${res.status}`);
  const data = await res.json();
  return { externalId: data.id };
}
