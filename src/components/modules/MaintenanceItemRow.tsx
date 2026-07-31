"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, X } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { cn, currency, plantIdentityLine } from "@/lib/utils";
import { PlantThumbnail } from "./PlantThumbnail";
import type { MaintenanceItem, MaintenanceLogEntry, Plant } from "@/lib/db/schema";

export type ItemWithLog = MaintenanceItem & { log: MaintenanceLogEntry[]; plant?: Plant | null };

function lastCost(item: ItemWithLog): number | null {
  const sorted = [...item.log].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const cost = sorted[0]?.cost;
  return cost ? Number(cost) : null;
}

export function MaintenanceItemRow({ item }: { item: ItemWithLog }) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [task, setTask] = useState(item.task);
  const [intervalDays, setIntervalDays] = useState(item.intervalDays ?? 90);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logMileage, setLogMileage] = useState("");
  const [logCost, setLogCost] = useState("");
  const [logNote, setLogNote] = useState("");

  const daysUntil = item.nextDue
    ? differenceInCalendarDays(new Date(item.nextDue), new Date())
    : null;
  const cost = lastCost(item);
  const history = [...item.log].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const showMileage = item.assetType === "vehicle";
  // Garden reminders are just "did I do it" — no cost/note tracking, unlike
  // vehicle service or home repairs.
  const showCostAndNote = item.assetType !== "garden";
  const logFieldCount = 1 + (showMileage ? 1 : 0) + (showCostAndNote ? 2 : 0);
  const isGardenItem = item.assetType === "garden";
  const identityLine = isGardenItem ? plantIdentityLine(item.plant) : null;

  async function saveItem() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/maintenance/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, intervalDays }),
      });
      if (!res.ok) throw new Error("Couldn't save changes.");
      setIsEditingItem(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function logService() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/maintenance/${item.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedAt: logDate,
          mileageAt: logMileage ? Number(logMileage) : undefined,
          cost: logCost ? logCost : undefined,
          note: logNote || undefined,
        }),
      });
      if (!res.ok) throw new Error("Couldn't log this service.");
      setLogMileage("");
      setLogCost("");
      setLogNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <li className="rounded-lg bg-pine/5">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          {isGardenItem && <PlantThumbnail plant={item.plant} />}
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{item.task}</p>
            {identityLine && <p className="truncate text-xs italic text-sage">{identityLine}</p>}
            <p className="text-xs text-sage">
              {item.lastDone
                ? `Last done ${format(new Date(item.lastDone), "MMM d, yyyy")}`
                : "Not logged yet"}
              {showCostAndNote && cost !== null && ` · ${currency(cost)}`}
            </p>
            {item.weatherNote && <p className="text-xs italic text-sage">☔ {item.weatherNote}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.nextDue && (
            <Badge tone={daysUntil !== null && daysUntil < 0 ? "sand" : "sage"}>
              {daysUntil !== null && daysUntil < 0
                ? "overdue"
                : `due ${format(new Date(item.nextDue), "MMM d")}`}
            </Badge>
          )}
          <ChevronDown className={cn("size-3.5 text-sage transition-transform", isExpanded && "rotate-180")} />
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-pine/10 px-2.5 py-3">
          {/* Item details / edit */}
          {isEditingItem ? (
            <div className="space-y-2">
              <input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="w-full rounded-lg border border-sage/30 bg-white p-2 text-sm text-ink outline-none focus:border-pine"
              />
              <label className="flex items-center gap-2 text-xs text-ink">
                Remind every
                <input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="w-16 rounded-lg border border-sage/30 bg-white px-2 py-1"
                />
                days
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveItem}
                  disabled={isSaving || !task.trim()}
                  className="rounded-full bg-pine px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingItem(false)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-sage"
                >
                  <X className="size-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingItem(true)}
              className="flex items-center gap-1 text-xs text-sage hover:text-ink"
            >
              <Pencil className="size-3" /> Edit task / reminder interval
            </button>
          )}

          {/* Log a service */}
          <div className="rounded-lg border border-sage/20 bg-white/60 p-2.5">
            <p className="text-xs font-medium text-ink">Log a completion</p>
            <div
              className={cn(
                "mt-1.5 grid grid-cols-2 gap-1.5",
                logFieldCount >= 4 ? "sm:grid-cols-4" : logFieldCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
              )}
            >
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
              />
              {showMileage && (
                <input
                  type="number"
                  placeholder="Mileage"
                  value={logMileage}
                  onChange={(e) => setLogMileage(e.target.value)}
                  className="rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
                />
              )}
              {showCostAndNote && (
                <>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Cost $"
                    value={logCost}
                    onChange={(e) => setLogCost(e.target.value)}
                    className="rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
                  />
                  <input
                    placeholder="Note (optional)"
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    className="rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
                  />
                </>
              )}
            </div>
            <button
              type="button"
              onClick={logService}
              disabled={isSaving}
              className="mt-2 rounded-full bg-pine px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Log completion"}
            </button>
          </div>

          {error && <p className="text-xs text-sand">{error}</p>}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink">History</p>
              <ul className="mt-1 space-y-1">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-xs text-sage">
                    <span>
                      {format(new Date(entry.completedAt), "MMM d, yyyy")}
                      {entry.mileageAt != null && ` · ${entry.mileageAt.toLocaleString()} mi`}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                    {entry.cost && <span>{currency(Number(entry.cost))}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
