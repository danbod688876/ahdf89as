import { Wrench, Home, Car } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import { currency } from "@/lib/utils";
import { AddMaintenanceItemButton } from "./AddMaintenanceItemButton";
import { CaptureBar } from "./CaptureBar";
import { HouseholdTaskRow } from "./HouseholdTaskRow";
import { MaintenanceItemRow, type ItemWithLog } from "./MaintenanceItemRow";
import type { HouseholdTask } from "@/lib/db/schema";

function totalCost(items: ItemWithLog[]): number {
  return items.reduce(
    (sum, item) => sum + item.log.reduce((s, entry) => s + (entry.cost ? Number(entry.cost) : 0), 0),
    0
  );
}

/** Home & Vehicle only — garden's maintenance items surface inside the Garden module instead. */
export function MaintenanceModule({
  items,
  householdTasks,
}: {
  items: ItemWithLog[];
  householdTasks: HouseholdTask[];
}) {
  const overdue = items.filter(
    (i) => i.nextDue && differenceInCalendarDays(new Date(i.nextDue), new Date()) < 0
  );
  const homeTasks = householdTasks.filter((t) => t.assetType === "home");
  const vehicleTasks = householdTasks.filter((t) => t.assetType === "vehicle");

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
      <div className="mb-3 flex justify-end">
        <AddMaintenanceItemButton />
      </div>

      <div className="mb-4 space-y-2">
        <CaptureBar moduleHint="home" />
        <CaptureBar moduleHint="vehicle" />
      </div>

      {(homeTasks.length > 0 || vehicleTasks.length > 0) && (
        <div className="mb-4 space-y-3">
          {homeTasks.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sage">
                <Home className="size-3.5" /> Home tasks
              </p>
              <ul className="space-y-1.5">
                {homeTasks.map((t) => (
                  <HouseholdTaskRow key={t.id} task={t} />
                ))}
              </ul>
            </div>
          )}
          {vehicleTasks.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sage">
                <Car className="size-3.5" /> Vehicle tasks
              </p>
              <ul className="space-y-1.5">
                {vehicleTasks.map((t) => (
                  <HouseholdTaskRow key={t.id} task={t} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
              <ul className="space-y-1.5">
                {assetItems.map((item) => (
                  <MaintenanceItemRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          );
        })}
        {items.length === 0 && homeTasks.length === 0 && vehicleTasks.length === 0 && (
          <p className="text-sm text-sage">Nothing tracked yet.</p>
        )}
      </div>
    </ExpandableSection>
  );
}
