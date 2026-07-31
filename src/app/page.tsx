import { getMaintenanceItems, getGardenTasks, getPlants } from "@/lib/db/queries";
import { GardenModule } from "@/components/modules/GardenModule";
import { VoiceCaptureButton } from "@/components/modules/VoiceCaptureButton";
import { AuthControls } from "@/components/ui/AuthControls";
import { getWeatherForecast } from "@/lib/integrations/weather";
import { reconcileGardenSchedule } from "@/lib/garden";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Surfaces whatever this season's care plans call for and weather-adjusts
  // due watering items before reading anything back, so the load below
  // always reflects the current state rather than yesterday's.
  await reconcileGardenSchedule();

  const [maintenanceItems, gardenTasks, plants, weather] = await Promise.all([
    getMaintenanceItems(),
    getGardenTasks("open"),
    getPlants(),
    getWeatherForecast(),
  ]);

  const gardenRecurringItems = maintenanceItems.filter((i) => i.assetType === "garden");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-3xl text-ink">Pig Manor</p>
          <p className="text-sm text-sage">Reducing the pig family mental load</p>
        </div>
        <AuthControls />
      </header>

      <GardenModule
        tasks={gardenTasks}
        recurringItems={gardenRecurringItems}
        plants={plants}
        weather={weather}
      />

      <VoiceCaptureButton />
    </main>
  );
}
