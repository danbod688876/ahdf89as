import { Bell, Receipt } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/lib/db/schema";

export function RemindersModule({ reminders }: { reminders: Reminder[] }) {
  const sorted = [...reminders].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <ModuleCard title="Reminders" icon={<Bell className="size-5" />} size="compact">
      <ul className="space-y-2">
        {sorted.map((r) => {
          const daysOut = differenceInCalendarDays(new Date(r.dueDate), new Date());
          const isDueSoon = daysOut <= r.leadTimeDays;
          const isBill = r.category === "bill" || r.category === "renewal";
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-start gap-2 rounded-lg px-2.5 py-1.5",
                isBill ? "bg-sand/10 border border-sand/30" : "bg-pine/5"
              )}
            >
              {isBill ? (
                <Receipt className="mt-0.5 size-3.5 shrink-0 text-sand" />
              ) : (
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pine" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{r.title}</p>
                <p className="text-xs text-sage">
                  {format(new Date(r.dueDate), "MMM d")}
                  {r.amount && <> · ${r.amount}</>}
                  {r.account && <> · {r.account}</>}
                </p>
              </div>
              {isDueSoon && (
                <Badge tone={isBill ? "sand" : "pine"}>
                  {daysOut <= 0 ? "due" : `${daysOut}d`}
                </Badge>
              )}
            </li>
          );
        })}
        {sorted.length === 0 && <p className="text-sm text-sage">Nothing upcoming.</p>}
      </ul>
    </ModuleCard>
  );
}
