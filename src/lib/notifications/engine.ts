import { differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";

export type PendingNotification = {
  module: "reminder" | "maintenance" | "goal";
  id: string;
  title: string;
  dueDate: string;
  daysUntilDue: number;
};

/**
 * Unified due-date/notification engine (spec §2.3, §4.5): the single place
 * "something is due" is computed for Reminders, Maintenance (home/vehicle/
 * garden), and goals nearing their target date, instead of each module
 * reinventing its own lead-time logic.
 */
export async function getPendingNotifications(): Promise<PendingNotification[]> {
  const [reminders, maintenanceItems, goals] = await Promise.all([
    db.query.reminders.findMany(),
    db.query.maintenanceItems.findMany(),
    db.query.goals.findMany(),
  ]);

  const notifications: PendingNotification[] = [];

  for (const r of reminders) {
    const daysUntilDue = differenceInCalendarDays(new Date(r.dueDate), new Date());
    if (daysUntilDue <= r.leadTimeDays) {
      notifications.push({
        module: "reminder",
        id: r.id,
        title: r.title,
        dueDate: r.dueDate,
        daysUntilDue,
      });
    }
  }

  const MAINTENANCE_LEAD_DAYS = 7;
  for (const m of maintenanceItems) {
    if (!m.nextDue) continue;
    const daysUntilDue = differenceInCalendarDays(new Date(m.nextDue), new Date());
    if (daysUntilDue <= MAINTENANCE_LEAD_DAYS) {
      notifications.push({
        module: "maintenance",
        id: m.id,
        title: `${m.assetName} — ${m.task}`,
        dueDate: m.nextDue,
        daysUntilDue,
      });
    }
  }

  const GOAL_LEAD_DAYS = 30;
  for (const g of goals) {
    if (!g.targetDate || g.status === "done") continue;
    const daysUntilDue = differenceInCalendarDays(new Date(g.targetDate), new Date());
    if (daysUntilDue <= GOAL_LEAD_DAYS) {
      notifications.push({
        module: "goal",
        id: g.id,
        title: g.title,
        dueDate: g.targetDate,
        daysUntilDue,
      });
    }
  }

  return notifications.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
