import { Wrench, Home, Car } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import type { MaintenanceItem, MaintenanceLogEntry } from "@/lib/db/schema";

type ItemWithLog = MaintenanceItem & { log: MaintenanceLogEntry[] };

function lastCost(item: ItemWithLog): number | null {
  const sorted = [...item.log].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const cost = sorted[0]?.cost;
  return cost ? Number(cost) : null;
}

function totalCost(items: ItemWithLog[]): number {
  return items.reduce(
    (sum, item) => sum + item.log.reduce((s, entry) => s + (entry.cost ? Number(entry.cost) : 0), 0),
    0
  );
}

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** Home & Vehicle only — garden's maintenance items surface inside the Garden module instead. */
export function MaintenanceModule({ items }: { items: ItemWithLog[] }) {
  const overdue = items.filter(
    (i) => i.nextDue && differenceInCalendarDays(new Date(i.nextDue), new Date()) < 0
  );

  // Group by asset (e.g. each vehicle, or "Furnace") so multiple vehicles
  // each get their own task list and running total cost.
  const groups = new Map<string, ItemWithLog[]>();
  for (const item of items) {
    groups.set(item.assetName, [...(groups.get(item.assetName) ?? []), item]);
  }

  return (
    <ExpandableSection
      title="Home & Vehicle Maintenance"
      icon={<Wrench className="size-4" />}
      defaultOpen={overdue.length > 0}
      badge={overdue.length > 0 && <Badge tone="sand">{overdue.length} overdue</Badge>}
    >
      <div className="space-y-4">
        {[...groups.entries()].map(([assetName, assetItems]) => {
          const assetTotal = totalCost(assetItems);
          return (
            <div key={assetName}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sage">
                  {assetItems[0].assetType === "vehicle" ? (
                    <Car className="size-3.5" />
                  ) : (
                    <Home className="size-3.5" />
                  )}
                  {assetName}
                </p>
                {assetTotal > 0 && (
                  <span className="text-xs text-sage">{currency(assetTotal)} total</span>
                )}
              </div>
              <ul className="space-y-2">
                {assetItems.map((item) => {
                  const daysUntil = item.nextDue
                    ? differenceInCalendarDays(new Date(item.nextDue), new Date())
                    : null;
                  const cost = lastCost(item);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-pine/5 px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{item.task}</p>
                        <p className="text-xs text-sage">
                          {item.lastDone
                            ? `Last done ${format(new Date(item.lastDone), "MMM d, yyyy")}`
                            : "Not logged yet"}
                          {cost !== null && ` · ${currency(cost)}`}
                        </p>
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
              </ul>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm text-sage">Nothing tracked yet.</p>}
      </div>
    </ExpandableSection>
  );
}
