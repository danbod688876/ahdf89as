import {
  getUpcomingEvents,
  getUsers,
  getGoals,
  getReminders,
  getTrips,
  getMaintenanceItems,
  getGardenTasks,
  getPlants,
} from "@/lib/db/queries";
import { CalendarModule } from "@/components/modules/CalendarModule";
import { GoalsModule } from "@/components/modules/GoalsModule";
import { RemindersModule } from "@/components/modules/RemindersModule";
import { TripsModule } from "@/components/modules/TripsModule";
import { MaintenanceModule } from "@/components/modules/MaintenanceModule";
import { GardenModule } from "@/components/modules/GardenModule";
import { VoiceCaptureButton } from "@/components/modules/VoiceCaptureButton";
import { AuthControls } from "@/components/ui/AuthControls";
import { getWeatherForecast } from "@/lib/integrations/weather";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [events, users, goals, reminders, trips, maintenanceItems, gardenTasks, plants, weather] =
    await Promise.all([
      getUpcomingEvents(),
      getUsers(),
      getGoals(),
      getReminders(),
      getTrips(),
      getMaintenanceItems(),
      getGardenTasks("open"),
      getPlants(),
      getWeatherForecast(),
    ]);

  const homeVehicleItems = maintenanceItems.filter((i) => i.assetType !== "garden");
  const gardenRecurringItems = maintenanceItems.filter((i) => i.assetType === "garden");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-3xl text-ink">Household</p>
          <p className="text-sm text-sage">Everything you&rsquo;re both keeping track of, in one place.</p>
        </div>
        <AuthControls />
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <CalendarModule events={events} users={users} />
          <TripsModule trips={trips} />
          <MaintenanceModule items={homeVehicleItems} />
          <GardenModule
            tasks={gardenTasks}
            recurringItems={gardenRecurringItems}
            plantCount={plants.length}
            weather={weather}
          />
        </div>
        <div className="space-y-5">
          <GoalsModule goals={goals} />
          <RemindersModule reminders={reminders} />
        </div>
      </div>

      <VoiceCaptureButton />
    </main>
  );
}
