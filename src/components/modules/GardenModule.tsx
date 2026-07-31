import { Sprout } from "lucide-react";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { Badge } from "@/components/ui/Badge";
import { CaptureBar } from "./CaptureBar";
import { GardenTaskRow } from "./GardenTaskRow";
import { PhotoCaptureButton } from "./PhotoCaptureButton";
import { PlantLibrary } from "./PlantLibrary";
import { MaintenanceItemRow, type ItemWithLog } from "./MaintenanceItemRow";
import { WeatherWidget } from "./WeatherWidget";
import type { GardenTask, Plant } from "@/lib/db/schema";
import type { WeatherSummary } from "@/lib/integrations/weather";

export function GardenModule({
  tasks,
  recurringItems,
  plants,
  weather,
}: {
  tasks: (GardenTask & { plant: Plant | null })[];
  recurringItems: ItemWithLog[];
  plants: Plant[];
  weather: WeatherSummary | null;
}) {
  const todayTasks = tasks.filter((t) => t.urgency === "today");

  return (
    <div className="relative">
      <ExpandableSection
        title="Garden"
        icon={<Sprout className="size-4" />}
        defaultOpen
        badge={
          todayTasks.length > 0 ? (
            <Badge tone="sand">{todayTasks.length} today</Badge>
          ) : (
            <Badge tone="sage">{plants.length} plants</Badge>
          )
        }
      >
        <CaptureBar moduleHint="garden" />
        <div className="mb-3 flex justify-end">
          <PhotoCaptureButton />
        </div>
        <WeatherWidget weather={weather} />

        <ul className="space-y-2">
          {tasks.map((t) => (
            <GardenTaskRow key={t.id} task={t} />
          ))}
          {tasks.length === 0 && recurringItems.length === 0 && (
            <p className="text-sm text-sage">No open garden tasks — inventory has {plants.length} plants.</p>
          )}
        </ul>

        {recurringItems.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sage">
              Recurring care
            </p>
            <ul className="space-y-1.5">
              {recurringItems.map((item) => (
                <MaintenanceItemRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sage">
            Plant library
          </p>
          <PlantLibrary plants={plants} />
        </div>
      </ExpandableSection>
    </div>
  );
}
