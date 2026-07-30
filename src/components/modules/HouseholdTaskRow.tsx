"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { HouseholdTask } from "@/lib/db/schema";

export function HouseholdTaskRow({ task }: { task: HouseholdTask }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const showRawText = task.rawText !== task.action;

  async function markDone() {
    setIsSaving(true);
    try {
      await fetch(`/api/household-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
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

      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          {task.assetReference ? `${task.assetReference} — ${task.action}` : task.action}
        </p>
        {showRawText && <p className="mt-1 text-xs italic text-sage">&ldquo;{task.rawText}&rdquo;</p>}
      </div>

      {task.dueHint && <Badge tone="sand">{task.dueHint}</Badge>}
    </li>
  );
}
