import { Target } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ModuleCard } from "@/components/ui/ModuleCard";
import { Badge } from "@/components/ui/Badge";
import type { Goal } from "@/lib/db/schema";

const STATUS_LABEL: Record<Goal["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export function GoalsModule({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status !== "done");
  const nearingThisMonth = active.filter(
    (g) => g.targetDate && differenceInCalendarDays(new Date(g.targetDate), new Date()) <= 31
  );

  return (
    <ModuleCard title="Goals" icon={<Target className="size-5" />} size="compact">
      {nearingThisMonth.length > 0 && (
        <div className="mb-3 rounded-lg bg-sand/15 px-3 py-2">
          <p className="text-xs font-medium text-ink">This month</p>
          <ul className="mt-1 space-y-0.5">
            {nearingThisMonth.map((g) => (
              <li key={g.id} className="text-sm text-ink">
                {g.title}
                {g.targetDate && (
                  <span className="ml-1.5 text-xs text-sage">
                    {format(new Date(g.targetDate), "MMM d")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-2">
        {active.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-ink">{g.title}</span>
            <Badge tone={g.status === "in_progress" ? "pine" : "sage"}>
              {STATUS_LABEL[g.status]}
            </Badge>
          </li>
        ))}
        {active.length === 0 && <p className="text-sm text-sage">No open goals.</p>}
      </ul>
    </ModuleCard>
  );
}
