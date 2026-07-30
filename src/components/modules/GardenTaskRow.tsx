"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Droplet, Scissors, Leaf, Eye, HelpCircle, Pencil, Repeat, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { GardenTask, Plant } from "@/lib/db/schema";

const ACTION_ICON: Record<GardenTask["actionType"], typeof Droplet> = {
  water: Droplet,
  prune: Scissors,
  fertilize: Leaf,
  watch: Eye,
  other: HelpCircle,
};

type TaskWithPlant = GardenTask & { plant: Plant | null };

export function GardenTaskRow({ task }: { task: TaskWithPlant }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rawText, setRawText] = useState(task.rawText);
  const [detail, setDetail] = useState(task.detail ?? task.rawText);
  const [urgency, setUrgency] = useState(task.urgency);
  const [repeats, setRepeats] = useState(false);
  const [intervalDays, setIntervalDays] = useState(14);
  const [error, setError] = useState<string | null>(null);

  const Icon = ACTION_ICON[task.actionType];
  // Only show her original phrasing as a caption when it's genuinely
  // different from the expanded explanation — avoids redundant text for
  // manually-added tasks that never went through Claude.
  const showOriginalNote = task.detail && task.detail !== task.rawText;

  async function markDone() {
    setIsSaving(true);
    try {
      await fetch(`/api/garden/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit() {
    setIsSaving(true);
    setError(null);
    try {
      if (repeats) {
        // Recurring care rides on the existing Maintenance engine rather than
        // a garden-only recurrence system (spec §2.7 merge notes) — this
        // one-off task is replaced by a MaintenanceItem, asset_type=garden.
        const res = await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetType: "garden",
            assetName: task.plant?.commonName ?? rawText,
            assetRefId: task.plantId ?? undefined,
            task: detail || rawText,
            intervalDays,
            lastDone: new Date().toISOString().slice(0, 10),
          }),
        });
        if (!res.ok) throw new Error("Couldn't set up the recurring reminder.");
        await fetch(`/api/garden/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
      } else {
        const res = await fetch(`/api/garden/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, detail, urgency }),
        });
        if (!res.ok) throw new Error("Couldn't save changes.");
      }
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-pine/20 bg-white/70 p-3">
        <label className="block text-xs text-sage">
          What she said
          <input
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-sage/30 bg-white p-2 text-sm text-ink outline-none focus:border-pine"
          />
        </label>
        <label className="mt-2 block text-xs text-sage">
          What to actually do
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded-lg border border-sage/30 bg-white p-2 text-sm text-ink outline-none focus:border-pine"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as GardenTask["urgency"])}
            className="rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
          >
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="someday">Someday</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={repeats}
              onChange={(e) => setRepeats(e.target.checked)}
            />
            <Repeat className="size-3.5 text-pine" />
            Repeat every
          </label>
          {repeats && (
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="w-16 rounded-lg border border-sage/30 bg-white px-2 py-1 text-xs text-ink"
            />
          )}
          {repeats && <span className="text-xs text-sage">days</span>}
        </div>

        {error && <p className="mt-2 text-xs text-sand">{error}</p>}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={isSaving || !rawText.trim()}
            className="rounded-full bg-pine px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-sage"
          >
            <X className="size-3.5" /> Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg bg-pine/5 px-2.5 py-2">
      <button
        type="button"
        onClick={markDone}
        disabled={isSaving}
        aria-label="Mark done"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-pine/40 text-transparent hover:bg-pine/10 hover:text-pine"
      >
        <Check className="size-3.5" />
      </button>

      <div className="relative mt-0.5 size-9 shrink-0 overflow-hidden rounded-full bg-sage/15">
        {task.plant?.referencePhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={task.plant.referencePhotoUrl}
            alt={task.plant.commonName}
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{task.plant?.commonName ?? "Unidentified plant"}</p>
        <p className="mt-0.5 flex items-start gap-1 text-xs text-ink">
          <Icon className="mt-0.5 size-3 shrink-0 text-sage" />
          <span>{task.detail ?? task.rawText}</span>
        </p>
        {showOriginalNote && (
          <p className="mt-1 text-xs italic text-sage">&ldquo;{task.rawText}&rdquo;</p>
        )}
      </div>
      <Badge tone={task.urgency === "today" ? "sand" : task.urgency === "this_week" ? "pine" : "sage"}>
        {task.urgency.replace("_", " ")}
      </Badge>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit task"
        className="mt-0.5 text-sage hover:text-ink"
      >
        <Pencil className="size-3.5" />
      </button>
    </li>
  );
}
