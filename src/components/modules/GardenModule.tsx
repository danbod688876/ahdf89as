import { Sprout, Droplet, Scissors, Leaf, Eye, HelpCircle } from "lucide-react";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { GardenTask, Plant } from "@/lib/db/schema";

const ACTION_ICON: Record<GardenTask["actionType"], typeof Droplet> = {
  water: Droplet,
  prune: Scissors,
  fertilize: Leaf,
  watch: Eye,
  other: HelpCircle,
};

function TaskRow({ task }: { task: GardenTask & { plant: Plant | null } }) {
  const Icon = ACTION_ICON[task.actionType];
  return (
    <li className="flex items-center gap-3 rounded-lg bg-pine/5 px-2.5 py-2">
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-sage/15">
        {task.plant?.referencePhotoUrl && (
          // Reference photos come from third-party plant APIs / user uploads with
          // unpredictable hosts, so next/image's remote-pattern allowlist isn't a
          // fit here — a plain <img> renders any origin without config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={task.plant.referencePhotoUrl}
            alt={task.plant.commonName}
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          {task.plant?.commonName ?? "Unidentified plant"}
        </p>
        <p className="flex items-center gap-1 text-xs text-sage">
          <Icon className="size-3" /> {task.rawText}
        </p>
      </div>
      <Badge tone={task.urgency === "today" ? "sand" : task.urgency === "this_week" ? "pine" : "sage"}>
        {task.urgency.replace("_", " ")}
      </Badge>
    </li>
  );
}

export function GardenModule({
  tasks,
  plantCount,
}: {
  tasks: (GardenTask & { plant: Plant | null })[];
  plantCount: number;
}) {
  const todayTasks = tasks.filter((t) => t.urgency === "today");

  return (
    <div className="relative">
      <ExpandableSection
        title="Garden"
        icon={<Sprout className="size-4" />}
        defaultOpen={todayTasks.length > 0}
        badge={
          todayTasks.length > 0 ? (
            <Badge tone="sand">{todayTasks.length} today</Badge>
          ) : (
            <Badge tone="sage">{plantCount} plants</Badge>
          )
        }
      >
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-sage">No open garden tasks — inventory has {plantCount} plants.</p>
          )}
        </ul>
      </ExpandableSection>
    </div>
  );
}

/**
 * Persistent, low-friction capture entry point — she's often outside with
 * hands full, so voice capture can't be buried a level deep (spec §5).
 * Fixed to the viewport, independent of the Garden module's expand state.
 */
export function VoiceCaptureButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-pine px-5 py-3.5",
        "text-sm font-medium text-white shadow-lg shadow-pine/25 transition-transform hover:scale-105",
        className
      )}
      aria-label="Capture a garden task by voice"
    >
      <Sprout className="size-4" />
      Tell the garden
    </button>
  );
}
