import { CalendarDays, AlertTriangle } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Event, User } from "@/lib/db/schema";

const OWNER_DOT: Record<"single-you" | "single-her" | "shared", string> = {
  "single-you": "bg-pine",
  "single-her": "bg-sand",
  shared: "bg-ink",
};

function ownerKind(ownerIds: string[], users: User[]): keyof typeof OWNER_DOT {
  if (ownerIds.length !== 1) return "shared";
  const idx = users.findIndex((u) => u.id === ownerIds[0]);
  return idx === 0 ? "single-you" : "single-her";
}

/** Two events overlap and belong to different single owners, or either owner has two overlapping events. */
function findConflicts(list: Event[]): Set<string> {
  const conflicted = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const overlaps = a.start < b.end && b.start < a.end;
      if (!overlaps) continue;
      const sharesOwner = a.ownerIds.some((id) => b.ownerIds.includes(id));
      if (sharesOwner || (a.ownerIds.length === 1 && b.ownerIds.length === 1)) {
        conflicted.add(a.id);
        conflicted.add(b.id);
      }
    }
  }
  return conflicted;
}

export function CalendarModule({ events, users }: { events: Event[]; users: User[] }) {
  const conflicts = findConflicts(events);
  const byDay = new Map<string, Event[]>();
  for (const e of events) {
    const key = format(e.start, "yyyy-MM-dd");
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 7);

  return (
    <ModuleCard title="Calendar" icon={<CalendarDays className="size-5" />} size="primary">
      {days.length === 0 && (
        <p className="text-sm text-sage">Nothing on the merged calendar yet.</p>
      )}
      <div className="space-y-4">
        {days.map(([dayKey, dayEvents]) => (
          <div key={dayKey}>
            <p className="text-xs font-medium uppercase tracking-wide text-sage">
              {format(new Date(dayKey), "EEEE, MMM d")}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {dayEvents.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                    conflicts.has(e.id) ? "bg-sand/15" : "bg-pine/5"
                  )}
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", OWNER_DOT[ownerKind(e.ownerIds, users)])}
                  />
                  <span className="flex-1 truncate text-ink">{e.title}</span>
                  <span className="shrink-0 text-xs text-sage">
                    {isSameDay(e.start, e.end) ? format(e.start, "h:mm a") : "multi-day"}
                  </span>
                  {conflicts.has(e.id) && (
                    <Badge tone="sand" className="flex items-center gap-1">
                      <AlertTriangle className="size-3" /> conflict
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}
