import { Wrench, Home, Car } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import type { MaintenanceItem } from "@/lib/db/schema";

/** Home & Vehicle only — garden's maintenance items surface inside the Garden module instead. */
export function MaintenanceModule({ items }: { items: MaintenanceItem[] }) {
  const overdue = items.filter(
    (i) => i.nextDue && differenceInCalendarDays(new Date(i.nextDue), new Date()) < 0
  );

  return (
    <ExpandableSection
      title="Home & Vehicle Maintenance"
      icon={<Wrench className="size-4" />}
      defaultOpen={overdue.length > 0}
      badge={overdue.length > 0 && <Badge tone="sand">{overdue.length} overdue</Badge>}
    >
      <ul className="space-y-2">
        {items.map((item) => {
          const daysUntil = item.nextDue
            ? differenceInCalendarDays(new Date(item.nextDue), new Date())
            : null;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-pine/5 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.assetType === "vehicle" ? (
                  <Car className="size-3.5 shrink-0 text-pine" />
                ) : (
                  <Home className="size-3.5 shrink-0 text-pine" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {item.assetName} — {item.task}
                  </p>
                  <p className="text-xs text-sage">
                    {item.lastDone
                      ? `Last done ${format(new Date(item.lastDone), "MMM d, yyyy")}`
                      : "Not logged yet"}
                  </p>
                </div>
              </div>
              {item.nextDue && (
                <Badge tone={daysUntil !== null && daysUntil < 0 ? "sand" : "sage"}>
                  {daysUntil !== null && daysUntil < 0
                    ? "overdue"
                    : `due ${format(new Date(item.nextDue), "MMM d")}`}
                </Badge>
              )}
            </li>
          );
        })}
        {items.length === 0 && <p className="text-sm text-sage">Nothing tracked yet.</p>}
      </ul>
    </ExpandableSection>
  );
}
