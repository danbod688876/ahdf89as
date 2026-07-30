"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export function AddMaintenanceItemButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [assetType, setAssetType] = useState<"home" | "vehicle">("vehicle");
  const [assetName, setAssetName] = useState("");
  const [task, setTask] = useState("");
  const [intervalDays, setIntervalDays] = useState(180);
  const [lastDone, setLastDone] = useState("");
  const [lastDoneMileage, setLastDoneMileage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!assetName.trim() || !task.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType,
          assetName,
          task,
          intervalDays,
          lastDone: lastDone || undefined,
          lastDoneMileage: lastDoneMileage ? Number(lastDoneMileage) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Couldn't add this item.");
      setAssetName("");
      setTask("");
      setLastDone("");
      setLastDoneMileage("");
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="flex items-center gap-1 rounded-full bg-pine/10 px-3 py-1 text-xs font-medium text-pine hover:bg-pine/15"
      >
        <Plus className="size-3.5" /> Add
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-mist p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Add maintenance item</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="text-sage hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex gap-2">
                {(["vehicle", "home"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAssetType(t)}
                    className={`rounded-full px-3 py-1 text-xs capitalize ${
                      assetType === t ? "bg-pine text-white" : "bg-pine/10 text-pine"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder={assetType === "vehicle" ? "e.g. Subaru Forester" : "e.g. Furnace"}
                className="w-full rounded-xl border border-sage/30 bg-white/70 p-2.5 text-sm text-ink outline-none focus:border-pine"
              />
              <input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Task, e.g. Oil change"
                className="w-full rounded-xl border border-sage/30 bg-white/70 p-2.5 text-sm text-ink outline-none focus:border-pine"
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

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-sage">
                  Last done (optional)
                  <input
                    type="date"
                    value={lastDone}
                    onChange={(e) => setLastDone(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
                  />
                </label>
                {assetType === "vehicle" && (
                  <label className="text-xs text-sage">
                    Mileage (optional)
                    <input
                      type="number"
                      value={lastDoneMileage}
                      onChange={(e) => setLastDoneMileage(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
                    />
                  </label>
                )}
              </div>
            </div>

            {error && <p className="mt-2 text-sm text-sand">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !assetName.trim() || !task.trim()}
              className="mt-4 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Add item"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
