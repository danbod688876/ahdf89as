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
import { GardenModule, VoiceCaptureButton } from "@/components/modules/GardenModule";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [events, users, goals, reminders, trips, maintenanceItems, gardenTasks, plants] =
    await Promise.all([
      getUpcomingEvents(),
      getUsers(),
      getGoals(),
      getReminders(),
      getTrips(),
      getMaintenanceItems(),
      getGardenTasks("open"),
      getPlants(),
    ]);

  const homeVehicleItems = maintenanceItems.filter((i) => i.assetType !== "garden");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <header className="mb-6">
        <p className="font-serif text-3xl text-ink">Household</p>
        <p className="text-sm text-sage">Everything you&rsquo;re both keeping track of, in one place.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <CalendarModule events={events} users={users} />
          <TripsModule trips={trips} />
          <MaintenanceModule items={homeVehicleItems} />
          <GardenModule tasks={gardenTasks} plantCount={plants.length} />
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
